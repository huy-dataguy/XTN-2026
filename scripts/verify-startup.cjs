// Actual process-level startup rejection gates, with a disposable local standalone Mongo.
const { spawnSync, execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const server = path.resolve(__dirname, "../backend/server.js");
const valid = {
  MONGO_URI: "mongodb://127.0.0.1:27029/xtn_refactor_test_startup",
  JWT_SECRET: "startup-test-secret-more-than-32-characters",
  CORS_ORIGINS: "http://127.0.0.1:5173",
  PORT: "5002",
  NODE_ENV: "test",
};
function rejected(name, overrides, pattern) {
  const r = spawnSync(process.execPath, [server], {
    cwd: os.tmpdir(),
    env: { ...process.env, ...valid, ...overrides },
    encoding: "utf8",
    timeout: 20000,
  });
  assert.equal(r.status, 1, `${name}: ${r.stdout} ${r.stderr}`);
  assert.match(r.stderr, pattern);
  assert.equal(r.stdout.includes('"event":"started"'), false);
  console.log(`${name}: rejected before listen`);
}
rejected("missing DB", { MONGO_URI: "" }, /MONGO_URI is required/);
rejected("weak JWT", { JWT_SECRET: "short" }, /JWT_SECRET must/);
rejected("wildcard CORS", { CORS_ORIGINS: "*" }, /explicit origins/);
rejected(
  "production CORS required",
  { NODE_ENV: "production", CORS_ORIGINS: "" },
  /CORS_ORIGINS is required/,
);
rejected(
  "invalid proxy trust",
  { TRUST_PROXY_HOPS: "2" },
  /TRUST_PROXY_HOPS must/,
);
rejected("invalid port", { PORT: "5000oops" }, /PORT must/);
const container = "xtn-standalone-check";
assert.notEqual(
  spawnSync("docker", ["inspect", container], { stdio: "ignore" }).status,
  0,
  "Refusing to replace existing check container",
);
let created = false;
(async () => {
  try {
    execFileSync(
      "docker",
      [
        "run",
        "-d",
        "--name",
        container,
        "--label",
        "xtn.refactor=test",
        "-p",
        "127.0.0.1:27029:27017",
        "mongo:7.0",
      ],
      { stdio: "pipe" },
    );
    created = true;
    let ready = false;
    for (let i = 0; i < 40; i++) {
      if (
        spawnSync(
          "docker",
          [
            "exec",
            container,
            "mongosh",
            "--quiet",
            "--eval",
            "db.adminCommand({ping:1})",
          ],
          { stdio: "ignore" },
        ).status === 0
      ) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.equal(ready, true, "Standalone fixture not ready");
    rejected(
      "standalone Mongo",
      {},
      /replica set or sharded cluster is required/,
    );
  } finally {
    if (created)
      execFileSync("docker", ["rm", "-f", "-v", container], { stdio: "pipe" });
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
