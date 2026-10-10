// Verify actual boundary, restart and release/rollback on the isolated local stack.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  https = require("node:https");
const { execFileSync, spawn } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, ".local/production-verify");
const state = JSON.parse(fs.readFileSync(path.join(dir, "smoke-state.json")));
const compose = [
  "compose",
  "--env-file",
  path.join(dir, "env"),
  "-f",
  path.join(root, "infra/compose.production.yml"),
];
const agent = new https.Agent({
  ca: fs.readFileSync(path.join(dir, "caddy-root.crt")),
  family: 4,
});
async function get(endpoint, token, extra = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      "https://localhost:18443" + endpoint,
      {
        agent,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extra,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, raw }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(3000, () => req.destroy(Error("Probe timeout")));
  });
}
function run(args, log) {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(path.join(dir, log), "w");
    const child = spawn("bash", args, {
      cwd: root,
      env: { ...process.env, XTN_DEPLOY_DIR: dir },
      stdio: ["ignore", fd, fd],
    });
    child.on("exit", (code) => {
      fs.closeSync(fd);
      code === 0 ? resolve() : reject(Error(`Operation exit ${code}: ${log}`));
    });
    child.on("error", reject);
  });
}
(async () => {
  const normal = await get("/health/ready"),
    fake = await get("/health/ready", undefined, {
      "X-Forwarded-For": "203.0.113.99",
    });
  assert.equal(normal.status, 200);
  assert.equal(fake.status, 200);
  const logs = execFileSync(
    "docker",
    ["logs", "--since", "2m", "xtn-prod-verify-api-1"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
    .split("\n")
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const real = logs.find((r) => r.requestId === normal.headers["x-request-id"]),
    spoof = logs.find((r) => r.requestId === fake.headers["x-request-id"]);
  assert.ok(real && spoof);
  assert.equal(real.clientIp, spoof.clientIp);
  assert.notEqual(spoof.clientIp, "203.0.113.99");
  const boundary = JSON.parse(
    execFileSync("docker", ["inspect", "xtn-prod-verify-api-1"], {
      encoding: "utf8",
    }),
  )[0];
  assert.equal(boundary.Config.User, "node");
  assert.equal(boundary.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(boundary.HostConfig.PortBindings, {});
  const mongo = JSON.parse(
    execFileSync("docker", ["inspect", "xtn-prod-verify-mongo-1"], {
      encoding: "utf8",
    }),
  )[0];
  assert.deepEqual(mongo.HostConfig.PortBindings, {});
  execFileSync(
    "docker",
    [
      "exec",
      "xtn-prod-verify-mongo-1",
      "mongosh",
      "--quiet",
      "--eval",
      "try {db.getSiblingDB('xtn_production').users.findOne();quit(1)}catch(e){if(e.code!==13)throw e}",
    ],
    { stdio: "pipe" },
  );
  execFileSync(
    "docker",
    [
      "exec",
      "xtn-prod-verify-api-1",
      "node",
      "-e",
      "const m=require('./src/infrastructure/models');m.mongoose.connect(process.env.MONGO_URI,{autoIndex:false}).then(()=>m.mongoose.connection.db.admin().command({usersInfo:1})).then(()=>process.exitCode=1).catch(e=>{if(e.code!==13)process.exitCode=1}).finally(()=>m.mongoose.disconnect())",
    ],
    { stdio: "pipe" },
  );
  const start = performance.now();
  let done = false;
  const restart = new Promise((resolve, reject) => {
    const child = spawn("docker", [...compose, "restart", "mongo", "api"], {
      stdio: "ignore",
    });
    child.on("exit", (code) => {
      done = true;
      code === 0 ? resolve() : reject(Error("Restart failed"));
    });
  });
  let unavailable = 0;
  while (!done) {
    try {
      if ((await get("/health/ready")).status !== 200) unavailable++;
    } catch {
      unavailable++;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  await restart;
  let recovered = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await get("/health/ready")).status === 200) {
        recovered = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(recovered);
  const restartMs = Math.round(performance.now() - start);
  const previous = fs
    .readFileSync(path.join(dir, "current-release"), "utf8")
    .trim();
  const tag = "verify-" + Date.now();
  await run(["scripts/production.sh", "release", tag], "release.log");
  const image = execFileSync(
    "docker",
    ["inspect", "--format", "{{.Config.Image}}", "xtn-prod-verify-api-1"],
    { encoding: "utf8" },
  ).trim();
  assert.equal(image, `xtn-api:${tag}`);
  await run(["scripts/production.sh", "rollback", previous], "rollback.log");
  const restored = execFileSync(
    "docker",
    ["inspect", "--format", "{{.Config.Image}}", "xtn-prod-verify-api-1"],
    { encoding: "utf8" },
  ).trim();
  assert.equal(restored, `xtn-api:${previous}`);
  assert.equal((await get("/health/ready")).status, 200);
  const result = {
    status: "passed",
    apiNonRoot: true,
    apiReadOnly: true,
    apiAndMongoPortsPrivate: true,
    unauthenticatedMongoRead: "blocked",
    applicationMongoAdminAccess: "blocked",
    forwardedIpSpoof: "ignored",
    restart: {
      milliseconds: restartMs,
      unavailableProbes: unavailable,
      recovered: true,
    },
    release: { tag, image },
    rollback: { tag: previous, image: restored },
    scope:
      "Single-host production-style containers; real restart and rollback mechanics. No HA or public-domain certificate claim.",
  };
  fs.writeFileSync(
    path.join(root, "docs/production/operations.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => agent.destroy());
