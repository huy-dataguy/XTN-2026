const { Router } = require("express");
const { commerceRoutes } = require("./commerce-routes");
const { periodRoutes } = require("./period-routes");
const { staffRoutes } = require("./staff-routes");
const { kpiRoutes } = require("./kpi-routes");
function routes() {
  const router = Router();
  router.use(commerceRoutes(), periodRoutes(), staffRoutes(), kpiRoutes());
  return router;
}
module.exports = { routes };
