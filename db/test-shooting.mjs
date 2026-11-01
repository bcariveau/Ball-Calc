// shooting round: ▶ Start shooting → full-screen Shooting view (live radar + typed shots, string stats, energy, ES at distance, dope strip,
// bad read / tag / add / new string / new target / end string / mark holes, wake lock, exit restores tab + scroll), Log empty state,
// ＋ Session always tappable, wind dial scroll fix (vertical swipe scrolls; ring drag / hold engages; tap = hour; lock; undo toast).
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs";
const URL_ = "http://localhost:8765/ballistic-calculator.html", SHOT = "/workspace/screenshot-sh-";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] }],
  optics: [], opticsMig: 1, ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", tab: "dope", values: { target: "500", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
const init = `if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))}); }`;
const fakes = () => {   // fake radar (as in test-bluetooth-ui) + wake lock + vibrate + page visibility
  const mkChr = v0 => { const et = new EventTarget(); et.value = v0; et.startNotifications = async () => et; et.stopNotifications = async () => et; et.readValue = async () => et.value; return et; };
  const notify = mkChr(null), batt = mkChr(new DataView(Uint8Array.of(87).buffer)); const dev = new EventTarget(); dev.name = "ATHLONVPR1_060655"; dev.id = "x";
  dev.gatt = { connected: false, async connect() { this.connected = true; return this; }, disconnect() { this.connected = false; dev.dispatchEvent(new Event("gattserverdisconnected")); },
    async getPrimaryService(u) { if (u === "6e40ff01-b5a3-f393-e0a9-4174686c6f6e") return { getCharacteristic: async () => notify }; if (u === "battery_service") return { getCharacteristic: async () => batt }; throw new DOMException("no", "NotFoundError"); } };
  window.__fake = { dev, send(bytes) { notify.value = new DataView(Uint8Array.from(bytes).buffer); notify.dispatchEvent(new Event("characteristicvaluechanged")); } };
  Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => dev, getDevices: async () => [] }, configurable: true });
  window.__wl = { req: 0, rel: 0, active: false };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async t => { window.__wl.req++; window.__wl.active = true; const s = new EventTarget(); s.type = t; s.released = false;
    s.release = async () => { if (!s.released) { s.released = true; window.__wl.rel++; window.__wl.active = false; s.dispatchEvent(new Event("release")); } }; return s; } } });
  window.__vib = []; Object.defineProperty(navigator, "vibrate", { configurable: true, value: ms => { window.__vib.push(ms); return true; } });
  window.__vis = "visible"; Object.defineProperty(document, "visibilityState", { configurable: true, get: () => window.__vis });
};
const hex = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));
const PA = hex("80 1C 22 01 26 10 31 20 27 50 04 50 D9 02 D9 02 D9 02 D9 02 00 00 00 00 00 00 E3 01 8D 03");
const PB = hex("80 1C 22 02 26 10 31 20 33 31 05 07 C3 02 D9 02 C3 02 CE 02 16 00 1E 00 24 00 D4 01 7F 03");
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
const hook = pg => { pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); pg.on("pageerror", e => errs.push("PAGEERR " + e.message)); pg.on("dialog", d => d.accept()); };
const route = async c => c.route("https://api.open-meteo.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: [260], current: { temperature_2m: 59, relative_humidity_2m: 40, wind_speed_10m: 8, wind_direction_10m: 270, wind_gusts_10m: 14, surface_pressure: 984 } }) }));

/* =================== part 1: Shooting view, Log, ＋ Session (412×915) =================== */
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
await ctx.addInitScript(init); await ctx.addInitScript(fakes); await route(ctx);
const p = await ctx.newPage(); hook(p);
const ready = (pg = p) => pg.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
const T = s => p.textContent(s), vis = s => p.isVisible(s);
const LOG = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__bc.log)));
const ED = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__bc.ED)));
const toastTxt = () => p.evaluate(() => document.getElementById("toast").classList.contains("show") ? document.getElementById("toast").textContent : "");
const colors = sels => p.evaluate(sels => { const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== "transparent") return c; } return getComputedStyle(document.body).backgroundColor; };
  return sels.flatMap(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent && e.textContent.trim() && !e.closest(".dis") && !e.disabled && !e.closest("button:disabled")).map(e => [s + "#" + (e.id || e.className), getComputedStyle(e).color, bgOf(e)])); }, sels);
const addV = async v => { if (!(await vis("#shAddBox"))) await p.click("#shAdd"); await p.fill("#shVel", String(v)); await p.press("#shVel", "Enter"); await p.waitForTimeout(60); };
await p.goto(URL_); await ready();

/* ---------- Dope: the Start shooting button ---------- */
ok("Dope tab shows a prominent ▶ Start shooting button", await vis("#shStartBtn") && /Start shooting/.test(await T("#shStartBtn")));
const sb = await p.evaluate(() => { const r = document.getElementById("shStartBtn").getBoundingClientRect(), w = document.getElementById("windSec").getBoundingClientRect(); return { h: r.height, w: r.width, above: r.bottom <= w.top + 1 }; });
ok("button is big (≥56 px tall, full width) and sits right above Wind & angle", sb.h >= 56 && sb.w > 360 && sb.above, JSON.stringify(sb));
await p.evaluate(() => document.getElementById("shStartBtn").scrollIntoView({ block: "center" }));
await p.screenshot({ path: SHOT + "dope-start.png" });

/* ---------- Log: empty state + ＋ Session ---------- */
await p.click("#tabBtnLog"); await p.waitForTimeout(100);
ok("Log empty state is shown when there are no sessions", await vis("#slEmpty"));
const em = await T("#slEmpty");
ok("empty state explains a session and mentions ▶ Start shooting and ＋ Session", /A session is/.test(em) && /Start shooting/.test(em) && /＋ Session/.test(em), em);
ok("the old summary line is hidden while empty (one line only)", !(await vis("#slSum")));
await p.screenshot({ path: SHOT + "log-empty.png" });
ok("＋ Session is enabled with a load picked", !(await p.isDisabled("#slNewBtn")));
// no load picked → ＋ Session asks for one instead of being disabled
await p.evaluate(() => { window.__bc.P.rifles[0].lastLoadId = null; });
await p.evaluate(() => { document.getElementById("tabBtnGear").click(); document.getElementById("tabBtnLog").click(); });
ok("＋ Session stays tappable with no load picked", !(await p.isDisabled("#slNewBtn")));
ok("empty state (no load) still explains how to start", /pick them on Gear/.test(await T("#slEmpty")));
await p.click("#slNewBtn"); await p.waitForTimeout(150);
ok("＋ Session without a load → Gear tab with the load picker flashed, no editor", (await p.evaluate(() => document.body.dataset.tab)) === "gear" && !(await vis("#slEditor"))
  && await p.evaluate(() => document.getElementById("loadSel").closest(".picker").classList.contains("pkFlash")));
ok("…and a toast asks for the load", /Pick a load/.test(await toastTxt()), await toastTxt());
await p.selectOption("#loadSel", "l1"); await p.waitForTimeout(150);
ok("picking the load offers ＋ Session in a toast", /Ready: 6\.5 CM · 140 ELD-M/.test(await toastTxt()) && (await T("#toastAct")) === "＋ Session", await toastTxt());
await p.click("#toastAct"); await p.waitForSelector("#slEditor.show");
ok("the toast action opens a new session", (await ED())._new === true);
await p.click("#slEdClose"); await p.waitForTimeout(80);
// Start shooting without a load → same prompt, then ▶ Start shooting from the toast
await p.evaluate(() => { window.__bc.P.rifles[0].lastLoadId = null; document.getElementById("tabBtnDope").click(); });
await p.evaluate(() => document.getElementById("shStartBtn").click()); await p.waitForTimeout(150);
ok("Start shooting without a load → Gear pickers, not the view", (await p.evaluate(() => document.body.dataset.tab)) === "gear" && !(await vis("#shView")) && /Pick a load/.test(await toastTxt()));
await p.selectOption("#loadSel", "l1"); await p.waitForTimeout(150);
ok("picking it offers ▶ Start shooting", (await T("#toastAct")) === "▶ Start shooting");
await p.click("#toastAct"); await p.waitForSelector("#shView.show");
ok("the toast action opens the Shooting view", await vis("#shView"));
await p.click("#shExit"); await p.waitForTimeout(100);
ok("exit with no shots returns to Gear (where it started) and saves nothing", (await p.evaluate(() => document.body.dataset.tab)) === "gear" && !(await vis("#shView")) && (await LOG()).length === 0);

/* ---------- open from Dope with a scroll position ---------- */
await p.click("#tabBtnDope"); await p.waitForTimeout(100);
const y0 = await p.evaluate(() => { window.scrollTo(0, 420); return window.scrollY; });
const wl0 = await p.evaluate(() => ({ ...window.__wl }));
await p.evaluate(() => document.getElementById("shStartBtn").click()); await p.waitForSelector("#shView.show"); await p.waitForTimeout(150);
ok("Shooting view opens full screen over everything", await p.evaluate(() => { const r = document.getElementById("shView").getBoundingClientRect(); const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return r.top <= 0.5 && r.height >= innerHeight - 1 && !!e.closest("#shView"); }));
ok("it starts a new session for the current gun + load (no keyboard pop-up)", (await ED())._new && (await ED()).loadId === "l1" && await p.evaluate(() => document.activeElement.id !== "slVel"));
ok("String / Target labels shown", (await T("#shStr")) === "String 1 · Target A" && /6\.5 CM · 140 ELD-M · 500 yd/.test(await T("#shFor")), await T("#shFor"));
const wl1 = await p.evaluate(() => ({ ...window.__wl }));
ok("Screen Wake Lock requested while open", wl1.req === wl0.req + 1 && wl1.active, JSON.stringify(wl1));
await p.evaluate(() => { window.__vis = "hidden"; document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(80);
const wl2 = await p.evaluate(() => ({ ...window.__wl }));
ok("wake lock released when the page is hidden", wl2.rel === wl1.rel + 1 && !wl2.active, JSON.stringify(wl2));
await p.evaluate(() => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(80);
const wl3 = await p.evaluate(() => ({ ...window.__wl }));
ok("…and re-acquired on visibilitychange back to visible", wl3.req === wl2.req + 1 && wl3.active, JSON.stringify(wl3));
ok("radar status shows disconnected with a Connect button", /Disconnected/.test(await T("#shRadar")) && await vis("#shConn"));
ok("no shots yet: waiting hint + empty list text", /Waiting/.test(await T("#shMeta")) && /No shots in String 1/.test(await T("#shList")));

/* ---------- typed shots, stats, energy ---------- */
await p.click("#shAdd"); ok("＋ Add shot opens a big velocity field", await vis("#shVel") && (await p.evaluate(() => document.activeElement.id)) === "shVel");
for (const v of [2700, 2712, 2695, 2720]) await addV(v);
ok("huge last-shot velocity", (await T("#shV")) === "2720");
ok("shot # and ± from the string average ('#4 · +13')", (await T("#shMeta")) === "#4 · +13", await T("#shMeta"));
const st = await p.evaluate(() => [...document.querySelectorAll("#shStats div")].map(d => [d.querySelector("span").textContent, d.querySelector("b").textContent]));
const S0 = Object.fromEntries(st), vv = [2700, 2712, 2695, 2720], avg = vv.reduce((a, c) => a + c) / 4, sd = Math.sqrt(vv.reduce((a, c) => a + (c - avg) ** 2, 0) / 3);
ok("string stats avg / SD / ES / min / max / count", S0.Avg === String(Math.round(avg)) && S0.SD === sd.toFixed(1) && S0.ES === "25" && S0.Min === "2695" && S0.Max === "2720" && S0.Shots === "4", JSON.stringify(S0));
ok("last shot energy from bullet weight (140 gr · 2720² / 450240)", S0["Energy · last"] === `${Math.round(140 * 2720 ** 2 / 450240).toLocaleString()} ft-lb`, S0["Energy · last"]);
ok("__bc.shEnergy math", near(await p.evaluate(() => window.__bc.shEnergy(3000, 175)), 175 * 9e6 / 450240, 1e-9));
const rows = await p.evaluate(() => [...document.querySelectorAll("#shList .shRow .v")].map(e => e.textContent));
ok("shot list newest first", rows.join(",") === "2720,2695,2712,2700", rows.join(","));
const lg = await LOG();
ok("shots autosave to the Log (one session, 4 shots)", lg.length === 1 && lg[0].shots.length === 4);

/* ---------- ES at target distance + dope strip ---------- */
await p.waitForFunction(() => /ES ±[\d.]+ mil at 500 yd/.test(document.getElementById("shEs").textContent), null, { timeout: 10000 });
const esT = await T("#shEs"), esV = await p.evaluate(() => window.__bc.shEsAt(2695, 2720, 500));
ok("ES at target distance from the solver, min vs max velocity, in mil", esV && esT.startsWith(`ES ±${String(+esV.half.toFixed(2))} mil at 500 yd`) && esV.half > 0.01 && esV.half < 0.2, esT + " " + JSON.stringify(esV));
const es800 = await p.evaluate(() => window.__bc.shEsAt(2695, 2720, 800));
ok("vertical ES grows with distance (800 > 500 yd) and inches agree with the angle", es800.spread > esV.spread && near(es800.inch, es800.spread * 3.6 * 8, es800.inch * 0.08), JSON.stringify(es800));
await p.waitForFunction(() => /Wind hold/.test(document.getElementById("shDope").textContent) && /mil/.test(document.getElementById("shDope").textContent), null, { timeout: 10000 });
const dp = await T("#shDope"), dc = await p.evaluate(() => [document.getElementById("dcElev").textContent, document.getElementById("dcWind").textContent]);
ok("dope strip: dialed elevation + wind hold match the Dope card at 500 yd", dp.includes(dc[0]) && dp.includes(dc[1]) && /10 mph @ 3 o'clock/.test(dp), dp + " | " + dc.join(" "));

/* ---------- bad read, tag ---------- */
await p.click("#shBad"); await p.waitForTimeout(100);
let e1 = await ED();
ok("✗ Bad read discards the last shot (stays visible, grayed)", e1.shots[3].x === true && await p.evaluate(() => document.querySelector("#shList .shRow").classList.contains("dis")) && /discarded/.test(await T("#shMeta")));
const stats = async () => Object.fromEntries(await p.evaluate(() => [...document.querySelectorAll("#shStats div")].map(d => [d.querySelector("span").textContent, d.querySelector("b").textContent])));
ok("stats drop the discarded shot", (await stats()).Shots.startsWith("3"), JSON.stringify(await stats()));
ok("bad read offers Undo", /discarded/.test(await toastTxt()) && (await T("#toastAct")) === "Undo");
await p.click("#toastAct"); await p.waitForTimeout(100);
ok("Undo restores it", !(await ED()).shots[3].x);
await p.click("#shBad"); await p.waitForTimeout(80); await p.click("#shBad"); await p.waitForTimeout(80);
e1 = await ED();
ok("a second bad read discards the previous kept shot", e1.shots[3].x && e1.shots[2].x && !e1.shots[1].x);
await p.click("#shList .shRow.dis button[data-a=x]"); await p.waitForTimeout(80);
ok("tapping ↺ on a row restores that shot", !(await ED()).shots[3].x && (await ED()).shots[2].x);
ok("discard saved to the Log", (await LOG())[0].shots[2].x === true);
await addV(2705);
await p.click("#shTag"); ok("🏷 Tag opens the tag bar for the last shot", await vis("#shTagBar") && /shot #5/.test(await T("#shTagFor")));
await p.click('#shTagBar button[data-f="cold"]'); await p.waitForTimeout(80);
await p.fill("#shNote", "first after clean"); await p.press("#shNote", "Tab"); await p.waitForTimeout(80);
e1 = await ED();
ok("Tag sets Cold + a note on the last shot (and shows in the list)", e1.shots[4].cold === true && e1.shots[4].note === "first after clean" && /Cold · ✎ first after clean/.test(await T("#shList .shRow .shTg")));
await p.click("#shTag");

/* ---------- themes: AA in all 5 ---------- */
await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act"));
const SELS = ["#shView b", "#shView small", "#shView span", "#shView button", "#shView .shRow .n", "#shView p"];
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => { document.documentElement.dataset.theme = t; }, th); await p.waitForTimeout(40);
  const bad = (await colors(SELS)).map(([s, c, g]) => [s, cr(c, g)]).filter(([, r]) => r < 4.5);
  ok(`AA text contrast in the ${th} theme`, !bad.length, JSON.stringify(bad.slice(0, 4)));
  if (th === "night") await p.screenshot({ path: SHOT + "shooting-night.png" });
}
await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });

/* ---------- layout: portrait + landscape ---------- */
const lay = () => p.evaluate(() => { const W = innerWidth, H = innerHeight, bad = [];
  document.querySelectorAll("#shView *").forEach(e => { if (!e.offsetParent) return; const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 0.5 || r.left < -0.5 || r.bottom > H + 0.5)) bad.push(`${e.id || e.className} ${Math.round(r.left)}-${Math.round(r.right)} b${Math.round(r.bottom)}`); });
  const small = [...document.querySelectorAll("#shView button")].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 39.5 || r.width < 43.5).length;
  const v = document.getElementById("shV").getBoundingClientRect();
  return { bad: bad.slice(0, 6), small, vh: v.height, btnB: document.querySelector(".shBtns").getBoundingClientRect().bottom, H, list: document.getElementById("shList").getBoundingClientRect().height }; });
for (const [w, h, name] of [[360, 740, "portrait"], [412, 915, null], [740, 360, "landscape"], [915, 412, null]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(120);
  const L = await lay();
  ok(`${w}×${h}: nothing clipped or off screen, buttons ≥44 px, big number, list visible`, !L.bad.length && !L.small && L.vh >= 44 && L.btnB <= L.H && L.list >= 44, JSON.stringify(L));
  if (name) await p.screenshot({ path: SHOT + `shooting-${name}.png` });
}
await p.setViewportSize({ width: 412, height: 915 }); await p.waitForTimeout(100);
/* ---------- new string, new target, end string ---------- */
await p.click("#shStrBtn"); await p.click("#shNewStr"); await p.waitForTimeout(120);
e1 = await ED();
ok("New string → String 2 on the same target, empty list", e1.tg.strings.length === 2 && (await T("#shStr")) === "String 2 · Target A" && /No shots in String 2/.test(await T("#shList")));
await addV(2710);
ok("new shots go to the current string", (await ED()).shots[5].str === (await ED()).tg.cur && (await T("#shMeta")) === "#1");
await p.click("#shStrBtn"); await p.click("#shNewTgt"); await p.waitForTimeout(120);
e1 = await ED();
ok("New target → String 3 on Target B", e1.tg.strings.length === 3 && e1.tg.targets.length === 2 && (await T("#shStr")) === "String 3 · Target B");
await addV(2702);
await p.click("#shStrBtn"); await p.click("#shEndStr"); await p.waitForTimeout(100);
ok("End string marks it ended and says the next shot starts String 4", await vis("#shEndNote") && /String 3 ended · the next shot starts String 4/.test(await T("#shEndNote")) && /String 3 ended/.test(await toastTxt()));
await addV(2711);
e1 = await ED();
ok("…the next shot starts String 4 (same target)", e1.tg.strings.length === 4 && (await T("#shStr")) === "String 4 · Target B" && e1.shots[7].str === e1.tg.cur && !(await vis("#shEndNote")));
if (await vis("#shAddBox")) await p.click("#shAddDone");

/* ---------- radar live: shots arrive once, no banner, radar string #1 = new string ---------- */
await p.click("#shConn"); await p.waitForFunction(() => /Connected/.test(document.getElementById("shRadar").textContent), null, { timeout: 5000 });
ok("radar connects from the view; battery shown; Connect hidden", /🔋 87%/.test(await T("#shRadar")) && !(await vis("#shConn")), await T("#shRadar"));
const n0 = (await LOG())[0].shots.length;
await p.evaluate(b2 => window.__fake.send(b2), PA); await p.waitForTimeout(250);
let lg2 = await LOG(); e1 = await ED();
const rv = lg2[0].shots[lg2[0].shots.length - 1].v;
ok("radar shot appears live in the view", (await T("#shV")) === String(Math.round(rv)) && (await T("#shMeta")) === "#1");
ok("no double logging: one session, one more shot", lg2.length === 1 && lg2[0].shots.length === n0 + 1 && e1.shots.length === n0 + 1);
ok("radar shot #1 started a new string (String 5) in the same session", e1.tg.strings.length === 5 && (await T("#shStr")) === "String 5 · Target B");
ok("no live banner on top of the view", await p.evaluate(() => document.getElementById("shotBan").hidden || getComputedStyle(document.getElementById("shotBan")).display === "none"));
await p.evaluate(b2 => window.__fake.send(b2), PB); await p.waitForTimeout(250);
lg2 = await LOG();
ok("radar shot #2 joins String 5", lg2[0].shots.length === n0 + 2 && (await T("#shMeta")).startsWith("#2") && (await ED()).tg.strings.length === 5);

/* ---------- 🎯 Mark holes round trip ---------- */
await p.click("#shMark"); await p.waitForSelector("#tgEd.show");
ok("🎯 Mark holes opens the target editor above the view", await p.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest("#tgEd")));
await p.click("#tgEdDone"); await p.waitForTimeout(150);
ok("Done returns to the Shooting view", await vis("#shView") && !(await vis("#tgEd")) && await p.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2).closest("#shView")));

await p.evaluate(() => document.getElementById("radarDisconnect").click()); await p.waitForTimeout(150);
ok("radar disconnect shows in the view with Connect again", /Disconnected|📡/.test(await T("#shRadar")) && await vis("#shConn"));

/* ---------- exit restores tab + scroll; wake lock released ---------- */
const nAll = (await ED()).shots.length;
await p.click("#shExit"); await p.waitForTimeout(250);
const ex = await p.evaluate(() => ({ tab: document.body.dataset.tab, y: window.scrollY, sh: document.getElementById("shView").hidden, ed: document.getElementById("slEditor").classList.contains("show"), wl: window.__wl.active, on: window.__bc.SH.on }));
ok("Exit returns to the Dope tab at the same scroll position", ex.tab === "dope" && near(ex.y, y0, 2) && ex.sh && !ex.ed && !ex.on, JSON.stringify(ex) + " y0=" + y0);
ok("wake lock released on exit", !ex.wl);
ok("session saved with every shot", (await LOG())[0].shots.length === nAll && /Session saved/.test(await toastTxt()));
ok("Start button now offers to continue today's session", /Continue shooting/.test(await T("#shStartBtn")));
await p.click("#tabBtnLog"); await p.waitForTimeout(100);
ok("Log shows the session, empty state gone", !(await vis("#slEmpty")) && await vis("#slSum") && (await p.locator("#slList .slItem").count()) === 1);
await p.click("#tabBtnDope");
await p.evaluate(() => document.getElementById("shStartBtn").click()); await p.waitForSelector("#shView.show"); await p.waitForTimeout(100);
ok("Start again continues the same session and string", (await ED()).id === (await LOG())[0].id && (await T("#shStr")) === "String 5 · Target B");
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
ok("Escape exits the view too", !(await vis("#shView")) && (await p.evaluate(() => document.body.dataset.tab)) === "dope");
// a background radar shot after exit continues the same session (the live one) — still no duplicate session
await p.evaluate(() => document.getElementById("radarReconnect").click()); await p.waitForTimeout(300);
await p.evaluate(b2 => { b2[3] = 3; window.__fake.send(b2); }, PB); await p.waitForTimeout(250);
lg2 = await LOG();
ok("after exit, radar shots keep going to that session (banner, no new session)", lg2.length === 1 && lg2[0].shots.length === nAll + 1, `${lg2.length} ${lg2[0].shots.length}`);
await ctx.close();

/* =================== part 2: wind dial gestures (touch phone, 412×915) =================== */
const c2 = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await c2.addInitScript(init); await c2.addInitScript(fakes); await route(c2);
const q = await c2.newPage(); hook(q); await q.goto(URL_); await ready(q);
const cdp = await c2.newCDPSession(q);
const wd = () => q.evaluate(() => document.getElementById("windDir").value);
const sy = () => q.evaluate(() => window.scrollY);
const toastQ = () => q.evaluate(() => document.getElementById("toast").classList.contains("show") ? document.getElementById("toast").textContent : "");
const center = async () => { await q.evaluate(() => { const r = document.getElementById("windSec").getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - 260); }); await q.waitForTimeout(120); };
const dpt = (ang, rad) => q.evaluate(([a, r]) => { const b = document.getElementById("dial").getBoundingClientRect(), k = b.width / 150, t = a * Math.PI / 180; return [b.left + b.width / 2 + Math.sin(t) * r * k, b.top + b.height / 2 - Math.cos(t) * r * k]; }, [ang, rad]);
const touch = async (pts, hold = 0) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  if (hold) await q.waitForTimeout(hold);
  for (const [x, y] of pts.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }); await q.waitForTimeout(12); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await q.waitForTimeout(150);
};
const line = (x, y, dx, dy, n = 14) => Array.from({ length: n + 1 }, (_, i) => [x + dx * i / n, y + dy * i / n]);
const clearUndo = () => q.evaluate(() => { document.getElementById("toast").classList.remove("show", "act"); });
await center();
ok("dial lets the page pan vertically (touch-action: pan-y)", (await q.evaluate(() => getComputedStyle(document.getElementById("dial")).touchAction)) === "pan-y");
ok("hint no longer says to swipe the numbers; explains ring drag, hold and tap", await q.evaluate(() => { const h = [...document.querySelectorAll("#windSec .hint")].map(e => e.textContent).join(" "); return !/swipe/i.test(h) && /ring/.test(h) && /tap an hour/.test(h); }));
// 1) vertical swipe over the dial face scrolls, wind unchanged
let [x0, y0b] = await dpt(200, 20); let s0 = await sy(), w0 = await wd();
await touch(line(x0, y0b, 0, -220));
ok("vertical swipe over the dial scrolls the page, wind unchanged", (await sy()) > s0 + 60 && (await wd()) === w0, `${s0}→${await sy()} ${w0}→${await wd()}`);
await center();
// 2) vertical swipe starting on the ring at 12 (radial) scrolls too
[x0, y0b] = await dpt(0, 58); s0 = await sy();
await touch(line(x0, y0b, 0, -200));
ok("vertical swipe starting on the ring (12 o'clock) scrolls, wind unchanged", (await sy()) > s0 + 60 && (await wd()) === w0);
await center();
// 2b) vertical swipe down the side of the ring (9 o'clock, not the handle) scrolls
[x0, y0b] = await dpt(270, 58); s0 = await sy();
await touch(line(x0, y0b, 0, -200));
ok("vertical swipe along the ring's side (9 o'clock) scrolls, wind unchanged", (await sy()) > s0 + 60 && (await wd()) === w0);
await center();
// 3) vertical swipe over the wind number boxes scrolls; a horizontal swipe no longer changes them
for (const id of ["windSpeed", "windDir"]) {
  const r = await q.evaluate(id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, id);
  s0 = await sy(); const v0 = await q.evaluate(id => document.getElementById(id).value, id);
  await touch(line(r[0], r[1], 0, -200));
  ok(`vertical swipe over #${id} scrolls the page`, (await sy()) > s0 + 60 && (await q.evaluate(id => document.getElementById(id).value, id)) === v0);
  await center();
  const r2 = await q.evaluate(id => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left + b.width / 2 - 40, b.top + b.height / 2]; }, id);
  await touch(line(r2[0], r2[1], 90, 0));
  ok(`horizontal swipe on #${id} no longer changes it`, (await q.evaluate(id => document.getElementById(id).value, id)) === v0);
  await q.evaluate(() => document.activeElement && document.activeElement.blur());
  await center();
}
// 4) tangential drag along the top of the ring turns the dial, page doesn't scroll, haptic tick
await clearUndo(); await q.evaluate(() => { window.__vib.length = 0; });
[x0, y0b] = await dpt(-10, 58); s0 = await sy();
const arc = Array.from({ length: 16 }, (_, i) => [0, 0]); for (let i = 0; i <= 15; i++) arc[i] = await dpt(-10 + i * 4, 58);
await touch(arc);
const wTan = +(await wd());
ok("tangential drag along the ring changes the wind direction", wTan >= 40 && wTan <= 55 && wTan % 5 === 0, String(wTan));
ok("…without scrolling the page", near(await sy(), s0, 1), `${s0}→${await sy()}`);
ok("haptic tick on engage (vibrate 10 ms)", await q.evaluate(() => window.__vib.includes(10)));
await q.waitForTimeout(500);
ok("undo toast 'Wind now N o'clock'", /Wind now 2 o'clock/.test(await toastQ()) && (await q.textContent("#toastAct")) === "Undo", await toastQ());
await q.screenshot({ path: SHOT + "wind-undo.png" });
await q.click("#toastAct"); await q.waitForTimeout(100);
ok("Undo reverts the wind direction", (await wd()) === w0 && /back to 3 o'clock/.test(await toastQ()));
// 5) press and hold, then a vertical move: engages (no scroll)
await clearUndo(); [x0, y0b] = await dpt(150, 30); s0 = await sy();
await touch(line(x0, y0b, -40, 60, 12), 350);
const wHold = +(await wd());
ok("press-and-hold then drag engages the dial (even vertically, from the face)", wHold !== +w0 && near(await sy(), s0, 1), `${w0}→${wHold} y ${s0}→${await sy()}`);
await q.waitForTimeout(500); ok("…with an undo toast", /Wind now/.test(await toastQ()));
// 6) tap an hour → snaps to it
await clearUndo(); [x0, y0b] = await dpt(272, 56); await touch([[x0, y0b]]);
ok("tap at 9 o'clock snaps to 270°", (await wd()) === "270");
[x0, y0b] = await dpt(128, 50); await touch([[x0, y0b]]);
ok("tap near 4 o'clock snaps to 120°", (await wd()) === "120");
await q.waitForTimeout(500); ok("tap change shows 'Wind now 4 o'clock'", /Wind now 4 o'clock/.test(await toastQ()));
// 7) a drag that starts on the handle (at 4 o'clock) follows the finger
await clearUndo(); [x0, y0b] = await dpt(120, 44); const hp = []; for (let i = 0; i <= 12; i++) hp.push(await dpt(120 + i * 5, 44));
await touch(hp); ok("drag from the handle turns the dial", +(await wd()) >= 170 && +(await wd()) <= 185, await wd());
// 8) − / + still work and show the undo toast
await q.waitForTimeout(500); await clearUndo();
const before = +(await wd()); await q.tap('#windDir ~ button[aria-label="increase"]').catch(async () => { await q.evaluate(() => document.getElementById("windDir").closest(".stepper").querySelector('button[aria-label="increase"]').dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))); });
await q.waitForTimeout(600);
ok("＋ on wind direction still bumps 5° and offers Undo", +(await wd()) === before + 5 && /Wind now/.test(await toastQ()), `${before}→${await wd()} ${await toastQ()}`);
// 9) 🔒 lock: dial ignores input, persisted
await q.click("#windLock"); await q.waitForTimeout(80);
ok("🔒 lock toggles on (aria-pressed) and dims the dial", (await q.getAttribute("#windLock", "aria-pressed")) === "true" && await q.evaluate(() => document.getElementById("dial").classList.contains("locked")));
const wl = await wd(); [x0, y0b] = await dpt(0, 56); await touch([[x0, y0b]]); await touch(arc);
ok("locked dial ignores taps and drags", (await wd()) === wl);
ok("lock persisted in settings", await q.evaluate(() => JSON.parse(localStorage.getItem("bcalc.settings.v1")).windLock === true));
await q.reload(); await ready(q); await center();
ok("lock survives a reload", (await q.getAttribute("#windLock", "aria-pressed")) === "true");
await q.click("#windLock"); [x0, y0b] = await dpt(0, 56); await touch([[x0, y0b]]);
ok("unlocked: tap at 12 snaps to 0°", (await wd()) === "0");
// gesture decision unit checks
const dec = await q.evaluate(() => { const d = window.__bc.dialDecide; return [d("ring", { x: 0, y: -58 }, 20, 0), d("ring", { x: 0, y: -58 }, 0, 20), d("ring", { x: 58, y: 0 }, 0, 20), d("handle", { x: 44, y: 0 }, 0, 20), d("face", { x: 5, y: 5 }, 20, 0), d("ring", { x: 0, y: -58 }, 3, 2)]; });
ok("dialDecide: top tangential=engage, top radial=scroll, side vertical ring=scroll, handle vertical=engage, face=scroll, tiny=wait", dec.join() === "engage,scroll,scroll,engage,scroll,wait", dec.join());
await c2.close();
await b.close();
console.log(`${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs));
