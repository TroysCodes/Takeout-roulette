// GET /api/stats — founder only: visitors this month, last month and today, plus page views and accounts.
const { redis } = require("./_redis");
const { isAdmin, today } = require("./_auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isAdmin(req))) return res.status(401).json({ error: "Founder only" });
  const day = today(), month = day.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const last = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  try {
    const n = async (...cmd) => Number(await redis(...cmd)) || 0;
    res.status(200).json({
      month, last,
      thisMonth: { visitors: await n("PFCOUNT", "visitors:" + month), views: await n("GET", "views:" + month) },
      lastMonth: { visitors: await n("PFCOUNT", "visitors:" + last), views: await n("GET", "views:" + last) },
      today: await n("PFCOUNT", "visitors:" + day),
      accounts: await n("HLEN", "users"),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
