// POST /api/visit {id} — counts one visit per browser tab. The id is the random anonymous browser id,
// stored in Redis HyperLogLogs (unique counts only; the ids themselves can't be read back).
// POST /api/visit {id, secs} — adds time spent on the site (sent every 30s while the tab is in view).
// The founder's own visits and time are never counted.
const { redis } = require("./_redis");
const { today, currentUser } = require("./_auth");
const hour = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", hourCycle: "h23" }).format(new Date());

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let b = req.body || {};
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const id = String(b.id || "");
  if (!/^[a-z0-9]{6,64}$/.test(id)) return res.status(400).json({ error: "Bad id" });
  try {
    const me = await currentUser(req).catch(() => null);
    if (me && me.founder) return res.status(200).json({ ok: true, skipped: "founder" });
    const day = today(), month = day.slice(0, 7);
    if (b.secs != null) {
      const s = Math.round(Number(b.secs));
      if (!(s > 0)) return res.status(400).json({ error: "Bad time" });
      const add = Math.min(s, 120);
      await redis("INCRBY", "secs:" + month, add);
      await redis("INCRBY", "secs:" + day, add);
      return res.status(200).json({ ok: true });
    }
    const hk = `visitors:${day}:${hour()}`;
    await redis("PFADD", "visitors:" + month, id);
    await redis("PFADD", "visitors:" + day, id);
    await redis("PFADD", hk, id);
    await redis("EXPIRE", hk, 2 * 86400);
    await redis("INCR", "views:" + month);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
