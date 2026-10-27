// GET /api/reviews — public: every diner's rating (no ids), for the cards and the owner's Reviews tab.
const { redis } = require("./_redis");

module.exports = async (req, res) => {
  try {
    const flat = (await redis("HGETALL", "reviews")) || [];
    const rows = [];
    for (let i = 1; i < flat.length; i += 2) { try { rows.push(JSON.parse(flat[i])); } catch {} }
    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    res.status(200).json({ rows });
  } catch (e) {
    res.status(200).json({ rows: [] });
  }
};
