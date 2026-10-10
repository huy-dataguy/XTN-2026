const { spawn } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
(async () => {
  const count = Number(process.env.SCALE_MEMBERS || 100),
    uri = process.env.TEST_MONGO_URI,
    label = process.env.SCALE_LABEL || "baseline";
  assert.match(
    uri || "",
    /^mongodb:\/\/127\.0\.0\.1:27028\/xtn_refactor_test_scale_[\w]+\?directConnection=true$/,
  );
  assert.match(label, /^[\w-]+$/);
  const fixture = JSON.parse(
    fs.readFileSync(
      path.join(root, `docs/redesign/evidence/scale/fixture-${count}.json`),
      "utf8",
    ),
  );
  assert.equal(
    fixture.database,
    uri.split("/")[3].split("?")[0],
    "Fixture database mismatch",
  );
  assert.equal(fixture.members, count);
  const log = fs.openSync(
    path.join(root, `docs/redesign/evidence/scale/${label}-${count}-api.txt`),
    "w",
  );
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(root, "backend"),
    env: {
      ...process.env,
      MONGO_URI: uri,
      JWT_SECRET: "scale-fixture-secret-more-than-32-characters",
      PORT: "5003",
      NODE_ENV: "test",
    },
    stdio: ["ignore", log, log],
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw Error("Scale API exited");
      try {
        ready =
          (await fetch("http://127.0.0.1:5003/health/ready")).status === 200;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready);
    const token = (
      await (
        await fetch("http://127.0.0.1:5003/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "scale-admin",
            password: "scale-fixture-password",
          }),
        })
      ).json()
    ).token;
    assert.ok(token);
    const timings = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const response = await fetch(
        `http://127.0.0.1:5003/api/v1/analytics/weekly?from=${fixture.from}&to=${fixture.to}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30000),
        },
      );
      const raw = await response.text();
      assert.equal(response.status, 200, raw.slice(0, 300));
      const result = JSON.parse(raw);
      for (const [key, value] of Object.entries(fixture.expected))
        assert.equal(result.totals[key], value, key);
      const samples = fixture.sampleMembers.filter((s) =>
        result.memberTotals.some((r) => r.memberId === s.id),
      );
      assert.equal(
        samples.length,
        Math.min(50, count),
        "Expected stock samples must be present",
      );
      for (const sample of samples) {
        const found = result.memberTotals.find((r) => r.memberId === sample.id);
        assert.equal(found.closing.physical, sample.physical);
      }
      const rss =
        Number(
          fs
            .readFileSync(`/proc/${child.pid}/status`, "utf8")
            .match(/VmRSS:\s+(\d+)/)[1],
        ) / 1024;
      timings.push({
        ms: Math.round(performance.now() - start),
        bytes: Buffer.byteLength(raw),
        rssMB: Math.round(rss),
        detailRows: result.rows.length,
        membersReturned: result.memberTotals.length,
      });
    }
    const report = {
      status: "passed",
      scope:
        "Real HTTP on Node API and real local three-node Mongo; synthetic historical fixture, no mock",
      label,
      members: count,
      counts: fixture.counts,
      accuracy: "Independent fixture totals and sampled closing stock match",
      timings,
    };
    fs.writeFileSync(
      path.join(root, `docs/redesign/evidence/scale/${label}-${count}.json`),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => child.kill("SIGKILL"), 15000).unref();
    });
    fs.closeSync(log);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
