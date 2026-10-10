const m = require("../infrastructure/models");
const { snapshot, entity } = require("../infrastructure/transaction");
const p = require("../domain/policy");
const s = require("./schemas");
const { routerKit } = require("./router-kit");
const periods = require("../application/periods");
function periodRoutes() {
  const { router, admin, mutate, list } = routerKit();
  router.post(
    "/periods/member",
    admin,
    mutate("period.configure", s.memberPeriod, async (req, input, session) => {
      const user = await m.User.findById(input.memberId).session(session);
      if (!user || user.role !== "DISTRIBUTOR")
        p.fail(404, "NOT_FOUND", "Không tìm thấy thành viên");
      await periods.openPeriod(input.periodId, session);
      const state = await periods.memberPeriod(
        input.memberId,
        input.periodId,
        session,
      );
      if (input.extensionUntil) {
        if (
          +new Date(input.extensionUntil) < +p.bounds(input.periodId).deadline
        )
          p.fail(400, "INVALID_EXTENSION", "Gia hạn phải sau hạn chuẩn");
        state.extensionUntil = input.extensionUntil;
        state.extensionReason = input.reason;
        state.complete = false;
      }
      if (input.targetRevenue !== undefined)
        state.targetRevenue = input.targetRevenue;
      await state.save({ session });
      return entity(state);
    }),
  );
  router.post(
    "/periods/complete",
    mutate(
      "period.complete",
      p.z.object({ periodId: p.week }).strict(),
      async (req, input, session) => {
        if (req.actor.role !== "DISTRIBUTOR")
          p.fail(403, "MEMBER_ONLY", "Thành viên tự xác nhận đã khai báo đủ");
        if (+p.bounds(input.periodId).end > Date.now())
          p.fail(409, "PERIOD_NOT_FINISHED", "Chưa hết tuần");
        const state = await periods.reportingAllowed(
          req.actor,
          req.actor.id,
          input.periodId,
          session,
        );
        if (
          await m.Report.exists({
            memberId: req.actor.id,
            periodId: input.periodId,
            status: "PENDING",
          }).session(session)
        )
          p.fail(409, "PENDING_REPORTS", "Còn báo cáo chờ duyệt");
        state.complete = true;
        state.completedAt = new Date();
        await state.save({ session });
        return entity(state);
      },
    ),
  );
  router.post(
    "/periods/close",
    admin,
    mutate(
      "period.close",
      p.z.object({ periodId: p.week, reason: p.text }).strict(),
      async (req, input, session) =>
        entity(await periods.closePeriod(input.periodId, session)),
    ),
  );
  router.post(
    "/periods/reopen",
    admin,
    mutate(
      "period.reopen",
      p.z.object({ periodId: p.week, reason: p.text }).strict(),
      async (req, input, session) => {
        const period = await m.Period.findById(input.periodId).session(session);
        if (!period || period.status !== "CLOSED")
          p.fail(409, "STATE_CONFLICT", "Kỳ chưa khóa");
        period.status = "OPEN";
        period.revision++;
        await period.save({ session });
        return entity(period);
      },
    ),
  );

  return router;
}
module.exports = { periodRoutes };
