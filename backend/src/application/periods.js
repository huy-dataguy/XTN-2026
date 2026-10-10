const {
  Period,
  SystemGuard,
  MemberPeriod,
  User,
  Report,
} = require("../infrastructure/models");
const { fail, bounds } = require("../domain/policy");
async function openPeriod(key, session) {
  const period = await Period.findOneAndUpdate(
    { _id: key },
    { $inc: { revision: 1 }, $setOnInsert: { status: "OPEN" } },
    { upsert: true, returnDocument: "after", session },
  );
  if (period.status === "CLOSED")
    fail(409, "PERIOD_CLOSED", "Kỳ đã khóa; cần quản trị mở lại với lý do");
  return period;
}
async function memberPeriod(memberId, key, session) {
  const member = await User.findById(memberId).session(session).lean();
  return MemberPeriod.findOneAndUpdate(
    { _id: `${memberId}:${key}` },
    {
      $setOnInsert: {
        memberId,
        periodId: key,
        complete: false,
        targetRevenue: null,
        group: member?.group || "Chưa phân nhóm",
      },
    },
    { upsert: true, returnDocument: "after", session },
  );
}
async function reportingAllowed(actor, memberId, key, session) {
  await openPeriod(key, session);
  const scope = await memberPeriod(memberId, key, session);
  if (
    actor.role !== "ADMIN" &&
    Date.now() > +(scope.extensionUntil || bounds(key).deadline)
  )
    fail(409, "REPORT_DEADLINE", "Đã hết hạn báo cáo; cần quản trị gia hạn");
  return scope;
}
async function incomplete(memberId, key, session) {
  await memberPeriod(memberId, key, session);
  await MemberPeriod.updateOne(
    { _id: `${memberId}:${key}` },
    { $set: { complete: false }, $unset: { completedAt: 1 } },
    { session },
  );
}
async function postingFence(session) {
  await SystemGuard.findOneAndUpdate(
    { _id: "period-posting" },
    { $inc: { revision: 1 } },
    { upsert: true, session, returnDocument: "after" },
  );
}
async function invalidateDownstream(memberId, key, session) {
  await postingFence(session);
  if (
    await Period.exists({ _id: { $gt: key }, status: "CLOSED" }).session(
      session,
    )
  )
    fail(
      409,
      "DOWNSTREAM_PERIOD_CLOSED",
      "Có kỳ sau đã khóa; mở lại các kỳ bị ảnh hưởng trước khi ghi lịch sử",
    );
  await MemberPeriod.updateMany(
    { memberId, periodId: { $gt: key } },
    { $set: { complete: false }, $unset: { completedAt: 1 } },
    { session },
  );
}
async function closePeriod(key, session) {
  await postingFence(session);
  if (+bounds(key).end > Date.now())
    fail(409, "PERIOD_NOT_FINISHED", "Chưa hết tuần");
  const period = await openPeriod(key, session);
  if (
    await Report.exists({
      periodId: key,
      status: "PENDING",
      schemaVersion: 1,
    }).session(session)
  )
    fail(409, "PENDING_REPORTS", "Còn báo cáo trong kỳ chờ duyệt");
  const members = await User.find({
    role: "DISTRIBUTOR",
    active: { $ne: false },
    createdAt: { $lt: bounds(key).end },
  })
    .session(session)
    .lean();
  const scopes = await MemberPeriod.find({
    _id: { $in: members.map((member) => `${member._id}:${key}`) },
  })
    .session(session)
    .lean();
  const scopeMap = new Map(scopes.map((state) => [state._id, state]));
  for (const member of members) {
    const state = scopeMap.get(`${member._id}:${key}`);
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
  await period.save({ session });
  return period;
}
module.exports = {
  openPeriod,
  invalidateDownstream,
  memberPeriod,
  reportingAllowed,
  incomplete,
  closePeriod,
};
