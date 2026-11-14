const { randomBytes } = require("node:crypto");
const { Pool } = require("pg");

const WRITE_LOCK = 778211;
let pool;

function connectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  return url.toString();
}

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: connectionString(),
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: true,
    ssl: /sslmode=(require|verify-ca|verify-full)/.test(
      process.env.DATABASE_URL,
    )
      ? { rejectUnauthorized: false }
      : undefined,
  });
  pool.on("error", (error) =>
    console.error(JSON.stringify({ event: "pg-pool-error", error: error.message })),
  );
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}
async function one(executor, text, params) {
  const result = await (executor || getPool()).query(text, params);
  return result.rows[0] || null;
}
async function many(executor, text, params) {
  const result = await (executor || getPool()).query(text, params);
  return result.rows;
}

async function withTransaction(execute, { readOnly = false } = {}) {
  const client = await getPool().connect();
  try {
    await client.query(
      readOnly
        ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
        : "BEGIN",
    );
    if (!readOnly) await client.query("SELECT pg_advisory_xact_lock($1)", [WRITE_LOCK]);
    const result = await execute(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

let counter = randomBytes(3).readUIntBE(0, 3);
function objectId() {
  const time = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, "0");
  const random = randomBytes(5).toString("hex");
  counter = (counter + 1) & 0xffffff;
  return `${time}${random}${counter.toString(16).padStart(6, "0")}`;
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}

module.exports = {
  getPool,
  query,
  one,
  many,
  withTransaction,
  objectId,
  connect: getPool,
  disconnect: closePool,
};
