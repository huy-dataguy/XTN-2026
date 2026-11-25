const repo = require("../infrastructure/repository");
const { objectId } = require("../infrastructure/db");
const p = require("../domain/policy");

async function overview(tx, from, to) {
  return {
    from,
    to,
    phases: await repo.listKpiPhases(tx),
    weeks: await repo.getKpiSnapshots(tx, p.weeks(from, to)),
  };
}

async function configure(actor, input, tx) {
  p.weeks(input.startPeriod, input.endPeriod);
  const overlap = await repo.listKpiPhasesOverlapping(tx, {
    start: input.startPeriod,
    end: input.endPeriod,
  });
  if (overlap.length)
    p.fail(409, "KPI_PHASE_OVERLAP", "Khoảng tuần này đã có cấu hình KPI");
  return repo.createKpiPhase(tx, {
    id: objectId(),
    startPeriod: input.startPeriod,
    endPeriod: input.endPeriod,
    weeklyTarget: input.weeklyTarget,
    reason: input.reason,
    createdBy: actor.id,
    revision: 0,
  });
}

async function update(actor, input, tx) {
  const current = await repo.getKpiPhaseForUpdate(tx, input.id);
  if (!current) p.fail(404, "NOT_FOUND", "Không tìm thấy cấu hình KPI");
  if (current.revision !== input.version)
    p.fail(409, "VERSION_CONFLICT", "Cấu hình KPI đã thay đổi");
  const start = input.startPeriod ?? current.startPeriod;
  const end = input.endPeriod ?? current.endPeriod;
  p.weeks(start, end);
  const overlap = await repo.listKpiPhasesOverlapping(tx, {
    start,
    end,
    excludeId: current.id,
  });
  if (overlap.length)
    p.fail(409, "KPI_PHASE_OVERLAP", "Khoảng tuần này đã có cấu hình KPI");
  return repo.saveKpiPhase(tx, {
    ...current,
    startPeriod: start,
    endPeriod: end,
    weeklyTarget: input.weeklyTarget ?? current.weeklyTarget,
    reason: input.reason,
    revision: current.revision + 1,
  });
}

async function targetsByWeek(tx, keys) {
  const snapshots = await repo.getKpiSnapshots(tx, keys);
  const phases = await repo.listKpiPhasesOverlapping(tx, {
    start: keys[0],
    end: keys[keys.length - 1],
  });
  const result = new Map();
  for (const key of keys) {
    const frozen = snapshots.find((s) => s.periodId === key);
    const phase = phases.find((x) => x.startPeriod <= key && x.endPeriod >= key);
    const amount = frozen?.weeklyTarget ?? phase?.weeklyTarget ?? null;
    if (amount != null) result.set(key, amount);
  }
  return result;
}

async function snapshotWeek(key, tx) {
  const existing = await repo.getKpiSnapshots(tx, [key]);
  if (existing.length) return existing[0];
  const phase = (
    await repo.listKpiPhasesOverlapping(tx, { start: key, end: key })
  )[0];
  if (!phase) return null;
  return (
    await repo.insertKpiSnapshots(tx, [
      { periodId: key, weeklyTarget: phase.weeklyTarget, phaseId: phase.id },
    ])
  )[0];
}

module.exports = { overview, configure, update, targetsByWeek, snapshotWeek };
