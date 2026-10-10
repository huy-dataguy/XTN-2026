const { test } = require("node:test");
const assert = require("node:assert/strict");
const p = require("../src/domain/policy");
const { metrics } = require("../src/application/analytics");
test("Vietnam Monday boundary, full calendar keys and bounded ranges", () => {
  assert.equal(p.periodId("2026-10-04T17:00:00Z"), "2026-10-05");
  assert.equal(p.periodId("2026-10-04T16:59:59Z"), "2026-09-28");
  assert.deepEqual(p.weeks("2026-09-28", "2026-10-05"), [
    "2026-09-28",
    "2026-10-05",
  ]);
  assert.throws(() => p.weeks("2026-01-05", "2026-10-05"));
  assert.throws(() => p.parse(p.week, "2026-10-04"));
});
test("historical timeline rejects a sale before receipt even if final balance positive", () => {
  assert.throws(
    () =>
      p.validateTimeline([
        {
          lotId: "a",
          effectiveAt: "2026-10-01",
          sellableDelta: -1,
          damagedDelta: 0,
        },
        {
          lotId: "a",
          effectiveAt: "2026-10-02",
          sellableDelta: 10,
          damagedDelta: 0,
        },
      ]),
    /âm tồn/,
  );
});
test("damage then gift consumes physical quantity and expense once", () => {
  const damaged = { sold: 0, damaged: 3, giftGood: 0, giftDamaged: 0 },
    gift = { sold: 0, damaged: 0, giftGood: 0, giftDamaged: 3 };
  const stock = p
    .validateTimeline([
      {
        lotId: "a",
        effectiveAt: "2026-10-01",
        sellableDelta: 10,
        damagedDelta: 0,
      },
      { lotId: "a", effectiveAt: "2026-10-02", ...p.quantities(damaged) },
      { lotId: "a", effectiveAt: "2026-10-03", ...p.quantities(gift) },
    ])
    .get("a");
  assert.deepEqual(stock, { sellable: 7, damaged: 0 });
  assert.equal(
    p.valuation(damaged, { price: 10000, unitCost: 6000 }).damageCost,
    18000,
  );
  assert.equal(p.valuation(gift, { price: 10000, unitCost: 6000 }).giftCost, 0);
});
test("missing cost stays unknown; safe integer overflow rejected", () => {
  const m = p.valuation(
    { sold: 1, damaged: 0, giftGood: 0 },
    { price: 10000, unitCost: null },
  );
  assert.equal(metrics([m]).contribution, null);
  assert.throws(() => p.safeMoney(Number.MAX_SAFE_INTEGER + 1));
});
