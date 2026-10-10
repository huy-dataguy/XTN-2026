const { Report, Receipt, Movement, User } = require("../infrastructure/models");
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
async function checkReport(input, memberId, session) {
  for (const line of input.lines) {
    if (periodId(line.effectiveAt) !== input.periodId)
      fail(400, "PERIOD_MISMATCH", "Ngày phát sinh phải thuộc tuần báo cáo");
    const lot = await Receipt.findById(line.lotId).session(session);
    if (!lot || String(lot.memberId) !== String(memberId))
      fail(403, "LOT_OWNERSHIP", "Đợt nhận hàng không thuộc thành viên");
  }
}
async function createReport(input, actor, session) {
  await reportingAllowed(actor, actor.id, input.periodId, session);
  await checkReport(input, actor.id, session);
  await incomplete(actor.id, input.periodId, session);
  return entity(
    (
      await Report.create(
        [
          {
            ...input,
            memberId: actor.id,
            memberName: actor.name,
            submittedAt: new Date(),
          },
        ],
        { session },
      )
    )[0],
  );
}
async function amendReport(id, input, actor, session) {
  const report = await Report.findById(id).session(session);
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
  await reportingAllowed(actor, report.memberId, input.periodId, session);
  await checkReport(input, report.memberId, session);
  Object.assign(report, { lines: input.lines, notes: input.notes });
  report.version++;
  await incomplete(report.memberId, input.periodId, session);
  await report.save({ session });
  return entity(report);
}
async function postLines(report, actor, session) {
  await User.updateOne(
    { _id: report.memberId },
    { $inc: { inventoryRevision: 1 } },
    { session },
  );
  await invalidateDownstream(report.memberId, report.periodId, session);
  for (const line of report.lines) {
    const lot = await Receipt.findById(line.lotId).session(session);
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
      session,
    );
  }
  // The whole affected history is checked, including future weeks after backdating.
  const history = await Movement.find({ memberId: report.memberId })
    .session(session)
    .lean();
  validateTimeline(history);
  await incomplete(report.memberId, report.periodId, session);
}
async function reportStatus(id, input, actor, session) {
  const report = await Report.findById(id).session(session);
  if (!report?.memberId) fail(404, "NOT_FOUND", "Không tìm thấy báo cáo");
  if (report.status !== "PENDING" || report.version !== input.version)
    fail(409, "STATE_CONFLICT", "Báo cáo đã xử lý");
  await openPeriod(report.periodId, session);
  if (input.status === "APPROVED") {
    await postLines(report, actor, session);
    report.approvedAt = new Date();
  }
  report.status = input.status;
  report.version++;
  await report.save({ session });
  return entity(report);
}
async function correctReport(id, input, actor, session) {
  const old = await Report.findById(id).session(session);
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
  await openPeriod(old.periodId, session);
  await checkReport(input, old.memberId, session);
  const originals = await Movement.find({
    sourceId: old.id,
    kind: "DECLARATION",
  })
    .session(session)
    .lean();
  for (const original of originals) {
    const reversal = {
      ...original,
      _id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
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
    await movement(reversal, actor, session);
  }
  const replacement = (
    await Report.create(
      [
        {
          periodId: input.periodId,
          lines: input.lines,
          notes: input.notes,
          memberId: old.memberId,
          memberName: old.memberName,
          replacesId: old.id,
          status: "APPROVED",
          submittedAt: new Date(),
          approvedAt: new Date(),
        },
      ],
      { session },
    )
  )[0];
  await postLines(replacement, actor, session);
  old.status = "SUPERSEDED";
  old.version++;
  await old.save({ session });
  return entity(replacement);
}

module.exports = { createReport, amendReport, reportStatus, correctReport };
