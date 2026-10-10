// Explicit, repeatable local index migration. Default invocation only inspects.
const assert = require("node:assert/strict");
const path = require("node:path");
require("../backend/node_modules/dotenv").config({
  path: path.resolve(__dirname, "../backend/.env"),
  quiet: true,
});
const { mongoose } = require("../backend/src/infrastructure/models");
const plans = [
  require("../backend/migrations/001-query-indexes.plan.json"),
  require("../backend/migrations/002-list-query-indexes.plan.json"),
];
(async () => {
  const uri = process.env.MIGRATION_MONGO_URI || process.env.MONGO_URI;
  const parsed = new URL(uri);
  const database = parsed.pathname.slice(1);
  const production = process.argv.includes("--production");
  const apply = process.argv.includes("--apply");
  assert.ok(
    process.argv
      .slice(2)
      .every((arg) => ["--apply", "--production"].includes(arg)),
    "Unknown migration option",
  );
  if (production) {
    assert.equal(
      process.env.NODE_ENV,
      "production",
      "Production environment required",
    );
    assert.ok(
      process.env.MIGRATION_DATABASE &&
        process.env.MIGRATION_DATABASE === database,
      "Explicit migration database must match URI",
    );
    assert.ok(
      ["mongodb:", "mongodb+srv:"].includes(parsed.protocol),
      "Mongo URI required",
    );
  } else {
    assert.equal(parsed.protocol, "mongodb:", "Local Mongo migration only");
    assert.equal(parsed.hostname, "127.0.0.1", "Local Mongo migration only");
    assert.ok(
      (parsed.port === "27017" && database === "xtn_local") ||
        (parsed.port === "27028" && /^xtn_refactor_test_[\w]+$/.test(database)),
      "Unexpected local database",
    );
  }
  await mongoose.connect(uri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.ok(hello.setName, "Replica set required");
  const changes = [];
  for (const index of plans.flatMap((plan) => plan.indexes)) {
    const model = mongoose.models[index.model];
    assert.ok(model, `Unknown model ${index.model}`);
    let existing;
    try {
      existing = await model.collection.listIndexes().toArray();
    } catch (error) {
      if (error.code !== 26) throw error;
      existing = [];
    }
    const named = existing.find((i) => i.name === index.name);
    if (named) {
      assert.deepEqual(named.key, index.key, `Conflicting index ${index.name}`);
      assert.equal(
        Boolean(named.unique),
        false,
        `Unexpected unique index ${index.name}`,
      );
      assert.ok(
        !named.partialFilterExpression &&
          !named.sparse &&
          !named.hidden &&
          !named.collation,
        `Unexpected index options ${index.name}`,
      );
    }
    const equivalent = existing.find(
      (i) =>
        JSON.stringify(i.key) === JSON.stringify(index.key) &&
        (!i.unique || index.acceptExistingUnique) &&
        !i.partialFilterExpression &&
        !i.sparse &&
        !i.hidden &&
        !i.collation,
    );
    let status = named || equivalent ? "already-present" : "would-create";
    if (status === "would-create" && apply) {
      await model.collection.createIndex(index.key, { name: index.name });
      status = "created";
    }
    changes.push({
      collection: model.collection.name,
      name: index.name,
      key: index.key,
      status,
    });
  }
  console.log(
    JSON.stringify(
      {
        status: "passed",
        migrationIds: plans.map((plan) => plan.migrationId),
        database,
        mode: apply ? "apply" : "inspect",
        changes,
      },
      null,
      2,
    ),
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
