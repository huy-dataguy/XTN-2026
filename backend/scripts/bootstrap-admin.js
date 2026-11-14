require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const bcrypt = require("bcryptjs");
const { withTransaction, disconnect } = require("../src/infrastructure/db");
const repo = require("../src/infrastructure/repository");
const { parse } = require("../src/domain/policy");
const { user } = require("../src/http/schemas");
async function bootstrap() {
  if (process.env.BOOTSTRAP_ADMIN !== "true")
    throw new Error("Explicit BOOTSTRAP_ADMIN=true required");
  const input = parse(user, {
    username: process.env.ADMIN_USERNAME,
    name: process.env.ADMIN_NAME || "Quản trị",
    password: process.env.ADMIN_PASSWORD_FILE
      ? fs.readFileSync(process.env.ADMIN_PASSWORD_FILE, "utf8").trim()
      : process.env.ADMIN_PASSWORD,
    role: "ADMIN",
  });
  const count = await repo.countUsers(undefined);
  if (process.env.BOOTSTRAP_ALLOW_EXISTING === "true" && count > 0) {
    const existing = await repo.getUserByUsername(undefined, input.username);
    if (
      !existing ||
      existing.role !== "ADMIN" ||
      existing.active === false ||
      !(await bcrypt.compare(input.password, existing.password))
    )
      throw new Error(
        "Existing administrator does not match supplied credentials",
      );
    console.log("Existing administrator verified. No changes made.");
    return;
  }
  const password = await bcrypt.hash(input.password, 12);
  await withTransaction(async (tx) => {
    if ((await repo.countUsers(tx)) > 0)
      throw new Error(
        "Database already contains users. Use authenticated user management.",
      );
    const claimed = await repo.claimCommand(tx, {
      id: "bootstrap-admin",
      requestHash: null,
    });
    if (!claimed) throw new Error("Bootstrap already claimed");
    const admin = await repo.createUser(tx, { ...input, password });
    await repo.insertAudit(tx, {
      actorId: admin.id,
      action: "admin.bootstrap",
      sourceId: admin.id,
    });
  });
  console.log("Initial administrator created. No password is logged.");
}
bootstrap()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => disconnect());
