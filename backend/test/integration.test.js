const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("node:crypto");
const m = require("../src/infrastructure/models");
const { createApp } = require("../src/http/app");
const { periodId, bounds } = require("../src/domain/policy");
let server, base, admin, member, other, userId;
const URI = process.env.TEST_MONGO_URI;
if (
  !URI ||
  !/^mongodb:\/\/127\.0\.0\.1:27028\/xtn_refactor_test[\w-]*(\?|$)/.test(URI)
)
  throw new Error(
    "TEST_MONGO_URI must use dedicated localhost:27028/xtn_refactor_test... database",
  );
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
const now = new Date();
const currentWeek = periodId(now);
const W2 = periodId(new Date(+bounds(currentWeek).start - 86400000)),
  W1 = periodId(new Date(+bounds(W2).start - 86400000));
const time = (key, day, hour = 10) =>
  new Date(+bounds(key).start + day * 86400000 + hour * 3600000).toISOString();
before(async () => {
  await m.mongoose.connect(URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 15000,
  });
  assert.equal(
    await m.User.countDocuments(),
    0,
    "Test requires a fresh database suffix",
  );
  // Schema-owned writes initialize only this fresh test database, never production.
  const password = await bcrypt.hash("fixture-password-2026", 4);
  const users = await m.User.create([
    { username: "admin", name: "Admin", role: "ADMIN", password },
    {
      username: "alice",
      name: "Alice",
      role: "DISTRIBUTOR",
      group: "Tài Chính",
      password,
      createdAt: time(W1, 0),
    },
    {
      username: "bob",
      name: "Bob",
      role: "DISTRIBUTOR",
      group: "Hậu Cần",
      password,
      createdAt: time(W1, 0),
    },
  ]);
  userId = users[1].id;
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
  if (server) await new Promise((resolve) => server.close(resolve));
  await m.mongoose.disconnect();
});
async function product(name, stock = 100, cost = 6000) {
  return ok(
    "/products",
    "POST",
    { name, price: 10000, unitCost: cost, openingStock: stock },
    admin,
  );
}
async function allocate(p, q, week = W1) {
  let o = await ok("/orders", "POST", {
    items: [{ productId: p.id, quantity: q }],
    intendedPeriodId: week,
  });
  o = await ok(
    `/orders/${o.id}/status`,
    "PUT",
    { status: "APPROVED", version: o.version },
    admin,
  );
  return o;
}
async function receive(o, p, q, when) {
  return ok(`/orders/${o.id}/receipts`, "POST", {
    items: [{ productId: p.id, quantity: q }],
    effectiveAt: when,
    version: o.version,
  });
}
async function approve(p, lot, key, day, counts) {
  const r = await ok("/reports", "POST", {
    periodId: key,
    lines: [{ lotId: lot.id, effectiveAt: time(key, day), ...counts }],
  });
  return ok(
    `/reports/${r.id}/status`,
    "PUT",
    { status: "APPROVED", version: r.version },
    admin,
  );
}
test("fail-closed signup, admin-only internal resources, no hash leak, legacy API closed", async () => {
  assert.equal(
    (
      await request(
        "/auth/register",
        "POST",
        {
          username: "evil",
          name: "Evil",
          role: "ADMIN",
          password: "fixture-password-2026",
        },
        null,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/auth/register",
        "POST",
        {
          username: "evil",
          name: "Evil",
          role: "ADMIN",
          password: "fixture-password-2026",
          securityCode: "x",
        },
        null,
      )
    ).status,
    403,
  );
  assert.equal((await request("/tasks")).status, 403);
  const u = await ok("/users", "GET", undefined, admin);
  assert.equal(JSON.stringify(u).includes("password"), false);
  assert.equal(
    (await fetch(base + "/api/orders", { method: "POST" })).status,
    410,
  );
});
test("multi-line failure rolls back reservation and order; negative/empty input rejected", async () => {
  const p = await product("rollback", 10);
  assert.equal(
    (
      await request("/orders", "POST", {
        items: [
          { productId: p.id, quantity: 2 },
          { productId: "000000000000000000000001", quantity: 1 },
        ],
        intendedPeriodId: W1,
      })
    ).status,
    404,
  );
  assert.equal((await m.Product.findById(p.id)).reserved, 0);
  assert.equal(await m.Order.countDocuments({ "items.productId": p.id }), 0);
  assert.equal(
    (
      await request("/orders", "POST", {
        items: [{ productId: p.id, quantity: -1 }],
        intendedPeriodId: W1,
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/orders", "POST", { items: [], intendedPeriodId: W1 }))
      .status,
    400,
  );
});
test("concurrent requests for stock=1 allow one; same key replays and payload conflict rejected", async () => {
  const p = await product("concurrent", 1);
  const payload = {
    items: [{ productId: p.id, quantity: 1 }],
    intendedPeriodId: W1,
  };
  const results = await Promise.all([
    request("/orders", "POST", payload),
    request("/orders", "POST", payload),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await m.Product.findById(p.id)).reserved, 1);
  const p2 = await product("replay", 5),
    key = randomUUID(),
    body = { items: [{ productId: p2.id, quantity: 2 }], intendedPeriodId: W1 };
  const replay = await Promise.all([
    request("/orders", "POST", body, member, key),
    request("/orders", "POST", body, member, key),
  ]);
  assert.ok(
    replay.every((r) => r.status === 200),
    JSON.stringify(replay),
  );
  assert.equal(replay[0].data.id, replay[1].data.id);
  assert.equal((await m.Product.findById(p2.id)).reserved, 2);
  assert.equal(
    (
      await request(
        "/orders",
        "POST",
        { ...body, items: [{ productId: p2.id, quantity: 3 }] },
        member,
        key,
      )
    ).status,
    409,
  );
});
test("partial receipts, ownership, cancellation and amendment release only remaining reservation", async () => {
  const p = await product("partial", 10);
  const o = await allocate(p, 5);
  assert.equal(
    (
      await request(
        `/orders/${o.id}/receipts`,
        "POST",
        {
          items: [{ productId: p.id, quantity: 2 }],
          effectiveAt: time(W1, 2),
          version: o.version,
        },
        other,
      )
    ).status,
    403,
  );
  const received = await receive(o, p, 2, time(W1, 2));
  assert.equal(received.order.status, "PARTIALLY_RECEIVED");
  const cancel = await ok(`/orders/${o.id}/status`, "PUT", {
    status: "CANCELLED",
    version: received.order.version,
  });
  assert.equal(cancel.status, "CANCELLED");
  const after = await m.Product.findById(p.id);
  assert.equal(after.onHand, 8);
  assert.equal(after.reserved, 0);
  assert.equal(
    (
      await request(`/orders/${o.id}/status`, "PUT", {
        status: "CANCELLED",
        version: cancel.version,
      })
    ).status,
    409,
  );
});
test("two-week ledger: multiple receipts/reports, late submission, damage→gift, snapshots, weighted KPI, correction", async () => {
  const weeklyUser = await m.User.create({
    username: "weekly-alice",
    name: "Weekly Alice",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
    createdAt: time(W1, 0),
  });
  userId = weeklyUser.id;
  member = (
    await ok(
      "/auth/login",
      "POST",
      { username: "weekly-alice", password: "fixture-password-2026" },
      null,
    )
  ).token;
  const p = await product("weekly");
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: userId,
      periodId: W1,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      targetRevenue: 200000,
      reason: "Cho phép nộp muộn",
    },
    admin,
  );
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: userId,
      periodId: W2,
      targetRevenue: 300000,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Mục tiêu tuần",
    },
    admin,
  );
  let o = await allocate(p, 30),
    r = await receive(o, p, 20, time(W1, 2, 9));
  o = r.order;
  const lot1 = r.receipts[0];
  r = await receive(o, p, 10, time(W1, 4, 9));
  const lot2 = r.receipts[0];
  const original = await approve(p, lot1, W1, 3, { sold: 8, damaged: 3 });
  await approve(p, lot1, W1, 4, { giftDamaged: 3, giftGood: 2 });
  await approve(p, lot2, W1, 5, { sold: 4 });
  o = await allocate(p, 5, W2);
  const lot3 = (await receive(o, p, 5, time(W2, 1, 9))).receipts[0];
  await approve(p, lot1, W2, 2, { sold: 7 });
  await approve(p, lot3, W2, 2, { sold: 3 });
  await ok(
    `/products/${p.id}`,
    "PUT",
    { price: 99000, unitCost: 88000 },
    admin,
  );
  let data = await ok(`/analytics/weekly?from=${W1}&to=${W2}`);
  const a = data.rows.find((x) => x.periodId === W1),
    b = data.rows.find((x) => x.periodId === W2);
  assert.equal(a.revenue, 120000);
  assert.equal(a.contribution, 18000);
  assert.equal(a.closing.physical, 13);
  assert.equal(b.revenue, 100000);
  assert.equal(b.closing.physical, 8);
  assert.equal(data.totals.revenue, 220000);
  assert.equal(data.totals.contribution, 58000);
  assert.equal(data.totals.achievement, null);
  assert.equal(a.hasExtension, true);
  // Reporting before receipt fails at approval, entire post rolled back.
  const invalid = await ok("/reports", "POST", {
    periodId: W1,
    lines: [{ lotId: lot2.id, effectiveAt: time(W1, 1), sold: 1 }],
  });
  assert.equal(
    (
      await request(
        `/reports/${invalid.id}/status`,
        "PUT",
        { status: "APPROVED", version: invalid.version },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(await m.Movement.countDocuments({ sourceId: invalid.id }), 0);
  await ok(
    `/reports/${invalid.id}/status`,
    "PUT",
    { status: "REJECTED", version: invalid.version },
    admin,
  );
  // Reduce old W1 sold by one; all W2 balances are rebuilt from the ledger.
  const corrected = await ok(
    `/reports/${original.id}/corrections`,
    "POST",
    {
      periodId: W1,
      version: original.version,
      reason: "Kiểm kê điều chỉnh",
      notes: "",
      lines: [
        { lotId: lot1.id, effectiveAt: time(W1, 3), sold: 7, damaged: 3 },
      ],
    },
    admin,
  );
  assert.equal(corrected.replacesId, original.id);
  data = await ok(`/analytics/weekly?from=${W1}&to=${W2}`);
  assert.equal(data.totals.revenue, 210000);
  assert.equal(data.rows.find((x) => x.periodId === W2).closing.physical, 9);
  assert.equal(
    (
      await request(
        `/reports/${original.id}/corrections`,
        "POST",
        {
          periodId: W1,
          version: original.version,
          reason: "Lặp bản cũ",
          lines: [{ lotId: lot1.id, effectiveAt: time(W1, 3), sold: 7 }],
        },
        admin,
      )
    ).status,
    409,
  );
});
test("legacy uninitialized inventory refused, unknown cost null, revoked user token rejected", async () => {
  const legacy = await m.Product.create({
    name: "legacy",
    price: 100,
    stock: 10,
  });
  assert.equal(
    (
      await request("/orders", "POST", {
        items: [{ productId: legacy.id, quantity: 1 }],
        intendedPeriodId: W1,
      })
    ).data.code,
    "MIGRATION_REQUIRED",
  );
  const p = await product("unknown", 10, null),
    o = await allocate(p, 1),
    lot = (await receive(o, p, 1, time(W1, 0, 10))).receipts[0];
  await approve(p, lot, W1, 0, { sold: 1 });
  const data = await ok(`/analytics/weekly?from=${W1}&to=${W1}`);
  assert.equal(data.totals.contribution, null);
  const otherUser = await m.User.findOne({ username: "bob" });
  await ok(`/users/${otherUser.id}`, "PUT", { active: false }, admin);
  assert.equal((await request("/orders", "GET", undefined, other)).status, 401);
});
test("concurrent sales in different periods cannot oversell the same lot", async () => {
  const account = await m.User.create({
    username: "crossweek",
    name: "Cross Week",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
    createdAt: time(W1, 0),
  });
  const token = (
    await ok(
      "/auth/login",
      "POST",
      { username: "crossweek", password: "fixture-password-2026" },
      null,
    )
  ).token;
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: account.id,
      periodId: W1,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Gia hạn thử nghiệm",
    },
    admin,
  );
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: account.id,
      periodId: W2,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Gia hạn tuần thứ hai",
    },
    admin,
  );
  const p = await product("crossweek", 5);
  let o = await ok(
    "/orders",
    "POST",
    { items: [{ productId: p.id, quantity: 5 }], intendedPeriodId: W1 },
    token,
  );
  o = await ok(
    `/orders/${o.id}/status`,
    "PUT",
    { status: "APPROVED", version: o.version },
    admin,
  );
  const lot = (
    await ok(
      `/orders/${o.id}/receipts`,
      "POST",
      {
        items: [{ productId: p.id, quantity: 5 }],
        effectiveAt: time(W1, 0),
        version: o.version,
      },
      token,
    )
  ).receipts[0];
  const r1 = await ok(
    "/reports",
    "POST",
    {
      periodId: W1,
      lines: [{ lotId: lot.id, effectiveAt: time(W1, 1), sold: 4 }],
    },
    token,
  );
  const r2 = await ok(
    "/reports",
    "POST",
    {
      periodId: W2,
      lines: [{ lotId: lot.id, effectiveAt: time(W2, 0), sold: 4 }],
    },
    token,
  );
  const result = await Promise.all([
    request(
      `/reports/${r1.id}/status`,
      "PUT",
      { status: "APPROVED", version: 0 },
      admin,
    ),
    request(
      `/reports/${r2.id}/status`,
      "PUT",
      { status: "APPROVED", version: 0 },
      admin,
    ),
  ]);
  assert.deepEqual(result.map((r) => r.status).sort(), [200, 409]);
  const inventory = await ok("/inventory", "GET", undefined, token);
  assert.equal(inventory.lots[0].sellable, 1);
});
test("member completion, weighted multi-week KPI, close guard, closed writes and reopen", async () => {
  const account = await m.User.create({
    username: "closing",
    name: "Closing Member",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
    createdAt: time(W1, 0),
  });
  const token = (
    await ok(
      "/auth/login",
      "POST",
      { username: "closing", password: "fixture-password-2026" },
      null,
    )
  ).token;
  // Zero-activity completion is explicit, never inferred from missing reports.
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: account.id,
      periodId: W1,
      targetRevenue: 100,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Cho phép chốt",
    },
    admin,
  );
  await ok("/periods/complete", "POST", { periodId: W1 }, token);
  let data = await ok(
    `/analytics/weekly?from=${W1}&to=${W1}`,
    "GET",
    undefined,
    token,
  );
  assert.equal(data.totals.incompleteRows, 0);
  assert.equal(data.totals.achievement, 0);
  assert.equal(
    (
      await request(
        "/periods/close",
        "POST",
        { periodId: W1, reason: "Chốt" },
        admin,
      )
    ).status,
    409,
  );
  const pending = await m.Report.find({ periodId: W1, status: "PENDING" });
  for (const report of pending)
    await ok(
      `/reports/${report.id}/status`,
      "PUT",
      { status: "REJECTED", version: report.version },
      admin,
    );
  // Isolated fixture sets other members complete and expires granted extensions.
  const members = await m.User.find({
    role: "DISTRIBUTOR",
    active: { $ne: false },
  });
  for (const u of members) {
    await m.MemberPeriod.updateOne(
      { _id: `${u.id}:${W1}` },
      {
        $set: { memberId: u.id, periodId: W1, complete: true },
        $unset: { extensionUntil: 1 },
      },
      { upsert: true },
    );
  }
  await ok(
    "/periods/close",
    "POST",
    { periodId: W1, reason: "Đã chốt đủ" },
    admin,
  );
  assert.equal(
    (
      await request(
        "/periods/member",
        "POST",
        {
          memberId: account.id,
          periodId: W1,
          targetRevenue: 500,
          reason: "Sửa sau khóa",
        },
        admin,
      )
    ).data.code,
    "PERIOD_CLOSED",
  );
  await ok(
    "/periods/reopen",
    "POST",
    { periodId: W1, reason: "Kiểm kê lại" },
    admin,
  );
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: account.id,
      periodId: W1,
      targetRevenue: 500,
      reason: "Cập nhật sau mở",
    },
    admin,
  );
});
test("warehouse damage/gift, financial references, cash totals and immutable void", async () => {
  const p = await product("warehouse", 10);
  const result = await ok(
    `/products/${p.id}/activity`,
    "POST",
    { damaged: 3, giftDamaged: 3, giftGood: 2, reason: "Tặng hàng" },
    admin,
  );
  assert.equal(result.physicalStock, 5);
  assert.equal(result.stock, 5);
  const statement = await ok(
    "/statements",
    "POST",
    {
      transactionDate: new Date().toISOString(),
      type: "IN",
      amount: 10000,
      partnerName: "A",
      reference: "bank-fixture",
      description: "Fixture",
    },
    admin,
  );
  assert.equal(
    (
      await request(
        "/statements",
        "POST",
        {
          transactionDate: new Date().toISOString(),
          type: "IN",
          amount: 10000,
          partnerName: "A",
          reference: "bank-fixture",
        },
        admin,
      )
    ).status,
    409,
  );
  let cash = await ok("/cash/summary", "GET", undefined, admin);
  assert.equal(cash.netCashFlow, 10000);
  await ok(
    `/statements/${statement.id}/void`,
    "POST",
    { reason: "Nhập sai" },
    admin,
  );
  cash = await ok("/cash/summary", "GET", undefined, admin);
  assert.equal(cash.netCashFlow, 0);
  assert.equal(await m.Statement.countDocuments({ _id: statement.id }), 1);
});
test("forged totals rejected; money overflow rolls back; order amendment changes reservation delta", async () => {
  const p = await product("amend", 10);
  let o = await ok("/orders", "POST", {
    items: [
      { productId: p.id, quantity: 2 },
      { productId: p.id, quantity: 1 },
    ],
    intendedPeriodId: W2,
  });
  assert.equal(o.items.length, 1);
  assert.equal((await m.Product.findById(p.id)).reserved, 3);
  o = await ok(`/orders/${o.id}`, "PUT", {
    items: [{ productId: p.id, quantity: 5 }],
    version: o.version,
  });
  assert.equal((await m.Product.findById(p.id)).reserved, 5);
  await ok(`/orders/${o.id}/status`, "PUT", {
    status: "CANCELLED",
    version: o.version,
  });
  assert.equal((await m.Product.findById(p.id)).reserved, 0);
  assert.equal(
    (
      await request("/reports", "POST", {
        periodId: W2,
        totalRevenue: 123,
        lines: [],
      })
    ).status,
    400,
  );
  const costly = await ok(
    "/products",
    "POST",
    {
      name: "overflow",
      price: 1000000000000,
      unitCost: null,
      openingStock: 1000000,
    },
    admin,
  );
  assert.equal(
    (
      await request("/orders", "POST", {
        items: [{ productId: costly.id, quantity: 1000000 }],
        intendedPeriodId: W2,
      })
    ).data.code,
    "MONEY_OVERFLOW",
  );
  assert.equal((await m.Product.findById(costly.id)).reserved, 0);
});
test("expired reporting requires extension; pending amendments and password reset revoke previous sessions", async () => {
  const u = await m.User.create({
    username: "late-member",
    name: "Late Member",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
    createdAt: time(W1, 0),
  });
  const token = (
    await ok(
      "/auth/login",
      "POST",
      { username: u.username, password: "fixture-password-2026" },
      null,
    )
  ).token;
  const p = await product("late", 5);
  let order = await ok(
    "/orders",
    "POST",
    { items: [{ productId: p.id, quantity: 5 }], intendedPeriodId: W1 },
    token,
  );
  order = await ok(
    `/orders/${order.id}/status`,
    "PUT",
    { status: "APPROVED", version: 0 },
    admin,
  );
  const lot = (
    await ok(
      `/orders/${order.id}/receipts`,
      "POST",
      {
        items: [{ productId: p.id, quantity: 5 }],
        effectiveAt: time(W1, 0),
        version: order.version,
      },
      token,
    )
  ).receipts[0];
  const input = {
    periodId: W1,
    lines: [{ lotId: lot.id, effectiveAt: time(W1, 1), sold: 1 }],
  };
  assert.equal(
    (await request("/reports", "POST", input, token)).data.code,
    "REPORT_DEADLINE",
  );
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: u.id,
      periodId: W1,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Quên nộp",
    },
    admin,
  );
  const report = await ok("/reports", "POST", input, token);
  const edited = await ok(
    `/reports/${report.id}`,
    "PUT",
    {
      ...input,
      lines: [{ lotId: lot.id, effectiveAt: time(W1, 1), sold: 2 }],
      version: report.version,
    },
    token,
  );
  assert.equal(edited.lines[0].sold, 2);
  await ok(
    `/users/${u.id}/password`,
    "PUT",
    { password: "new-fixture-password-2026" },
    admin,
  );
  assert.equal(
    (await request("/auth/me", "GET", undefined, token)).status,
    401,
  );
});

test("partial product patch preserves costing and tag filters are non-additive", async () => {
  const p = await product("cost-preserved", 5);
  const before = await m.Product.findById(p.id);
  await ok(`/products/${p.id}`, "PUT", { active: false }, admin);
  assert.equal((await m.Product.findById(p.id)).unitCost, before.unitCost);
  const a = await ok("/tags", "POST", { name: "Nhóm A" }, admin),
    b = await ok("/tags", "POST", { name: "Nhóm B" }, admin);
  await ok(
    "/statements",
    "POST",
    {
      transactionDate: new Date().toISOString(),
      type: "IN",
      amount: 250,
      partnerName: "Tag fixture",
      reference: "two-tags",
      tags: [a.id, b.id],
    },
    admin,
  );
  assert.equal(
    (await ok(`/cash/summary?tagId=${a.id}`, "GET", undefined, admin))
      .netCashFlow,
    250,
  );
  assert.equal(
    (await ok(`/cash/summary?tagId=${b.id}`, "GET", undefined, admin))
      .netCashFlow,
    250,
  );
  assert.equal(
    (await ok("/cash/summary", "GET", undefined, admin)).netCashFlow,
    250,
  );
  assert.equal(
    (await ok(`/statements?tagId=${a.id}`, "GET", undefined, admin)).items
      .length,
    1,
  );
});

test("backdated receipt and later period close serialize; receipts cannot precede membership", async () => {
  const W0 = periodId(new Date(+bounds(W1).start - 86400000));
  const u = await m.User.create({
    username: "closing-race",
    name: "Closing Race",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
    createdAt: time(W0, 0),
  });
  const token = (
    await ok(
      "/auth/login",
      "POST",
      { username: u.username, password: "fixture-password-2026" },
      null,
    )
  ).token;
  const p = await product("closing-race", 3);
  let o = await ok(
    "/orders",
    "POST",
    { items: [{ productId: p.id, quantity: 3 }], intendedPeriodId: W0 },
    token,
  );
  o = await ok(
    `/orders/${o.id}/status`,
    "PUT",
    { status: "APPROVED", version: 0 },
    admin,
  );
  assert.equal(
    (
      await request(
        `/orders/${o.id}/receipts`,
        "POST",
        {
          items: [{ productId: p.id, quantity: 1 }],
          effectiveAt: new Date(+bounds(W0).start - 86400000).toISOString(),
          version: o.version,
        },
        token,
      )
    ).data.code,
    "BEFORE_MEMBER_JOIN",
  );
  assert.equal((await m.Product.findById(p.id)).reserved, 3);
  // Prepare an otherwise closable later week in the isolated test DB.
  await m.Report.updateMany(
    { periodId: W1, status: "PENDING" },
    { $set: { status: "REJECTED" } },
  );
  for (const member of await m.User.find({
    role: "DISTRIBUTOR",
    active: { $ne: false },
    createdAt: { $lt: bounds(W1).end },
  }))
    await m.MemberPeriod.updateOne(
      { _id: `${member.id}:${W1}` },
      {
        $set: {
          memberId: member.id,
          periodId: W1,
          complete: true,
          extensionUntil: new Date(0),
        },
      },
      { upsert: true },
    );
  const results = await Promise.all([
    request(
      "/periods/close",
      "POST",
      { periodId: W1, reason: "Race fixture" },
      admin,
    ),
    request(
      `/orders/${o.id}/receipts`,
      "POST",
      {
        items: [{ productId: p.id, quantity: 1 }],
        effectiveAt: time(W0, 1),
        version: o.version,
      },
      token,
    ),
  ]);
  assert.equal(
    results.filter((r) => r.status === 200).length,
    1,
    JSON.stringify(results),
  );
  assert.ok(
    results.some((r) =>
      ["INCOMPLETE_PERIOD", "DOWNSTREAM_PERIOD_CLOSED"].includes(r.data.code),
    ),
    JSON.stringify(results),
  );
  const state = await m.Period.findById(W1);
  const receipts = await m.Receipt.countDocuments({ orderId: o.id });
  assert.equal(
    state.status === "CLOSED" ? receipts === 0 : receipts === 1,
    true,
  );
});

test("nonzero multi-week KPI is weighted, group snapshots survive change, completion is explicit", async () => {
  if ((await m.Period.findById(W1))?.status === "CLOSED")
    await ok(
      "/periods/reopen",
      "POST",
      { periodId: W1, reason: "Isolated KPI scenario" },
      admin,
    );
  const u = await m.User.create({
    username: "weighted-kpi",
    name: "Weighted KPI",
    group: "Alpha",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
    createdAt: time(W1, 0),
  });
  const token = (
    await ok(
      "/auth/login",
      "POST",
      { username: u.username, password: "fixture-password-2026" },
      null,
    )
  ).token;
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: u.id,
      periodId: W1,
      targetRevenue: 100000,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Week one",
    },
    admin,
  );
  await ok(`/users/${u.id}`, "PUT", { group: "Beta" }, admin);
  await ok(
    "/periods/member",
    "POST",
    {
      memberId: u.id,
      periodId: W2,
      targetRevenue: 400000,
      extensionUntil: new Date(Date.now() + 86400000).toISOString(),
      reason: "Week two",
    },
    admin,
  );
  const p = await product("weighted-kpi", 10);
  let o = await ok(
    "/orders",
    "POST",
    { items: [{ productId: p.id, quantity: 10 }], intendedPeriodId: W1 },
    token,
  );
  o = await ok(
    `/orders/${o.id}/status`,
    "PUT",
    { status: "APPROVED", version: 0 },
    admin,
  );
  const lot = (
    await ok(
      `/orders/${o.id}/receipts`,
      "POST",
      {
        items: [{ productId: p.id, quantity: 10 }],
        effectiveAt: time(W1, 0),
        version: o.version,
      },
      token,
    )
  ).receipts[0];
  for (const [week, sold] of [
    [W1, 5],
    [W2, 2],
  ]) {
    const r = await ok(
      "/reports",
      "POST",
      {
        periodId: week,
        lines: [{ lotId: lot.id, effectiveAt: time(week, 1), sold }],
      },
      token,
    );
    await ok(
      `/reports/${r.id}/status`,
      "PUT",
      { status: "APPROVED", version: 0 },
      admin,
    );
  }
  let result = await ok(
    `/analytics/weekly?from=${W1}&to=${W2}`,
    "GET",
    undefined,
    token,
  );
  assert.equal(result.totals.achievement, null);
  for (const week of [W1, W2])
    await ok("/periods/complete", "POST", { periodId: week }, token);
  result = await ok(
    `/analytics/weekly?from=${W1}&to=${W2}`,
    "GET",
    undefined,
    token,
  );
  assert.ok(Math.abs(result.totals.achievement - 14) < 1e-9);
  assert.ok(Math.abs(result.memberTotals[0].achievement - 14) < 1e-9);
  assert.equal(result.totals.revenue, 70000);
  assert.equal(result.totals.contribution, 28000);
  assert.equal(result.memberTotals[0].closing.physical, 3);
  assert.deepEqual(
    result.rows.map((r) => r.group),
    ["Alpha", "Beta"],
  );
  assert.deepEqual(
    result.rows.map((r) => r.achievement),
    [50, 5],
  );
  assert.equal(
    (
      await request(
        "/periods/close",
        "POST",
        { periodId: currentWeek, reason: "Still current" },
        admin,
      )
    ).data.code,
    "PERIOD_NOT_FINISHED",
  );
});
test("tasks lifecycle, internal authorization, pagination, logout and audit secrecy", async () => {
  const t = await ok(
    "/tasks",
    "POST",
    {
      title: "Verify work",
      description: "Review architecture",
      assigneeId: (await m.User.findOne({ username: "admin" })).id,
      priority: "HIGH",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    },
    admin,
  );
  assert.equal(t.priority, "HIGH");
  assert.equal(
    (await request("/tasks", "POST", { title: "Forbidden" })).status,
    403,
  );
  await ok(`/tasks/${t.id}`, "PUT", { status: "IN_PROGRESS" }, admin);
  await ok(`/tasks/${t.id}`, "PUT", { status: "REVIEW" }, admin);
  await ok(`/tasks/${t.id}`, "PUT", { status: "DONE", active: false }, admin);
  assert.equal(
    (await ok("/tasks", "GET", undefined, admin)).items.some(
      (i) => i.id === t.id,
    ),
    false,
  );
  assert.equal((await m.Task.findById(t.id)).status, "DONE");
  assert.equal(
    (
      await request(
        "/tasks",
        "POST",
        { title: "Invalid assignee", assigneeId: userId },
        admin,
      )
    ).data.code,
    "INVALID_ASSIGNEE",
  );
  const page1 = await ok("/products?limit=1", "GET", undefined, admin),
    page2 = await ok("/products?limit=1&offset=1", "GET", undefined, admin);
  assert.equal(page1.hasMore, true);
  assert.notEqual(page1.items[0].id, page2.items[0].id);
  assert.equal(
    (await request("/products?limit=201", "GET", undefined, admin)).status,
    400,
  );
  for (const path of [
    "/users",
    "/statements",
    "/cash/summary",
    "/audit",
    "/migration/status",
    "/tags",
  ])
    assert.equal((await request(path)).status, 403, path);
  const audit = await ok("/audit?limit=200", "GET", undefined, admin);
  assert.equal(JSON.stringify(audit).includes("fixture-password"), false);
  assert.ok(audit.items.some((i) => i.action.startsWith("task.")));
  const logged = (
    await ok(
      "/auth/login",
      "POST",
      { username: "weighted-kpi", password: "fixture-password-2026" },
      null,
    )
  ).token;
  await ok("/auth/logout", "POST", {}, logged);
  assert.equal(
    (await request("/auth/me", "GET", undefined, logged)).status,
    401,
  );
});

test("independent reconciliation: physical warehouse, reservations, lot balances and approved revenue agree with stored ledger", async () => {
  const warehouse = await m.Movement.find({
    memberId: { $exists: false },
  }).lean();
  const orders = await m.Order.find({
    schemaVersion: 1,
    status: { $in: ["PENDING", "APPROVED", "PARTIALLY_RECEIVED"] },
  }).lean();
  for (const p of await m.Product.find({ inventoryVersion: 1 }).lean()) {
    const entries = warehouse.filter(
      (v) => String(v.productId) === String(p._id),
    );
    assert.equal(
      entries.reduce((s, v) => s + v.sellableDelta + v.damagedDelta, 0),
      p.onHand,
      p.name,
    );
    assert.equal(
      entries.reduce((s, v) => s + v.damagedDelta, 0),
      p.damagedOnHand,
      p.name,
    );
    const reserved = orders
      .flatMap((o) => o.items)
      .filter((i) => String(i.productId) === String(p._id))
      .reduce((s, i) => s + i.quantity - i.receivedQuantity, 0);
    assert.equal(reserved, p.reserved, p.name);
  }
  const members = await m.User.find({ role: "DISTRIBUTOR" }).lean();
  for (const u of members) {
    const inventory = await ok(
      `/inventory?memberId=${u._id}`,
      "GET",
      undefined,
      admin,
    );
    const history = await m.Movement.find({ memberId: u._id }).lean();
    for (const lot of inventory.lots) {
      const entries = history.filter((v) => String(v.lotId) === lot.id);
      assert.equal(
        lot.physical,
        entries.reduce((s, v) => s + v.sellableDelta + v.damagedDelta, 0),
      );
      assert.ok(lot.sellable >= 0 && lot.damaged >= 0);
    }
  }
  const approved = await m.Report.find({
    schemaVersion: 1,
    status: "APPROVED",
    periodId: { $in: [W1, W2] },
  }).lean();
  const receipts = await m.Receipt.find().lean();
  let revenue = 0,
    sold = 0;
  for (const report of approved)
    for (const line of report.lines) {
      const lot = receipts.find((l) => String(l._id) === String(line.lotId));
      revenue += line.sold * lot.price;
      sold += line.sold;
    }
  const result = await ok(
    `/analytics/weekly?from=${W1}&to=${W2}`,
    "GET",
    undefined,
    admin,
  );
  assert.equal(result.totals.revenue, revenue);
  assert.equal(result.totals.sold, sold);
});

test("weekly detail pagination never changes organization totals; inventory carries across range boundaries", async () => {
  const all = await ok(
    `/analytics/weekly?from=${W1}&to=${W2}&limit=200`,
    "GET",
    undefined,
    admin,
  );
  const a = await ok(
      `/analytics/weekly?from=${W1}&to=${W2}&limit=1&offset=0`,
      "GET",
      undefined,
      admin,
    ),
    b = await ok(
      `/analytics/weekly?from=${W1}&to=${W2}&limit=1&offset=1`,
      "GET",
      undefined,
      admin,
    );
  assert.deepEqual(a.totals, all.totals);
  assert.deepEqual(b.totals, all.totals);
  assert.equal(a.pagination.hasMore, true);
  assert.equal(a.memberTotals.length, 1);
  assert.notEqual(a.memberTotals[0].memberId, b.memberTotals[0].memberId);
  assert.ok(a.rows.every((r) => r.memberId === a.memberTotals[0].memberId));
  const empty = await ok(
    `/analytics/weekly?from=${W1}&to=${W2}&limit=1&offset=10000`,
    "GET",
    undefined,
    admin,
  );
  assert.equal(empty.rows.length, 0);
  assert.deepEqual(empty.totals, all.totals);
  assert.equal(empty.provisional, all.provisional);
  assert.equal(
    (
      await request(
        `/analytics/weekly?from=${W1}&to=${W2}&limit=201`,
        "GET",
        undefined,
        admin,
      )
    ).status,
    400,
  );
  const token = (
    await ok(
      "/auth/login",
      "POST",
      { username: "weighted-kpi", password: "fixture-password-2026" },
      null,
    )
  ).token;
  const result = await ok(
    `/analytics/weekly?from=${W2}&to=${W2}`,
    "GET",
    undefined,
    token,
  );
  assert.equal(result.rows[0].opening.physical, 5);
  assert.equal(result.rows[0].closing.physical, 3);
  assert.equal(result.totals.revenue, 20000);
  assert.equal(result.rows[0].received, 0);
});

test("session refresh does not consume the public login rate limit", async () => {
  const username = `rate-test-${randomUUID()}`;
  await m.User.create({
    username,
    name: "Rate limit verification",
    role: "DISTRIBUTOR",
    password: await bcrypt.hash("fixture-password-2026", 4),
  });
  const isolated = createApp({
    jwtSecret: "fixture-secret-that-is-more-than-32-characters",
    inviteCode: null,
    origins: ["http://127.0.0.1:5173"],
    logRequests: false,
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => isolated.once("listening", resolve));
  const url = `http://127.0.0.1:${isolated.address().port}/api/v1/auth`;
  try {
    const login = await fetch(url + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "fixture-password-2026" }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    for (let i = 0; i < 30; i++) {
      const me = await fetch(url + "/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(me.status, 200);
      await me.arrayBuffer();
    }
    for (let i = 0; i < 20; i++) {
      const bad = await fetch(url + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "wrong-password" }),
      });
      assert.equal(bad.status, i < 19 ? 401 : 429);
      await bad.arrayBuffer();
    }
    assert.equal(
      (
        await fetch(url + "/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      200,
    );
  } finally {
    await new Promise((resolve) => isolated.close(resolve));
  }
});
