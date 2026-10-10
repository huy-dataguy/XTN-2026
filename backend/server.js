require("dotenv").config();
const { mongoose } = require("./src/infrastructure/models");
const { configuration } = require("./src/infrastructure/config");
const { createApp } = require("./src/http/app");
async function start() {
  const config = configuration();
  await mongoose.connect(config.mongoUri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
  });
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid")
    throw new Error(
      "A MongoDB replica set or sharded cluster is required for transactions",
    );
  const server = createApp(config).listen(config.port, () =>
    console.log(JSON.stringify({ event: "started", port: config.port })),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      server.close(() => mongoose.disconnect().then(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10000).unref();
    });
}
if (require.main === module)
  start().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
module.exports = { start };
