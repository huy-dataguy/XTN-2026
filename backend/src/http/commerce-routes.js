const m = require("../infrastructure/models");
const { snapshot, entity } = require("../infrastructure/transaction");
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
      products: await m.Product.countDocuments({
        inventoryVersion: { $ne: 1 },
      }),
      orders: await m.Order.countDocuments({ schemaVersion: { $ne: 1 } }),
      reports: await m.Report.countDocuments({ schemaVersion: { $ne: 1 } }),
    }),
  );
  router.get("/products", list(m.Product, {}, commerce.productDTO));
  router.post(
    "/products",
    admin,
    mutate("product.create", s.product, (req, input, session) =>
      commerce.createProduct(input, req.actor, session),
    ),
  );
  router.put(
    "/products/:id",
    admin,
    mutate("product.update", s.productUpdate, (req, input, session) =>
      commerce.updateProduct(req.params.id, input, session),
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
      (req, input, session) =>
        commerce.adjustProduct(req.params.id, input, req.actor, session),
    ),
  );
  router.post(
    "/products/:id/activity",
    admin,
    mutate("warehouse.activity", s.warehouse, (req, input, session) =>
      commerce.warehouseActivity(req.params.id, input, req.actor, session),
    ),
  );
  router.get(
    "/orders",
    list(m.Order, (req) => ({
      ...commerce.scoped(req.actor),
      schemaVersion: 1,
    })),
  );
  router.post(
    "/orders",
    mutate("order.create", s.order, (req, input, session) => {
      if (req.actor.role !== "DISTRIBUTOR")
        p.fail(403, "MEMBER_ONLY", "Chỉ thành viên đặt yêu cầu cấp hàng");
      return commerce.createOrder(input, req.actor, session);
    }),
  );
  router.put(
    "/orders/:id",
    mutate("order.amend", s.orderUpdate, (req, input, session) =>
      commerce.amendOrder(req.params.id, input, req.actor, session),
    ),
  );
  router.put(
    "/orders/:id/status",
    mutate("order.status", s.status, (req, input, session) =>
      commerce.orderStatus(req.params.id, input, req.actor, session),
    ),
  );
  router.post(
    "/orders/:id/receipts",
    mutate("order.receive", s.receipt, (req, input, session) =>
      commerce.receiveOrder(req.params.id, input, req.actor, session),
    ),
  );
  router.get(
    "/reports",
    list(m.Report, (req) => ({
      ...commerce.scoped(req.actor),
      schemaVersion: 1,
    })),
  );
  router.post(
    "/reports",
    mutate("report.create", s.reportInput, (req, input, session) => {
      if (req.actor.role !== "DISTRIBUTOR")
        p.fail(403, "MEMBER_ONLY", "Chỉ thành viên gửi báo cáo");
      return commerce.createReport(input, req.actor, session);
    }),
  );
  router.put(
    "/reports/:id",
    mutate("report.amend", s.reportUpdate, (req, input, session) =>
      commerce.amendReport(req.params.id, input, req.actor, session),
    ),
  );
  router.put(
    "/reports/:id/status",
    admin,
    mutate("report.status", s.reportStatus, (req, input, session) =>
      commerce.reportStatus(req.params.id, input, req.actor, session),
    ),
  );
  router.post(
    "/reports/:id/corrections",
    admin,
    mutate("report.correct", s.correction, (req, input, session) =>
      commerce.correctReport(req.params.id, input, req.actor, session),
    ),
  );
  router.get("/inventory", async (req, res) => {
    let actor = req.actor;
    if (req.query.memberId) {
      const memberId = p.parse(p.id, req.query.memberId);
      p.owner(req.actor, memberId);
      actor = { ...actor, id: memberId, role: "DISTRIBUTOR" };
    }
    res.json(await snapshot((session) => analytics.stock(actor, session)));
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
      await snapshot((session) =>
        analytics.weekly(req.actor, input.from, input.to, session, {
          limit: input.limit,
          offset: input.offset,
        }),
      ),
    );
  });

  return router;
}
module.exports = { commerceRoutes };
