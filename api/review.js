// POST /api/review {anon, placeId, review: {verdict, comment, at, name} | null}
// Saves (or clears) one diner's rating of one restaurant. Kept in its own Redis hash, "reviews",
// separate from the email sign-ups. Each browser has a random anonymous id; no names or emails.
const { redis } = require("./_redis");
const VERDICTS = new Set(["loved", "ok", "nope"]);
const str = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  const anon = String(b.anon || ""), placeId = String(b.placeId || "");
  if (!/^[a-z0-9]{8,40}$/.test(anon) || !/^[a-z0-9-]{1,80}$/.test(placeId)) return res.status(400).json({ error: "Bad request" });
  const key = `${placeId}|${anon}`;
  try {
    if (!b.review) { await redis("HDEL", "reviews", key); return res.status(200).json({ ok: true }); }
    const r = b.review;
    if (!VERDICTS.has(r.verdict)) return res.status(400).json({ error: "Bad rating" });
    const at = isNaN(Date.parse(r.at)) ? new Date().toISOString() : new Date(r.at).toISOString();
    const row = { placeId, name: str(r.name, 100), verdict: r.verdict, comment: str(r.comment, 200), at };
    await redis("HSET", "reviews", key, JSON.stringify(row));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not save" });
  }
};
