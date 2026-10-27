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
  const names = Object.keys(process.env).filter(k => /REDIS|KV_|UPSTASH/.test(k)).sort();
  res.status(200).json({
    database,
    databaseSettings: { url: URL_KEY || null, token: TOKEN_KEY || null },
    otherDatabaseSettingsFound: names,
    founderEmailSet: !!process.env.FOUNDER_EMAIL,
    adminPasswordSet: !!process.env.ADMIN_PASSWORD,
  });
};
