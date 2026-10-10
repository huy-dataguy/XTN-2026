// Real HTTPS/API/Chromium acceptance against the isolated production-style stack.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  https = require("node:https");
const { randomUUID, randomBytes } = require("node:crypto");
const { chromium } = require("../frontend/node_modules/@playwright/test");
const root = path.resolve(__dirname, "..");
const dir = path.resolve(
  process.env.XTN_DEPLOY_DIR || path.join(root, ".local/production-verify"),
);
const restoring = process.env.RESTORE_VERIFY === "true";
const existing = process.env.VERIFY_EXISTING === "true";
assert.ok(
  ["production-verify", "production-restore-verify"].includes(
    path.basename(dir),
  ),
  "Isolated verification directory required",
);
const source = path.join(root, ".local/production-verify");
const credentials = JSON.parse(
  fs.readFileSync(path.join(dir, "admin-credentials.json")),
);
const origin = restoring
  ? "https://localhost:18444"
  : "https://localhost:18443";
const agent = new https.Agent({
  ca: fs.readFileSync(path.join(dir, "caddy-root.crt")),
  keepAlive: true,
  family: 4,
});
const timings = [];
async function request(
  endpoint,
  method = "GET",
  body,
  token,
  key = randomUUID(),
  expected = 200,
) {
  const start = performance.now();
  const result = await new Promise((resolve, reject) => {
    const req = https.request(
      origin + endpoint,
      {
        method,
        agent,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Idempotency-Key": key,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            raw: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    req.setTimeout(20000, () => req.destroy(Error("HTTPS request timed out")));
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
  timings.push(performance.now() - start);
  let data;
  try {
    data = JSON.parse(result.raw);
  } catch {
    throw Error(`Expected JSON: ${endpoint}, status ${result.status}`);
  }
  assert.equal(result.status, expected, `${endpoint}: ${data.code || ""}`);
  return data;
}
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
(async () => {
  assert.equal((await request("/health/ready")).status, "ready");
  const login = await request("/api/v1/auth/login", "POST", credentials);
  const token = login.token;
  let state;
  if (!restoring && !existing) {
    assert.equal(
      (await request("/api/v1/orders", "GET", undefined, token)).items.length,
      0,
      "Fresh production fixture required",
    );
    const members = [],
      password = randomBytes(24).toString("hex");
    for (let i = 0; i < 5; i++) {
      const user = await request(
        "/api/v1/users",
        "POST",
        {
          username: `production-member-${i}`,
          name: `Production Member ${i}`,
          role: "DISTRIBUTOR",
          group: "Production acceptance",
          password,
        },
        token,
      );
      const memberToken = (
        await request("/api/v1/auth/login", "POST", {
          username: user.username,
          password,
        })
      ).token;
      members.push({
        id: user.id,
        username: user.username,
        token: memberToken,
      });
    }
    const week = require("../backend/src/domain/policy").periodId(new Date());
    for (const member of members)
      await request(
        "/api/v1/periods/member",
        "POST",
        {
          memberId: member.id,
          periodId: week,
          targetRevenue: 100000,
          reason: "Production acceptance target",
        },
        token,
      );
    const product = await request(
      "/api/v1/products",
      "POST",
      {
        name: "Production acceptance product",
        price: 10000,
        unitCost: 6000,
        openingStock: 200,
      },
      token,
    );
    const orders = [],
      reports = [];
    await pool(
      Array.from({ length: 20 }, (_, i) => i),
      async (_, i) => {
        const member = members[i % 5],
          body = {
            items: [{ productId: product.id, quantity: 6 }],
            intendedPeriodId: week,
          },
          key = randomUUID();
        const [first, replay] = await Promise.all([
          request("/api/v1/orders", "POST", body, member.token, key),
          request("/api/v1/orders", "POST", body, member.token, key),
        ]);
        assert.equal(first.id, replay.id);
        orders[i] = first;
      },
    );
    await pool(orders, async (order, i) => {
      const member = members[i % 5];
      const approved = await request(
        `/api/v1/orders/${order.id}/status`,
        "PUT",
        { status: "APPROVED", version: order.version },
        token,
      );
      const partial = await request(
        `/api/v1/orders/${order.id}/receipts`,
        "POST",
        {
          items: [{ productId: product.id, quantity: 2 }],
          version: approved.version,
          effectiveAt: new Date().toISOString(),
        },
        member.token,
      );
      const remaining = await request(
        `/api/v1/orders/${order.id}/receipts`,
        "POST",
        {
          items: [{ productId: product.id, quantity: 4 }],
          version: partial.order.version,
          effectiveAt: new Date().toISOString(),
        },
        member.token,
      );
      const lines = [
        {
          lotId: partial.receipts[0].id,
          effectiveAt: new Date().toISOString(),
          sold: 1,
          damaged: 1,
          giftGood: 0,
          giftDamaged: 1,
        },
        {
          lotId: remaining.receipts[0].id,
          effectiveAt: new Date().toISOString(),
          sold: 1,
          damaged: 0,
          giftGood: 1,
          giftDamaged: 0,
        },
      ];
      const posted = [];
      for (const line of lines) {
        const draft = await request(
          "/api/v1/reports",
          "POST",
          { periodId: week, lines: [line] },
          member.token,
        );
        posted.push(
          await request(
            `/api/v1/reports/${draft.id}/status`,
            "PUT",
            { status: "APPROVED", version: draft.version },
            token,
          ),
        );
      }
      reports[i] = { first: posted[0], line: lines[0] };
    });
    const original = reports[0];
    await request(
      `/api/v1/reports/${original.first.id}/corrections`,
      "POST",
      {
        periodId: week,
        lines: [{ ...original.line, sold: 0 }],
        version: original.first.version,
        reason: "Correct one overstated sale",
      },
      token,
    );
    await request(
      `/api/v1/products/${product.id}/activity`,
      "POST",
      {
        damaged: 2,
        giftGood: 1,
        giftDamaged: 2,
        reason: "Warehouse damage and gifts",
      },
      token,
    );
    const tag = await request(
      "/api/v1/tags",
      "POST",
      { name: "Production acceptance", color: "green" },
      token,
    );
    await request(
      "/api/v1/statements",
      "POST",
      {
        transactionDate: new Date().toISOString(),
        type: "IN",
        amount: 150000,
        partnerName: "Acceptance",
        description: "Receipt",
        reference: "production-acceptance-in",
        tags: [tag.id],
      },
      token,
    );
    const cashOut = await request(
      "/api/v1/statements",
      "POST",
      {
        transactionDate: new Date().toISOString(),
        type: "OUT",
        amount: 20000,
        partnerName: "Acceptance",
        description: "Expense",
        reference: "production-acceptance-out",
        tags: [tag.id],
      },
      token,
    );
    await request(
      `/api/v1/statements/${cashOut.id}/void`,
      "POST",
      { reason: "Acceptance void" },
      token,
    );
    const task = await request(
      "/api/v1/tasks",
      "POST",
      {
        title: "Production acceptance task",
        priority: "HIGH",
        assigneeId: login.user.id,
      },
      token,
    );
    await request(`/api/v1/tasks/${task.id}`, "PUT", { status: "DONE" }, token);
    await request(
      "/api/v1/users",
      "GET",
      undefined,
      members[0].token,
      undefined,
      403,
    );
    await request(
      "/api/v1/periods/close",
      "POST",
      { periodId: week, reason: "Cannot close unfinished week" },
      token,
      undefined,
      409,
    );
    state = {
      adminId: login.user.id,
      members: members.map(({ token, ...member }) => member),
      memberPassword: password,
      week,
      productId: product.id,
      tagId: tag.id,
      taskId: task.id,
      expected: {
        revenue: 390000,
        contribution: -102000,
        warehousePhysical: 77,
        memberPhysical: 41,
        cashIn: 150000,
        cashOut: 0,
      },
    };
    fs.writeFileSync(
      path.join(dir, "smoke-state.json"),
      JSON.stringify(state, null, 2) + "\n",
      { mode: 0o600 },
    );
  } else {
    state = JSON.parse(fs.readFileSync(path.join(source, "smoke-state.json")));
    assert.equal(
      login.user.id,
      state.adminId,
      "Restored administrator identity",
    );
  }
  const weekly = await request(
    `/api/v1/analytics/weekly?from=${state.week}&to=${state.week}`,
    "GET",
    undefined,
    token,
  );
  assert.equal(weekly.totals.revenue, state.expected.revenue);
  assert.equal(weekly.totals.contribution, state.expected.contribution);
  const warehouse = (
    await request("/api/v1/inventory", "GET", undefined, token)
  ).warehouse.find((p) => p.id === state.productId);
  assert.equal(warehouse.physical, state.expected.warehousePhysical);
  assert.equal(warehouse.reserved, 0);
  const cash = await request(
    `/api/v1/cash/summary?tagId=${state.tagId}`,
    "GET",
    undefined,
    token,
  );
  assert.equal(cash.cashIn, state.expected.cashIn);
  assert.equal(cash.cashOut, state.expected.cashOut);
  const memberTokens = [];
  let physical = 0;
  for (const [i, member] of state.members.entries()) {
    const t = (
      await request("/api/v1/auth/login", "POST", {
        username: member.username,
        password: state.memberPassword,
      })
    ).token;
    memberTokens.push(t);
    const inventory = await request("/api/v1/inventory", "GET", undefined, t);
    const stock = inventory.lots.reduce((sum, lot) => sum + lot.physical, 0);
    assert.equal(stock, i === 0 ? 9 : 8);
    physical += stock;
  }
  assert.equal(physical, state.expected.memberPhysical);
  const browser = await chromium.launch({ headless: true });
  const browserErrors = [];
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.goto(origin + "/orders");
    await page.getByLabel("Tên đăng nhập").fill(credentials.username);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("heading", { name: "Tổng quan hoạt động" }).waitFor();
    for (const [label, heading] of [
      ["Cấp hàng", "Yêu cầu cấp hàng"],
      ["Báo cáo", "Báo cáo bán hàng"],
      ["Kho & sản phẩm", "Kho trung tâm & sản phẩm"],
      ["Thành viên", "Đội ngũ"],
      ["Thu / chi", "Giao dịch thu / chi"],
      ["Công việc", "Công việc"],
    ]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    }
    assert.deepEqual(browserErrors, []);
    await page.screenshot({
      path: path.join(
        root,
        "docs/production",
        restoring ? "restored-app.png" : "production-app.png",
      ),
    });
  } finally {
    await browser.close();
  }
  let sustainedRequests = 0;
  if (!restoring && !existing) {
    const until = performance.now() + 60000;
    while (performance.now() < until) {
      await Promise.all(
        memberTokens.map((t) =>
          request(
            `/api/v1/analytics/weekly?from=${state.week}&to=${state.week}`,
            "GET",
            undefined,
            t,
          ),
        ),
      );
      sustainedRequests += 5;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const sorted = timings.sort((a, b) => a - b);
  const result = {
    status: "passed",
    origin,
    mode: restoring ? "restored" : existing ? "existing" : "fresh",
    tls: "Node client validates HTTPS with the local Caddy CA; Chromium accepts this local CA exception",
    realOrderWorkflows: 20,
    partialReceipts: 40,
    deltaReports: 40,
    corrections: 1,
    duplicateCalls: 20,
    expected: state.expected,
    memberStock: physical,
    browser: { pages: 6, errors: browserErrors },
    sustained: {
      seconds: restoring || existing ? 0 : 60,
      requests: sustainedRequests,
      clients: 5,
    },
    httpRequests: timings.length,
    p95Ms: Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)]),
  };
  fs.writeFileSync(
    path.join(
      root,
      "docs/production",
      restoring
        ? "restore-app.json"
        : existing
          ? "existing-app.json"
          : "production-app.json",
    ),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => agent.destroy());
