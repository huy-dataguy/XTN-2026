const repo = require("../infrastructure/repository");
const { entity } = require("../infrastructure/transaction");
const {
  fail,
  owner,
  periodId,
  quantities,
  valuation,
  validateTimeline,
} = require("../domain/policy");
const {
  openPeriod,
  reportingAllowed,
  incomplete,
  invalidateDownstream,
} = require("./periods");
const { movement } = require("./inventory-shared");
async function checkReport(input, memberId, tx) {
  for (const line of input.lines) {
    if (periodId(line.effectiveAt) !== input.periodId)
      fail(400, "PERIOD_MISMATCH", "Ngày phát sinh phải thuộc tuần báo cáo");
    const lot = await repo.getReceiptForUpdate(tx, line.lotId);
    if (!lot || String(lot.memberId) !== String(memberId))
      fail(403, "LOT_OWNERSHIP", "Đợt nhận hàng không thuộc thành viên");
  }
}
async function createReport(input, actor, tx) {
  await reportingAllowed(actor, actor.id, input.periodId, tx);
  await checkReport(input, actor.id, tx);
  await incomplete(actor.id, input.periodId, tx);
  return entity(
    await repo.createReport(tx, {
      ...input,
      memberId: actor.id,
      memberName: actor.name,
      submittedAt: new Date(),
    }),
  );
}
async function amendReport(id, input, actor, tx) {
  const report = await repo.getReportForUpdate(tx, id);
  if (!report?.memberId) fail(404, "NOT_FOUND", "Không tìm thấy báo cáo");
  owner(actor, report.memberId);
  if (
    report.status !== "PENDING" ||
    report.version !== input.version ||
    report.periodId !== input.periodId
  )
    fail(
      409,
      "STATE_CONFLICT",
      "Chỉ sửa báo cáo chờ duyệt đúng phiên bản và kỳ",
    );
  await reportingAllowed(actor, report.memberId, input.periodId, tx);
  await checkReport(input, report.memberId, tx);
  report.lines = input.lines;
  report.notes = input.notes;
  report.version++;
  await incomplete(report.memberId, input.periodId, tx);
  return entity(await repo.saveReport(tx, report));
}
async function postLines(report, actor, tx) {
  await repo.bumpInventoryRevision(tx, report.memberId);
  await invalidateDownstream(report.memberId, report.periodId, tx);
  for (const line of report.lines) {
    const lot = await repo.getReceiptForUpdate(tx, line.lotId);
    await movement(
      {
        productId: lot.productId,
        memberId: report.memberId,
        lotId: lot.id,
        sourceId: report.id,
        kind: "DECLARATION",
        ...quantities(line),
        ...valuation(line, lot),
        sold: line.sold,
        damaged: line.damaged,
        giftGood: line.giftGood,
        giftDamaged: line.giftDamaged,
        effectiveAt: line.effectiveAt,
      },
      actor,
      tx,
    );
  }
  const history = await repo.listMovementsByMember(tx, report.memberId);
  validateTimeline(history);
  await incomplete(report.memberId, report.periodId, tx);
}
async function reportStatus(id, input, actor, tx) {
  const report = await repo.getReportForUpdate(tx, id);
  if (!report?.memberId) fail(404, "NOT_FOUND", "Không tìm thấy báo cáo");
  if (report.status !== "PENDING" || report.version !== input.version)
    fail(409, "STATE_CONFLICT", "Báo cáo đã xử lý");
  await openPeriod(report.periodId, tx);
  if (input.status === "APPROVED") {
    await postLines(report, actor, tx);
    report.approvedAt = new Date();
  }
  report.status = input.status;
  report.version++;
  return entity(await repo.saveReport(tx, report));
}
async function correctReport(id, input, actor, tx) {
  const old = await repo.getReportForUpdate(tx, id);
  if (!old?.memberId) fail(404, "NOT_FOUND", "Không tìm thấy báo cáo");
  if (
    old.status !== "APPROVED" ||
    old.version !== input.version ||
    input.periodId !== old.periodId
  )
    fail(
      409,
      "STATE_CONFLICT",
      "Bản gốc không còn là báo cáo đã duyệt hiện hành",
    );
  await openPeriod(old.periodId, tx);
  await checkReport(input, old.memberId, tx);
  const originals = await repo.listMovementsBySourceKind(
    tx,
    old.id,
    "DECLARATION",
  );
  for (const original of originals) {
    const reversal = {
      ...original,
      kind: "REVERSAL",
      sourceId: `reversal:${old.id}`,
    };
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
      reversal[field] = original[field] == null ? null : -original[field];
    await movement(reversal, actor, tx);
  }
  const replacement = await repo.createReport(tx, {
    periodId: input.periodId,
    lines: input.lines,
    notes: input.notes,
    memberId: old.memberId,
    memberName: old.memberName,
    replacesId: old.id,
    status: "APPROVED",
    submittedAt: new Date(),
    approvedAt: new Date(),
  });
  await postLines(replacement, actor, tx);
  old.status = "SUPERSEDED";
  old.version++;
  await repo.saveReport(tx, old);
  return entity(replacement);
}

module.exports = { createReport, amendReport, reportStatus, correctReport };
