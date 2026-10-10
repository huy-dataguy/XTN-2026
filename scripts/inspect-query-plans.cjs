// Read-only query-plan evidence on the indexed synthetic benchmark database.
const assert = require("node:assert/strict");
const m = require("../backend/src/infrastructure/models");
(async () => {
  const uri = process.env.TEST_MONGO_URI;
  assert.match(
    uri || "",
    /^mongodb:\/\/127\.0\.0\.1:27028\/xtn_refactor_test_scale_[\w]+\?directConnection=true$/,
  );
  await m.mongoose.connect(uri, { autoIndex: false });
  const member = await m.User.findOne({ username: "scale-0" }).lean();
  assert.ok(member);
  const queries = {
    adminReports: m.Report.find({ schemaVersion: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(51),
    memberReports: m.Report.find({ schemaVersion: 1, memberId: member._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(51),
    memberHistory: m.Movement.find({ memberId: member._id }),
    username: m.User.find({ username: "scale-0" }).limit(1),
    adminUsers: m.User.find().sort({ createdAt: -1, _id: -1 }).limit(51),
  };
  const result = {};
  for (const [name, query] of Object.entries(queries)) {
    const plan = await query.explain("executionStats");
    const {
      nReturned,
      totalDocsExamined,
      totalKeysExamined,
      executionTimeMillis,
    } = plan.executionStats;
    result[name] = {
      nReturned,
      totalDocsExamined,
      totalKeysExamined,
      executionTimeMillis,
      winningPlan: plan.queryPlanner.winningPlan,
    };
  }
  console.log(
    JSON.stringify(
      {
        status: "passed",
        database: m.mongoose.connection.name,
        queries: result,
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
  .finally(() => m.mongoose.disconnect());
