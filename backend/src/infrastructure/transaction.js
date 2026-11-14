const { createHash } = require("node:crypto");
const { withTransaction } = require("./db");
const repo = require("./repository");
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
    if (stored.request_hash !== requestHash)
      fail(409, "IDEMPOTENCY_CONFLICT", "Key đã dùng với dữ liệu khác");
    return stored.result;
  };
  return withTransaction(async (tx) => {
    const prior = await repo.getCommand(tx, commandId);
    if (prior) return replay(prior);
    const claimed = await repo.claimCommand(tx, {
      id: commandId,
      requestHash,
    });
    if (!claimed) return replay(await repo.getCommand(tx, commandId));
    const result = dto(await execute(tx));
    await repo.insertAudit(tx, {
      actorId: actor.id,
      action: operation,
      sourceId: result.id || commandId,
      reason: payload.reason,
      after: result,
    });
    await repo.saveCommandResult(tx, commandId, result);
    return result;
  });
}
async function snapshot(execute) {
  return withTransaction(execute, { readOnly: true });
}
function entity(doc) {
  if (!doc) return null;
  const data = { ...doc };
  delete data.password;
  delete data.tokenVersion;
  delete data.inventoryRevision;
  delete data._id;
  delete data.__v;
  if (data.role) data.active = data.active !== false;
  return data;
}
module.exports = { command, snapshot, entity };
