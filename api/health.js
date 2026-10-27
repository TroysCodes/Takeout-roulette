// GET /api/health — setup check. Says which settings are present and whether the database answers.
// Never shows values, only names and yes/no.
const { redis, URL_KEY, TOKEN_KEY } = require("./_redis");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  let database = "not connected";
  if (URL_KEY && TOKEN_KEY) {
    try { database = (await redis("PING")) === "PONG" ? "working" : "odd reply"; }
    catch (e) { database = "connected but failing: " + String(e.message).slice(0, 120); }
  }
  // ?deep=1 runs every step an account sign-up uses, on throwaway test keys, and says which one fails
  let accountSteps;
  if (req.query && req.query.deep && database === "working") {
    const A = require("./_auth"), k = "healthcheck:" + Date.now();
    accountSteps = {};
    const step = async (name, fn) => { try { await fn(); accountSteps[name] = "ok"; } catch (e) { accountSteps[name] = "FAILED: " + String(e.message).slice(0, 120); } };
    await step("password hashing", async () => { const r = A.hashPassword("test-password"); if (!A.checkPassword("test-password", r)) throw new Error("mismatch"); });
    await step("counter", async () => { await redis("INCR", k + ":n"); await redis("EXPIRE", k + ":n", 60); });
    await step("save account", async () => { await redis("HSETNX", k + ":h", "a", "1"); await redis("HGET", k + ":h", "a"); });
    await step("session", async () => { await redis("SET", k + ":s", "x", "EX", 60); await redis("GET", k + ":s"); });
    await step("clean up", async () => { await redis("DEL", k + ":n"); await redis("DEL", k + ":h"); await redis("DEL", k + ":s"); });
  }
  const names = Object.keys(process.env).filter(k => /REDIS|KV_|UPSTASH/.test(k)).sort();
  res.status(200).json({
    database,
    databaseSettings: { url: URL_KEY || null, token: TOKEN_KEY || null },
    otherDatabaseSettingsFound: names,
    founderEmailSet: !!process.env.FOUNDER_EMAIL,
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
    accountSteps,
  });
};
