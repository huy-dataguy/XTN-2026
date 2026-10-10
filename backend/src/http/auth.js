const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Router } = require("express");
const { User, Command, mongoose } = require("../infrastructure/models");
const { entity } = require("../infrastructure/transaction");
const { parse, z, fail } = require("../domain/policy");
const schemas = require("./schemas");
function authentication(config) {
  return async (req, res, next) => {
    try {
      const match = /^Bearer ([^ ]+)$/.exec(req.header("Authorization") || "");
      if (!match) fail(401, "UNAUTHENTICATED", "Cần đăng nhập");
      let decoded;
      try {
        decoded = jwt.verify(match[1], config.jwtSecret, {
          algorithms: ["HS256"],
          issuer: "xtn",
          audience: "xtn-web",
        });
      } catch {
        fail(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hợp lệ");
      }
      const user = await User.findById(decoded.sub).lean();
      if (
        !user ||
        user.active === false ||
        (user.tokenVersion || 0) !== decoded.version
      )
        fail(401, "SESSION_EXPIRED", "Phiên đã bị thu hồi");
      req.actor = { ...entity(user), id: String(user._id) };
      next();
    } catch (error) {
      next(error);
    }
  };
}
function authRoutes(config) {
  const router = Router();
  router.post("/login", async (req, res) => {
    const input = parse(
      z
        .object({
          username: z.string().min(1).max(80),
          password: z.string().min(1).max(128),
        })
        .strict(),
      req.body,
    );
    const user = await User.findOne({
      username: input.username,
      active: { $ne: false },
    }).select("+password");
    if (!user || !(await bcrypt.compare(input.password, user.password)))
      fail(
        401,
        "INVALID_CREDENTIALS",
        "Tên đăng nhập hoặc mật khẩu không đúng",
      );
    const token = jwt.sign(
      { version: user.tokenVersion || 0 },
      config.jwtSecret,
      {
        algorithm: "HS256",
        expiresIn: "8h",
        subject: user.id,
        issuer: "xtn",
        audience: "xtn-web",
      },
    );
    res.json({ token, user: entity(user) });
  });
  router.post("/register", async (req, res) => {
    const input = parse(
      schemas.user
        .extend({ securityCode: z.string().min(1).max(128) })
        .strict(),
      req.body,
    );
    if (
      input.role !== "DISTRIBUTOR" ||
      !config.inviteCode ||
      input.securityCode !== config.inviteCode
    )
      fail(403, "INVITE_REQUIRED", "Chỉ đăng ký thành viên bằng mã mời hợp lệ");
    const password = await bcrypt.hash(input.password, 12);
    const user = await mongoose.connection.transaction(async (session) => {
      if (await User.exists({ username: input.username }).session(session))
        fail(409, "DUPLICATE_USERNAME", "Tên đăng nhập đã tồn tại");
      await Command.create([{ _id: `username:${input.username}` }], {
        session,
      });
      return (await User.create([{ ...input, password }], { session }))[0];
    });
    res.status(201).json(entity(user));
  });
  router.use(authentication(config));
  router.get("/me", (req, res) => res.json(req.actor));
  router.post("/logout", async (req, res) => {
    await User.updateOne({ _id: req.actor.id }, { $inc: { tokenVersion: 1 } });
    res.json({ ok: true });
  });
  router.post("/impersonate/:id", (req, res) =>
    res.status(410).json({
      code: "REMOVED",
      message: "Chức năng đăng nhập thay không còn được hỗ trợ",
    }),
  );
  return router;
}
module.exports = { authentication, authRoutes };
