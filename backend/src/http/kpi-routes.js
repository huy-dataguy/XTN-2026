const { entity, snapshot } = require("../infrastructure/transaction");
const p = require("../domain/policy");
const s = require("./schemas");
const { routerKit } = require("./router-kit");
const kpi = require("../application/kpi");

function kpiRoutes() {
  const { router, admin, mutate } = routerKit();

  router.get("/kpi", async (req, res) => {
    const input = p.parse(
      p.z.object({
        from: p.week.default(p.periodId(new Date())),
        to: p.week.optional(),
      }),
      req.query,
    );
    res.json(await snapshot((tx) => kpi.overview(tx, input.from, input.to || input.from)));
  });

  router.post(
    "/kpi/phases",
    admin,
    mutate("kpi.phase.create", s.kpiPhase, async (req, input, tx) =>
      entity(await kpi.configure(req.actor, input, tx)),
    ),
  );

  router.patch(
    "/kpi/phases/:id",
    admin,
    mutate("kpi.phase.update", s.kpiPhaseUpdate, async (req, input, tx) =>
      entity(await kpi.update(req.actor, { ...input, id: req.params.id }, tx)),
    ),
  );

  return router;
}

module.exports = { kpiRoutes };
