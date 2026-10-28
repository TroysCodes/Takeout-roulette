// POST /api/signup {email} — saves an email from the Spin pop-up. Anyone can add; nobody can read here.
const { redis } = require("./_redis");
const { CONSENT_TEXT } = require("./_auth");
const ok = v => typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!ok(email)) return res.status(400).json({ error: "Invalid email" });
  if (req.body.consent !== true) return res.status(400).json({ error: "Consent needed" });
  try {
    // HSETNX keeps the first sign-up date if the same email comes back
    const at = new Date().toISOString();
    await redis("HSETNX", "signups", email, at);
    // Proof of consent for the weekly email (kept apart from the sign-up list)
    await redis("HSETNX", "consent", email, JSON.stringify({ at, via: "spin pop-up", text: CONSENT_TEXT }));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not save" });
  }
};
