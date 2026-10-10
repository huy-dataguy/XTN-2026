const { z } = require("zod");
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (status, code, message) => {
  throw new AppError(status, code, message);
};
const id = z.string().regex(/^[a-f\d]{24}$/i, "ID không hợp lệ");
const qty = z.number().int().min(0).max(1000000);
const money = z.number().int().min(0).max(1000000000000);
const text = z.string().trim().min(1).max(200);
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (v) => new Date(v).getTime() <= Date.now(),
    "Ngày nghiệp vụ không được ở tương lai",
  );
const week = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00+07:00`);
    return !Number.isNaN(d.getTime()) && periodId(d) === v;
  }, "Kỳ phải bắt đầu thứ Hai");
function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    fail(
      400,
      "VALIDATION",
      result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
function safeMoney(value) {
  if (!Number.isSafeInteger(value))
    fail(400, "MONEY_OVERFLOW", "Số tiền vượt giới hạn tính toán");
  return value;
}
function periodId(value) {
  const d = new Date(new Date(value).getTime() + 7 * 3600000);
  if (Number.isNaN(d.getTime())) fail(400, "INVALID_DATE", "Ngày không hợp lệ");
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function bounds(key) {
  const start = new Date(`${key}T00:00:00+07:00`);
  return {
    start,
    end: new Date(+start + 7 * 86400000),
    deadline: new Date(+start + 8 * 86400000 - 1),
  };
}
function weeks(from, to) {
  parse(week, from);
  parse(week, to);
  if (from > to) fail(400, "INVALID_RANGE", "Khoảng tuần không hợp lệ");
  const keys = [];
  for (
    let d = bounds(from).start;
    periodId(d) <= to;
    d = new Date(+d + 7 * 86400000)
  ) {
    keys.push(periodId(d));
    if (keys.length > 26)
      fail(400, "RANGE_TOO_LARGE", "Tối đa 26 tuần mỗi lần");
  }
  return keys;
}
const activity = z
  .object({
    lotId: id,
    effectiveAt: timestamp,
    sold: qty.default(0),
    damaged: qty.default(0),
    giftGood: qty.default(0),
    giftDamaged: qty.default(0),
  })
  .strict()
  .refine(
    (v) => v.sold + v.damaged + v.giftGood + v.giftDamaged > 0,
    "Cần ít nhất một số lượng phát sinh",
  );
const reportInput = z
  .object({
    periodId: week,
    lines: z.array(activity).min(1).max(100),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict();
function quantities(line) {
  return {
    sellableDelta: -line.sold - line.damaged - line.giftGood,
    damagedDelta: line.damaged - line.giftDamaged,
  };
}
function validateTimeline(movements) {
  const balances = new Map(),
    groups = new Map();
  for (const m of movements) {
    const lot = String(m.lotId || m.productId),
      time = +new Date(m.effectiveAt);
    const key = `${lot}:${time}`,
      group = groups.get(key) || {
        lot,
        time,
        sellableDelta: 0,
        damagedDelta: 0,
      };
    group.sellableDelta += m.sellableDelta;
    group.damagedDelta += m.damagedDelta;
    groups.set(key, group);
  }
  for (const m of [...groups.values()].sort((a, b) => a.time - b.time)) {
    const b = balances.get(m.lot) || { sellable: 0, damaged: 0 };
    b.sellable += m.sellableDelta;
    b.damaged += m.damagedDelta;
    if (b.sellable < 0 || b.damaged < 0)
      fail(
        409,
        "INSUFFICIENT_HISTORICAL_STOCK",
        "Phát sinh làm âm tồn tại một thời điểm; kiểm tra ngày nhận, bán và hàng hư/tặng",
      );
    balances.set(m.lot, b);
  }
  return balances;
}
function valuation(line, lot) {
  const cost = (q) =>
    q === 0 ? 0 : lot.unitCost == null ? null : safeMoney(q * lot.unitCost);
  return {
    revenue: safeMoney(line.sold * lot.price),
    cogs: cost(line.sold),
    damageCost: cost(line.damaged),
    giftCost: cost(line.giftGood),
  };
}
function owner(actor, memberId) {
  if (actor.role !== "ADMIN" && actor.id !== String(memberId))
    fail(403, "FORBIDDEN", "Không có quyền với dữ liệu này");
}
function admin(actor) {
  if (actor.role !== "ADMIN")
    fail(403, "FORBIDDEN", "Chỉ quản trị được thực hiện");
}
function inventoryReady(product) {
  if (product.inventoryVersion !== 1)
    fail(
      409,
      "MIGRATION_REQUIRED",
      "Sản phẩm cũ cần đối soát và khởi tạo sổ kho trước khi giao dịch",
    );
}
module.exports = {
  z,
  AppError,
  fail,
  id,
  qty,
  money,
  text,
  timestamp,
  week,
  parse,
  safeMoney,
  periodId,
  bounds,
  weeks,
  reportInput,
  quantities,
  validateTimeline,
  valuation,
  owner,
  admin,
  inventoryReady,
};
