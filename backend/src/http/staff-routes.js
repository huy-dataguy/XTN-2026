const m = require("../infrastructure/models");
const { snapshot, entity } = require("../infrastructure/transaction");
const p = require("../domain/policy");
const s = require("./schemas");
const { routerKit } = require("./router-kit");
const bcrypt = require("bcryptjs");
function staffRoutes() {
  const { router, admin, mutate, list } = routerKit();
  router.get("/users", admin, list(m.User, {}));
  router.post(
    "/users",
    admin,
    mutate("user.create", s.user, async (req, input, session) => {
      if (await m.User.exists({ username: input.username }).session(session))
        p.fail(409, "DUPLICATE_USERNAME", "Tên đăng nhập đã tồn tại");
      await m.Command.create([{ _id: `username:${input.username}` }], {
        session,
      });
      return entity(
        (
          await m.User.create(
            [{ ...input, password: await bcrypt.hash(input.password, 12) }],
            { session },
          )
        )[0],
      );
    }),
  );
  router.put(
    "/users/:id",
    admin,
    mutate(
      "user.update",
      p.z
        .object({
          name: p.text.optional(),
          group: p.z.string().max(100).optional(),
          active: p.z.boolean().optional(),
        })
        .strict(),
      async (req, input, session) => {
        if (req.params.id === req.actor.id && input.active === false)
          p.fail(409, "SELF_DISABLE", "Không tự khóa tài khoản đang dùng");
        const user = await m.User.findById(req.params.id).session(session);
        if (!user) p.fail(404, "NOT_FOUND", "Không có tài khoản");
        Object.assign(user, input);
        if (input.active !== undefined)
          user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save({ session });
        return entity(user);
      },
    ),
  );
  router.put(
    "/users/:id/password",
    admin,
    mutate(
      "user.password",
      p.z.object({ password: s.password }).strict(),
      async (req, input, session) => {
        const user = await m.User.findById(req.params.id)
          .select("+password")
          .session(session);
        if (!user) p.fail(404, "NOT_FOUND", "Không có tài khoản");
        user.password = await bcrypt.hash(input.password, 12);
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save({ session });
        return { id: user.id, ok: true };
      },
    ),
  );
  router.get("/tasks", admin, list(m.Task, { active: { $ne: false } }));
  router.post(
    "/tasks",
    admin,
    mutate("task.create", s.task, async (req, input, session) => {
      if (
        input.assigneeId &&
        !(await m.User.exists({
          _id: input.assigneeId,
          role: "ADMIN",
          active: { $ne: false },
        }).session(session))
      )
        p.fail(400, "INVALID_ASSIGNEE", "Người nhận việc phải là quản trị");
      return entity(
        (
          await m.Task.create(
            [{ ...input, assignee: input.assigneeId, creator: req.actor.id }],
            { session },
          )
        )[0],
      );
    }),
  );
  router.put(
    "/tasks/:id",
    admin,
    mutate(
      "task.update",
      p.z
        .object({
          status: p.z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
          active: p.z.boolean().optional(),
        })
        .strict(),
      async (req, input, session) => {
        const task = await m.Task.findByIdAndUpdate(
          req.params.id,
          { $set: input },
          { session, returnDocument: "after", runValidators: true },
        );
        if (!task) p.fail(404, "NOT_FOUND", "Không có công việc");
        return entity(task);
      },
    ),
  );
  router.get("/tags", admin, list(m.Tag, { active: { $ne: false } }));
  router.post(
    "/tags",
    admin,
    mutate(
      "tag.create",
      p.z
        .object({
          name: p.text,
          color: p.z
            .enum([
              "red",
              "blue",
              "green",
              "yellow",
              "purple",
              "gray",
              "orange",
              "teal",
            ])
            .default("green"),
        })
        .strict(),
      async (req, input, session) =>
        entity((await m.Tag.create([input], { session }))[0]),
    ),
  );
  router.put(
    "/tags/:id",
    admin,
    mutate(
      "tag.update",
      p.z
        .object({ name: p.text.optional(), active: p.z.boolean().optional() })
        .strict(),
      async (req, input, session) => {
        const tag = await m.Tag.findByIdAndUpdate(
          req.params.id,
          { $set: input },
          { session, returnDocument: "after", runValidators: true },
        );
        if (!tag) p.fail(404, "NOT_FOUND", "Không có nhãn");
        return entity(tag);
      },
    ),
  );
  router.get("/cash/summary", admin, async (req, res) =>
    res.json(
      await snapshot(async (session) => {
        let cashIn = 0,
          cashOut = 0;
        for await (const value of m.Statement.find({
          voided: { $ne: true },
          ...(req.query.tagId ? { tags: p.parse(p.id, req.query.tagId) } : {}),
        })
          .select("type amount")
          .session(session)
          .lean()
          .cursor({ batchSize: 1000 })) {
          if (value.type === "IN") cashIn = p.safeMoney(cashIn + value.amount);
          if (value.type === "OUT")
            cashOut = p.safeMoney(cashOut + value.amount);
        }
        return { cashIn, cashOut, netCashFlow: cashIn - cashOut };
      }),
    ),
  );
  router.get(
    "/statements",
    admin,
    list(m.Statement, (req) => ({
      voided: { $ne: true },
      ...(req.query.tagId ? { tags: p.parse(p.id, req.query.tagId) } : {}),
    })),
  );
  router.post(
    "/statements",
    admin,
    mutate(
      "cash.create",
      p.z
        .object({
          transactionDate: p.timestamp,
          type: p.z.enum(["IN", "OUT"]),
          amount: p.money.refine((v) => v > 0),
          partnerName: p.text,
          description: p.z.string().max(2000).default(""),
          reference: p.text,
          tags: p.z.array(p.id).max(20).default([]),
        })
        .strict(),
      async (req, input, session) => {
        for (const tag of input.tags) {
          if (
            !(await m.Tag.exists({ _id: tag, active: { $ne: false } }).session(
              session,
            ))
          )
            p.fail(400, "INVALID_TAG", "Nhãn không hợp lệ");
        }
        // Reference deterministic identity prevents duplicate imports even with a fresh key.
        const duplicate = await m.Statement.findOne({
          reference: input.reference,
        }).session(session);
        if (duplicate)
          p.fail(409, "DUPLICATE_REFERENCE", "Mã giao dịch đã được ghi nhận");
        // Serialize reference claims without schema/index changes using the command collection.
        await m.Command.create([{ _id: `bank:${input.reference}` }], {
          session,
        });
        return entity((await m.Statement.create([input], { session }))[0]);
      },
    ),
  );
  router.post(
    "/statements/:id/void",
    admin,
    mutate(
      "cash.void",
      p.z.object({ reason: p.text }).strict(),
      async (req, input, session) => {
        const statement = await m.Statement.findOneAndUpdate(
          { _id: req.params.id, voided: { $ne: true } },
          { $set: { voided: true } },
          { session, returnDocument: "after" },
        );
        if (!statement)
          p.fail(409, "STATE_CONFLICT", "Giao dịch không còn hiệu lực");
        return entity(statement);
      },
    ),
  );
  router.get("/audit", admin, list(m.Audit, {}));

  return router;
}
module.exports = { staffRoutes };
