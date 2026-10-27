// Tiny Upstash Redis REST client. Vercel's Upstash integration sets these env vars.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...cmd) {
  if (!URL || !TOKEN) throw new Error("Database is not connected yet");
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const out = await r.json();
  if (!r.ok || out.error) throw new Error(out.error || `Redis ${r.status}`);
  return out.result;
}

module.exports = { redis };
