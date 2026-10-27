// GET  /api/auth -> {user: {email, uid, founder} | null}
// POST /api/auth {action: "signup" | "login" | "logout", email, password}
const { redis, NoDatabase } = require("./_redis");
const A = require("./_auth");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.status(200).json({ user: await A.currentUser(req) });
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
    const b = req.body || {};
    if (b.action === "logout") { await A.endSession(req, res); return res.status(200).json({ user: null }); }

    const email = A.normEmail(b.email), password = String(b.password || "");
    if (!A.emailOk(email)) return res.status(400).json({ error: "That doesn't look like an email." });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: "Passwords need at least 8 characters." });

    // Slow down guessing: 10 tries per email per 15 minutes
    const tries = await redis("INCR", "rl:auth:" + email);
    if (tries === 1) await redis("EXPIRE", "rl:auth:" + email, 900);
    if (tries > 10) return res.status(429).json({ error: "Too many tries. Wait 15 minutes and try again." });

    if (b.action === "signup") {
      const rec = { ...A.hashPassword(password), at: new Date().toISOString() };
      const created = await redis("HSETNX", "users", email, JSON.stringify(rec));
      if (!created) return res.status(409).json({ error: "There's already an account with that email. Try signing in." });
      await redis("HSETNX", "signups", email, rec.at); // an account counts as an email sign-up too
    } else if (b.action === "login") {
      const raw = await redis("HGET", "users", email);
      const rec = raw && JSON.parse(raw);
      if (!rec || !A.checkPassword(password, rec)) {
        await new Promise(r => setTimeout(r, 500));
        return res.status(401).json({ error: "Email or password is wrong." });
      }
    } else return res.status(400).json({ error: "Unknown action" });

    await redis("DEL", "rl:auth:" + email);
    await A.startSession(res, email);
    res.status(200).json({ user: { email, uid: A.uidOf(email), founder: A.isFounder(email) } });
  } catch (e) {
    if (e instanceof NoDatabase) return res.status(503).json({ error: "Accounts aren't switched on yet: the site's database isn't connected." });
    console.error("auth failed:", e);
    res.status(500).json({ error: "Something went wrong. Try again." });
  }
};
