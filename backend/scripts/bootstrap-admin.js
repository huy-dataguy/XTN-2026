require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const bcrypt = require("bcryptjs");
const {
  mongoose,
  User,
  Command,
  Audit,
} = require("../src/infrastructure/models");
const { transactionOptions } = require("../src/infrastructure/transaction");
const { configuration } = require("../src/infrastructure/config");
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
  const config = configuration();
  await mongoose.connect(config.mongoUri, { autoIndex: false });
  if (
    process.env.BOOTSTRAP_ALLOW_EXISTING === "true" &&
    (await User.exists({}))
  ) {
    const existing = await User.findOne({
      username: input.username,
      role: "ADMIN",
      active: { $ne: false },
    }).select("+password");
    if (!existing || !(await bcrypt.compare(input.password, existing.password)))
      throw new Error(
        "Existing administrator does not match supplied credentials",
      );
    console.log("Existing administrator verified. No changes made.");
    return;
  }
  const password = await bcrypt.hash(input.password, 12);
  await mongoose.connection.transaction(async (session) => {
    if (await User.exists({}).session(session))
      throw new Error(
        "Database already contains users. Use authenticated user management.",
      );
    await Command.create([{ _id: "bootstrap-admin" }], { session });
    const admin = (await User.create([{ ...input, password }], { session }))[0];
    await Audit.create(
      [{ actorId: admin.id, action: "admin.bootstrap", sourceId: admin.id }],
      { session },
    );
  }, transactionOptions);
  console.log("Initial administrator created. No password is logged.");
}
bootstrap()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
