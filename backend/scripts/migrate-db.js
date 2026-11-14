require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const { getPool, disconnect } = require("../src/infrastructure/db");
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const schema = process.env.DB_SCHEMA || "public";
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema))
    throw new Error("DB_SCHEMA must be a simple identifier");
  const sql = fs
    .readFileSync(
      path.join(__dirname, "..", "src", "infrastructure", "schema.sql"),
      "utf8",
    )
    .replace(/\bxtn\./g, `${schema}.`);
  const pool = getPool();
  await pool.query(sql);
  const tables = await pool.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = $1",
    [schema],
  );
  console.log(
    JSON.stringify({
      event: "schema-ready",
      schema,
      tables: tables.rows[0].count,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
