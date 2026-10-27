// Accounts on the website: sign up / sign in with email + password, lists saved to the account,
// spins counted on the server, and the founder (FOUNDER_EMAIL in Vercel) gets the owner tools.
// Uses the hooks the app exposes on window.__TR.
(() => {
const T = window.__TR; if (!T) return;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const A = { user: null, mode: "login", saveTimer: null };
const api = (path, opts = {}) => fetch(path, {credentials: "same-origin", headers: {"Content-Type": "application/json"}, ...opts})
  .then(async r => ({ok: r.ok, status: r.status, body: await r.json().catch(() => ({}))}));

/* ---------- Sign-in dialog (reuses the email pop-up's look) ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
.pw-wrap{position:relative;display:flex;flex-direction:column}
.pw-wrap input{padding-left:64px;padding-right:64px}
.pw-eye{position:absolute;right:8px;top:calc(50% + 2px);transform:translateY(-50%);font:700 14px Figtree,system-ui,sans-serif;border:0;border-radius:999px;padding:7px 12px;background:var(--surface,#fff);color:var(--fg);box-shadow:0 0 0 1.5px var(--line);cursor:pointer}
.pw-eye:focus-visible{outline:2px solid var(--chili);outline-offset:2px}
</style>`);
document.body.insertAdjacentHTML("beforeend", `
<dialog class="gate" id="acct" aria-labelledby="acctH">
  <form id="acctForm" novalidate>
    <div class="gate-wheel" aria-hidden="true">👤</div>
    <h2 id="acctH">Sign in</h2>
    <p id="acctSub">Your lists, visits and ratings follow you to any device.</p>
    <input id="acctEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" aria-label="Email" required>
    <div class="pw-wrap">
      <input id="acctPw" type="password" autocomplete="current-password" placeholder="Password (8+ characters)" aria-label="Password" required minlength="8">
      <button type="button" class="pw-eye" id="acctEye" aria-label="Show password" aria-pressed="false">Show</button>
    </div>
    <p class="gate-err" id="acctErr" role="alert" hidden></p>
    <button class="btn go-green gate-go" type="submit" id="acctGo">Sign in</button>
    <button class="gate-later" type="button" id="acctSwap">New here? Create an account</button>
    <button class="gate-later" type="button" id="acctClose">Not now</button>
  </form>
</dialog>`);
function openAcct(mode){
  A.mode = mode || "login"; paintAcct(); showPw(false); $("#acctErr").hidden = true;
  const d = $("#acct"); if (d.showModal){ if (!d.open) d.showModal(); } else d.setAttribute("open", "");
  setTimeout(() => $("#acctEmail").focus(), 50);
}
function closeAcct(){ const d = $("#acct"); if (d.close && d.open) d.close(); else d.removeAttribute("open"); }
function paintAcct(){
  const up = A.mode === "signup";
  $("#acctH").textContent = up ? "Create your account" : "Sign in";
  $("#acctGo").textContent = up ? "Create account 🎉" : "Sign in";
  $("#acctSwap").textContent = up ? "Already have an account? Sign in" : "New here? Create an account";
  $("#acctPw").autocomplete = up ? "new-password" : "current-password";
}
$("#acctSwap").addEventListener("click", () => { A.mode = A.mode === "signup" ? "login" : "signup"; paintAcct(); $("#acctErr").hidden = true; });
$("#acctClose").addEventListener("click", closeAcct);
function showPw(on){ $("#acctPw").type = on ? "text" : "password"; $("#acctEye").textContent = on ? "Hide" : "Show"; $("#acctEye").setAttribute("aria-pressed", String(on)); $("#acctEye").setAttribute("aria-label", on ? "Hide password" : "Show password"); }
$("#acctEye").addEventListener("click", () => { showPw($("#acctPw").type === "password"); $("#acctPw").focus(); });
$("#acctForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#acctEmail").value.trim(), password = $("#acctPw").value;
  const err = m => { $("#acctErr").textContent = m; $("#acctErr").hidden = false; };
  if (password.length < 8) return err("Passwords need at least 8 characters.");
  $("#acctGo").disabled = true;
  const r = await api("/api/auth", {method: "POST", body: JSON.stringify({action: A.mode, email, password})}).catch(() => null);
  $("#acctGo").disabled = false;
  if (!r || !r.ok) return err((r && r.body.error) || "Couldn't reach the server. Try again.");
  $("#acctPw").value = ""; showPw(false); closeAcct();
  await signedIn(r.body.user, true);
});

/* ---------- Account store: whole list saved to /api/me, a moment after each change ---------- */
const acctStore = {
  kind: "acct",
  put(){ T.local.save(); schedule(); return Promise.resolve(); },
  del(){ T.local.save(); schedule(); return Promise.resolve(); }
};
function schedule(){
  clearTimeout(A.saveTimer);
  A.saveTimer = setTimeout(() => api("/api/me", {method: "PUT", body: JSON.stringify({items: T.S.items})}).catch(() => {}), 600);
}

/* ---------- Spins: counted on the server for signed-in people ---------- */
const takeLocal = T.SPINS.take.bind(T.SPINS);
T.SPINS.take = function(){
  takeLocal();
  if (!A.user || A.user.founder) return;
  api("/api/me", {method: "POST", body: JSON.stringify({action: "spin"})}).then(r => syncSpins(r.body.spinsLeft)).catch(() => {});
};
function syncSpins(left){
  if (typeof left !== "number") return;
  T.prefs.set(T.SPINS.key(), String(Math.max(0, T.DAILY - left))); T.render();
}

/* ---------- Signed in / out ---------- */
async function signedIn(user, fresh){
  A.user = user; if (!user) return paintMenu();
  T.GATE.ok = true; T.prefs.set("gateEmail", user.email);
  T.SPINS.owner = !!user.founder;
  T.REV.anon = user.uid;
  const r = await api("/api/me").catch(() => null);
  if (r && r.ok){
    const theirs = r.body.items || [], known = new Set(theirs.map(i => i.id)), names = new Set(theirs.map(i => T.norm(i.name)));
    // Bring anything saved on this device into the account
    const pending = T.S.items.filter(i => !known.has(i.id) && (i.list === "been" || !names.has(T.norm(i.name))));
    T.S.items = [...theirs, ...pending];
    T.S.store = acctStore; T.local.save();
    if (pending.length) schedule();
    syncSpins(r.body.spinsLeft);
  }
  T.setStatus(); T.REV.load(); paintMenu(); T.render();
  if (fresh) T.toast(user.founder ? "Welcome back, founder 👑" : `Signed in as ${user.email}`);
}
async function signOut(){
  await api("/api/auth", {method: "POST", body: JSON.stringify({action: "logout"})}).catch(() => {});
  A.user = null; T.S.store = T.localStore; T.S.items = []; T.local.save();
  T.SPINS.owner = T.prefs.get("owner") === "1";
  try { T.REV.anon = localStorage.getItem("takeout-anon") || ""; } catch {}
  T.setStatus(); paintMenu(); T.render(); T.toast("Signed out");
}

/* ---------- Menu: account items at the bottom ---------- */
function paintMenu(){
  const nav = $("#menu"); if (!nav) return;
  nav.querySelectorAll(".acct-item").forEach(n => n.remove());
  const svgUser = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>`;
  const html = A.user
    ? `<div class="acct-item acct-who">${svgUser}<span>${esc(A.user.email)}${A.user.founder ? "<b>Founder</b>" : ""}</span></div>
       ${A.user.founder ? `<a class="acct-item" href="/admin"><svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>Founder dashboard</a>` : ""}
       <button class="acct-item" type="button" id="acctOut"><svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>Sign out</button>`
    : `<button class="acct-item" type="button" id="acctIn">${svgUser}Sign in / Create account</button>`;
  nav.insertAdjacentHTML("beforeend", html);
  $("#acctIn")?.addEventListener("click", () => openAcct("login"));
  $("#acctOut")?.addEventListener("click", signOut);
}
// The email pop-up also offers signing in
const gateForm = $("#gateForm");
if (gateForm && !$("#gateAcct")){
  gateForm.querySelector(".gate-later")?.insertAdjacentHTML("beforebegin", `<button class="gate-later" type="button" id="gateAcct">Have an account? Sign in</button>`);
  $("#gateAcct").addEventListener("click", () => { const g = $("#gate"); if (g.close && g.open) g.close(); openAcct("login"); });
}

// Visitor count for the founder dashboard: once per browser tab, with the anonymous browser id
try {
  const id = localStorage.getItem("takeout-anon");
  if (id && !sessionStorage.getItem("tr-visit")){ sessionStorage.setItem("tr-visit", "1"); api("/api/visit", {method: "POST", body: JSON.stringify({id})}).catch(() => {}); }
} catch {}

paintMenu();
api("/api/auth").then(r => r.ok && r.body.user && signedIn(r.body.user, false)).catch(() => {});
})();
