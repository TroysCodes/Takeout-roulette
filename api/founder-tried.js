// GET /api/founder-tried -> {places: {placeId: verdict|null}} — the restaurants the founder has tried,
// shown to everyone on Explore. Only place ids and ratings leave the server, nothing personal.
const { redis } = require("./_redis");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60");
  try {
    const uid = await redis("GET", "founder:uid");
    const raw = uid && (await redis("GET", "userdata:" + uid));
    const places = {};
    if (raw) {
      const items = (JSON.parse(raw).items || []).filter(i => i.placeId);
      items.filter(i => i.list === "tried").forEach(i => { places[i.placeId] = "nope"; });
      items.filter(i => i.list === "been").sort((a, b) => (a.visitedAt || "").localeCompare(b.visitedAt || ""))
        .forEach(i => { if (i.verdict || !(i.placeId in places)) places[i.placeId] = i.verdict || places[i.placeId] || null; });
    } else {
      require("./_founder_tried").forEach(([id]) => { places[id] = null; });
    }
    res.status(200).json({ places });
  } catch (e) {
    res.status(200).json({ places: {} });
  }
};
