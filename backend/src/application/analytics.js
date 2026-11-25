const repo = require("../infrastructure/repository");
const { many } = require("../infrastructure/db");
const { weeks, bounds, safeMoney } = require("../domain/policy");
const { entity } = require("../infrastructure/transaction");
const kpi = require("./kpi");
function inventoryAt(movements, cutoff) {
  let sellable = 0,
    damaged = 0;
  for (const m of movements)
    if (+new Date(m.effectiveAt) < +cutoff) {
      sellable += m.sellableDelta;
      damaged += m.damagedDelta;
    }
  return { sellable, damaged, physical: sellable + damaged };
}
function metrics(movements) {
  const sum = (field) =>
    movements.reduce((s, m) => safeMoney(s + (m[field] || 0)), 0);
  const known = (field) => movements.every((m) => m[field] != null);
  const revenue = sum("revenue"),
    cogs = known("cogs") ? sum("cogs") : null,
    damageCost = known("damageCost") ? sum("damageCost") : null,
    giftCost = known("giftCost") ? sum("giftCost") : null;
  return {
    revenue,
    sold: sum("sold"),
    damaged: sum("damaged"),
    giftGood: sum("giftGood"),
    giftDamaged: sum("giftDamaged"),
    cogs,
    damageCost,
    giftCost,
    grossProfit: cogs == null ? null : safeMoney(revenue - cogs),
    contribution: [cogs, damageCost, giftCost].some((v) => v == null)
      ? null
      : safeMoney(revenue - cogs - damageCost - giftCost),
    missingCostLines: movements.filter((m) =>
      [m.cogs, m.damageCost, m.giftCost].some((v) => v == null),
    ).length,
  };
}
const metricFields = [
  "revenue",
  "sold",
  "damaged",
  "giftGood",
  "giftDamaged",
  "cogs",
  "damageCost",
  "giftCost",
];
function accumulator() {
  return {
    sums: Object.fromEntries(metricFields.map((k) => [k, 0])),
    unknown: new Set(),
    missingCostLines: 0,
  };
}
function addMetric(acc, value) {
  for (const key of metricFields) {
    if (["cogs", "damageCost", "giftCost"].includes(key) && value[key] == null)
      acc.unknown.add(key);
    else acc.sums[key] = safeMoney(acc.sums[key] + (value[key] || 0));
  }
  if (["cogs", "damageCost", "giftCost"].some((k) => value[k] == null))
    acc.missingCostLines++;
}
function finishMetric(acc) {
  const result = { ...acc.sums, missingCostLines: acc.missingCostLines };
  for (const key of acc.unknown) result[key] = null;
  result.grossProfit =
    result.cogs == null ? null : safeMoney(result.revenue - result.cogs);
  result.contribution = [result.cogs, result.damageCost, result.giftCost].some(
    (v) => v == null,
  )
    ? null
    : safeMoney(
        result.revenue - result.cogs - result.damageCost - result.giftCost,
      );
  return result;
}
const addBalance = (target, value) => {
  target.sellable = safeMoney(target.sellable + (value.sellableDelta || 0));
  target.damaged = safeMoney(target.damaged + (value.damagedDelta || 0));
};
const balanceDTO = (b) => ({
  ...b,
  physical: safeMoney(b.sellable + b.damaged),
});
async function weekly(
  actor,
  from,
  to,
  tx,
  { limit = 50, offset = 0 } = {},
) {
  let previous = performance.now();
  const trace = (phase) => {
    if (process.env.ANALYTICS_PROFILE === "1") {
      const now = performance.now();
      console.log(
        JSON.stringify({
          event: "analytics-profile",
          phase,
          ms: Math.round(now - previous),
        }),
      );
      previous = now;
    }
  };
  const keys = weeks(from, to),
    first = bounds(from).start,
    last = bounds(to).end;
  const members = await repo.listMembers(tx, {
    createdBefore: last,
    memberId: actor.role === "ADMIN" ? undefined : actor.id,
  });
  trace("members");
  const ids = members.map((m) => m.id),
    page = members.slice(offset, offset + limit),
    selected = new Set(page.map((m) => m.id)),
    pageIds = page.map((m) => m.id);
  const states = await repo.getMemberPeriods(tx, { memberIds: ids, keys });
  const stateMap = new Map(
    states.map((s) => [`${s.memberId}:${s.periodId}`, s]),
  );
  const periods = await repo.getPeriods(tx, keys),
    periodMap = new Map(periods.map((p) => [p.id, p]));
  const globalTargets = await kpi.targetsByWeek(tx, keys);
  trace("states");
  const headers = await many(
    tx,
    `SELECT member_id, period_id,
       count(*) FILTER (WHERE status <> 'SUPERSEDED')::int AS count,
       count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
       max(submitted_at) FILTER (WHERE status <> 'SUPERSEDED') AS latest
     FROM reports WHERE member_id = ANY($1) AND period_id = ANY($2) AND schema_version = 1
     GROUP BY member_id, period_id`,
    [ids, keys],
  );
  const submissions = new Map(
    headers.map((row) => [
      `${row.member_id}:${row.period_id}`,
      {
        count: row.count,
        pending: row.pending,
        latest: row.latest
          ? +new Date(row.latest)
          : row.count
            ? 0
            : -Infinity,
      },
    ]),
  );
  const liveReports = (
    await many(
      tx,
      `SELECT id FROM reports WHERE member_id = ANY($1) AND period_id = ANY($2)
         AND schema_version = 1 AND status = 'APPROVED'`,
      [ids, keys],
    )
  ).map((row) => row.id);
  trace("report-headers");
  const opening = new Map(),
    deltas = new Map(),
    financial = new Map(),
    received = new Map();
  for (const group of await many(
    tx,
    `SELECT member_id, sum(sellable_delta)::int AS sellable_delta,
       sum(damaged_delta)::int AS damaged_delta
     FROM movements WHERE member_id = ANY($1) AND effective_at < $2
     GROUP BY member_id`,
    [pageIds, first],
  )) {
    const b = { sellable: 0, damaged: 0 };
    addBalance(b, {
      sellableDelta: group.sellable_delta,
      damagedDelta: group.damaged_delta,
    });
    opening.set(group.member_id, b);
  }
  trace("opening");
  const weekExpr = `to_char(date_trunc('week', effective_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD')`;
  for (const group of await many(
    tx,
    `SELECT member_id, ${weekExpr} AS period_id,
       sum(sellable_delta)::int AS sellable_delta,
       sum(damaged_delta)::int AS damaged_delta,
       coalesce(sum(CASE WHEN kind = 'RECEIPT' THEN sellable_delta ELSE 0 END), 0)::int AS received
     FROM movements WHERE member_id = ANY($1) AND effective_at >= $2 AND effective_at < $3
     GROUP BY member_id, ${weekExpr}`,
    [pageIds, first, last],
  )) {
    const key = `${group.member_id}:${group.period_id}`,
      b = { sellable: 0, damaged: 0 };
    addBalance(b, {
      sellableDelta: group.sellable_delta,
      damagedDelta: group.damaged_delta,
    });
    deltas.set(key, b);
    received.set(key, safeMoney(group.received));
  }
  trace("inventory-range");
  for (const group of await many(
    tx,
    `SELECT member_id, period_id,
       sum(revenue)::bigint AS revenue, sum(sold)::int AS sold,
       sum(damaged)::int AS damaged, sum(gift_good)::int AS gift_good,
       sum(gift_damaged)::int AS gift_damaged, sum(cogs)::bigint AS cogs,
       sum(damage_cost)::bigint AS damage_cost, sum(gift_cost)::bigint AS gift_cost,
       count(*) FILTER (WHERE cogs IS NULL)::int AS cogs_missing,
       count(*) FILTER (WHERE damage_cost IS NULL)::int AS damage_cost_missing,
       count(*) FILTER (WHERE gift_cost IS NULL)::int AS gift_cost_missing,
       count(*) FILTER (WHERE cogs IS NULL OR damage_cost IS NULL OR gift_cost IS NULL)::int AS missing_cost_lines
     FROM movements
     WHERE member_id = ANY($1) AND effective_at >= $2 AND effective_at < $3
       AND period_id = ANY($4) AND kind = 'DECLARATION' AND source_id = ANY($5)
     GROUP BY member_id, period_id`,
    [ids, first, last, keys, liveReports],
  )) {
    const acc = accumulator();
    acc.sums.revenue = safeMoney(Number(group.revenue));
    acc.sums.sold = group.sold;
    acc.sums.damaged = group.damaged;
    acc.sums.giftGood = group.gift_good;
    acc.sums.giftDamaged = group.gift_damaged;
    acc.sums.cogs = safeMoney(Number(group.cogs));
    acc.sums.damageCost = safeMoney(Number(group.damage_cost));
    acc.sums.giftCost = safeMoney(Number(group.gift_cost));
    if (group.cogs_missing) acc.unknown.add("cogs");
    if (group.damage_cost_missing) acc.unknown.add("damageCost");
    if (group.gift_cost_missing) acc.unknown.add("giftCost");
    acc.missingCostLines = group.missing_cost_lines;
    financial.set(`${group.member_id}:${group.period_id}`, acc);
  }
  trace("financial-range");
  const rows = [],
    memberTotals = [],
    totals = {
      revenue: 0,
      sold: 0,
      contribution: 0,
      targetRevenue: 0,
      missingTargets: 0,
      incompleteRows: 0,
    };
  let provisional = false;
  const calendar = keys.map((key) => ({ key, ...bounds(key) }));
  for (const member of members) {
    const memberId = member.id,
      includeDetail = selected.has(memberId),
      balance = { ...(opening.get(memberId) || { sellable: 0, damaged: 0 }) },
      part = {
        memberId,
        memberName: member.name,
        revenue: 0,
        sold: 0,
        contribution: 0,
        targetRevenue: 0,
        complete: true,
        missingTargets: 0,
      };
    for (const { key, end, deadline: defaultDeadline } of calendar) {
      if (+new Date(member.createdAt) >= +end) continue;
      const slot = `${memberId}:${key}`,
        state = stateMap.get(slot),
        period = periodMap.get(key),
        stats = submissions.get(slot) || {
          count: 0,
          pending: 0,
          latest: -Infinity,
        },
        summary = finishMetric(financial.get(slot) || accumulator()),
        globalTarget = globalTargets.get(key) ?? null,
        target = state?.targetRevenue ?? globalTarget,
        targetSource =
          state?.targetRevenue != null
            ? "MEMBER"
            : globalTarget != null
              ? "GLOBAL"
              : null,
        complete = !!state?.complete && stats.pending === 0;
      totals.revenue = safeMoney(totals.revenue + summary.revenue);
      totals.sold = safeMoney(totals.sold + summary.sold);
      totals.targetRevenue = safeMoney(totals.targetRevenue + (target || 0));
      totals.contribution =
        totals.contribution == null || summary.contribution == null
          ? null
          : safeMoney(totals.contribution + summary.contribution);
      totals.missingTargets += target > 0 ? 0 : 1;
      totals.incompleteRows += complete ? 0 : 1;
      provisional =
        provisional || !complete || (period?.status || "OPEN") !== "CLOSED";
      if (!includeDetail) continue;
      const before = balanceDTO(balance),
        delta = deltas.get(slot) || { sellable: 0, damaged: 0 },
        deadline = new Date(state?.extensionUntil || defaultDeadline);
      addBalance(balance, {
        sellableDelta: delta.sellable,
        damagedDelta: delta.damaged,
      });
      rows.push({
        memberId,
        memberName: member.name,
        group: state?.group || member.group || "Chưa phân nhóm",
        groupSnapshotKnown: !!state,
        periodId: key,
        ...summary,
        targetRevenue: target,
        globalTargetRevenue: globalTarget,
        targetSource,
        achievement: target > 0 ? (summary.revenue / target) * 100 : null,
        opening: before,
        closing: balanceDTO(balance),
        received: received.get(slot) || 0,
        complete,
        pendingReports: stats.pending,
        deadlineAt: deadline.toISOString(),
        hasExtension: !!state?.extensionUntil,
        timeliness: !stats.count
          ? complete &&
            !summary.sold &&
            !summary.damaged &&
            !summary.giftGood &&
            !summary.giftDamaged
            ? "NO_ACTIVITY"
            : "MISSING"
          : stats.latest <= +deadline
            ? state?.extensionUntil
              ? "ON_TIME_EXTENDED"
              : "ON_TIME"
            : "LATE",
        periodStatus: period?.status || "OPEN",
        revision: period?.revision || 0,
      });
      part.revenue = safeMoney(part.revenue + summary.revenue);
      part.sold = safeMoney(part.sold + summary.sold);
      part.targetRevenue = safeMoney(part.targetRevenue + (target || 0));
      part.contribution =
        part.contribution == null || summary.contribution == null
          ? null
          : safeMoney(part.contribution + summary.contribution);
      part.complete = part.complete && complete;
      part.missingTargets += target > 0 ? 0 : 1;
    }
    if (includeDetail)
      memberTotals.push({
        ...part,
        achievement:
          part.complete && !part.missingTargets && part.targetRevenue > 0
            ? (part.revenue / part.targetRevenue) * 100
            : null,
        closing: balanceDTO(balance),
      });
  }
  trace("member-totals");
  const costs = accumulator();
  if (actor.role === "ADMIN")
    for (const move of await repo.listWarehouseCostMovements(tx, first, last))
      addMetric(costs, move);
  const warehouseCosts = finishMetric(costs);
  if (actor.role === "ADMIN")
    totals.contribution =
      totals.contribution == null ||
      warehouseCosts.damageCost == null ||
      warehouseCosts.giftCost == null
        ? null
        : safeMoney(
            totals.contribution -
              warehouseCosts.damageCost -
              warehouseCosts.giftCost,
          );
  trace("warehouse-costs");
  totals.achievement =
    !totals.missingTargets && !totals.incompleteRows && totals.targetRevenue > 0
      ? (totals.revenue / totals.targetRevenue) * 100
      : null;
  return {
    from,
    to,
    asOfRecordedAt: new Date().toISOString(),
    calculationVersion: "ledger-v4-paged-stock",
    warehouseCosts: actor.role === "ADMIN" ? warehouseCosts : null,
    memberTotals,
    provisional,
    rows,
    totals,
    pagination: {
      offset,
      limit,
      total: members.length,
      hasMore: offset + limit < members.length,
    },
  };
}
async function stock(actor, tx) {
  if (actor.role === "ADMIN")
    return {
      warehouse: (await repo.listProducts(tx)).map((p) => ({
        ...entity(p),
        sellable:
          p.inventoryVersion === 1 ? p.onHand - (p.damagedOnHand || 0) : null,
        physical: p.onHand ?? null,
        available:
          p.inventoryVersion === 1
            ? p.onHand - (p.damagedOnHand || 0) - p.reserved
            : null,
        needsMigration: p.inventoryVersion !== 1,
      })),
      lots: [],
    };
  const lots = await repo.listReceiptsByMember(tx, actor.id);
  const balances = new Map(),
    cutoff = new Date(Date.now() + 1);
  for (const move of await many(
    tx,
    `SELECT lot_id, sum(sellable_delta)::int AS sellable_delta,
       sum(damaged_delta)::int AS damaged_delta
     FROM movements WHERE member_id = $1 AND effective_at < $2
     GROUP BY lot_id`,
    [actor.id, cutoff],
  )) {
    const b = { sellable: 0, damaged: 0 };
    addBalance(b, {
      sellableDelta: move.sellable_delta,
      damagedDelta: move.damaged_delta,
    });
    balances.set(String(move.lot_id), b);
  }
  return {
    warehouse: [],
    lots: lots.map((l) => ({
      ...entity(l),
      ...balanceDTO(balances.get(String(l.id)) || { sellable: 0, damaged: 0 }),
    })),
  };
}
module.exports = { weekly, stock, metrics, inventoryAt };
