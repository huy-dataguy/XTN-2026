require("dotenv").config();
const { configuration } = require("./src/infrastructure/config");
const { createApp } = require("./src/http/app");
const { query, disconnect } = require("./src/infrastructure/db");

const config = configuration();
const app = createApp(config);

async function start() {
  await query("SELECT 1");
  const server = app.listen(config.port, () =>
    console.log(JSON.stringify({ event: "started", port: config.port })),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      server.close(() => disconnect().then(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10000).unref();
    });
}
if (require.main === module)
  start().catch(async (error) => {
    console.error(error.message);
    await disconnect();
    process.exitCode = 1;
  });

module.exports = app;
module.exports.start = start;
