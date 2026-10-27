// GET /api/signups — owner only. Send the ADMIN_PASSWORD (set in Vercel) as a Bearer token.
const crypto = require("crypto");
const { redis } = require("./_redis");

function same(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const pass = process.env.ADMIN_PASSWORD;
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!pass || pass.length < 8) return res.status(503).json({ error: "Set ADMIN_PASSWORD (8+ characters) in Vercel first" });
  if (!given || !same(given, pass)) {
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: "Wrong password" });
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
