const repo = require("../infrastructure/repository");
const { fail, bounds } = require("../domain/policy");
const kpi = require("./kpi");
async function openPeriod(key, tx) {
  const period = await repo.openPeriod(tx, key);
  if (period.status === "CLOSED")
    fail(409, "PERIOD_CLOSED", "Kỳ đã khóa; cần quản trị mở lại với lý do");
  return period;
}
async function memberPeriod(memberId, key, tx) {
  const member = await repo.getUserById(tx, memberId);
  return repo.upsertMemberPeriod(tx, {
    memberId,
    key,
    group: member?.group || "Chưa phân nhóm",
  });
}
async function reportingAllowed(actor, memberId, key, tx) {
  await openPeriod(key, tx);
  const scope = await memberPeriod(memberId, key, tx);
  if (
    actor.role !== "ADMIN" &&
    Date.now() > +(scope.extensionUntil || bounds(key).deadline)
  )
    fail(409, "REPORT_DEADLINE", "Đã hết hạn báo cáo; cần quản trị gia hạn");
  return scope;
}
async function incomplete(memberId, key, tx) {
  const state = await memberPeriod(memberId, key, tx);
  state.complete = false;
  state.completedAt = null;
  await repo.saveMemberPeriod(tx, state);
}
async function postingFence(tx) {
  await repo.bumpGuard(tx, "period-posting");
}
async function invalidateDownstream(memberId, key, tx) {
  await postingFence(tx);
  if (await repo.laterClosedPeriodExists(tx, key))
    fail(
      409,
      "DOWNSTREAM_PERIOD_CLOSED",
      "Có kỳ sau đã khóa; mở lại các kỳ bị ảnh hưởng trước khi ghi lịch sử",
    );
  await repo.invalidateMemberPeriodsAfter(tx, { memberId, key });
}
async function closePeriod(key, tx) {
  await postingFence(tx);
  if (+bounds(key).end > Date.now())
    fail(409, "PERIOD_NOT_FINISHED", "Chưa hết tuần");
  const period = await openPeriod(key, tx);
  if (await repo.pendingReportExists(tx, { periodId: key }))
    fail(409, "PENDING_REPORTS", "Còn báo cáo trong kỳ chờ duyệt");
  await kpi.snapshotWeek(key, tx);
  const members = await repo.listMembers(tx, {
    createdBefore: bounds(key).end,
    activeOnly: true,
  });
  const scopes = await repo.getMemberPeriods(tx, {
    memberIds: members.map((member) => member.id),
    keys: [key],
  });
  const scopeMap = new Map(scopes.map((state) => [state.memberId, state]));
  for (const member of members) {
    const state = scopeMap.get(member.id);
    if (
      !state?.complete ||
      (state.extensionUntil && +state.extensionUntil > Date.now())
    )
      fail(
        409,
        "INCOMPLETE_PERIOD",
        "Còn thành viên chưa chốt hoặc còn thời hạn gia hạn",
      );
  }
  period.status = "CLOSED";
  period.closedAt = new Date();
  return repo.savePeriod(tx, period);
}
module.exports = {
  openPeriod,
  invalidateDownstream,
  memberPeriod,
  reportingAllowed,
  incomplete,
  closePeriod,
};
