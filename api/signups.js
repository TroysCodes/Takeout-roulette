// GET /api/signups — founder only: a founder session, or the ADMIN_PASSWORD as a Bearer token.
const { redis } = require("./_redis");
const { isAdmin } = require("./_auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isAdmin(req))) {
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: process.env.ADMIN_PASSWORD || process.env.FOUNDER_EMAIL ? "Wrong password" : "Set FOUNDER_EMAIL in Vercel first" });
  }
  try {
    const flat = (await redis("HGETALL", "signups")) || [];
    const rows = [];
    for (let i = 0; i < flat.length; i += 2) rows.push({ email: flat[i], at: flat[i + 1] });
    rows.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    res.status(200).json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
