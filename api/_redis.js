// Tiny Upstash Redis REST client. Vercel's Upstash integration sets these env vars
// (sometimes with a prefix such as STORAGE_KV_REST_API_URL, so look for any of them).
const env = process.env;
const find = suffix => Object.keys(env).sort().find(k => k.endsWith(suffix) && env[k]);
const URL_KEY = ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"].find(k => env[k]) || find("KV_REST_API_URL") || find("UPSTASH_REDIS_REST_URL");
const TOKEN_KEY = ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"].find(k => env[k]) || find("KV_REST_API_TOKEN") || find("UPSTASH_REDIS_REST_TOKEN");
const URL = URL_KEY && env[URL_KEY];
const TOKEN = TOKEN_KEY && env[TOKEN_KEY];

class NoDatabase extends Error {}

async function redis(...cmd) {
  if (!URL || !TOKEN) throw new NoDatabase("Database is not connected yet");
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const out = await r.json();
  if (!r.ok || out.error) throw new Error(out.error || `Redis ${r.status}`);
  return out.result;
}

module.exports = { redis, NoDatabase, URL_KEY, TOKEN_KEY };
