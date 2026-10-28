// GET /api/stats — founder only: visitors this month, last month, today and the last 4 hours, time on site, page views and accounts.
// None of these include the founder (see visit.js).
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
    // Last 4 hours (Toronto time): the current hour plus the 3 before it, counted as unique visitors
    const now = Date.now(), fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
    const hourKey = t => { const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map(x => [x.type, x.value])); return `visitors:${p.year}-${p.month}-${p.day}:${p.hour}`; };
    const last4 = await n("PFCOUNT", ...[0, 1, 2, 3].map(h => hourKey(now - h * 3600000)));
    const vMonth = await n("PFCOUNT", "visitors:" + month), vToday = await n("PFCOUNT", "visitors:" + day);
    const sMonth = await n("GET", "secs:" + month), sToday = await n("GET", "secs:" + day);
    res.status(200).json({
      month, last,
      thisMonth: { visitors: vMonth, views: await n("GET", "views:" + month), secs: sMonth, avgSecs: vMonth ? Math.round(sMonth / vMonth) : 0 },
      lastMonth: { visitors: await n("PFCOUNT", "visitors:" + last), views: await n("GET", "views:" + last) },
      today: vToday, todaySecs: sToday, todayAvgSecs: vToday ? Math.round(sToday / vToday) : 0, last4,
      accounts: await n("HLEN", "users"),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
