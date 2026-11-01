// main-app offline: sw.js scope ./ coexisting with the beta's sw-beta.js scope ./beta; previous/legacy pass through; airplane mode; update banner.
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs"; import { spawn, execSync } from "child_process";
const SRC = "/workspace/site", TMP = "/tmp/offsite-main", PORT = 8772, BASE = `http://localhost:${PORT}/Ball-Calc/`, SHOT = "/workspace/screenshot-offm-";
execSync(`pkill -f "[h]ttp.server ${PORT}" ; sleep 0.3; rm -rf ${TMP} && cp -r ${SRC} ${TMP}; true`, { shell: "/bin/bash" });
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
const init = `if (!localStorage.getItem("seeded")) { localStorage.setItem("seeded", "1");
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
const cacheDump = (pg = p) => pg.evaluate(async () => { const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k); out[k] = await Promise.all((await c.keys()).map(async r => { const x = await c.match(r); return [r.url, x.type, x.status]; })); } return out; });
const F = n => TMP + "/Ball-Calc/" + n;

/* ---------- main app: install on /Ball-Calc/ ---------- */
await p.goto(BASE); await ready();
const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, script: r.active.scriptURL }; });
ok("/Ball-Calc/ registers sw.js with scope /Ball-Calc/", reg.scope === BASE && reg.script === BASE + "sw.js", JSON.stringify(reg));
await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
ok("first visit is controlled right away by sw.js", (await ctrl()) === BASE + "sw.js");
ok("manifest link → ballcalc.webmanifest", await p.evaluate(() => document.querySelector('link[rel=manifest]').getAttribute("href")) === "ballcalc.webmanifest");
const man = JSON.parse(fs.readFileSync(F("ballcalc.webmanifest"), "utf8"));
ok("manifest: name/short_name Ball-Calc, start_url ./, scope ./, standalone, no orientation lock, default-theme colours", man.name === "Ball-Calc" && man.short_name === "Ball-Calc" && man.start_url === "./" && man.scope === "./" && man.display === "standalone" && !("orientation" in man) && man.theme_color === "#0a1f14");
const icons = await p.evaluate(async list => Promise.all(list.map(i => new Promise(res => { const im = new Image(); im.onload = () => res([i.src, i.sizes, i.purpose, im.naturalWidth + "x" + im.naturalHeight]); im.onerror = () => res([i.src, "ERR"]); im.src = i.src; }))), man.icons);
ok("main icons 192/512 any + 192/512 maskable (no BETA tag) all load at their size", icons.filter(i => i[1] !== "any").every(i => i[1] === i[3]) && icons.filter(i => i[2] === "maskable").length === 2 && icons.every(i => !/beta/.test(i[0])), JSON.stringify(icons));
let cd = await cacheDump(), ck = Object.keys(cd);
ok("one main cache 'ballcalc-main-<VERSION>'", ck.length === 1 && /^ballcalc-main-\d{4}-\d\d-\d\d\.\d+$/.test(ck[0]), ck.join());
const MAIN = ck[0], urls = cd[MAIN].map(x => x[0].replace(BASE, ""));
const WANT = ["index.html", "ballcalc.webmanifest", "ballcalc-icon-192.png", "ballcalc-icon-512.png", "ballcalc-maskable-192.png", "ballcalc-maskable-512.png", "logo.svg", "ballcalc-apple-touch-icon.png", "vendor/js-ballistics-3.1.0.js", "vendor/xlsx-0.20.3.mjs", "bullets.json"];
ok("precache = index, main manifest, main icons, vendored engine + SheetJS, bullets.json", WANT.every(f => urls.includes(f)) && urls.length === WANT.length, urls.join(", "));
ok("nothing beta / previous / legacy / cross-origin in the main cache; all basic 200s", !urls.some(u => /beta|previous|legacy/.test(u)) && cd[MAIN].every(x => x[0].startsWith(BASE) && x[1] === "basic" && x[2] === 200));
const eng = await p.evaluate(() => performance.getEntriesByType("resource").map(e => e.name).filter(n => /js-ballistics/.test(n)));
ok("engine from the vendored copy", eng.length >= 1 && eng.every(n => n.startsWith(BASE + "vendor/")), eng.join());
ok("online: weather loads, no pill, no banner", /wind 8 mph/.test(await T("#wxStatus")) && !(await vis("#offPill")) && !(await vis("#updBar")));
const pi = await ctx.newPage(); hook(pi); await pi.goto(BASE + "index.html"); await ready(pi);
ok("index.html is controlled by sw.js too", (await ctrl(pi)) === BASE + "sw.js"); await pi.close();

/* ---------- beta coexists under its own worker ---------- */
const pb = await ctx.newPage(); hook(pb); const bResp = [];
pb.on("response", r => bResp.push([r.url(), r.fromServiceWorker()]));
await pb.goto(BASE + "beta.html"); await ready(pb);
const firstNav = bResp.find(x => x[0] === BASE + "beta.html");
ok("beta.html first visit: main sw.js lets it through to the network (no shell, no cache)", firstNav && firstNav[1] === false && bResp.filter(x => x[0].startsWith(BASE)).every(x => !x[1]), JSON.stringify(bResp.filter(x => x[1])));
await pb.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL.endsWith("sw-beta.js"), null, { timeout: 15000 });
await pb.reload(); await ready(pb);
const regs = await pb.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => r.scope).sort());
ok("two registrations: /Ball-Calc/ (sw.js) and /Ball-Calc/beta (sw-beta.js)", JSON.stringify(regs) === JSON.stringify([BASE, BASE + "beta"]), JSON.stringify(regs));
ok("the more specific ./beta scope wins: beta.html is controlled by sw-beta.js", (await ctrl(pb)) === BASE + "sw-beta.js" && (await pb.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope)) === BASE + "beta");
cd = await cacheDump(pb); ck = Object.keys(cd).sort();
ok("separate caches: ballcalc-beta-* and ballcalc-main-*", ck.length === 2 && ck.some(k => k.startsWith("ballcalc-beta-")) && ck.includes(MAIN), ck.join());
ok("index stays on sw.js after the beta registered", (await ctrl()) === BASE + "sw.js");

/* ---------- previous.html / legacy.html pass through ---------- */
for (const pg of ["previous.html", "legacy.html"]) {
  const q = await ctx.newPage(); const rs = []; const qe = [];
  q.on("response", r => { if (r.url().startsWith(BASE)) rs.push([r.url().replace(BASE, ""), r.fromServiceWorker()]); });
  q.on("pageerror", e => qe.push(e.message));
  await q.goto(BASE + pg); await q.waitForFunction(() => /^Done|Ready/.test(document.getElementById("status")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
  await q.evaluate(async () => { for (const u of ["bullets.json", "ballcalc-icon-192.png", "vendor/js-ballistics-3.1.0.js", "ballcalc.webmanifest"]) await fetch(u).then(r => r.blob()); });
  await q.waitForTimeout(200);
  const st = await q.evaluate(() => document.getElementById("status")?.textContent || "");
  ok(`${pg}: nothing answered by a service worker (navigation + its same-origin requests), page still works`, rs.length >= 5 && rs.every(x => !x[1]) && qe.length === 0 && /^Done|Ready/.test(st), JSON.stringify(rs) + " " + st.slice(0, 40));
  await q.close();
}
cd = await cacheDump();
ok("previous.html / legacy.html are not in any cache", !Object.values(cd).flat().some(x => /previous|legacy/.test(x[0])));

/* ---------- airplane mode ---------- */
await down(); await ctx.setOffline(true); const wxBefore = wxCalls;
let dead = false; try { await fetch(BASE); } catch { dead = true; }
ok("(setup) the web server is really down", dead);
await p.goto(BASE); await ready();
ok("offline: /Ball-Calc/ opens from the cache and solves", /^Done/.test(await T("#status")) && (await ctrl()) === BASE + "sw.js");
ok("Offline pill shows", await vis("#offPill"));
ok("weather: clear offline message, no hang", /Offline — weather needs a connection/.test(await T("#wxStatus")));
const d500 = await T("#dopeCard .dcBig");
await p.evaluate(() => { const e = document.getElementById("target"); e.value = "800"; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); });
await p.waitForFunction(old => document.querySelector("#dopeCard .dcBig").textContent !== old && document.getElementById("status").textContent.startsWith("Done"), d500, { timeout: 10000 });
ok("solve dope offline (distance change re-solves)", (await T("#dopeCard .dcBig")) !== d500);
ok("SheetJS available offline", await p.evaluate(() => window.__bc.importFirst(["./vendor/xlsx-0.20.3.mjs"]).then(m => m.version).catch(e => "ERR")) === "0.20.3");
await p.evaluate(() => { document.getElementById("toast").className = ""; }); await p.waitForTimeout(450);
await p.screenshot({ path: SHOT + "offline-pill.png" });
await p.evaluate(() => document.getElementById("shStartBtn").click()); await p.waitForSelector("#shView.show"); await p.waitForTimeout(150);
await p.click("#shAdd"); await p.fill("#shVel", "2703"); await p.press("#shVel", "Enter"); await p.waitForTimeout(80);
await p.click("#shConn"); await p.waitForTimeout(300);
await p.evaluate(b => window.__fake.send(b), PA); await p.waitForTimeout(250);
ok("Shooting view offline: typed + radar shot logged", await p.evaluate(() => window.__bc.log.some(s => s.shots.some(x => x.v === 2703) && s.shots.length >= 2)));
await p.click("#shExit").catch(() => p.evaluate(() => window.__bc.shExit())); await p.waitForTimeout(150);
const q1 = await ctx.newPage(); hook(q1); await q1.goto(BASE + "index.html"); await ready(q1);
await q1.waitForTimeout(300);
ok("offline: index.html cold start in a new tab works and has the offline shot", /^Done/.test(await T("#status", q1)) && await q1.evaluate(() => window.__bc.log.some(s => s.shots.some(x => x.v === 2703)))); await q1.close();
await pb.reload(); await ready(pb);
ok("offline: beta.html still works under its own sw-beta.js", (await ctrl(pb)) === BASE + "sw-beta.js" && /^Done/.test(await T("#status", pb)) && await vis("#offPill", pb));
const q2 = await ctx.newPage(); let prevFail = false; await q2.goto(BASE + "previous.html").catch(() => { prevFail = true; });
ok("offline: previous.html is NOT served from any cache (fails like any uncached page)", prevFail); await q2.close();
ok("nothing sent to open-meteo while offline", wxCalls === wxBefore);

/* ---------- back online + main version bump ---------- */
await up(); await ctx.setOffline(false); await p.waitForTimeout(400);
ok("back online: pill hides", !(await vis("#offPill")));
const BETACACHE = Object.keys(await cacheDump()).find(k => k.startsWith("ballcalc-beta-"));
const sw0 = fs.readFileSync(F("sw.js"), "utf8"), v0 = sw0.match(/const VERSION = "([^"]+)"/)[1];
fs.writeFileSync(F("sw.js"), sw0.replace(`const VERSION = "${v0}"`, 'const VERSION = "2099-02-02.1"'));
fs.writeFileSync(F("index.html"), fs.readFileSync(F("index.html"), "utf8").replace("Ballistics · Loads · Chrono", "Ballistics · Loads · Chrono · m2"));
await p.evaluate(() => window.__bc.swCheck(true));
await p.waitForSelector("#updBar:not([hidden])", { timeout: 15000 });
await p.waitForFunction(() => window.__bc.SWS.kind === "sw", null, { timeout: 15000 }).catch(() => {});
ok("main version bump → 'Update available · Reload' banner", (await T("#updBar")).replace(/\s+/g, " ").includes("Update available · Reload") && await p.evaluate(() => window.__bc.SWS.kind) === "sw");
await p.evaluate(() => { document.getElementById("toast").className = ""; }); await p.waitForTimeout(450);
await p.screenshot({ path: SHOT + "update-banner.png" });
await pb.evaluate(() => window.__bc.swCheck(true)); await pb.waitForTimeout(2500);
ok("the beta sees no update (its worker and page are unchanged)", !(await vis("#updBar", pb)));
await Promise.all([p.waitForEvent("load", { timeout: 15000 }), p.click("#updGo")]); await ready();
ok("Reload → new main build", (await T("#appHead")).includes("m2") && !(await vis("#updBar")));
const ks = Object.keys(await cacheDump()).sort();
ok("old main cache deleted, beta cache untouched", JSON.stringify(ks) === JSON.stringify([BETACACHE, "ballcalc-main-2099-02-02.1"]), ks.join());
await pb.reload(); await ready(pb);
ok("beta.html still on sw-beta.js and unchanged after the main update", (await ctrl(pb)) === BASE + "sw-beta.js" && !(await T("#appHead", pb)).includes("m2"));
fs.writeFileSync(F("index.html"), fs.readFileSync(F("index.html"), "utf8").replace("Chrono · m2", "Chrono · m3"));
await p.evaluate(() => window.__bc.swCheck(true));
await p.waitForSelector("#updBar:not([hidden])", { timeout: 15000 });
ok("main content-only change (forgotten bump) → banner", await p.evaluate(() => window.__bc.SWS.kind) === "content");
await Promise.all([p.waitForEvent("load", { timeout: 15000 }), p.click("#updGo")]); await ready();
ok("…Reload pulls it in", (await T("#appHead")).includes("m3"));
ok("data intact through updates (shot log)", await p.evaluate(() => window.__bc.log.some(s => s.shots.some(x => x.v === 2703))));
ok("sw.js never touches storage", !/localStorage|indexedDB/.test(fs.readFileSync(F("sw.js"), "utf8").replace(/\/\*[\s\S]*?\*\//, "")));
await b.close(); await down();
console.log(`${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs));
