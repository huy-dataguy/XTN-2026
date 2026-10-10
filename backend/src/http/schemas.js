const {
  z,
  id,
  qty,
  money,
  text,
  timestamp,
  week,
  reportInput,
} = require("../domain/policy");
const items = z
  .array(
    z
      .object({
        productId: id,
        quantity: qty.refine((v) => v > 0, "Số lượng phải dương"),
      })
      .strict(),
  )
  .min(1)
  .max(100);
const version = z.number().int().min(0);
const product = z
  .object({
    name: text,
    price: money,
    unitCost: money.nullable().default(null),
    openingStock: qty,
    category: z.string().max(100).default(""),
    image: z.string().max(1000).default(""),
  })
  .strict();
const productUpdate = z
  .object({
    name: text.optional(),
    price: money.optional(),
    unitCost: money.nullable().optional(),
    category: z.string().max(100).optional(),
    image: z.string().max(1000).optional(),
    active: z.boolean().optional(),
  })
  .strict();
const order = z.object({ items, intendedPeriodId: week }).strict();
const orderUpdate = z.object({ items, version }).strict();
const receipt = z.object({ items, version, effectiveAt: timestamp }).strict();
const status = z
  .object({ status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]), version })
  .strict();
const reportUpdate = reportInput.extend({ version }).strict();
const reportStatus = z
  .object({ status: z.enum(["APPROVED", "REJECTED"]), version })
  .strict();
const correction = reportUpdate.extend({ reason: text }).strict();
const memberPeriod = z
  .object({
    memberId: id,
    periodId: week,
    targetRevenue: money.nullable().optional(),
    extensionUntil: z.iso.datetime({ offset: true }).optional(),
    reason: text,
  })
  .strict();
const warehouse = z
  .object({
    damaged: qty.default(0),
    giftGood: qty.default(0),
    giftDamaged: qty.default(0),
    reason: text,
  })
  .strict()
  .refine((v) => v.damaged + v.giftGood + v.giftDamaged > 0);
const password = z
  .string()
  .min(12)
  .max(72)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Mật khẩu vượt 72 byte UTF-8",
  );
const user = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[\w.-]+$/),
    name: text,
    role: z.enum(["ADMIN", "DISTRIBUTOR"]),
    group: z.string().trim().max(100).default(""),
    password,
  })
  .strict();
const task = z
  .object({
    title: text,
    description: z.string().max(2000).default(""),
    assigneeId: id.nullable().default(null),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).default("TODO"),
    dueDate: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict();
module.exports = {
  product,
  productUpdate,
  order,
  orderUpdate,
  receipt,
  status,
  reportInput,
  reportUpdate,
  reportStatus,
  correction,
  memberPeriod,
  warehouse,
  user,
  task,
  version,
  items,
  password,
};
