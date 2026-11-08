/* Ball-Calc service worker: offline app shell (cache-first) + update checks.
 *
 * Which page it serves comes from the scope it was registered with, so this same file can be promoted later:
 *   scope "./beta"  (registered from beta.html)  -> serves beta.html only; index/previous/legacy are not controlled
 *   scope "./"      (register from index.html)   -> serves index.html
 *
 * - Precaches the page + its same-origin assets on install, in a versioned cache. Old caches are deleted on activate.
 * - Cross-origin and non-GET requests are never intercepted (weather API, CDN fallbacks); Web Bluetooth isn't HTTP at all.
 * - Only same-origin "basic" 200 responses are ever cached. It never touches localStorage / IndexedDB (your data).
 * - A new worker waits until the page asks it to take over ("Update available · Reload").
 *
 * >>> Bump VERSION on every publish that changes this file's precache list or the page. <<<
 * (The page also asks this worker to compare the cached page against the network, so a forgotten bump still shows the banner.)
 */
const VERSION = "2026-11-08.5";

const SCOPE = new URL(self.registration.scope);
const BETA = /\/beta$/.test(SCOPE.pathname);           // ".../Ball-Calc/beta" when registered with scope "./beta"
const TAG = BETA ? "beta" : "main";
const PREFIX = `ballcalc-${TAG}-`;
const CACHE = PREFIX + VERSION;
const abs = p => new URL(p, self.location.href).href;

const PAGE = abs(BETA ? "beta.html" : "index.html");
const SHELL_ALIASES = new Set([PAGE, BETA ? abs("beta") : abs("./")]);   // navigations that get the cached page
// beta.html is a thin shell: its code, styles and markup live in these module files (no build step). Keep this list in
// sync with beta/ (every file the shell or main.js loads must be here, or the beta won't start offline).
const MODULES = BETA ? [
  "beta/css/base.css",
  "beta/css/components.css",
  "beta/css/controls.css",
  "beta/css/dope.css",
  "beta/css/layout.css",
  "beta/css/log.css",
  "beta/css/offline.css",
  "beta/css/optics-table.css",
  "beta/css/sheets.css",
  "beta/css/shooting.css",
  "beta/css/targets.css",
  "beta/js/app.js",
  "beta/js/bulletdb.js",
  "beta/js/calc.js",
  "beta/js/components.js",
  "beta/js/core.js",
  "beta/js/dope-card.js",
  "beta/js/dope.js",
  "beta/js/gear.js",
  "beta/js/hooks.js",
  "beta/js/link-v3.js",
  "beta/js/log-import.js",
  "beta/js/log.js",
  "beta/js/main.js",
  "beta/js/offline.js",
  "beta/js/optics.js",
  "beta/js/radar.js",
  "beta/js/reassign.js",
  "beta/js/recipes.js",
  "beta/js/sensors.js",
  "beta/js/setup.js",
  "beta/js/shooting.js",
  "beta/js/shot-banner.js",
  "beta/js/storage.js",
  "beta/js/strings.js",
  "beta/js/target-draw.js",
  "beta/js/target-editor.js",
  "beta/js/targets.js",
  "beta/js/themes.js",
  "beta/js/truing.js",
  "beta/js/views/chrome.js",
  "beta/js/views/dope.js",
  "beta/js/views/gear.js",
  "beta/js/views/log.js",
  "beta/js/views/parts.js",
  "beta/js/views/shooting.js",
  "beta/js/views/targets.js",
  "beta/js/weather.js",
  "beta/js/wind-dial.js",
].map(abs) : [];
const CORE = [
  PAGE,
  ...MODULES,
  ...(BETA
    ? ["manifest-beta.webmanifest", "ballcalc-beta-icon-192.png", "ballcalc-beta-icon-512.png", "ballcalc-beta-maskable-192.png", "ballcalc-beta-maskable-512.png"]
    : ["ballcalc.webmanifest", "ballcalc-icon-192.png", "ballcalc-icon-512.png", "ballcalc-maskable-512.png", "logo.svg"]),
  "ballcalc-apple-touch-icon.png",
  "vendor/js-ballistics-3.1.0.js",   // the ballistics engine (required to solve)
  "bullets.json",                     // bullet/powder database (also kept by the page in IndexedDB)
].map(abs);
const OPTIONAL = ["vendor/xlsx-0.20.3.mjs"].map(abs);  // only for spreadsheet import; a failure here doesn't block install
const KNOWN = new Set([...CORE, ...OPTIONAL]);
const DB = abs("bullets.json");

const fresh = url => fetch(new Request(url, { cache: "no-cache" }));
const cacheable = r => r && r.ok && r.status === 200 && r.type === "basic";

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
  if (req.mode === "navigate") { if (SHELL_ALIASES.has(key)) e.respondWith(shell(req)); return; }
  if (key === DB) { e.respondWith(staleWhileRevalidate(req, e)); return; }
  if (KNOWN.has(key)) e.respondWith(cacheFirst(req, key));
});

async function shell(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(PAGE);
  if (hit) return hit;                                   // cache-first: opens instantly, even in airplane mode
  const r = await fetch(req);
  if (cacheable(r)) await c.put(PAGE, r.clone());
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
async function staleWhileRevalidate(req, e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(DB);
  const net = fresh(DB).then(async r => { if (cacheable(r)) await c.put(DB, r.clone()); return r; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener("message", e => {
  const d = e.data || {}, port = e.ports && e.ports[0], reply = m => port && port.postMessage(m);
  if (d.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (d.type === "VERSION") { reply({ version: VERSION, cache: CACHE, scope: SCOPE.href }); return; }
  if (d.type === "CHECK") {          // has the published page changed since it was cached? (catches a forgotten VERSION bump)
    e.waitUntil((async () => {         // the page and every module file are compared, so a content-only module change is caught too
      try {
        const c = await caches.open(CACHE);
        const diff = await Promise.all([PAGE, ...MODULES].map(async u => {
          const r = await fresh(u);
          if (!cacheable(r)) throw new Error(u + " " + r.status);
          const hit = await c.match(u);
          return !hit || (await hit.text()) !== (await r.text());
        }));
        reply({ ok: true, changed: diff.some(Boolean), version: VERSION });
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
