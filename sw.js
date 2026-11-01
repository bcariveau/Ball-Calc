/* Ball-Calc service worker for the main app (registered from index.html with scope "./").
 *
 * - App shell: index.html and /Ball-Calc/ open from the cache (cache-first), even in airplane mode.
 * - Precaches the page + its same-origin assets on install, in a versioned cache ("ballcalc-main-<VERSION>",
 *   separate from the beta's "ballcalc-beta-*"). Only its own old caches are deleted on activate.
 * - beta.html has its own worker (sw-beta.js, scope "./beta"); the more specific scope wins there.
 * - Every other page under /Ball-Calc/ (previous.html, legacy.html, …) passes straight through: its navigation
 *   and its requests are never answered from, or written to, this cache.
 * - Cross-origin and non-GET requests are never intercepted (weather API, CDN fallbacks); Web Bluetooth isn't HTTP.
 * - Only same-origin "basic" 200 responses are cached. It never touches localStorage / IndexedDB (your data).
 * - A new worker waits until the page asks it to take over ("Update available · Reload").
 *
 * >>> Bump VERSION on every publish of index.html (or of anything in the precache list). <<<
 * (The page also asks this worker to compare the cached page with the network, so a forgotten bump still shows the banner.)
 */
const VERSION = "2026-11-01.1";

const PREFIX = "ballcalc-main-";
const CACHE = PREFIX + VERSION;
const abs = p => new URL(p, self.location.href).href;
const keyOf = u => { const x = new URL(u); return x.origin + x.pathname; };

const PAGE = abs("index.html");
const SHELL = new Set([PAGE, abs("./")]);               // navigations that get the cached page
const CORE = [
  "index.html", "ballcalc.webmanifest",
  "ballcalc-icon-192.png", "ballcalc-icon-512.png", "ballcalc-maskable-192.png", "ballcalc-maskable-512.png", "logo.svg", "ballcalc-apple-touch-icon.png",
  "vendor/js-ballistics-3.1.0.js",   // the ballistics engine (required to solve)
  "bullets.json",                     // bullet/powder database (also kept by the page in IndexedDB)
].map(abs);
const OPTIONAL = ["vendor/xlsx-0.20.3.mjs"].map(abs);  // only for spreadsheet import; a failure here doesn't block install
const KNOWN = new Set([...CORE, ...OPTIONAL]);
const DB = abs("bullets.json");

const fresh = url => fetch(new Request(url, { cache: "no-cache" }));
const cacheable = r => r && r.ok && r.status === 200 && r.type === "basic";
// Subresources are only served from the cache for the app shell (or the browser itself, e.g. manifest icons).
// Requests made by previous.html / legacy.html / any other page go to the network untouched.
function forShell(req) {
  const ref = req.referrer;
  if (!ref || ref === "about:client") return true;
  try { const k = keyOf(ref); return SHELL.has(k) || KNOWN.has(k); } catch { return true; }
}

self.addEventListener("install", e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(CORE.map(u => new Request(u, { cache: "no-cache" })));        // all-or-nothing
  await Promise.all(OPTIONAL.map(u => fresh(u).then(r => cacheable(r) && c.put(u, r)).catch(() => {})));
})()));

self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // never intercept / cache cross-origin
  const key = url.origin + url.pathname;                 // ignore ?query
  if (req.mode === "navigate") { if (SHELL.has(key)) e.respondWith(shell(req)); return; }   // other pages: network, untouched
  if (!KNOWN.has(key) || !forShell(req)) return;
  if (key === DB) e.respondWith(staleWhileRevalidate(e));
  else e.respondWith(cacheFirst(req, key));
});

async function shell(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(PAGE);
  if (hit) return hit;                                   // cache-first: opens instantly, even in airplane mode
  const r = await fetch(req);
  if (cacheable(r) && keyOf(r.url) === PAGE) await c.put(PAGE, r.clone());
  return r;
}
async function cacheFirst(req, key) {
  const c = await caches.open(CACHE);
  const hit = await c.match(key);
  if (hit) return hit;
  const r = await fetch(req);
  if (cacheable(r)) await c.put(key, r.clone());
  return r;
}
async function staleWhileRevalidate(e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(DB);
  const net = fresh(DB).then(async r => { if (cacheable(r)) await c.put(DB, r.clone()); return r; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener("message", e => {
  const d = e.data || {}, port = e.ports && e.ports[0], reply = m => port && port.postMessage(m);
  if (d.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (d.type === "VERSION") { reply({ version: VERSION, cache: CACHE, scope: self.registration.scope }); return; }
  if (d.type === "CHECK") {          // has the published page changed since it was cached? (catches a forgotten VERSION bump)
    e.waitUntil((async () => {
      try {
        const r = await fresh(PAGE);
        if (!cacheable(r)) return reply({ ok: false });
        const hit = await (await caches.open(CACHE)).match(PAGE);
        reply({ ok: true, changed: !hit || (await hit.text()) !== (await r.text()), version: VERSION });
      } catch (err) { reply({ ok: false, error: String(err) }); }
    })());
    return;
  }
  if (d.type === "REFRESH") {        // pull the current published files into this cache (content-only update)
    e.waitUntil((async () => {
      try {
        const got = await Promise.all(CORE.map(u => fresh(u).then(r => { if (!cacheable(r)) throw new Error(u + " " + r.status); return [u, r]; })));
        const opt = await Promise.all(OPTIONAL.map(u => fresh(u).then(r => cacheable(r) ? [u, r] : null).catch(() => null)));
        const c = await caches.open(CACHE);
        for (const x of [...got, ...opt]) if (x) await c.put(x[0], x[1]);
        reply({ ok: true });
      } catch (err) { reply({ ok: false, error: String(err) }); }
    })());
  }
});
