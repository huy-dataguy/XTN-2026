const { createHash } = require("node:crypto");
const { mongoose, Command, Audit } = require("./models");
const { fail } = require("../domain/policy");
const dto = (doc) => JSON.parse(JSON.stringify(doc));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
const transactionOptions = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority", j: true },
  readPreference: "primary",
  maxCommitTimeMS: 10000,
};
async function command(actor, operation, key, payload, execute) {
  if (!/^[\w-]{8,128}$/.test(key || ""))
    fail(400, "IDEMPOTENCY_REQUIRED", "Cần Idempotency-Key từ 8 đến 128 ký tự");
  const commandId = createHash("sha256")
    .update(`${actor.id}:${operation}:${key}`)
    .digest("hex");
  const requestHash = createHash("sha256")
    .update(JSON.stringify(canonical(payload)))
    .digest("hex");
  const replay = (stored) => {
    if (stored.requestHash !== requestHash)
      fail(409, "IDEMPOTENCY_CONFLICT", "Key đã dùng với dữ liệu khác");
    return stored.result;
  };
  try {
    return await mongoose.connection.transaction(async (session) => {
      const prior = await Command.findById(commandId).session(session).lean();
      if (prior) return replay(prior);
      await Command.create([{ _id: commandId, requestHash }], { session });
      const result = dto(await execute(session));
      await Audit.create(
        [
          {
            actorId: actor.id,
            action: operation,
            sourceId: result.id || commandId,
            reason: payload.reason,
            after: result,
          },
        ],
        { session },
      );
      await Command.updateOne(
        { _id: commandId },
        { $set: { result } },
        { session },
      );
      return result;
    }, transactionOptions);
  } catch (error) {
    if (error.code === 11000) {
      const stored = await Command.findById(commandId).lean();
      if (stored) return replay(stored);
    }
    throw error;
  }
}
async function snapshot(execute) {
  return mongoose.connection.transaction(execute, transactionOptions);
}
function entity(doc) {
  if (!doc) return null;
  const data = dto(doc);
  return {
    ...data,
    id: String(data._id),
    _id: undefined,
    __v: undefined,
    password: undefined,
    tokenVersion: undefined,
    inventoryRevision: undefined,
    ...(data.role ? { active: data.active !== false } : {}),
  };
}
module.exports = { command, snapshot, entity, transactionOptions };
