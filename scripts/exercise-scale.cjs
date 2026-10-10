const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { chromium } = require("../frontend/node_modules/@playwright/test");
const m = require("../backend/src/infrastructure/models");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "docs/redesign/evidence/scale");
(async () => {
  const uri = process.env.TEST_MONGO_URI;
  assert.match(
    uri || "",
    /^mongodb:\/\/127\.0\.0\.1:27028\/xtn_refactor_test_scale_[\w]+\?directConnection=true$/,
  );
  const fixture = JSON.parse(
    fs.readFileSync(path.join(out, "fixture-1000.json")),
  );
  assert.equal(
    fixture.database,
    uri.split("/")[3].split("?")[0],
    "Fixture database mismatch",
  );
  const log = fs.openSync(path.join(out, "traffic-api.txt"), "w");
  const api = spawn(process.execPath, ["server.js"], {
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
  let ui, browser;
  const latencies = {
    reads: [],
    create: [],
    approve: [],
    receive: [],
    report: [],
    post: [],
    close: [],
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        ready =
          (await fetch("http://127.0.0.1:5003/health/ready")).status === 200;
        if (ready) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready);
    async function request(
      endpoint,
      method = "GET",
      body,
      token,
      key = randomUUID(),
      stage,
    ) {
      const start = performance.now();
      const response = await fetch(`http://127.0.0.1:5003/api/v1${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
          "Idempotency-Key": key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (stage) latencies[stage].push(performance.now() - start);
      assert.equal(response.status, 200, JSON.stringify(result));
      return result;
    }
    const admin = (
      await request("/auth/login", "POST", {
        username: "scale-admin",
        password: "scale-fixture-password",
      })
    ).token;
    const tokens = [];
    for (let i = 0; i < 5; i++)
      tokens.push(
        (
          await request("/auth/login", "POST", {
            username: `scale-${i}`,
            password: "scale-fixture-password",
          })
        ).token,
      );
    const query = `/analytics/weekly?from=${fixture.from}&to=${fixture.to}&limit=20`;
    for (let batch = 0; batch < 2; batch++) {
      await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          const r = await request(
            query + `&offset=${i * 20}`,
            "GET",
            undefined,
            admin,
            undefined,
            "reads",
          );
          for (const [key, value] of Object.entries(fixture.expected))
            assert.equal(r.totals[key], value, key);
          assert.equal(r.memberTotals.length, 20);
          assert.equal(r.rows.length, 520);
        }),
      );
    }
    const product = await request(
      "/products",
      "POST",
      {
        name: "Scale live workflow",
        price: 10000,
        unitCost: 6000,
        openingStock: 200,
      },
      admin,
    );
    const current = require("../backend/src/domain/policy").periodId(
      new Date(),
    );
    async function pool(values, fn) {
      let next = 0;
      await Promise.all(
        Array.from({ length: 5 }, async () => {
          while (next < values.length) {
            const index = next++;
            await fn(values[index], index);
          }
        }),
      );
    }
    const orders = [],
      lots = [],
      reports = [];
    await pool(
      Array.from({ length: 20 }, (_, i) => i),
      async (_, i) => {
        const key = randomUUID(),
          body = {
            items: [{ productId: product.id, quantity: 6 }],
            intendedPeriodId: current,
          };
        const replies = await Promise.all([
          request("/orders", "POST", body, tokens[i % 5], key, "create"),
          request("/orders", "POST", body, tokens[i % 5], key, "create"),
        ]);
        assert.equal(replies[0].id, replies[1].id);
        orders[i] = replies[0];
      },
    );
    await pool(
      orders,
      async (o, i) =>
        (orders[i] = await request(
          `/orders/${o.id}/status`,
          "PUT",
          { status: "APPROVED", version: o.version },
          admin,
          undefined,
          "approve",
        )),
    );
    await pool(orders, async (o, i) => {
      const r = await request(
        `/orders/${o.id}/receipts`,
        "POST",
        {
          items: [{ productId: product.id, quantity: 6 }],
          version: o.version,
          effectiveAt: new Date().toISOString(),
        },
        tokens[i % 5],
        undefined,
        "receive",
      );
      lots[i] = r.receipts[0];
    });
    await pool(
      lots,
      async (lot, i) =>
        (reports[i] = await request(
          "/reports",
          "POST",
          {
            periodId: current,
            lines: [
              {
                lotId: lot.id,
                effectiveAt: new Date().toISOString(),
                sold: 2,
                damaged: 1,
                giftGood: 1,
                giftDamaged: 1,
              },
            ],
          },
          tokens[i % 5],
          undefined,
          "report",
        )),
    );
    await pool(
      reports,
      async (r) =>
        await request(
          `/reports/${r.id}/status`,
          "PUT",
          { status: "APPROVED", version: r.version },
          admin,
          undefined,
          "post",
        ),
    );
    const warehouse = (
      await request("/inventory", "GET", undefined, admin)
    ).warehouse.find((p) => p.id === product.id);
    assert.equal(warehouse.physical, 80);
    assert.equal(warehouse.reserved, 0);
    for (let i = 0; i < 5; i++) {
      const inv = await request("/inventory", "GET", undefined, tokens[i]);
      assert.equal(
        inv.lots.reduce((s, l) => s + l.physical, 0),
        fixture.sampleMembers[i].physical + 8,
      );
    }
    const live = await request(
      `/analytics/weekly?from=${current}&to=${current}`,
      "GET",
      undefined,
      admin,
    );
    assert.equal(live.totals.revenue, 400000);
    assert.equal(live.totals.contribution, -80000);
    await request(
      "/periods/close",
      "POST",
      { periodId: fixture.from, reason: "Scale closure verification" },
      admin,
      undefined,
      "close",
    );
    await m.mongoose.connect(uri, { autoIndex: false });
    const u = await m.User.findOne({ username: "scale-0" }).lean();
    const plan = await m.Movement.find({ memberId: u._id })
      .select("lotId sellableDelta damagedDelta")
      .explain("executionStats");
    const stats = plan.executionStats;
    assert.equal(
      await m.Order.countDocuments({ "items.productId": product.id }),
      20,
    );
    assert.equal(
      await m.Report.countDocuments({ periodId: current, status: "APPROVED" }),
      20,
    );
    await m.mongoose.disconnect();
    ui = spawn(
      "npm",
      ["run", "preview", "--", "--host", "127.0.0.1", "--port", "5175"],
      {
        cwd: path.join(root, "frontend"),
        env: { ...process.env, API_PROXY_TARGET: "http://127.0.0.1:5003" },
        stdio: ["ignore", log, log],
      },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch("http://127.0.0.1:5175")).status === 200) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5175");
    await page.getByLabel("Tên đăng nhập").fill("scale-admin");
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill("scale-fixture-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("heading", { name: "Tổng quan hoạt động" }).waitFor();
    const browserStart = performance.now();
    await page.goto(
      `http://127.0.0.1:5175/?from=${fixture.from}&to=${fixture.to}`,
    );
    await page.getByText("Member 0000", { exact: true }).first().waitFor();
    assert.equal(await page.locator("tbody tr").count(), 540);
    const displayed = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(fixture.expected.revenue);
    assert.equal(
      await page.getByText(displayed, { exact: true }).first().isVisible(),
      true,
    );
    const browserMs = performance.now() - browserStart;
    await page.getByRole("button", { name: "Sau", exact: true }).click();
    await page.getByText("Member 0020", { exact: true }).first().waitFor();
    assert.equal(
      await page.getByText(displayed, { exact: true }).first().isVisible(),
      true,
    );
    assert.equal(await page.locator("tbody tr").count(), 540);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: path.join(out, "dashboard-1000.png"),
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const summary = {};
    for (const [stage, values] of Object.entries(latencies)) {
      const sorted = [...values].sort((a, b) => a - b);
      summary[stage] = {
        requests: values.length,
        p50Ms: Math.round(sorted[Math.floor((sorted.length - 1) * 0.5)]),
        p95Ms: Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)]),
        maxMs: Math.round(sorted.at(-1)),
      };
    }
    const result = {
      status: "passed",
      concurrency: 5,
      readRequests: 10,
      realOrderWorkflows: 20,
      idempotentDuplicateCalls: 20,
      approvedReports: 20,
      realWarehousePhysical: 80,
      realRevenue: 400000,
      realContribution: -80000,
      browser: {
        membersInDatabase: 1000,
        membersPerPage: 20,
        detailRowsPerPage: 520,
        loadAndRenderMs: Math.round(browserMs),
        pagination: "totals unchanged",
        jsErrors: errors,
        mobileOverflow: false,
      },
      latency: summary,
      queryPlan: {
        nReturned: stats.nReturned,
        totalDocsExamined: stats.totalDocsExamined,
        totalKeysExamined: stats.totalKeysExamined,
        executionTimeMillis: stats.executionTimeMillis,
      },
      limitations:
        "Synthetic seeded history + actual HTTP transactions. Local one-host measurements; queryPlan records actual index use. This is not production capacity or an unlimited scalability guarantee.",
    };
    fs.writeFileSync(
      path.join(out, "traffic-1000.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result));
  } finally {
    if (browser) await browser.close();
    await m.mongoose.disconnect();
    if (ui) ui.kill("SIGTERM");
    api.kill("SIGTERM");
    await new Promise((r) => {
      if (api.exitCode !== null) return r();
      api.once("exit", r);
      setTimeout(() => api.kill("SIGKILL"), 15000).unref();
    });
    fs.closeSync(log);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
