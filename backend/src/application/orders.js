const { Order, Receipt, User } = require("../infrastructure/models");
const { entity } = require("../infrastructure/transaction");
const {
  fail,
  owner,
  safeMoney,
  periodId,
  bounds,
} = require("../domain/policy");
const { openPeriod, incomplete, invalidateDownstream } = require("./periods");
const { movement, getProduct } = require("./inventory-shared");
const scoped = (actor) =>
  actor.role === "ADMIN" ? {} : { memberId: actor.id };
function normalizeItems(items) {
  const map = new Map();
  for (const item of items)
    map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }));
}
async function reserveItems(items, oldItems, session) {
  const next = normalizeItems(items),
    old = new Map(oldItems.map((i) => [String(i.productId), i]));
  const quantitiesById = new Map(next.map((i) => [i.productId, i.quantity]));
  const ids = [...new Set([...old.keys(), ...quantitiesById.keys()])].sort();
  const snapshots = [];
  for (const id of ids) {
    const p = await getProduct(id, session),
      count = quantitiesById.get(id) || 0,
      delta = count - (old.get(id)?.quantity || 0);
    if (count && !p.active) fail(409, "PRODUCT_ARCHIVED", "Sản phẩm ngừng cấp");
    if (delta > p.onHand - p.damagedOnHand - p.reserved)
      fail(409, "INSUFFICIENT_STOCK", `Không đủ hàng: ${p.name}`);
    p.reserved += delta;
    await p.save({ session });
    if (count)
      snapshots.push({
        productId: p.id,
        productName: p.name,
        quantity: count,
        receivedQuantity: 0,
        price: old.get(id)?.price ?? p.price,
        unitCost: old.has(id) ? old.get(id).unitCost : p.unitCost,
      });
  }
  return snapshots;
}
async function createOrder(input, actor, session) {
  const items = await reserveItems(input.items, [], session);
  const order = (
    await Order.create(
      [
        {
          memberId: actor.id,
          memberName: actor.name,
          intendedPeriodId: input.intendedPeriodId,
          items,
          totalAmount: safeMoney(
            items.reduce((s, i) => safeMoney(s + i.quantity * i.price), 0),
          ),
        },
      ],
      { session },
    )
  )[0];
  return entity(order);
}
async function amendOrder(id, input, actor, session) {
  const order = await Order.findById(id).session(session);
  if (!order?.memberId)
    fail(404, "NOT_FOUND", "Không tìm thấy đơn hoặc cần migrate");
  owner(actor, order.memberId);
  if (
    order.version !== input.version ||
    !["PENDING", "APPROVED"].includes(order.status)
  )
    fail(
      409,
      "STATE_CONFLICT",
      "Đơn đã đổi hoặc đã nhận hàng; tạo yêu cầu bổ sung",
    );
  order.items = await reserveItems(input.items, order.items, session);
  order.totalAmount = safeMoney(
    order.items.reduce((s, i) => safeMoney(s + i.quantity * i.price), 0),
  );
  order.version++;
  await order.save({ session });
  return entity(order);
}
async function orderStatus(id, input, actor, session) {
  const order = await Order.findById(id).session(session);
  if (!order?.memberId)
    fail(404, "NOT_FOUND", "Không tìm thấy đơn hoặc cần migrate");
  owner(actor, order.memberId);
  if (order.version !== input.version)
    fail(409, "STATE_CONFLICT", "Đơn đã thay đổi");
  if (
    input.status === "APPROVED" &&
    actor.role === "ADMIN" &&
    order.status === "PENDING"
  )
    order.status = "APPROVED";
  else if (
    ["REJECTED", "CANCELLED"].includes(input.status) &&
    ["PENDING", "APPROVED", "PARTIALLY_RECEIVED"].includes(order.status)
  ) {
    if (
      input.status === "REJECTED" &&
      (actor.role !== "ADMIN" || order.status !== "PENDING")
    )
      fail(409, "STATE_CONFLICT", "Không thể từ chối trạng thái này");
    for (const item of order.items) {
      const p = await getProduct(item.productId, session);
      p.reserved -= item.quantity - item.receivedQuantity;
      await p.save({ session });
    }
    order.status = input.status;
  } else fail(409, "STATE_CONFLICT", "Chuyển trạng thái không hợp lệ");
  order.version++;
  await order.save({ session });
  return entity(order);
}
async function receiveOrder(id, input, actor, session) {
  const order = await Order.findById(id).session(session);
  if (!order?.memberId)
    fail(404, "NOT_FOUND", "Không tìm thấy đơn hoặc cần migrate");
  owner(actor, order.memberId);
  if (
    !["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status) ||
    order.version !== input.version
  )
    fail(409, "STATE_CONFLICT", "Đơn chưa duyệt hoặc đã thay đổi");
  const key = periodId(input.effectiveAt);
  const member = await User.findOneAndUpdate(
    { _id: order.memberId },
    { $inc: { inventoryRevision: 1 } },
    { session },
  );
  if (
    !member?.createdAt ||
    +new Date(input.effectiveAt) < +bounds(periodId(member.createdAt)).start
  )
    fail(
      400,
      "BEFORE_MEMBER_JOIN",
      "Tuần nhận không được trước tuần thành viên tham gia; lịch sử cũ cần chuyển đổi có đối soát",
    );
  await openPeriod(key, session);
  await invalidateDownstream(order.memberId, key, session);
  const receipts = [];
  for (const received of normalizeItems(input.items)) {
    const line = order.items.find(
      (i) => String(i.productId) === received.productId,
    );
    if (!line || received.quantity > line.quantity - line.receivedQuantity)
      fail(409, "RECEIPT_EXCEEDS_ORDER", "Nhận vượt phần còn lại của đơn");
    const p = await getProduct(line.productId, session);
    p.onHand -= received.quantity;
    p.reserved -= received.quantity;
    await p.save({ session });
    const lot = (
      await Receipt.create(
        [
          {
            orderId: order.id,
            memberId: order.memberId,
            productId: p.id,
            productName: line.productName,
            quantity: received.quantity,
            price: line.price,
            unitCost: line.unitCost,
            effectiveAt: input.effectiveAt,
          },
        ],
        { session },
      )
    )[0];
    await movement(
      {
        productId: p.id,
        sourceId: lot.id,
        kind: "TRANSFER_OUT",
        sellableDelta: -lot.quantity,
        effectiveAt: lot.effectiveAt,
      },
      actor,
      session,
    );
    await movement(
      {
        productId: p.id,
        lotId: lot.id,
        memberId: order.memberId,
        sourceId: lot.id,
        kind: "RECEIPT",
        sellableDelta: lot.quantity,
        effectiveAt: lot.effectiveAt,
      },
      actor,
      session,
    );
    line.receivedQuantity += lot.quantity;
    receipts.push(entity(lot));
  }
  await incomplete(order.memberId, key, session);
  order.status = order.items.every((i) => i.quantity === i.receivedQuantity)
    ? "RECEIVED"
    : "PARTIALLY_RECEIVED";
  order.version++;
  await order.save({ session });
  return { id: order.id, order: entity(order), receipts };
}

module.exports = { scoped, createOrder, amendOrder, orderStatus, receiveOrder };
