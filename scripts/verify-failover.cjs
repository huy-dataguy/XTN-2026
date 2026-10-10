// Dedicated Docker test replica only. Never accepts a production URI.
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const primary = "xtn-refactor-test",
  nodes = [primary, "xtn-refactor-secondary-1", "xtn-refactor-secondary-2"];
for (const node of nodes)
  assert.equal(
    execFileSync(
      "docker",
      ["inspect", node, "--format", '{{index .Config.Labels "xtn.refactor"}}'],
      { encoding: "utf8" },
    ).trim(),
    "test",
  );
const db = process.env.FAILOVER_TEST_DB;
if (!/^xtn_refactor_test_run\d+$/.test(db || ""))
  throw new Error("FAILOVER_TEST_DB must be a dedicated test run database");
const uri = `mongodb://${nodes.map((n) => `${n}:27017`).join(",")}/${db}?replicaSet=xtn-test&serverSelectionTimeoutMS=10000`;
function mongo(code) {
  return JSON.parse(
    execFileSync(
      "docker",
      [
        "exec",
        primary,
        "mongosh",
        uri,
        "--quiet",
        "--eval",
        `print(JSON.stringify(${code}))`,
      ],
      { encoding: "utf8", timeout: 15000 },
    ).trim(),
  );
}
function evidence() {
  return mongo(
    "({primary:db.hello().primary,orders:db.orders.countDocuments(),reports:db.reports.countDocuments(),movements:db.inventorymovements.countDocuments(),commands:db.businesscommands.countDocuments()})",
  );
}
const before = evidence();
assert.ok(before.orders > 0 && before.movements > 0);
try {
  execFileSync(
    "docker",
    [
      "exec",
      primary,
      "mongosh",
      "--quiet",
      "--eval",
      "db.adminCommand({replSetStepDown:20,secondaryCatchUpPeriodSecs:10})",
    ],
    { stdio: "pipe", timeout: 15000 },
  );
} catch (error) {
  if (error.signal) throw error;
}
(async () => {
  let after;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      after = evidence();
      if (after.primary !== before.primary) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(
    after && after.primary !== before.primary,
    "A different primary must be elected",
  );
  for (const field of ["orders", "reports", "movements", "commands"])
    assert.equal(after[field], before[field], `${field} lost across election`);
  // The original node has priority 2; wait until it resumes before HTTP test reuse.
  let restored = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      restored = evidence().primary === before.primary;
      if (restored) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(restored, true, "Original test primary did not recover");
  const output = {
    scope: "isolated-three-node-replica-only",
    before,
    after,
    originalPrimaryRestored: restored,
  };
  fs.mkdirSync("docs/redesign/evidence", { recursive: true });
  fs.writeFileSync(
    "docs/redesign/evidence/failover.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
