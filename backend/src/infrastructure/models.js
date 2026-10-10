const mongoose = require("mongoose");
const { Schema } = mongoose;
const objectId = Schema.Types.ObjectId;
const number = {
  type: Number,
  min: 0,
  validate: (value) => value == null || Number.isSafeInteger(value),
};
const options = { timestamps: true, optimisticConcurrency: true };
const model = (name, definition, collection) =>
  mongoose.models[name] ||
  mongoose.model(name, new Schema(definition, options), collection);
const Product = model("Product", {
  name: { type: String, required: true },
  price: { ...number, required: true },
  unitCost: { ...number, default: null },
  onHand: number,
  damagedOnHand: { ...number, default: 0 },
  reserved: { ...number, default: 0 },
  active: { type: Boolean, default: true },
  inventoryVersion: Number,
  category: String,
  image: String,
  stock: Number,
});
const User = model("User", {
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true, select: false },
  name: { type: String, required: true },
  role: { type: String, enum: ["ADMIN", "DISTRIBUTOR"], required: true },
  group: String,
  active: { type: Boolean, default: true },
  inventoryRevision: { type: Number, default: 0 },
  tokenVersion: { type: Number, default: 0 },
});
const Order = model("Order", {
  memberId: { type: objectId, required: true },
  memberName: String,
  intendedPeriodId: String,
  items: [
    {
      productId: objectId,
      productName: String,
      quantity: number,
      receivedQuantity: { ...number, default: 0 },
      price: number,
      unitCost: { ...number, default: null },
    },
  ],
  totalAmount: number,
  status: {
    type: String,
    enum: [
      "PENDING",
      "APPROVED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "REJECTED",
      "CANCELLED",
    ],
    default: "PENDING",
  },
  version: { type: Number, default: 0 },
  schemaVersion: { type: Number, default: 1 },
});
const Receipt = model("Receipt", {
  orderId: objectId,
  memberId: objectId,
  productId: objectId,
  productName: String,
  quantity: number,
  price: number,
  unitCost: { ...number, default: null },
  effectiveAt: Date,
});
const line = {
  lotId: objectId,
  effectiveAt: Date,
  sold: number,
  damaged: number,
  giftGood: number,
  giftDamaged: number,
};
const Report = model("Report", {
  memberId: objectId,
  memberName: String,
  periodId: String,
  lines: [line],
  notes: String,
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "SUPERSEDED"],
    default: "PENDING",
  },
  version: { type: Number, default: 0 },
  replacesId: objectId,
  submittedAt: Date,
  approvedAt: Date,
  schemaVersion: { type: Number, default: 1 },
});
const Movement = model("InventoryMovement", {
  productId: objectId,
  lotId: objectId,
  memberId: objectId,
  sourceId: String,
  kind: String,
  sellableDelta: Number,
  damagedDelta: Number,
  sold: Number,
  damaged: Number,
  giftGood: Number,
  giftDamaged: Number,
  revenue: Number,
  cogs: Number,
  damageCost: Number,
  giftCost: Number,
  effectiveAt: Date,
  periodId: String,
  actorId: objectId,
});
const Period = model("ReportingPeriod", {
  _id: String,
  status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
  revision: { type: Number, default: 0 },
  closedAt: Date,
});
const MemberPeriod = model("MemberPeriod", {
  _id: String,
  memberId: objectId,
  periodId: String,
  extensionUntil: Date,
  extensionReason: String,
  complete: { type: Boolean, default: false },
  completedAt: Date,
  targetRevenue: { ...number, default: null },
  group: String,
});
const Command = model("BusinessCommand", {
  _id: String,
  requestHash: String,
  result: Schema.Types.Mixed,
});
const Audit = model("AuditEvent", {
  actorId: objectId,
  action: String,
  sourceId: String,
  reason: String,
  after: Schema.Types.Mixed,
});
const Statement = model("Statement1", {
  transactionDate: Date,
  type: { type: String, enum: ["IN", "OUT"] },
  amount: number,
  partnerName: String,
  description: String,
  reference: String,
  tags: [{ type: objectId, ref: "Tag" }],
  voided: { type: Boolean, default: false },
});
const Tag = model("Tag", {
  name: { type: String, required: true },
  color: String,
  active: { type: Boolean, default: true },
});
const Task = model("Task", {
  title: String,
  description: String,
  assignee: objectId,
  creator: objectId,
  status: {
    type: String,
    enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"],
    default: "TODO",
  },
  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"],
    default: "MEDIUM",
  },
  dueDate: Date,
  active: { type: Boolean, default: true },
});
const SystemGuard = model("SystemGuard", {
  _id: String,
  revision: { type: Number, default: 0 },
});
module.exports = {
  SystemGuard,
  mongoose,
  Product,
  User,
  Order,
  Receipt,
  Report,
  Movement,
  Period,
  MemberPeriod,
  Command,
  Audit,
  Statement,
  Task,
  Tag,
};
