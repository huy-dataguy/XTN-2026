const repo = require("../infrastructure/repository");
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
  actor.role === "ADMIN" ? null : actor.id;
function normalizeItems(items) {
  const map = new Map();
  for (const item of items)
    map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }));
}
async function reserveItems(items, oldItems, tx) {
  const next = normalizeItems(items),
    old = new Map(oldItems.map((i) => [String(i.productId), i]));
  const quantitiesById = new Map(next.map((i) => [i.productId, i.quantity]));
  const ids = [...new Set([...old.keys(), ...quantitiesById.keys()])].sort();
  const snapshots = [];
  for (const id of ids) {
    const p = await getProduct(id, tx),
      count = quantitiesById.get(id) || 0,
      delta = count - (old.get(id)?.quantity || 0);
    if (count && !p.active) fail(409, "PRODUCT_ARCHIVED", "Sản phẩm ngừng cấp");
    if (delta > p.onHand - p.damagedOnHand - p.reserved)
      fail(409, "INSUFFICIENT_STOCK", `Không đủ hàng: ${p.name}`);
    p.reserved += delta;
    await repo.saveProduct(tx, p);
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
async function createOrder(input, actor, tx) {
  const items = await reserveItems(input.items, [], tx);
  const order = await repo.createOrder(tx, {
    memberId: actor.id,
    memberName: actor.name,
    intendedPeriodId: input.intendedPeriodId,
    items,
    totalAmount: safeMoney(
      items.reduce((s, i) => safeMoney(s + i.quantity * i.price), 0),
    ),
  });
  return entity(order);
}
async function amendOrder(id, input, actor, tx) {
  const order = await repo.getOrderForUpdate(tx, id);
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
  order.items = await reserveItems(input.items, order.items, tx);
  order.totalAmount = safeMoney(
    order.items.reduce((s, i) => safeMoney(s + i.quantity * i.price), 0),
  );
  order.version++;
  return entity(await repo.saveOrder(tx, order));
}
async function orderStatus(id, input, actor, tx) {
  const order = await repo.getOrderForUpdate(tx, id);
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
      const p = await getProduct(item.productId, tx);
      p.reserved -= item.quantity - item.receivedQuantity;
      await repo.saveProduct(tx, p);
    }
    order.status = input.status;
  } else fail(409, "STATE_CONFLICT", "Chuyển trạng thái không hợp lệ");
  order.version++;
  return entity(await repo.saveOrder(tx, order));
}
async function receiveOrder(id, input, actor, tx) {
  const order = await repo.getOrderForUpdate(tx, id);
  if (!order?.memberId)
    fail(404, "NOT_FOUND", "Không tìm thấy đơn hoặc cần migrate");
  owner(actor, order.memberId);
  if (
    !["APPROVED", "PARTIALLY_RECEIVED"].includes(order.status) ||
    order.version !== input.version
  )
    fail(409, "STATE_CONFLICT", "Đơn chưa duyệt hoặc đã thay đổi");
  const key = periodId(input.effectiveAt);
  const member = await repo.bumpInventoryRevision(tx, order.memberId);
  if (
    !member?.createdAt ||
    +new Date(input.effectiveAt) < +bounds(periodId(member.createdAt)).start
  )
    fail(
      400,
      "BEFORE_MEMBER_JOIN",
      "Tuần nhận không được trước tuần thành viên tham gia; lịch sử cũ cần chuyển đổi có đối soát",
    );
  await openPeriod(key, tx);
  await invalidateDownstream(order.memberId, key, tx);
  const receipts = [];
  for (const received of normalizeItems(input.items)) {
    const line = order.items.find((i) => String(i.productId) === received.productId);
    if (!line || received.quantity > line.quantity - line.receivedQuantity)
      fail(409, "RECEIPT_EXCEEDS_ORDER", "Nhận vượt phần còn lại của đơn");
    const p = await getProduct(line.productId, tx);
    p.onHand -= received.quantity;
    p.reserved -= received.quantity;
    await repo.saveProduct(tx, p);
    const lot = await repo.createReceipt(tx, {
      orderId: order.id,
      memberId: order.memberId,
      productId: p.id,
      productName: line.productName,
      quantity: received.quantity,
      price: line.price,
      unitCost: line.unitCost,
      effectiveAt: input.effectiveAt,
    });
    await movement(
      {
        productId: p.id,
        sourceId: lot.id,
        kind: "TRANSFER_OUT",
        sellableDelta: -lot.quantity,
        effectiveAt: lot.effectiveAt,
      },
      actor,
      tx,
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
      tx,
    );
    line.receivedQuantity += lot.quantity;
    receipts.push(entity(lot));
  }
  await incomplete(order.memberId, key, tx);
  order.status = order.items.every((i) => i.quantity === i.receivedQuantity)
    ? "RECEIVED"
    : "PARTIALLY_RECEIVED";
  order.version++;
  const saved = await repo.saveOrder(tx, order);
  return { id: saved.id, order: entity(saved), receipts };
}

module.exports = { scoped, createOrder, amendOrder, orderStatus, receiveOrder };
