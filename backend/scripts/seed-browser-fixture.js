const bcrypt = require("bcryptjs");
const { mongoose, User } = require("../src/infrastructure/models");
async function seed() {
  const uri = process.env.TEST_MONGO_URI;
  if (
    !uri ||
    !/^mongodb:\/\/127\.0\.0\.1:27028\/xtn_refactor_test_browser[\w-]*(\?|$)/.test(
      uri,
    )
  )
    throw new Error("Dedicated local browser test DB required");
  await mongoose.connect(uri, { autoIndex: false });
  if (await User.exists({}))
    throw new Error("Use a new browser fixture DB name");
  const password = await bcrypt.hash("browser-fixture-password", 4);
  await User.create([
    { username: "admin", name: "Điều hành XTN", password, role: "ADMIN" },
    {
      username: "alice",
      name: "Thành viên An",
      password,
      role: "DISTRIBUTOR",
      group: "Tài Chính",
      createdAt: new Date("2026-01-01"),
    },
  ]);
  console.log("Isolated browser fixture seeded.");
}
seed()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
