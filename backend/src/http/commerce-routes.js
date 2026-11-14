const repo = require("../infrastructure/repository");
const { getPool } = require("../infrastructure/db");
const { snapshot } = require("../infrastructure/transaction");
const p = require("../domain/policy");
const s = require("./schemas");
const { routerKit } = require("./router-kit");
const commerce = {
  ...require("../application/inventory"),
  ...require("../application/orders"),
  ...require("../application/reports"),
};
const analytics = require("../application/analytics");
function commerceRoutes() {
  const { router, admin, mutate, list } = routerKit();
  router.get("/migration/status", admin, async (req, res) =>
    res.json({
      products: await repo.countLegacyProducts(getPool()),
      orders: await repo.countLegacyOrders(getPool()),
      reports: await repo.countLegacyReports(getPool()),
    }),
  );
  router.get(
    "/products",
    list(
      (req, { limit, offset }) =>
        repo.listProducts(getPool(), { limit, offset }),
      commerce.productDTO,
    ),
  );
  router.post(
    "/products",
    admin,
    mutate("product.create", s.product, (req, input, tx) =>
      commerce.createProduct(input, req.actor, tx),
    ),
  );
  router.put(
    "/products/:id",
    admin,
    mutate("product.update", s.productUpdate, (req, input, tx) =>
      commerce.updateProduct(req.params.id, input, tx),
    ),
  );
  router.post(
    "/products/:id/adjust",
    admin,
    mutate(
      "product.adjust",
      p.z
        .object({
          delta: p.z
            .number()
            .int()
            .min(-1000000)
            .max(1000000)
            .refine((v) => v !== 0),
          reason: p.text,
        })
        .strict(),
      (req, input, tx) =>
        commerce.adjustProduct(req.params.id, input, req.actor, tx),
    ),
  );
  router.post(
    "/products/:id/activity",
    admin,
    mutate("warehouse.activity", s.warehouse, (req, input, tx) =>
      commerce.warehouseActivity(req.params.id, input, req.actor, tx),
    ),
  );
  router.get(
    "/orders",
    list((req, { limit, offset }) =>
      repo.listOrders(getPool(), {
        memberId: commerce.scoped(req.actor),
        limit,
        offset,
      }),
    ),
  );
  router.post(
    "/orders",
    mutate("order.create", s.order, (req, input, tx) => {
      if (req.actor.role !== "DISTRIBUTOR")
        p.fail(403, "MEMBER_ONLY", "Chỉ thành viên đặt yêu cầu cấp hàng");
      return commerce.createOrder(input, req.actor, tx);
    }),
  );
  router.put(
    "/orders/:id",
    mutate("order.amend", s.orderUpdate, (req, input, tx) =>
      commerce.amendOrder(req.params.id, input, req.actor, tx),
    ),
  );
  router.put(
    "/orders/:id/status",
    mutate("order.status", s.status, (req, input, tx) =>
      commerce.orderStatus(req.params.id, input, req.actor, tx),
    ),
  );
  router.post(
    "/orders/:id/receipts",
    mutate("order.receive", s.receipt, (req, input, tx) =>
      commerce.receiveOrder(req.params.id, input, req.actor, tx),
    ),
  );
  router.get(
    "/reports",
    list((req, { limit, offset }) =>
      repo.listReports(getPool(), {
        memberId: commerce.scoped(req.actor),
        limit,
        offset,
      }),
    ),
  );
  router.post(
    "/reports",
    mutate("report.create", s.reportInput, (req, input, tx) => {
      if (req.actor.role !== "DISTRIBUTOR")
        p.fail(403, "MEMBER_ONLY", "Chỉ thành viên gửi báo cáo");
      return commerce.createReport(input, req.actor, tx);
    }),
  );
  router.put(
    "/reports/:id",
    mutate("report.amend", s.reportUpdate, (req, input, tx) =>
      commerce.amendReport(req.params.id, input, req.actor, tx),
    ),
  );
  router.put(
    "/reports/:id/status",
    admin,
    mutate("report.status", s.reportStatus, (req, input, tx) =>
      commerce.reportStatus(req.params.id, input, req.actor, tx),
    ),
  );
  router.post(
    "/reports/:id/corrections",
    admin,
    mutate("report.correct", s.correction, (req, input, tx) =>
      commerce.correctReport(req.params.id, input, req.actor, tx),
    ),
  );
  router.get("/inventory", async (req, res) => {
    let actor = req.actor;
    if (req.query.memberId) {
      const memberId = p.parse(p.id, req.query.memberId);
      p.owner(req.actor, memberId);
      actor = { ...actor, id: memberId, role: "DISTRIBUTOR" };
    }
    res.json(await snapshot((tx) => analytics.stock(actor, tx)));
  });
  router.get("/analytics/weekly", async (req, res) => {
    const input = p.parse(
      p.z
        .object({
          from: p.week,
          to: p.week,
          limit: p.z.coerce.number().int().min(1).max(200).default(50),
          offset: p.z.coerce.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      req.query,
    );
    res.json(
      await snapshot((tx) =>
        analytics.weekly(req.actor, input.from, input.to, tx, {
          limit: input.limit,
          offset: input.offset,
        }),
      ),
    );
  });

  return router;
}
module.exports = { commerceRoutes };
