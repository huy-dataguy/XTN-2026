// Synthetic historical scale data in a fresh, URI-guarded local benchmark DB only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const bcrypt = require("../backend/node_modules/bcryptjs");
const m = require("../backend/src/infrastructure/models");
const { periodId, bounds } = require("../backend/src/domain/policy");
(async () => {
  const uri = process.env.TEST_MONGO_URI,
    count = Number(process.env.SCALE_MEMBERS || 1000);
  assert.match(
    uri || "",
    /^mongodb:\/\/127\.0\.0\.1:27028\/xtn_refactor_test_scale_[\w]+\?directConnection=true$/,
  );
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 5000);
  await m.mongoose.connect(uri, { autoIndex: false });
  assert.equal(await m.User.countDocuments(), 0, "Fresh benchmark DB required");
  const last = periodId(
    new Date(+bounds(periodId(new Date())).start - 86400000),
  );
  const keys = Array.from({ length: 26 }, (_, i) =>
    periodId(new Date(+bounds(last).start - (25 - i) * 7 * 86400000)),
  );
  const when = (key, days, hours = 10) =>
    new Date(+bounds(key).start + days * 86400000 + hours * 3600000);
  const password = await bcrypt.hash("scale-fixture-password", 4),
    admin = await m.User.create({
      username: "scale-admin",
      name: "Scale Admin",
      role: "ADMIN",
      password,
    });
  const users = await m.User.insertMany(
    Array.from({ length: count }, (_, i) => ({
      username: `scale-${i}`,
      name: `Member ${String(i).padStart(4, "0")}`,
      role: "DISTRIBUTOR",
      group: `Group ${i % 8}`,
      password,
      createdAt: when(keys[0], 0, 0),
    })),
  );
  const products = await m.Product.insertMany(
    Array.from({ length: 200 }, (_, i) => ({
      name: `Scale Product ${i}`,
      price: 10000,
      unitCost: 6000,
      onHand: 0,
      damagedOnHand: 0,
      reserved: 0,
      inventoryVersion: 1,
    })),
  );
  await m.Period.insertMany(
    keys.map((key) => ({ _id: key, status: "OPEN", revision: 1 })),
  );
  let buffers = { Receipt: [], Report: [], Movement: [], MemberPeriod: [] };
  async function flush() {
    for (const [name, docs] of Object.entries(buffers)) {
      if (docs.length) await m[name].insertMany(docs);
      buffers[name] = [];
    }
  }
  const defaults = {
    damagedDelta: 0,
    sold: 0,
    damaged: 0,
    giftGood: 0,
    giftDamaged: 0,
    revenue: 0,
    cogs: 0,
    damageCost: 0,
    giftCost: 0,
    actorId: admin._id,
  };
  let correctionCount = 0,
    revenue = 0,
    missingTargets = 0,
    incompleteRows = 0;
  for (let index = 0; index < users.length; index++) {
    const u = users[index],
      p = products[index % 200];
    for (let week = 0; week < keys.length; week++) {
      const key = keys[week],
        lot = new m.mongoose.Types.ObjectId(),
        report1 = new m.mongoose.Types.ObjectId(),
        report2 = new m.mongoose.Types.ObjectId();
      const unknown = index % 13 === 0 && week === 0,
        corrected = index % 10 === 0 && week === 0,
        cost = unknown ? null : 6000;
      const submitted = new Date(
        +bounds(key).deadline +
          (index % 23 === 0 && week === 0 ? 3600000 : -3600000),
      );
      buffers.Receipt.push({
        _id: lot,
        memberId: u._id,
        productId: p._id,
        productName: p.name,
        quantity: 10,
        price: 10000,
        unitCost: cost,
        effectiveAt: when(key, 0, 8),
      });
      const a = {
        ...defaults,
        productId: p._id,
        lotId: lot,
        memberId: u._id,
        periodId: key,
      };
      buffers.Movement.push(
        {
          ...defaults,
          productId: p._id,
          sourceId: String(lot),
          kind: "TRANSFER_OUT",
          sellableDelta: -10,
          periodId: key,
          effectiveAt: when(key, 0, 8),
        },
        {
          ...a,
          sourceId: String(lot),
          kind: "RECEIPT",
          sellableDelta: 10,
          effectiveAt: when(key, 0, 8),
        },
      );
      const line1 = {
          lotId: lot,
          effectiveAt: when(key, 2),
          sold: 3,
          damaged: 1,
          giftGood: 0,
          giftDamaged: 0,
        },
        line2 = {
          lotId: lot,
          effectiveAt: when(key, 3),
          sold: 0,
          damaged: 0,
          giftGood: 1,
          giftDamaged: 1,
        };
      buffers.Report.push(
        {
          _id: report1,
          memberId: u._id,
          memberName: u.name,
          periodId: key,
          lines: [line1],
          status: corrected ? "SUPERSEDED" : "APPROVED",
          submittedAt: submitted,
          schemaVersion: 1,
        },
        {
          _id: report2,
          memberId: u._id,
          memberName: u.name,
          periodId: key,
          lines: [line2],
          status: "APPROVED",
          submittedAt: submitted,
          schemaVersion: 1,
        },
      );
      const first = {
        ...a,
        sourceId: String(report1),
        kind: "DECLARATION",
        sellableDelta: -4,
        damagedDelta: 1,
        sold: 3,
        damaged: 1,
        revenue: 30000,
        cogs: unknown ? null : 18000,
        damageCost: cost,
        effectiveAt: line1.effectiveAt,
      };
      buffers.Movement.push(first, {
        ...a,
        sourceId: String(report2),
        kind: "DECLARATION",
        sellableDelta: -1,
        damagedDelta: -1,
        giftGood: 1,
        giftDamaged: 1,
        giftCost: cost,
        effectiveAt: line2.effectiveAt,
      });
      if (corrected) {
        const replacement = new m.mongoose.Types.ObjectId();
        buffers.Report.push({
          _id: replacement,
          memberId: u._id,
          memberName: u.name,
          periodId: key,
          lines: [{ ...line1, sold: 2 }],
          status: "APPROVED",
          submittedAt: submitted,
          replacesId: report1,
          schemaVersion: 1,
        });
        const reversed = { ...first, kind: "REVERSAL" };
        for (const field of [
          "sellableDelta",
          "damagedDelta",
          "sold",
          "damaged",
          "giftGood",
          "giftDamaged",
          "revenue",
          "cogs",
          "damageCost",
          "giftCost",
        ])
          reversed[field] = first[field] == null ? null : -first[field];
        buffers.Movement.push(reversed, {
          ...first,
          sourceId: String(replacement),
          sellableDelta: -3,
          sold: 2,
          revenue: 20000,
          cogs: unknown ? null : 12000,
        });
        correctionCount++;
      }
      const missing = index % 11 === 0 && week === 0,
        incomplete = index % 17 === 0 && week === 25;
      buffers.MemberPeriod.push({
        _id: `${u.id}:${key}`,
        memberId: u._id,
        periodId: key,
        complete: !incomplete,
        targetRevenue: missing ? null : 60000,
        group: u.group,
        ...(index % 19 === 0 && week === 0
          ? { extensionUntil: new Date(+bounds(key).deadline + 86400000) }
          : {}),
      });
      revenue += corrected ? 20000 : 30000;
      missingTargets += missing ? 1 : 0;
      incompleteRows += incomplete ? 1 : 0;
    }
    if ((index + 1) % 10 === 0) await flush();
  }
  await flush();
  for (let i = 0; i < products.length; i++) {
    const quantity =
      users.filter((u, index) => index % 200 === i).length * 26 * 10;
    await m.Movement.create({
      ...defaults,
      productId: products[i]._id,
      sourceId: products[i].id,
      kind: "OPENING",
      sellableDelta: quantity,
      effectiveAt: when(keys[0], 0, 0),
      periodId: keys[0],
    });
  }
  const counts = {};
  for (const name of [
    "User",
    "Product",
    "Receipt",
    "Report",
    "Movement",
    "MemberPeriod",
  ])
    counts[name] = await m[name].countDocuments();
  const expected = {
    revenue,
    sold: count * 26 * 3 - correctionCount,
    targetRevenue: (count * 26 - missingTargets) * 60000,
    missingTargets,
    incompleteRows,
    contribution: null,
    achievement: null,
    memberPhysical: (index) => 130 + (index % 10 === 0 ? 1 : 0),
  };
  fs.mkdirSync("docs/redesign/evidence/scale", { recursive: true });
  fs.writeFileSync(
    `docs/redesign/evidence/scale/fixture-${count}.json`,
    JSON.stringify(
      {
        database: uri.split("/")[3].split("?")[0],
        members: count,
        from: keys[0],
        to: last,
        counts,
        expected: { ...expected, memberPhysical: undefined },
        sampleMembers: users
          .slice(0, 50)
          .map((u, i) => ({
            id: u.id,
            name: u.name,
            physical: expected.memberPhysical(i),
          })),
        note: "Synthetic bulk historical fixtures; actual HTTP business commands are exercised separately. No cloud/dev DB. Seeder does not create indexes; see separate migration evidence.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(counts));
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => m.mongoose.disconnect());
