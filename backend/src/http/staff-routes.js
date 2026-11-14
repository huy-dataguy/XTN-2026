const repo = require("../infrastructure/repository");
const { getPool } = require("../infrastructure/db");
const { snapshot, entity } = require("../infrastructure/transaction");
const p = require("../domain/policy");
const s = require("./schemas");
const { routerKit } = require("./router-kit");
const bcrypt = require("bcryptjs");
function staffRoutes() {
  const { router, admin, mutate, list } = routerKit();
  router.get(
    "/users",
    admin,
    list((req, { limit, offset }) =>
      repo.listUsers(getPool(), { limit, offset }),
    ),
  );
  router.post(
    "/users",
    admin,
    mutate("user.create", s.user, async (req, input, tx) => {
      if (await repo.usernameExists(tx, input.username))
        p.fail(409, "DUPLICATE_USERNAME", "Tên đăng nhập đã tồn tại");
      const claimed = await repo.claimCommand(tx, {
        id: `username:${input.username}`,
        requestHash: null,
      });
      if (!claimed)
        p.fail(409, "DUPLICATE_USERNAME", "Tên đăng nhập đã tồn tại");
      return entity(
        await repo.createUser(tx, {
          ...input,
          password: await bcrypt.hash(input.password, 12),
        }),
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
      async (req, input, tx) => {
        if (req.params.id === req.actor.id && input.active === false)
          p.fail(409, "SELF_DISABLE", "Không tự khóa tài khoản đang dùng");
        const user = await repo.getUserForUpdate(tx, req.params.id);
        if (!user) p.fail(404, "NOT_FOUND", "Không có tài khoản");
        if (input.name !== undefined) user.name = input.name;
        if (input.group !== undefined) user.group = input.group;
        if (input.active !== undefined) {
          user.active = input.active;
          user.tokenVersion = (user.tokenVersion || 0) + 1;
        }
        return entity(
          await repo.updateUser(tx, user.id, {
            name: user.name,
            group: user.group,
            active: user.active,
            tokenVersion: user.tokenVersion,
          }),
        );
      },
    ),
  );
  router.put(
    "/users/:id/password",
    admin,
    mutate(
      "user.password",
      p.z.object({ password: s.password }).strict(),
      async (req, input, tx) => {
        const user = await repo.getUserForUpdate(tx, req.params.id);
        if (!user) p.fail(404, "NOT_FOUND", "Không có tài khoản");
        await repo.updateUser(tx, user.id, {
          password: await bcrypt.hash(input.password, 12),
          tokenVersion: (user.tokenVersion || 0) + 1,
        });
        return { id: user.id, ok: true };
      },
    ),
  );
  router.get(
    "/tasks",
    admin,
    list((req, { limit, offset }) =>
      repo.listTasks(getPool(), { limit, offset }),
    ),
  );
  router.post(
    "/tasks",
    admin,
    mutate("task.create", s.task, async (req, input, tx) => {
      if (input.assigneeId) {
        const assignee = await repo.getUserById(tx, input.assigneeId);
        if (!assignee || assignee.role !== "ADMIN" || assignee.active === false)
          p.fail(400, "INVALID_ASSIGNEE", "Người nhận việc phải là quản trị");
      }
      return entity(
        await repo.createTask(tx, {
          ...input,
          assignee: input.assigneeId,
          creator: req.actor.id,
        }),
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
      async (req, input, tx) => {
        const task = await repo.updateTask(tx, req.params.id, input);
        if (!task) p.fail(404, "NOT_FOUND", "Không có công việc");
        return entity(task);
      },
    ),
  );
  router.get(
    "/tags",
    admin,
    list((req, { limit, offset }) =>
      repo.listTags(getPool(), { limit, offset }),
    ),
  );
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
      async (req, input, tx) => entity(await repo.createTag(tx, input)),
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
      async (req, input, tx) => {
        const tag = await repo.updateTag(tx, req.params.id, input);
        if (!tag) p.fail(404, "NOT_FOUND", "Không có nhãn");
        return entity(tag);
      },
    ),
  );
  router.get(
    "/groups",
    admin,
    list((req, { limit, offset }) =>
      repo.listGroups(getPool(), { limit, offset }),
    ),
  );
  router.post(
    "/groups",
    admin,
    mutate(
      "group.create",
      s.group,
      async (req, input, tx) => entity(await repo.createGroup(tx, input)),
    ),
  );
  router.put(
    "/groups/:id",
    admin,
    mutate(
      "group.update",
      p.z
        .object({ name: p.text.optional(), active: p.z.boolean().optional() })
        .strict(),
      async (req, input, tx) => {
        const group = await repo.updateGroup(tx, req.params.id, input);
        if (!group) p.fail(404, "NOT_FOUND", "Không có nhóm");
        return entity(group);
      },
    ),
  );
  router.get("/cash/summary", admin, async (req, res) =>
    res.json(
      await snapshot(async (tx) => {
        const tagId = req.query.tagId
          ? p.parse(p.id, req.query.tagId)
          : undefined;
        const { cashIn, cashOut } = await repo.cashSummary(tx, tagId);
        return { cashIn, cashOut, netCashFlow: cashIn - cashOut };
      }),
    ),
  );
  router.get(
    "/statements",
    admin,
    list((req, { limit, offset }) =>
      repo.listStatements(getPool(), {
        tagId: req.query.tagId ? p.parse(p.id, req.query.tagId) : undefined,
        limit,
        offset,
      }),
    ),
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
      async (req, input, tx) => {
        for (const tag of input.tags) {
          if (!(await repo.activeTagExists(tx, tag)))
            p.fail(400, "INVALID_TAG", "Nhãn không hợp lệ");
        }
        if (await repo.getStatementByReference(tx, input.reference))
          p.fail(409, "DUPLICATE_REFERENCE", "Mã giao dịch đã được ghi nhận");
        const claimed = await repo.claimCommand(tx, {
          id: `bank:${input.reference}`,
          requestHash: null,
        });
        if (!claimed)
          p.fail(409, "DUPLICATE_REFERENCE", "Mã giao dịch đã được ghi nhận");
        return entity(await repo.createStatement(tx, input));
      },
    ),
  );
  router.post(
    "/statements/:id/void",
    admin,
    mutate(
      "cash.void",
      p.z.object({ reason: p.text }).strict(),
      async (req, input, tx) => {
        const statement = await repo.voidStatement(tx, req.params.id);
        if (!statement)
          p.fail(409, "STATE_CONFLICT", "Giao dịch không còn hiệu lực");
        return entity(statement);
      },
    ),
  );
  router.get(
    "/audit",
    admin,
    list((req, { limit, offset }) =>
      repo.listAudit(getPool(), { limit, offset }),
    ),
  );

  return router;
}
module.exports = { staffRoutes };
