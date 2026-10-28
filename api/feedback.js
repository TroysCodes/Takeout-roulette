// POST /api/feedback {subject, message} — anyone can send the founder feedback (10 a day per connection).
// GET /api/feedback — founder only: every message, newest first. Kept in its own Redis hash, "feedback".
const crypto = require("crypto");
const { redis } = require("./_redis");
const { isAdmin, currentUser, today } = require("./_auth");
const str = (v, max) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      if (!(await isAdmin(req))) return res.status(401).json({ error: "Founder only" });
      const all = (await redis("HGETALL", "feedback")) || [];
      const rows = [];
      for (let i = 0; i < all.length; i += 2) { try { rows.push({ id: all[i], ...JSON.parse(all[i + 1]) }); } catch {} }
      rows.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      return res.status(200).json({ rows });
    }
    if (req.method === "DELETE") {
      if (!(await isAdmin(req))) return res.status(401).json({ error: "Founder only" });
      await redis("HDEL", "feedback", String((req.query || {}).id || ""));
      return res.status(200).json({ ok: true });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
    const b = req.body || {};
    const subject = str(b.subject, 120).replace(/\n/g, " "), message = str(b.message, 3000);
    if (message.length < 2) return res.status(400).json({ error: "Please write a little more." });
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
    const rk = "fbrate:" + today() + ":" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const n = Number(await redis("INCR", rk)); if (n === 1) await redis("EXPIRE", rk, 90000);
    if (n > 10) return res.status(429).json({ error: "Thanks! That's plenty of feedback for today." });
    const me = await currentUser(req).catch(() => null);
    const row = { subject, message, at: new Date().toISOString(), ...(me ? { email: me.email } : {}) };
    await redis("HSET", "feedback", Date.now() + "-" + crypto.randomBytes(4).toString("hex"), JSON.stringify(row));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not send. Please try again." });
  }
};
