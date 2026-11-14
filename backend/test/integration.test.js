const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("node:crypto");

const TEST = process.env.TEST_DATABASE_URL;
const enabled =
  !!TEST && /^postgres(ql)?:\/\/[^\s]*\/(xtn_test|xtn_test_\w+)(\?|$)/.test(TEST);
if (enabled) process.env.DATABASE_URL = TEST;
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "fixture-secret-that-is-more-than-32-characters";

const { query, disconnect } = require("../src/infrastructure/db");
const repo = require("../src/infrastructure/repository");
const { createApp } = require("../src/http/app");
const { periodId, bounds } = require("../src/domain/policy");

let server, base, admin, member, other;
const now = new Date();
const currentWeek = periodId(now);
const W2 = periodId(new Date(+bounds(currentWeek).start - 86400000));
const W1 = periodId(new Date(+bounds(W2).start - 86400000));
const time = (key, day, hour = 10) =>
  new Date(+bounds(key).start + day * 86400000 + hour * 3600000).toISOString();

async function request(
  path,
  method = "GET",
  body,
  token = member,
  key = randomUUID(),
) {
  const res = await fetch(base + "/api/v1" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Idempotency-Key": key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: await res.json() };
}
async function ok(path, method, body, token, key) {
  const r = await request(path, method, body, token, key);
  assert.ok(r.status < 300, JSON.stringify(r));
  return r.data;
}

before(async () => {
  if (!enabled) return;
  await query(`TRUNCATE users, products, orders, receipts, reports, movements,
    periods, member_periods, commands, audit_events, statements, tags, tasks,
    system_guards`);
  const password = await bcrypt.hash("fixture-password-2026", 4);
  const users = await Promise.all([
    repo.createUser(undefined, {
      username: "admin",
      name: "Admin",
      role: "ADMIN",
      password,
    }),
    repo.createUser(undefined, {
      username: "alice",
      name: "Alice",
      role: "DISTRIBUTOR",
      group: "Tài Chính",
      password,
      createdAt: time(W1, 0),
    }),
    repo.createUser(undefined, {
      username: "bob",
      name: "Bob",
      role: "DISTRIBUTOR",
      group: "Hậu Cần",
      password,
      createdAt: new Date(),
    }),
  ]);
  assert.equal(users.length, 3);
  server = createApp({
    jwtSecret: "fixture-secret-that-is-more-than-32-characters",
    inviteCode: null,
    origins: ["http://127.0.0.1:5173"],
    logRequests: false,
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  admin = (
    await ok(
      "/auth/login",
      "POST",
      { username: "admin", password: "fixture-password-2026" },
      null,
    )
  ).token;
  member = (
    await ok(
      "/auth/login",
      "POST",
      { username: "alice", password: "fixture-password-2026" },
      null,
    )
  ).token;
  other = (
    await ok(
      "/auth/login",
      "POST",
      { username: "bob", password: "fixture-password-2026" },
      null,
    )
  ).token;
});

after(async () => {
  if (!enabled) return;
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnect();
});

test("Postgres API port keeps inventory, reporting, idempotency and auth", {
  skip: !enabled && "TEST_DATABASE_URL must point at a dedicated xtn_test database",
}, async (t) => {
  await t.test("auth session revocation", async () => {
    const me = await ok("/auth/me", "GET", undefined, member);
    assert.equal(me.username, "alice");
    const bobToken = (
      await ok(
        "/auth/login",
        "POST",
        { username: "bob", password: "fixture-password-2026" },
        null,
      )
    ).token;
    await ok("/auth/logout", "POST", undefined, bobToken);
    assert.equal((await request("/auth/me", "GET", undefined, bobToken)).status, 401);
  });

  let product;
  await t.test("product create and idempotency", async () => {
    const key = randomUUID();
    const payload = {
      name: "Áo",
      price: 10000,
      unitCost: 6000,
      openingStock: 100,
    };
    product = await ok("/products", "POST", payload, admin, key);
    assert.equal(product.stock, 100);
    assert.equal(product.needsMigration, false);
    const replay = await ok("/products", "POST", payload, admin, key);
    assert.equal(replay.id, product.id);
    assert.equal(
      (
        await request(
          "/products",
          "POST",
          { ...payload, price: 11000 },
          admin,
          key,
        )
      ).status,
      409,
    );
    assert.equal((await request("/tasks", "GET", undefined, member)).status, 403);
  });

  await t.test("concurrent orders cannot oversell capacity", async () => {
    const limited = await ok(
      "/products",
      "POST",
      { name: "Giới hạn", price: 5000, unitCost: 1000, openingStock: 1 },
      admin,
    );
    const body = {
      items: [{ productId: limited.id, quantity: 1 }],
      intendedPeriodId: W2,
    };
    const results = await Promise.all([
      request("/orders", "POST", body, member),
      request("/orders", "POST", body, member),
    ]);
    assert.deepEqual(
      results.map((r) => r.status).sort(),
      [200, 409],
    );
    const winner = results.find((r) => r.status === 200).data;
    const cancel = await ok(
      `/orders/${winner.id}/status`,
      "PUT",
      { status: "CANCELLED", version: 0 },
      member,
    );
    assert.equal(cancel.status, "CANCELLED");
    const refreshed = await ok(`/products?limit=50`, "GET", undefined, admin);
    assert.equal(
      refreshed.items.find((p) => p.id === limited.id).reserved,
      0,
    );
  });

  await t.test("order reservation, receipt and report correction", async () => {
    const order = await ok(
      "/orders",
      "POST",
      {
        items: [{ productId: product.id, quantity: 10 }],
        intendedPeriodId: W2,
      },
      member,
    );
    assert.equal(order.status, "PENDING");
    assert.equal(
      (
        await request(
          "/orders",
          "POST",
          {
            items: [{ productId: product.id, quantity: 1 }],
            intendedPeriodId: W2,
          },
          admin,
        )
      ).status,
      403,
    );
    const approved = await ok(
      `/orders/${order.id}/status`,
      "PUT",
      { status: "APPROVED", version: 0 },
      admin,
    );
    assert.equal(approved.status, "APPROVED");
    const received = await ok(
      `/orders/${order.id}/receipts`,
      "POST",
      {
        items: [{ productId: product.id, quantity: 10 }],
        version: 1,
        effectiveAt: time(W2, 1),
      },
      admin,
    );
    assert.equal(received.order.status, "RECEIVED");
    const lot = received.receipts[0];
    // Reports for a past week require an admin extension.
    assert.equal(
      (
        await request(
          "/reports",
          "POST",
          {
            periodId: W2,
            lines: [{ lotId: lot.id, effectiveAt: time(W2, 2), sold: 4 }],
            notes: "muộn",
          },
          member,
        )
      ).status,
      409,
    );
    await ok(
      "/periods/member",
      "POST",
      {
        memberId: (await ok("/auth/me", "GET", undefined, member)).id,
        periodId: W2,
        targetRevenue: 50000,
        extensionUntil: new Date(Date.now() + 60000).toISOString(),
        reason: "Báo cáo muộn",
      },
      admin,
    );
    const report = await ok(
      "/reports",
      "POST",
      {
        periodId: W2,
        lines: [{ lotId: lot.id, effectiveAt: time(W2, 2), sold: 4 }],
        notes: "báo cáo",
      },
      member,
    );
    const approvedReport = await ok(
      `/reports/${report.id}/status`,
      "PUT",
      { status: "APPROVED", version: 0 },
      admin,
    );
    assert.equal(approvedReport.status, "APPROVED");

    let analytics = await ok(
      `/analytics/weekly?from=${W1}&to=${W2}`,
      "GET",
      undefined,
      admin,
    );
    const row = analytics.rows.find(
      (r) => r.memberName === "Alice" && r.periodId === W2,
    );
    assert.equal(row.revenue, 40000);
    assert.equal(row.contribution, 16000);
    assert.equal(row.received, 10);
    assert.equal(row.closing.physical, 6);
    assert.equal(analytics.totals.revenue, 40000);
    assert.equal(analytics.totals.contribution, 16000);
    assert.equal(analytics.totals.achievement, null);

    const corrected = await ok(
      `/reports/${report.id}/corrections`,
      "POST",
      {
        periodId: W2,
        lines: [{ lotId: lot.id, effectiveAt: time(W2, 2), sold: 3 }],
        notes: "sửa",
        version: 1,
        reason: "Sai số lượng",
      },
      admin,
    );
    assert.equal(corrected.replacesId, report.id);
    analytics = await ok(
      `/analytics/weekly?from=${W1}&to=${W2}`,
      "GET",
      undefined,
      admin,
    );
    const correctedRow = analytics.rows.find(
      (r) => r.memberName === "Alice" && r.periodId === W2,
    );
    assert.equal(correctedRow.revenue, 30000);
    assert.equal(analytics.totals.revenue, 30000);
    assert.equal(correctedRow.closing.physical, 7);
    const inventory = await ok("/inventory", "GET", undefined, member);
    assert.equal(inventory.lots[0].sellable, 7);
    assert.equal(inventory.lots[0].physical, 7);
  });

  await t.test("period completion, close and reopen", async () => {
    const me = await ok("/auth/me", "GET", undefined, member);
    await ok(
      "/periods/complete",
      "POST",
      { periodId: W2 },
      member,
    );
    // Simulate the extension window elapsing before the admin closes the week.
    await query(
      "UPDATE member_periods SET extension_until = now() - interval '1 minute' WHERE member_id = $1 AND period_id = $2",
      [me.id, W2],
    );
    const closed = await ok(
      "/periods/close",
      "POST",
      { periodId: W2, reason: "Chốt tuần" },
      admin,
    );
    assert.equal(closed.status, "CLOSED");
    const analytics = await ok(
      `/analytics/weekly?from=${W2}&to=${W2}`,
      "GET",
      undefined,
      admin,
    );
    assert.equal(
      analytics.rows.find((r) => r.memberName === "Alice").periodStatus,
      "CLOSED",
    );
    const reopened = await ok(
      "/periods/reopen",
      "POST",
      { periodId: W2, reason: "Mở lại" },
      admin,
    );
    assert.equal(reopened.status, "OPEN");
  });

  await t.test("cash statements deduplicate references", async () => {
    const tag = await ok(
      "/tags",
      "POST",
      { name: "Quỹ", color: "blue" },
      admin,
    );
    const statement = {
      transactionDate: new Date(Date.now() - 60000).toISOString(),
      type: "IN",
      amount: 20000,
      partnerName: "Nhà cung cấp",
      description: "Thu",
      reference: "REF-2026-001",
      tags: [tag.id],
    };
    await ok("/statements", "POST", statement, admin);
    assert.equal(
      (await request("/statements", "POST", statement, admin)).status,
      409,
    );
    const summary = await ok("/cash/summary", "GET", undefined, admin);
    assert.equal(summary.cashIn, 20000);
    assert.equal(summary.netCashFlow, 20000);
  });

  await t.test("username uniqueness and migration status", async () => {
    assert.equal(
      (
        await request(
          "/users",
          "POST",
          {
            username: "alice",
            name: "Alice 2",
            role: "DISTRIBUTOR",
            password: "another-password-2026",
          },
          admin,
        )
      ).status,
      409,
    );
    const migration = await ok("/migration/status", "GET", undefined, admin);
    assert.deepEqual(migration, { products: 0, orders: 0, reports: 0 });
  });
});
