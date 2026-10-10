function configuration(env = process.env) {
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must have at least 32 characters");
  if (env.NODE_ENV === "production" && !env.CORS_ORIGINS)
    throw new Error("CORS_ORIGINS is required in production");
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (![0, 1].includes(trustProxyHops))
    throw new Error("TRUST_PROXY_HOPS must be 0 or 1");
  const origins = (
    env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim());
  if (origins.includes("*"))
    throw new Error("CORS_ORIGINS must list explicit origins");
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer from 1 to 65535");
  return {
    mongoUri: env.MONGO_URI,
    jwtSecret: env.JWT_SECRET,
    inviteCode: env.DISTRIBUTOR_REGISTRATION_CODE || null,
    origins,
    port,
    trustProxyHops,
    logRequests: env.NODE_ENV !== "test",
  };
}
module.exports = { configuration };
