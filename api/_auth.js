// Accounts: email + password (scrypt), sessions in Redis behind an HttpOnly cookie.
// The founder is the account whose email matches FOUNDER_EMAIL (set in Vercel).
const crypto = require("crypto");
const { redis } = require("./_redis");

const COOKIE = "tr_session";
const DAYS = 30;
const emailOk = v => typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const normEmail = v => String(v || "").trim().toLowerCase();
const uidOf = email => crypto.createHash("sha256").update("tr:" + email).digest("hex").slice(0, 24);
// Troy's account is the founder. Stored as a hash so the email isn't in the public code.
// FOUNDER_EMAIL in Vercel can name another founder too.
const FOUNDER_HASH = "b08f4ba86192bb6f791f0f2309de34d47c264de8455946ec7ccb6a5c1c3f54e0";
const isFounder = email => !!email && (
  crypto.createHash("sha256").update(email).digest("hex") === FOUNDER_HASH ||
  (!!process.env.FOUNDER_EMAIL && normEmail(process.env.FOUNDER_EMAIL) === email));

function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return { salt, hash };
}
function checkPassword(pw, rec) {
  const { hash } = hashPassword(pw, rec.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(rec.hash, "hex"));
}

function readCookie(req, name) {
  const m = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : "";
}
function setSessionCookie(res, token, maxAge) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

async function startSession(res, email) {
  const token = crypto.randomBytes(32).toString("hex");
  await redis("SET", "session:" + token, email, "EX", DAYS * 86400);
  setSessionCookie(res, token, DAYS * 86400);
}
async function endSession(req, res) {
  const token = readCookie(req, COOKIE);
  if (/^[a-f0-9]{64}$/.test(token)) await redis("DEL", "session:" + token);
  setSessionCookie(res, "", 0);
}
// -> {email, uid, founder} or null
async function currentUser(req) {
  const token = readCookie(req, COOKIE);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const email = await redis("GET", "session:" + token);
  return email ? { email, uid: uidOf(email), founder: isFounder(email) } : null;
}

// Founder session, or the ADMIN_PASSWORD as a Bearer token (kept as a backup way in)
async function isAdmin(req) {
  const me = await currentUser(req).catch(() => null);
  if (me && me.founder) return true;
  const pass = process.env.ADMIN_PASSWORD, given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!pass || pass.length < 8 || !given) return false;
  const a = crypto.createHash("sha256").update(given).digest(), b = crypto.createHash("sha256").update(pass).digest();
  return crypto.timingSafeEqual(a, b);
}

// Toronto calendar date, so daily limits reset at local midnight
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

module.exports = { emailOk, normEmail, uidOf, isFounder, hashPassword, checkPassword, startSession, endSession, currentUser, isAdmin, today };
