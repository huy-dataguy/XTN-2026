// Isolated audit: execute extracted baseline calculations, not browser/DB tests.
// Proposed accounting fixtures are explicitly separate from baseline probes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const frontendRequire = createRequire(path.resolve(__dirname, '../frontend/package.json'));
const { transformSync } = frontendRequire('esbuild');
process.env.TZ = 'Asia/Ho_Chi_Minh';
const results = [];
function source(file) { return fs.readFileSync(path.resolve(__dirname, '../frontend/src', file), 'utf8'); }
function extract(text, start, end) {
  const first = text.indexOf(start);
  const last = text.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Source changed: review extractor before rerunning');
  return text.slice(first, last);
}
function evaluate(code, context) {
  return vm.runInNewContext(transformSync(code, { loader: 'ts', target: 'es2022' }).code,
    { Date, ...context }, { timeout: 1000 });
}
function record(id, evidence, kind = 'baseline-defect-reproduced') { results.push({ id, kind, evidence }); }
const reportSource = source('pages/distributor/ReportPage.tsx');
const statsCode = extract(reportSource, 'const getProductStockStats =', 'const handleReportChange');
const anchor = new Date('2026-10-05T00:00:00+07:00');
const context = {
  myReports: [], myOrders: [], editReportId: null,
  ReportStatus: { APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
  OrderStatus: { APPROVED: 'APPROVED' },
  weekRange: { anchorMonday: anchor,
    orderStartDate: new Date('2026-10-03T00:00:00+07:00'),
    orderEndLimit: new Date('2026-10-10T00:00:00+07:00') },
};
function stats(overrides) { return evaluate(statsCode + '\ngetProductStockStats("sku");', { ...context, ...overrides }); }
function order(createdAt, quantity, extra = {}) {
  return { status: 'APPROVED', createdAt, isReceived: false,
    items: [{ productId: 'sku', quantity }], ...extra };
}
let result = stats({ myOrders: [order('2026-10-06T10:00:00+07:00', 10)] });
assert.equal(result.newReceived, 10);
record('W01-approved-not-received', { baselineReceived: result.newReceived, actualReceived: 0 });
result = stats({ myOrders: [order('2026-10-11T10:00:00+07:00', 5, { isReceived: true })] });
assert.equal(result.newReceived, 0);
record('W02-sunday-receipt-excluded', { baselineReceived: result.newReceived, actualW1Receipt: 5 });
result = stats({ myOrders: [order('2026-10-06T10:00:00+07:00', 2, {
  isReceived: true, items: [{ productId: 'sku', quantity: 2 }, { productId: 'sku', quantity: 3 }],
})] });
assert.equal(result.newReceived, 2);
record('W03-duplicate-lines-under-counted', { baselineReceived: result.newReceived, totalReceiptLines: 5 });
const reports = [
  { id: 'r1', status: 'APPROVED', weekStartDate: '2026-09-28T00:00:00+07:00',
    details: [{ productId: 'sku', remainingStock: 8, quantitySold: 2, quantityDamaged: 0 }] },
  { id: 'r2', status: 'APPROVED', weekStartDate: '2026-09-28T00:00:00+07:00',
    details: [{ productId: 'sku', remainingStock: 5, quantitySold: 3, quantityDamaged: 0 }] },
];
result = stats({ myReports: reports });
assert.equal(result.prevRemaining, 8);
record('W04-first-report-of-tied-week-selected', { baselineOpening: result.prevRemaining, chronologicalClosing: 5 });
const mondayCode = extract(reportSource, 'const getMonday =', 'export const ReportPage');
const mondayKey = evaluate(mondayCode + '\ngetMonday(new Date("2026-10-07T10:00:00+07:00")).toISOString().split("T")[0];', {});
assert.equal(mondayKey, '2026-10-04');
record('W05-local-monday-utc-sunday-key', { baselineUtcDateKey: mondayKey, canonicalPeriodId: '2026-10-05' });
const chartCode = extract(source('pages/admin/AdminDashboard.tsx'), 'const getChartData =', 'const chartData =');
const chart = evaluate(chartCode + '\ngetChartData();', {
  distributorFilter: 'ALL', validReports: [
    { weekStartDate: '2025-10-06T00:00:00+07:00', totalRevenue: 10, distributorGroup: 'A' },
    { weekStartDate: '2031-10-06T00:00:00+07:00', totalRevenue: 20, distributorGroup: 'A' },
  ],
});
assert.equal(chart.length, 1);
assert.equal(chart[0].A, 30);
record('W06-chart-collides-across-years', { chartRows: chart.length, expectedPeriods: 2, combinedRevenue: chart[0].A });
const dashboardCode = extract(source('pages/distributor/DistributorDashboard.tsx'), 'const filteredOrders =', 'return (');
const metrics = evaluate(dashboardCode + '\n({totalRevenue,itemsSold,totalOrdered});', {
  selectedWeek: 'CURRENT', myOrders: [{ status: 'REJECTED', totalAmount: 100 }],
  myReports: [{ status: 'APPROVED', totalRevenue: 20, totalSold: 2 },
    { status: 'REJECTED', totalRevenue: 30, totalSold: 3 }], ReportStatus: { APPROVED: 'APPROVED' },
});
assert.equal(metrics.itemsSold, 5);
assert.equal(metrics.totalRevenue, 20);
assert.equal(metrics.totalOrdered, 100);
record('W07-distributor-status-mismatch', { baseline: metrics, acceptedSold: 2, rejectedOrderIncludedInCost: true });

// Independently specified fixture; production does NOT implement these formulas.
const W1 = { received: 30, sold: 8 + 4, damaged: 3, giftDamaged: 3, giftGood: 2, target: 200000 };
const W2 = { received: 5, sold: 10, damaged: 0, giftDamaged: 0, giftGood: 0, target: 300000 };
function reference(opening, week) {
  const sellable = opening + week.received - week.sold - week.damaged - week.giftGood;
  const damaged = week.damaged - week.giftDamaged;
  const revenue = week.sold * 10000;
  const cogs = week.sold * 6000;
  const damageExpense = week.damaged * 6000;
  const giftExpense = week.giftGood * 6000;
  return { sellable, damaged, physical: sellable + damaged, revenue, cogs,
    gross: revenue - cogs, damageExpense, giftExpense,
    contribution: revenue - cogs - damageExpense - giftExpense,
    achievement: week.target > 0 ? revenue / week.target * 100 : null };
}
const a = reference(0, W1), b = reference(a.sellable, W2);
assert.equal(a.physical, 13);
assert.equal(a.contribution, 18000);
assert.equal(a.achievement, 60);
assert.equal(b.physical, 8);
assert.equal(a.contribution + b.contribution, 58000);
assert.equal((a.revenue + b.revenue) / (W1.target + W2.target) * 100, 44);
assert.equal(70 + a.physical, 100 - W1.sold - W1.giftGood - W1.giftDamaged);
assert.equal(reference(0, { ...W1, target: 0 }).achievement, null);
record('R01-two-period-damage-gift-and-kpi', { W1: a, W2: b, rangeRevenue: 220000,
  rangeContribution: 58000, rangeAchievement: 44, rangeClosingStock: 8 }, 'proposed-formula-fixture-only');
console.log(JSON.stringify({ mode: 'extracted-baseline-calculations-and-independent-fixture',
  timezone: process.env.TZ, results }, null, 2));
