const { Router } = require("express");
const { command, entity } = require("../infrastructure/transaction");
const p = require("../domain/policy");
function routerKit() {
  const router = Router();
  router.param("id", (req, res, next, value) => {
    try {
      p.parse(p.id, value);
      next();
    } catch (e) {
      next(e);
    }
  });
  const admin = (req, res, next) => {
    try {
      p.admin(req.actor);
      next();
    } catch (e) {
      next(e);
    }
  };
  const mutate = (operation, schema, execute) => async (req, res) => {
    const input = p.parse(schema, req.body);
    const result = await command(
      req.actor,
      `${operation}:${req.params.id || ""}`,
      req.header("Idempotency-Key"),
      input,
      (session) => execute(req, input, session),
    );
    res.json(result);
  };
  const page = (req) =>
    p.parse(
      p.z.object({
        limit: p.z.coerce.number().int().min(1).max(200).default(50),
        offset: p.z.coerce.number().int().min(0).max(100000).default(0),
      }),
      req.query,
    );
  const list =
    (Model, query, format = entity) =>
    async (req, res) => {
      const { limit, offset } = page(req),
        filter = typeof query === "function" ? query(req) : query;
      const docs = await Model.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit + 1)
        .lean();
      res.json({
        items: docs.slice(0, limit).map(format),
        hasMore: docs.length > limit,
        offset,
        limit,
      });
    };
  return { router, admin, mutate, list };
}
module.exports = { routerKit };
