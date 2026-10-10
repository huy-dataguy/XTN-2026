const {
  User,
  Movement,
  MemberPeriod,
  Period,
  Report,
  Product,
  Receipt,
} = require("../infrastructure/models");
const { weeks, bounds, safeMoney } = require("../domain/policy");
const { entity } = require("../infrastructure/transaction");
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
  session,
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
  const members = await User.find({
    role: "DISTRIBUTOR",
    ...(actor.role === "ADMIN" ? {} : { _id: actor.id }),
    createdAt: { $lt: last },
  })
    .select("_id name group createdAt")
    .sort({ createdAt: 1, _id: 1 })
    .session(session)
    .lean();
  trace("members");
  const ids = members.map((m) => m._id),
    page = members.slice(offset, offset + limit),
    selected = new Set(page.map((m) => String(m._id))),
    pageIds = page.map((m) => m._id);
  const states = await MemberPeriod.find({
    memberId: { $in: ids },
    periodId: { $in: keys },
  })
    .select("memberId periodId targetRevenue complete extensionUntil group")
    .session(session)
    .lean();
  const stateMap = new Map(
    states.map((s) => [`${s.memberId}:${s.periodId}`, s]),
  );
  const periods = await Period.find({ _id: { $in: keys } })
      .session(session)
      .lean(),
    periodMap = new Map(periods.map((p) => [p._id, p]));
  trace("states");
  const liveReports = new Set(),
    submissions = new Map();
  for await (const report of Report.find({
    memberId: { $in: ids },
    periodId: { $in: keys },
    schemaVersion: 1,
  })
    .select("_id memberId periodId status submittedAt")
    .session(session)
    .lean()
    .cursor({ batchSize: 1000 })) {
    const key = `${report.memberId}:${report.periodId}`,
      stats = submissions.get(key) || {
        count: 0,
        pending: 0,
        latest: -Infinity,
      };
    if (report.status === "APPROVED") liveReports.add(String(report._id));
    if (report.status === "PENDING") stats.pending++;
    if (report.status !== "SUPERSEDED") {
      stats.count++;
      stats.latest = Math.max(
        stats.latest,
        Number.isFinite(+report.submittedAt) ? +report.submittedAt : Infinity,
      );
    }
    submissions.set(key, stats);
  }
  trace("report-headers");
  const opening = new Map(),
    deltas = new Map(),
    financial = new Map(),
    received = new Map();
  // Aggregate inside the same snapshot: raw movement volume never crosses HTTP/Node.
  for await (const group of Movement.aggregate([
    { $match: { memberId: { $in: pageIds }, effectiveAt: { $lt: first } } },
    {
      $group: {
        _id: "$memberId",
        sellableDelta: { $sum: "$sellableDelta" },
        damagedDelta: { $sum: "$damagedDelta" },
      },
    },
  ])
    .session(session)
    .cursor({ batchSize: 1000 })) {
    const b = { sellable: 0, damaged: 0 };
    addBalance(b, group);
    opening.set(String(group._id), b);
  }
  trace("opening");
  const effectiveWeek = {
    $dateToString: {
      format: "%Y-%m-%d",
      timezone: "Asia/Ho_Chi_Minh",
      date: {
        $dateTrunc: {
          date: "$effectiveAt",
          unit: "week",
          startOfWeek: "monday",
          timezone: "Asia/Ho_Chi_Minh",
        },
      },
    },
  };
  for await (const group of Movement.aggregate([
    {
      $match: {
        memberId: { $in: pageIds },
        effectiveAt: { $gte: first, $lt: last },
      },
    },
    {
      $group: {
        _id: { memberId: "$memberId", periodId: effectiveWeek },
        sellableDelta: { $sum: "$sellableDelta" },
        damagedDelta: { $sum: "$damagedDelta" },
        received: {
          $sum: { $cond: [{ $eq: ["$kind", "RECEIPT"] }, "$sellableDelta", 0] },
        },
      },
    },
  ])
    .session(session)
    .cursor({ batchSize: 1000 })) {
    const key = `${group._id.memberId}:${group._id.periodId}`,
      b = { sellable: 0, damaged: 0 };
    addBalance(b, group);
    deltas.set(key, b);
    received.set(key, safeMoney(group.received));
  }
  trace("inventory-range");
  const missing = (field) => ({
    $eq: [{ $ifNull: [`$${field}`, null] }, null],
  });
  const moneyGroup = {
    _id: { memberId: "$memberId", periodId: "$periodId" },
    ...Object.fromEntries(
      metricFields.map((field) => [field, { $sum: `$${field}` }]),
    ),
  };
  for (const field of ["cogs", "damageCost", "giftCost"])
    moneyGroup[`${field}Missing`] = { $sum: { $cond: [missing(field), 1, 0] } };
  moneyGroup.missingCostLines = {
    $sum: {
      $cond: [
        { $or: [missing("cogs"), missing("damageCost"), missing("giftCost")] },
        1,
        0,
      ],
    },
  };
  for await (const group of Movement.aggregate([
    {
      $match: {
        memberId: { $in: ids },
        effectiveAt: { $gte: first, $lt: last },
        periodId: { $in: keys },
        kind: "DECLARATION",
        sourceId: { $in: [...liveReports] },
      },
    },
    { $group: moneyGroup },
  ])
    .session(session)
    .cursor({ batchSize: 1000 })) {
    const acc = accumulator();
    for (const field of metricFields) acc.sums[field] = safeMoney(group[field]);
    for (const field of ["cogs", "damageCost", "giftCost"])
      if (group[`${field}Missing`]) acc.unknown.add(field);
    acc.missingCostLines = group.missingCostLines;
    financial.set(`${group._id.memberId}:${group._id.periodId}`, acc);
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
    const memberId = String(member._id),
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
      if (+member.createdAt >= +end) continue;
      const slot = `${memberId}:${key}`,
        state = stateMap.get(slot),
        period = periodMap.get(key),
        stats = submissions.get(slot) || {
          count: 0,
          pending: 0,
          latest: -Infinity,
        },
        summary = finishMetric(financial.get(slot) || accumulator()),
        target = state?.targetRevenue ?? null,
        complete = !!state?.complete && stats.pending === 0;
      // Organization scope is independent of the displayed member page.
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
    for await (const move of Movement.find({
      memberId: { $exists: false },
      kind: "WAREHOUSE_ACTIVITY",
      effectiveAt: { $gte: first, $lt: last },
    })
      .select(metricFields.join(" "))
      .session(session)
      .lean()
      .cursor({ batchSize: 1000 }))
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
async function stock(actor, session) {
  if (actor.role === "ADMIN")
    return {
      warehouse: (await Product.find().session(session).lean()).map((p) => ({
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
  const lots = await Receipt.find({ memberId: actor.id })
    .session(session)
    .lean();
  const balances = new Map(),
    cutoff = new Date(Date.now() + 1);
  for await (const move of Movement.find({
    memberId: actor.id,
    effectiveAt: { $lt: cutoff },
  })
    .select("lotId sellableDelta damagedDelta")
    .session(session)
    .lean()
    .cursor({ batchSize: 1000 })) {
    const key = String(move.lotId),
      b = balances.get(key) || { sellable: 0, damaged: 0 };
    addBalance(b, move);
    balances.set(key, b);
  }
  return {
    warehouse: [],
    lots: lots.map((l) => ({
      ...entity(l),
      ...balanceDTO(balances.get(String(l._id)) || { sellable: 0, damaged: 0 }),
    })),
  };
}
module.exports = { weekly, stock, metrics, inventoryAt };
