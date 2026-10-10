const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const { randomUUID } = require("node:crypto");
const { mongoose } = require("../infrastructure/models");
const { authRoutes, authentication } = require("./auth");
const { routes } = require("./routes");
function createApp(config) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxyHops) app.set("trust proxy", config.trustProxyHops);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    const start = Date.now();
    res.on("finish", () => {
      if (config.logRequests)
        console.log(
          JSON.stringify({
            requestId: req.requestId,
            method: req.method,
            clientIp: req.ip,
            path: req.path,
            status: res.statusCode,
            ms: Date.now() - start,
          }),
        );
    });
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: config.origins, credentials: false }));
  app.use(express.json({ limit: "100kb" }));
  app.get("/health/live", (req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (req, res, next) => {
    try {
      if (mongoose.connection.readyState !== 1)
        return res.status(503).json({ status: "unavailable" });
      await mongoose.connection.db.command({ ping: 1 });
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  const limit = (count, keyGenerator) =>
    rateLimit({
      windowMs: 60000,
      ...(keyGenerator ? { keyGenerator } : {}),
      limit: count,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        code: "RATE_LIMITED",
        message: "Quá nhiều yêu cầu; vui lòng thử lại sau",
      },
    });
  app.use(["/api/v1/auth/login", "/api/v1/auth/register"], limit(20));
  app.use(
    "/api/v1/auth",
    limit(2000),
    authRoutes(
      config,
      limit(300, (req) => `actor:${req.actor.id}`),
    ),
  );
  app.use(
    "/api/v1",
    limit(2000),
    authentication(config),
    limit(300, (req) => `actor:${req.actor.id}`),
    routes(),
  );
  app.use("/api", (req, res) =>
    res.status(410).json({
      code: "API_VERSION_REQUIRED",
      message: "Dùng API /api/v1; các lối ghi cũ đã được đóng",
    }),
  );
  app.use((req, res) =>
    res
      .status(404)
      .json({ code: "NOT_FOUND", message: "Không tìm thấy endpoint" }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    let status = error.status || 500,
      code = error.code || "INTERNAL_ERROR",
      message = error.message;
    if (error.name === "ValidationError" || error.name === "CastError") {
      status = 400;
      code = "VALIDATION";
    }
    if (error.code === 11000) {
      status = 409;
      code = "DUPLICATE";
      message = "Dữ liệu hoặc mã giao dịch đã tồn tại";
    }
    if (status >= 500) {
      console.error(
        JSON.stringify({ requestId: req.requestId, error: error.message }),
      );
      message = "Không thể xử lý yêu cầu";
    }
    res.status(status).json({ code, message, requestId: req.requestId });
  });
  return app;
}
module.exports = { createApp };
