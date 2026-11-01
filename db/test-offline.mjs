// offline round (beta-only stage; index.html here is the pre-offline build — main-app coexistence is in test-offline-main): beta-only service worker (scope ./beta), precache + cache-first shell, real airplane mode (server killed + context offline),
// solve / Shooting view / log a shot offline, index/previous/legacy NOT controlled, update banner (SW version bump + content-only change),
// offline pill, weather fails gracefully, data (localStorage / IndexedDB) untouched, manifest + icons, banner/pill contrast in all 5 themes.
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs"; import { spawn, execSync } from "child_process";
const SRC = "/workspace/site", TMP = "/tmp/offsite", PORT = 8771, BASE = `http://localhost:${PORT}/Ball-Calc/`, SHOT = "/workspace/screenshot-off-";
execSync(`pkill -f "[h]ttp.server ${PORT}" ; sleep 0.3; rm -rf ${TMP} && cp -r ${SRC} ${TMP} && cp /workspace/ballistic-calculator-pre-offline.html.bak ${TMP}/Ball-Calc/index.html && rm -f ${TMP}/Ball-Calc/sw.js; true`, { shell: "/bin/bash" });
let srv = null;
const up = async () => { srv = spawn("python3", ["-m", "http.server", String(PORT), "-d", TMP], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "sw-beta.js")).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw new Error("server didn't start"); };
const down = async () => { if (srv) { const s = srv; srv = null; if (s.exitCode === null && s.signalCode === null) { const gone = new Promise(r => s.on("exit", r)); s.kill(); await gone; } } };
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] }],
  optics: [], opticsMig: 1, ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", tab: "dope", values: { target: "500", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
const init = `if (location.pathname.endsWith("beta.html") && !localStorage.getItem("seeded")) { localStorage.setItem("seeded", "1");
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))}); }`;
const fakes = () => {
  const mkChr = v0 => { const et = new EventTarget(); et.value = v0; et.startNotifications = async () => et; et.stopNotifications = async () => et; et.readValue = async () => et.value; return et; };
  const notify = mkChr(null), batt = mkChr(new DataView(Uint8Array.of(87).buffer)); const dev = new EventTarget(); dev.name = "ATHLONVPR1_060655"; dev.id = "x";
  dev.gatt = { connected: false, async connect() { this.connected = true; return this; }, disconnect() { this.connected = false; dev.dispatchEvent(new Event("gattserverdisconnected")); },
    async getPrimaryService(u) { if (u === "6e40ff01-b5a3-f393-e0a9-4174686c6f6e") return { getCharacteristic: async () => notify }; if (u === "battery_service") return { getCharacteristic: async () => batt }; throw new DOMException("no", "NotFoundError"); } };
  window.__fake = { dev, send(bytes) { notify.value = new DataView(Uint8Array.from(bytes).buffer); notify.dispatchEvent(new Event("characteristicvaluechanged")); } };
  Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => dev, getDevices: async () => [] }, configurable: true });
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async () => { const s = new EventTarget(); s.release = async () => {}; return s; } } });
};
const hex = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));
const PA = hex("80 1C 22 01 26 10 31 20 27 50 04 50 D9 02 D9 02 D9 02 D9 02 00 00 00 00 00 00 E3 01 8D 03");
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
const hook = pg => { pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); pg.on("pageerror", e => errs.push("PAGEERR " + e.message)); pg.on("dialog", d => d.accept()); };
const WX = { elevation: [260], current: { temperature_2m: 59, relative_humidity_2m: 40, wind_speed_10m: 8, wind_direction_10m: 270, wind_gusts_10m: 14, surface_pressure: 984 } };
let wxCalls = 0;

await up();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 44.9, longitude: -93.2 } });
await ctx.addInitScript(init); await ctx.addInitScript(fakes);
await ctx.route("https://api.open-meteo.com/**", r => { wxCalls++; return r.fulfill({ contentType: "application/json", body: JSON.stringify(WX) }); });
const p = await ctx.newPage(); hook(p);
const ready = (pg = p) => pg.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
const T = (s, pg = p) => pg.textContent(s), vis = (s, pg = p) => pg.isVisible(s);
const ctrl = (pg = p) => pg.evaluate(() => navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null);

/* ---------- online first visit: install + control ---------- */
await p.goto(BASE + "beta.html"); await ready();
const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, script: r.active.scriptURL }; });
ok("beta registers sw-beta.js with scope /Ball-Calc/beta", reg.scope === BASE + "beta" && reg.script === BASE + "sw-beta.js", JSON.stringify(reg));
await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
ok("clients.claim(): the first visit is controlled right away (no reload needed)", (await ctrl()) === BASE + "sw-beta.js");
const cache = await p.evaluate(async () => { const ks = await caches.keys(); const out = {}; for (const k of ks) { const c = await caches.open(k); out[k] = await Promise.all((await c.keys()).map(async r => { const x = await c.match(r); return [r.url, x.type, x.status]; })); } return out; });
const ck = Object.keys(cache);
ok("one versioned cache 'ballcalc-beta-<VERSION>'", ck.length === 1 && /^ballcalc-beta-\d{4}-\d\d-\d\d\.\d+$/.test(ck[0]), ck.join());
const urls = cache[ck[0]].map(x => x[0].replace(BASE, ""));
for (const f of ["beta.html", "manifest-beta.webmanifest", "vendor/js-ballistics-3.1.0.js", "vendor/xlsx-0.20.3.mjs", "bullets.json", "ballcalc-beta-icon-192.png", "ballcalc-beta-icon-512.png", "ballcalc-beta-maskable-192.png", "ballcalc-beta-maskable-512.png", "ballcalc-apple-touch-icon.png"])
  assert.ok(urls.includes(f), "precached " + f);
ok("precache holds the page, manifest, vendored engine + SheetJS, bullets.json and icons", urls.length === 10, urls.join(", "));
ok("nothing cross-origin / opaque in the cache, all basic 200s", cache[ck[0]].every(x => x[0].startsWith(BASE) && x[1] === "basic" && x[2] === 200));
ok("index.html / previous / legacy are NOT in the beta cache", !urls.some(u => /index|previous|legacy/.test(u)));
const eng = await p.evaluate(() => performance.getEntriesByType("resource").map(e => e.name).filter(n => /js-ballistics|jsdelivr/.test(n)));
ok("engine loads from the same-origin vendored copy (no CDN request)", eng.length >= 1 && eng.every(n => n.startsWith(BASE + "vendor/")), eng.join());
ok("manifest link → manifest-beta.webmanifest", await p.evaluate(() => document.querySelector('link[rel=manifest]').getAttribute("href")) === "manifest-beta.webmanifest");
const man = JSON.parse(fs.readFileSync(TMP + "/Ball-Calc/manifest-beta.webmanifest", "utf8"));
ok("manifest: name / start_url ./beta.html / scope ./beta / standalone / default-theme colours", man.name === "Ball-Calc Beta" && man.short_name && man.start_url === "./beta.html" && man.scope === "./beta" && man.display === "standalone" && man.theme_color === "#0a1f14" && man.background_color === "#0a1f14");
const icons = await p.evaluate(async list => Promise.all(list.map(i => new Promise(res => { const im = new Image(); im.onload = () => res([i.src, i.sizes, i.purpose, im.naturalWidth + "x" + im.naturalHeight]); im.onerror = () => res([i.src, "ERR"]); im.src = i.src; }))), man.icons);
ok("manifest icons 192/512 any + maskable all load at their declared size", icons.length === 4 && icons.every(i => i[1] === i[3]) && icons.filter(i => i[2] === "maskable").length === 2, JSON.stringify(icons));
const wx0 = await T("#wxStatus");
ok("online: weather loads normally", /wind 8 mph/.test(wx0), wx0);
ok("online: no Offline pill, no update banner", !(await vis("#offPill")) && !(await vis("#updBar")));
await p.waitForTimeout(3500);   // first background check (3 s after load) runs: page unchanged → still no banner
ok("background check with nothing new → no banner", !(await vis("#updBar")));

/* ---------- other pages are not controlled, and don't register ---------- */
for (const pg of ["index.html", "previous.html", "legacy.html", ""]) {
  const q = await ctx.newPage(); await q.goto(BASE + pg); await q.waitForTimeout(pg === "index.html" || pg === "" ? 1500 : 600);
  const st = await q.evaluate(async () => ({ c: !!navigator.serviceWorker.controller, regs: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope), mine: !!(await navigator.serviceWorker.getRegistration()) }));
  ok(`/${pg || "(root)"} is NOT controlled and registers nothing`, !st.c && st.regs.length === 1 && st.regs[0] === BASE + "beta" && !st.mine, JSON.stringify(st));
  await q.close();
}

/* ---------- airplane mode: server gone + browser offline ---------- */
await down(); await ctx.setOffline(true); const wxBefore = wxCalls;
let dead = false; try { await fetch(BASE + "beta.html"); } catch { dead = true; }
ok("(setup) the web server is really down", dead);
await p.reload(); await ready();
ok("offline reload: the app opens from the cache and the engine solves (status Done)", /^Done/.test(await T("#status")) && (await ctrl()) === BASE + "sw-beta.js");
ok("Offline pill shows in the header", await vis("#offPill") && /Offline/.test(await T("#offPill")));
const wxOff = await T("#wxStatus");
ok("weather on startup: clear offline message, keeps manual values (no hang, no error)", /Offline — weather needs a connection/.test(wxOff) && await p.evaluate(() => document.getElementById("wxStatus").classList.contains("bad")), wxOff);
const t0 = Date.now(); await p.click("#calcBtn"); await p.waitForTimeout(150);
ok("↻ Weather offline answers immediately with the offline message", /Offline/.test(await T("#wxStatus")) && Date.now() - t0 < 2000);
const d500 = await T("#dopeCard .dcBig");
await p.evaluate(() => { const e = document.getElementById("target"); e.value = "800"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
await p.waitForFunction(old => document.querySelector("#dopeCard .dcBig").textContent !== old && document.getElementById("status").textContent.startsWith("Done"), d500, { timeout: 10000 });
const d800 = await T("#dopeCard .dcBig");
ok("solve dope offline: changing the distance re-solves", d800 !== d500 && /\d/.test(d800), JSON.stringify([d500.trim(), d800.trim()]));
const xl = await p.evaluate(() => window.__bc.importFirst(["./vendor/xlsx-0.20.3.mjs"]).then(m => m.version).catch(e => "ERR " + e.message));
ok("spreadsheet reader (SheetJS) is available offline from the cache", xl === "0.20.3", xl);
await p.evaluate(() => { const t = document.getElementById("toast"); t.className = ""; }); await p.waitForTimeout(450);
await p.screenshot({ path: SHOT + "offline-pill.png" });
// Shooting view + log a shot (typed and from the fake radar over Web Bluetooth)
await p.evaluate(() => document.getElementById("shStartBtn").click()); await p.waitForSelector("#shView.show"); await p.waitForTimeout(150);
ok("Shooting view opens offline", await vis("#shView"));
await p.click("#shAdd"); await p.fill("#shVel", "2701"); await p.press("#shVel", "Enter"); await p.waitForTimeout(80);
await p.click("#shConn"); await p.waitForFunction(() => /Connected|ATHLON|87/.test(document.getElementById("shRadar").textContent), null, { timeout: 5000 }).catch(() => {});
await p.evaluate(b => window.__fake.send(b), PA); await p.waitForTimeout(250);
const lg = await p.evaluate(() => JSON.parse(JSON.stringify(window.__bc.log)));
ok("log shots offline: typed shot + radar shot (Web Bluetooth path untouched by the SW)", lg.length === 1 && lg[0].shots.length === 2 && lg[0].shots[0].v === 2701, JSON.stringify(lg[0]?.shots));
await p.click("#shExit").catch(() => p.evaluate(() => window.__bc.shExit())); await p.waitForTimeout(150);
// a cold start in a brand-new tab while offline
const q2 = await ctx.newPage(); hook(q2); await q2.goto(BASE + "beta.html"); await ready(q2);
ok("cold start in a new tab while offline works", /^Done/.test(await T("#status", q2)) && await vis("#offPill", q2));
await q2.waitForTimeout(300);
ok("the offline shots were saved (IndexedDB) and load in the new tab", await q2.evaluate(() => window.__bc.log.some(s => s.shots.some(x => x.v === 2701))));
const idb = await q2.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
ok("data stays in localStorage / IndexedDB (bullet DB in IDB 'bcalc-db', presets intact)", idb.includes("bcalc-db") && await q2.evaluate(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles[0].name === "6.5 CM"), JSON.stringify(idb));
await q2.close();
ok("sw-beta.js never touches storage (no localStorage / indexedDB in the worker)", !/localStorage|indexedDB/.test(fs.readFileSync(TMP + "/Ball-Calc/sw-beta.js", "utf8").replace(/\/\*[\s\S]*?\*\//, "")));

ok("nothing was sent to open-meteo while offline (weather skipped, no hang)", wxCalls === wxBefore, `${wxBefore}→${wxCalls}`);
/* ---------- back online ---------- */
await up(); await ctx.setOffline(false); await p.waitForTimeout(400);
ok("back online: pill hides", !(await vis("#offPill")));
await p.waitForFunction(() => /wind 8 mph/.test(document.getElementById("wxStatus").textContent), null, { timeout: 8000 });
ok("back online: weather refreshes by itself", /wind 8 mph/.test(await T("#wxStatus")));

/* ---------- update 1: publish with a VERSION bump ---------- */
const F = n => TMP + "/Ball-Calc/" + n;
const sw0 = fs.readFileSync(F("sw-beta.js"), "utf8"), v0 = sw0.match(/const VERSION = "([^"]+)"/)[1];
fs.writeFileSync(F("sw-beta.js"), sw0.replace(`const VERSION = "${v0}"`, 'const VERSION = "2099-01-01.1"'));
fs.writeFileSync(F("beta.html"), fs.readFileSync(F("beta.html"), "utf8").replace("Ballistics · Loads · Chrono", "Ballistics · Loads · Chrono · v2"));
await p.evaluate(() => window.__bc.swCheck(true));
await p.waitForSelector("#updBar:not([hidden])", { timeout: 15000 });
await p.waitForFunction(() => window.__bc.SWS.kind === "sw", null, { timeout: 15000 }).catch(() => {});
ok("new version found → non-blocking 'Update available · Reload' banner", (await T("#updBar")).replace(/\s+/g, " ").includes("Update available · Reload") && await p.evaluate(() => window.__bc.SWS.kind) === "sw");
const bb = await p.evaluate(() => { const r = document.getElementById("updBar").getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width, vw: innerWidth }; });
ok("banner is small, at the top, fits 360 px", bb.top >= 0 && bb.top < 20 && bb.h < 56 && bb.w <= bb.vw - 12, JSON.stringify(bb));
ok("page stays usable under the banner (tabs / inputs still clickable)", await p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !e.closest("#updBar"); }));
ok("old worker keeps serving until you tap (waiting worker)", await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting) && !(await T("#appHead")).includes("v2"));
await p.evaluate(() => { const t = document.getElementById("toast"); t.className = ""; }); await p.waitForTimeout(450);
await p.screenshot({ path: SHOT + "update-banner.png" });
await Promise.all([p.waitForEvent("load", { timeout: 15000 }), p.click("#updGo")]); await ready();
ok("tap Reload → new worker activates and the page reloads with the new build", (await T("#appHead")).includes("v2") && !(await vis("#updBar")));
const after = await p.evaluate(async () => ({ keys: await caches.keys(), v: await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data.version); navigator.serviceWorker.controller.postMessage({ type: "VERSION" }, [ch.port2]); }) }));
ok("old cache deleted on activate, new versioned cache in use", after.keys.length === 1 && after.keys[0] === "ballcalc-beta-2099-01-01.1" && after.v === "2099-01-01.1", JSON.stringify(after));
ok("data survives the update (presets + shot log)", await p.evaluate(() => window.__bc.log.length === 1 && window.__bc.log[0].shots.length === 2));

/* ---------- update 2: page changed but VERSION not bumped (forgotten bump) ---------- */
fs.writeFileSync(F("beta.html"), fs.readFileSync(F("beta.html"), "utf8").replace("Chrono · v2", "Chrono · v3"));
await p.evaluate(() => window.__bc.swCheck(true));
await p.waitForSelector("#updBar:not([hidden])", { timeout: 15000 });
ok("content-only change is detected too → banner", await p.evaluate(() => window.__bc.SWS.kind) === "content");
await Promise.all([p.waitForEvent("load", { timeout: 15000 }), p.click("#updGo")]); await ready();
ok("…and Reload pulls the new page into the cache", (await T("#appHead")).includes("v3"));
await ctx.setOffline(true); await down(); await p.reload(); await ready();
ok("the refreshed page is what opens offline", (await T("#appHead")).includes("v3"));
await up(); await ctx.setOffline(false);
// ✕ dismiss
await p.evaluate(() => window.__bc.updShow("content")); ok("banner can be dismissed with ✕", await vis("#updBar")); await p.click("#updX"); ok("…hidden after ✕", !(await vis("#updBar")));
// unsaved Log editor is saved before the update reload
await p.click("#tabBtnLog"); await p.evaluate(() => document.getElementById("slNewBtn").click()); await p.waitForTimeout(150);
ok("(setup) Log editor open with a new session", await p.evaluate(() => !!window.__bc.ED));
{
  await p.fill("#slVel", "2650"); await p.press("#slVel", "Enter"); await p.waitForTimeout(80);
  fs.writeFileSync(F("beta.html"), fs.readFileSync(F("beta.html"), "utf8").replace("Chrono · v3", "Chrono · v4"));
  await p.evaluate(() => window.__bc.updShow("content"));
  await Promise.all([p.waitForEvent("load", { timeout: 15000 }), p.click("#updGo")]); await ready();
  ok("an unsaved Log session is saved before the update reload", await p.evaluate(() => window.__bc.log.some(s => s.shots.some(x => x.v === 2650))) && (await T("#appHead")).includes("v4"));
}

/* ---------- banner + pill in all 5 themes ---------- */
for (const t of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => { document.documentElement.dataset.theme = t; document.getElementById("offPill").hidden = false; document.getElementById("updBar").hidden = false; }, t);
  const c = await p.evaluate(() => { const g = id => getComputedStyle(document.getElementById(id)); const bar = g("updBar");
    return { pill: [g("offPill").color, g("offPill").backgroundColor], txt: [bar.color, bar.backgroundColor], go: [g("updGo").color, g("updGo").backgroundColor], x: [g("updX").color, bar.backgroundColor] }; });
  const r = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +cr(v[0], v[1]).toFixed(2)]));
  ok(`theme ${t}: pill / banner text / Reload / ✕ readable (≥4.5:1, ✕ ≥3:1)`, r.pill >= 4.5 && r.txt >= 4.5 && r.go >= 4.5 && r.x >= 3, JSON.stringify(r));
}
await p.evaluate(() => { document.getElementById("offPill").hidden = true; document.getElementById("updBar").hidden = true; });
await b.close(); await down();
console.log(`${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs));
