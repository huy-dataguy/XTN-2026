// Read-only verification of the running local workspace, never cloud/test databases.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { chromium } = require("../frontend/node_modules/@playwright/test");
const { mongoose, User } = require("../backend/src/infrastructure/models");
const root = path.resolve(__dirname, "..");
(async () => {
  const credentials = JSON.parse(
    fs.readFileSync(path.join(root, ".local/admin-credentials.json"), "utf8"),
  );
  const ready = await fetch("http://127.0.0.1:5000/health/ready");
  assert.equal(ready.status, 200);
  await mongoose.connect(
    "mongodb://127.0.0.1:27017/xtn_local?replicaSet=xtn-local",
    { autoIndex: false },
  );
  const account = await User.findOne({ username: credentials.username }).lean();
  assert.equal(account.role, "ADMIN");
  const id = String(account._id);
  await mongoose.disconnect();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    const failedResponses = [];
    const apiChecks = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/v1/") && res.status() >= 400)
        failedResponses.push({
          path: new URL(res.url()).pathname,
          status: res.status(),
        });
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5173");
    await page.getByLabel("Tên đăng nhập").fill(credentials.username);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("heading", { name: "Tổng quan hoạt động" }).waitFor();
    for (const [label, heading, endpoint] of [
      ["Cấp hàng", "Yêu cầu cấp hàng", "orders"],
      ["Báo cáo", "Báo cáo bán hàng", "reports"],
      ["Kho & sản phẩm", "Kho trung tâm & sản phẩm", "inventory"],
      ["Thành viên", "Đội ngũ", "users"],
      ["Thu / chi", "Giao dịch thu / chi", "statements"],
      ["Công việc", "Công việc", "tasks"],
    ]) {
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            new URL(res.url()).pathname === `/api/v1/${endpoint}` &&
            res.request().method() === "GET",
        ),
        page.getByRole("link", { name: label, exact: true }).click(),
      ]);
      assert.equal(response.status(), 200, endpoint);
      const body = await response.json();
      assert.equal(
        Array.isArray(endpoint === "inventory" ? body.warehouse : body.items),
        true,
        endpoint,
      );
      apiChecks.push({ endpoint, status: response.status() });
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(failedResponses, []);
    assert.equal(await page.getByRole("alert").count(), 0);
    fs.writeFileSync(
      path.join(root, "docs/redesign/evidence/full-check/live-api-pages.json"),
      JSON.stringify(
        { status: "passed", apiChecks, failedResponses, jsErrors: errors },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await browser.close();
  }
  // Restart only the explicitly local compose service; do not remove its volume.
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      path.join(root, "infra/compose.local.yml"),
      "restart",
      "mongo",
    ],
    { stdio: "pipe" },
  );
  let restored = false;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch("http://127.0.0.1:5000/health/ready");
      if (res.status === 200) {
        restored = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(restored, true, "Local API did not recover after Mongo restart");
  await mongoose.connect(
    "mongodb://127.0.0.1:27017/xtn_local?replicaSet=xtn-local",
    { autoIndex: false },
  );
  assert.equal(
    String((await User.findOne({ username: credentials.username }))._id),
    id,
  );
  const expectedIndexes = [
    ...require("../backend/migrations/001-query-indexes.plan.json").indexes,
    ...require("../backend/migrations/002-list-query-indexes.plan.json")
      .indexes,
  ];
  for (const expected of expectedIndexes) {
    const indexes = await mongoose.models[expected.model].collection
      .listIndexes()
      .toArray();
    const index =
      indexes.find((item) => item.name === expected.name) ||
      indexes.find(
        (item) =>
          JSON.stringify(item.key) === JSON.stringify(expected.key) &&
          (!item.unique || expected.acceptExistingUnique) &&
          !item.partialFilterExpression &&
          !item.sparse &&
          !item.hidden &&
          !item.collation,
      );
    assert.ok(index, `Missing index ${expected.name} after Mongo restart`);
    assert.deepEqual(index.key, expected.key);
  }
  const result = {
    status: "passed",
    persistedQueryIndexes: expectedIndexes.length,
    frontend: "http://127.0.0.1:5173",
    api: "http://127.0.0.1:5000/api/v1",
    database: "mongodb://127.0.0.1:27017/xtn_local?replicaSet=xtn-local",
    adminLogin: "passed",
    adminPages: 6,
    consoleErrors: 0,
    mongoRestart: "recovered",
    persistedAdminIdentity: "unchanged",
    cloudConnection: false,
  };
  fs.writeFileSync(
    path.join(root, "docs/redesign/evidence/full-check/local-runtime.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
})()
  .catch(() => {
    console.error(
      "Local runtime verification failed. Check page labels, readiness and local Mongo. Credentials are not logged.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
