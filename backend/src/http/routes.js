const { Router } = require("express");
const { commerceRoutes } = require("./commerce-routes");
const { periodRoutes } = require("./period-routes");
const { staffRoutes } = require("./staff-routes");
function routes() {
  const router = Router();
  router.use(commerceRoutes(), periodRoutes(), staffRoutes());
  return router;
}
module.exports = { routes };
