// GET /api/me -> {items, spinsLeft}; PUT /api/me {items} saves the signed-in person's lists, visits and ratings.
// POST /api/me {action: "spin"} counts one spin against today's limit (3 a day; the founder is unlimited).
const { redis } = require("./_redis");
const A = require("./_auth");
const DAILY = 3;

async function spinsLeft(me) {
  if (me.founder) return null; // unlimited
  const used = +(await redis("GET", `spins:${me.uid}:${A.today()}`)) || 0;
  return Math.max(0, DAILY - used);
}

// Add the places the founder has already been to as unrated visits, once per batch
async function seedFounderTried(me, items) {
  const list = require("./_founder_tried"), batches = [...new Set(list.map(x => x[3]))];
  const done = await Promise.all(batches.map(b => redis("GET", `seeded:${b}:${me.uid}`)));
  const todo = new Set(batches.filter((b, n) => !done[n]));
  if (!todo.size) return items;
  const have = new Set(items.filter(i => i.list === "been" || i.list === "tried").map(i => i.placeId));
  const at = new Date().toISOString();
  list.forEach(([placeId, name, address, batch], n) => {
    if (!todo.has(batch) || have.has(placeId)) return;
    items.push({ id: "seed" + n.toString(36) + Date.now().toString(36), name, place: "", address, placeId, list: "been", visitedAt: at, addedAt: at });
  });
  await redis("SET", "userdata:" + me.uid, JSON.stringify({ items, at }));
  for (const b of todo) await redis("SET", `seeded:${b}:${me.uid}`, at);
  return items;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const me = await A.currentUser(req);
    if (!me) return res.status(401).json({ error: "Not signed in" });
    if (req.method === "GET") {
      const raw = await redis("GET", "userdata:" + me.uid);
      let items = raw ? JSON.parse(raw).items || [] : [];
      if (me.founder) await redis("SET", "founder:uid", me.uid); // lets /api/founder-tried find the founder's list
      if (me.founder) items = await seedFounderTried(me, items);
      return res.status(200).json({ items, spinsLeft: await spinsLeft(me) });
    }
    if (req.method === "PUT") {
      const items = (req.body || {}).items;
      if (!Array.isArray(items) || items.length > 2000) return res.status(400).json({ error: "Bad data" });
      const json = JSON.stringify({ items, at: new Date().toISOString() });
      if (json.length > 400000) return res.status(413).json({ error: "Too much data" });
      await redis("SET", "userdata:" + me.uid, json);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "POST" && (req.body || {}).action === "spin") {
      if (me.founder) return res.status(200).json({ ok: true, spinsLeft: null });
      const key = `spins:${me.uid}:${A.today()}`;
      const used = await redis("INCR", key);
      if (used === 1) await redis("EXPIRE", key, 2 * 86400);
      if (used > DAILY) return res.status(429).json({ ok: false, spinsLeft: 0 });
      return res.status(200).json({ ok: true, spinsLeft: DAILY - used });
    }
    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    res.status(500).json({ error: "Something went wrong" });
  }
};
