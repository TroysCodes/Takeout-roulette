// POST /api/visit {id} — counts one visit per browser tab. The id is the random anonymous browser id,
// stored in Redis HyperLogLogs (unique counts only; the ids themselves can't be read back).
const { redis } = require("./_redis");
const { today } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const id = String((req.body && req.body.id) || "");
  if (!/^[a-z0-9]{6,64}$/.test(id)) return res.status(400).json({ error: "Bad id" });
  const day = today(), month = day.slice(0, 7);
  try {
    await redis("PFADD", "visitors:" + month, id);
    await redis("PFADD", "visitors:" + day, id);
    await redis("INCR", "views:" + month);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
