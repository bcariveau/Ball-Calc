// tgpolish round: target setup collapses to one summary line (defaults, expand/edit, whole target visible at 360×800 + 412×915, AA, no clipping);
// elevation dialed stored at turret resolution (whole clicks × click size), edited values kept exactly (≤2 decimals shown), legacy raw dials shown rounded but kept.
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const LEGACY = fs.existsSync(OUT + "index.html") ? OUT + "index.html" : "/workspace/ballistic-calculator-pre-targets.html.bak";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.25moa", opticId: "o1", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] }],
  optics: [{ id: "o1", name: "Razor HD", opTurret: "0.25moa", opTurretV: "", opTurretU: "moa", opReticle: "moa", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.75", opWTravel: "", opTrack: "1.05" }],
  opticsMig: 1, ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MOA", view: "dope", values: { target: "500", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
const OLD = { id: "old1", rifleId: "r1", loadId: "l1", date: "2026-10-01T15:00:00.000Z", source: "manual", shots: [{ v: 2701 }, { v: 2712, cold: true }, { v: 2695, note: "pulled" }],
  notes: "old session", wx: { temp: 60, humidity: 40, pressure: 29.9, altitude: 900, powder: 62 }, barrel: 24 };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))});
  localStorage.setItem("bcalc.shotlog.v1", ${JSON.stringify(JSON.stringify([OLD]))}); }`);
await ctx.addInitScript(() => {   // fake radar (as in test-bluetooth-ui) + wake lock
  const mkChr = init => { const et = new EventTarget(); et.value = init; et.startNotifications = async () => et; et.stopNotifications = async () => et; et.readValue = async () => et.value; return et; };
  const notify = mkChr(null), batt = mkChr(new DataView(Uint8Array.of(87).buffer)); const dev = new EventTarget(); dev.name = "ATHLONVPR1_060655"; dev.id = "x";
  dev.gatt = { connected: false, async connect() { this.connected = true; return this; }, disconnect() { this.connected = false; dev.dispatchEvent(new Event("gattserverdisconnected")); },
    async getPrimaryService(u) { if (u === "6e40ff01-b5a3-f393-e0a9-4174686c6f6e") return { getCharacteristic: async () => notify }; if (u === "battery_service") return { getCharacteristic: async () => batt }; throw new DOMException("no", "NotFoundError"); } };
  window.__fake = { dev, send(bytes) { notify.value = new DataView(Uint8Array.from(bytes).buffer); notify.dispatchEvent(new Event("characteristicvaluechanged")); } };
  Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async () => dev, getDevices: async () => [] }, configurable: true });
  window.__wl = { req: 0, rel: 0, active: false };
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: async t => { window.__wl.req++; window.__wl.active = true; const s = new EventTarget(); s.type = t; s.released = false;
    s.release = async () => { if (!s.released) { s.released = true; window.__wl.rel++; window.__wl.active = false; s.dispatchEvent(new Event("release")); } }; return s; } } });
});
await ctx.route("https://api.open-meteo.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: [260], current: { temperature_2m: 59, relative_humidity_2m: 40, wind_speed_10m: 8, wind_direction_10m: 270, wind_gusts_10m: 14, surface_pressure: 984 } }) }));
await ctx.route("http://localhost:8765/index-r31.html", r => r.fulfill({ contentType: "text/html", body: fs.readFileSync(LEGACY) }));
const hex = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));
const PA = hex("80 1C 22 01 26 10 31 20 27 50 04 50 D9 02 D9 02 D9 02 D9 02 00 00 00 00 00 00 E3 01 8D 03");
const PB = hex("80 1C 22 02 26 10 31 20 33 31 05 07 C3 02 D9 02 C3 02 CE 02 16 00 1E 00 24 00 D4 01 7F 03");
const p = await ctx.newPage();
const hook = pg => { pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); pg.on("pageerror", e => errs.push("PAGEERR " + e.message)); pg.on("dialog", d => d.accept()); };
hook(p);
// tgpolish: the target setup collapses to one summary line; open it before using its fields
const openSet = () => p.evaluate(() => { const b = document.getElementById("tgSum"); if (b && document.getElementById("tgEd").classList.contains("show") && b.getAttribute("aria-expanded") === "false") b.click(); });
const SETRE = /^#tg(Dist|Du|U|Tpl|StrSel|DialV|DialD|DialApp)$/;
for (const fn of ["fill", "selectOption", "press", "click"]) { const o = p[fn].bind(p); p[fn] = async (sel, ...a) => { if (typeof sel === "string" && SETRE.test(sel)) await openSet(); return o(sel, ...a); }; }
const ready = (pg = p) => pg.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
const colors = sels => p.evaluate(sels => { const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== "transparent") return c; } return getComputedStyle(document.body).backgroundColor; };
  return sels.flatMap(s => [...document.querySelectorAll(s)].filter(e => (e.offsetParent || getComputedStyle(e).position === "fixed") && e.textContent.trim()).map(e => [s, getComputedStyle(e).color, bgOf(e)])); }, sels);
const LOG = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__bc.log)));
const ED = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__bc.ED)));
const vis = s => p.isVisible(s);
const T = s => p.textContent(s);
// tap the target sheet at (x, y) inches (y up)
const sheetPt = (x, y) => p.evaluate(([x, y]) => { const svg = document.getElementById("tgSvg"), q = new DOMPoint(x, -y).matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, [x, y]);
const tap = async (x, y) => { const [a, c] = await sheetPt(x, y); await p.mouse.click(a, c); await p.waitForTimeout(40); };
const svgIntoView = () => p.evaluate(() => document.getElementById("tgSvg").scrollIntoView({ block: "center" }));
const sizes = sel => p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent || getComputedStyle(e).position === "fixed").map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.className || e.textContent.trim().slice(0, 14), h: r.height, w: r.width }; }), sel);
const small = async sel => (await sizes(sel)).filter(o => o.h < 44 - 0.5 || o.w < 44 - 0.5);
const overflow = () => p.evaluate(() => { const W = document.documentElement.clientWidth, bad = [];
  for (const e of document.querySelectorAll(".ovl.show *, #shotBan, #shotBan *")) { if (!e.offsetParent && getComputedStyle(e).position !== "fixed") continue; const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 0.5 || r.left < -0.5)) bad.push(`${e.id || e.className} ${Math.round(r.left)}-${Math.round(r.right)}`); }
  document.querySelectorAll(".ovl.show").forEach(o => { if (o.scrollWidth > o.clientWidth + 1) bad.push(o.id + " scrollW " + o.scrollWidth); });
  return bad.slice(0, 8); });


/* ---------- migration: old session loads unchanged ---------- */

const key = async s => { for (const ch of s) await p.click(`#tgKeys button[data-k="${ch === "<" ? "back" : ch}"]`); };
const add = async v => { await p.fill("#slVel", String(v)); await p.click("#slAdd"); await p.waitForTimeout(40); };
const setHoles = (si, H, sh = true) => p.evaluate(([si, H, sh]) => { const e = window.__bc.ED, st = e.tg.strings[si], rd = e.shots.filter(x => x.str === st.id || (!x.str && si === 0));
  st.aim = { x: 0, y: 0 }; st.holes = H.map((m, i) => ({ id: "h" + si + "_" + i, x: m[0], y: m[1], sh: sh && rd[i] ? rd[i].id : null, m: { x: m[0], y: m[1] } })); window.__bc.openTgEd(st.id); }, [si, H, sh]);

const sum = () => p.evaluate(() => { const b = document.getElementById("tgSum"), r = b.getBoundingClientRect();
  return { t: b.querySelector(".t").textContent, i: b.querySelector(".i").textContent, exp: b.getAttribute("aria-expanded"), vis: !!b.offsetParent, h: r.height, w: r.width, sw: b.scrollWidth, cw: b.clientWidth,
    set: !!document.getElementById("tgTpl").offsetParent && !!document.getElementById("tgDist").offsetParent && !!document.getElementById("tgDialV").offsetParent && !!document.getElementById("tgStrSel").offsetParent && !!document.getElementById("tgU").offsetParent }; });
const tgtBox = () => p.evaluate(() => { document.getElementById("tgEd").scrollTop = 0; const r = document.getElementById("tgSvg").getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
const dial = async () => (await ED()).tg.strings[0].dial;
const GEO = {};
let L; await p.goto(URL_); await ready();

/* ---------- auto-filled new target: collapsed summary, dial at whole ¼ MOA clicks ---------- */
await p.click("#tabBtnLog"); await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show");
for (const v of [2700, 2690, 2680, 2710, 2685]) await add(v);
await p.click("#tgMarkBtn"); await p.waitForSelector("#tgEd.show"); await p.waitForTimeout(600);
let d = await dial(), S0 = await sum();
ok("auto-filled dial is stored in the turret unit at whole clicks (e = clicks × ¼ MOA)", d && d.src === "app" && d.u === "MOA" && d.c > 20 && Math.abs(d.e - d.c * 0.25) < 1e-9 && d.k === 1.05 && d.cl === "¼ MOA", JSON.stringify(d));
ok("auto-filled target opens with the setup collapsed", S0.exp === "false" && !S0.set && S0.vis && S0.i === "✎", JSON.stringify(S0));
ok("summary line: template · distance · dial at turret resolution (clicks)", S0.t === `1″ grid · 500 yd · U ${d.e.toFixed(2)} MOA (${d.c})`, S0.t);
ok("summary is one ≥44px button with aria-controls", S0.h >= 44 && S0.w > 300 && (await p.getAttribute("#tgSum", "aria-controls")) === "tgSetBox" && (await p.evaluate(() => document.getElementById("tgSum").tagName)) === "BUTTON");
ok("mode is Holes-ready (aim first) and the sheet is on screen", await vis("#tgSvg") && await vis("#tgMode"));
await svgIntoView(); await tap(0, 0); await tap(3, 6); await tap(-4, 8); await tap(2, 4); await tap(5, 7); await tap(-1, 5);
ok("in Holes mode after the aim point, 5 holes", (await ED()).tg.strings[0].holes.length === 5 && (await p.getAttribute('#tgMode button[data-v="hole"]', "aria-pressed")) === "true");
for (const [w, h] of [[360, 800], [412, 915]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(150); const g = await tgtBox(); GEO[`holes ${w}×${h}`] = g;
  ok(`${w}×${h}: whole target visible in Holes mode without scrolling`, g.top >= 0 && g.bottom <= g.vh, JSON.stringify(g));
  ok(`${w}×${h}: no clipping, summary fits its row`, !(await overflow()).length && (await sum()).sw <= (await sum()).cw + 1, JSON.stringify(await overflow()));
}
await p.setViewportSize({ width: 412, height: 915 });

/* ---------- expand / edit / collapse ---------- */
await p.click("#tgSum"); await p.waitForTimeout(60); let S1 = await sum();
ok("tapping the summary expands the setup", S1.exp === "true" && S1.set && S1.i === "▴", JSON.stringify(S1));
ok("dial box at turret resolution: 2 decimals on ¼ MOA, unit MOA, clicks in the hint", (await p.inputValue("#tgDialV")) === d.e.toFixed(2) && (await T("#tgDialU")) === "MOA" && (await T("#tgDialH")).includes(`U ${d.c} clicks (¼ MOA)`) && (await p.getAttribute("#tgDialV", "step")) === "0.25", await T("#tgDialH"));
for (const [w, h] of [[360, 800], [412, 915]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(100);
  ok(`${w}: expanded setup has no clipping`, !(await overflow()).length, JSON.stringify(await overflow())); }
await p.setViewportSize({ width: 412, height: 915 });
await p.fill("#tgDist", "600"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(500); d = await dial();
ok("distance change re-dopes the app dial at whole clicks and the summary follows", d.wx.yd === 600 && Math.abs(d.e - d.c * 0.25) < 1e-9 && (await sum()).t === `1″ grid · 600 yd · U ${d.e.toFixed(2)} MOA (${d.c})`, (await sum()).t);
await p.fill("#tgDist", "500"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(500);
await p.selectOption("#tgU", "cm"); await p.waitForTimeout(40);
ok("summary shows cm when measuring in cm", (await sum()).t.includes(" · cm · "), (await sum()).t);
await p.selectOption("#tgU", "in"); await p.waitForTimeout(40);
await p.fill("#tgDialV", "11.13"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60); d = await dial();
ok("an edited value is stored exactly as typed", d.e === 11.13 && d.u === "MOA" && d.src === "user" && d.c === 45 && (await p.inputValue("#tgDialV")) === "11.13", JSON.stringify(d));
await p.fill("#tgDialV", "11.125"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60); d = await dial();
ok("…even past 2 decimals (stored 11.125), shown at most 2 decimals", d.e === 11.125 && (await p.inputValue("#tgDialV")) === "11.13" && (await sum()).t.endsWith("U 11.13 MOA (45)"), `${d.e} ${await p.inputValue("#tgDialV")} ${(await sum()).t}`);
await p.fill("#tgDialV", "11"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60);
ok("whole value shows trimmed", (await dial()).e === 11 && (await sum()).t.endsWith("U 11 MOA (44)"), (await sum()).t);
await p.fill("#tgDialV", "11.125"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60);
await p.click("#tgSum"); await p.waitForTimeout(40);
ok("tapping again collapses it", (await sum()).exp === "false" && !(await sum()).set);
await p.click('#tgMode button[data-v="meas"]'); await p.waitForTimeout(40);
ok("Measure mode hides the summary (as it hid the setup)", !(await sum()).vis);
await p.click('#tgMode button[data-v="hole"]'); await p.waitForTimeout(40);
ok("back in Holes the summary returns", (await sum()).vis);

/* ---------- Truing uses the stored value × tracking − offset ---------- */
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; st.holes.forEach((h, i) => { h.x = [3, -2, 1, 4, 0][i]; h.y = [6, 8, 5, 7, 6][i]; delete h.m; }); window.__bc.openTgEd(st.id); }); await p.waitForTimeout(80);
let st0 = (await ED()).tg.strings[0]; const cy = st0.holes.reduce((a, h) => a + (h.y - st0.aim.y), 0) / st0.holes.length;
await p.click('label.tgl[for="tgAtDist"]'); await p.waitForTimeout(40);
ok("at-distance switch names the dial as typed (≤2 decimals)", (await T('label.tgl[for="tgAtDist"]')).includes("U 11.13 MOA dialed"));
await p.click("#tgTrue"); await p.waitForSelector("#trSheet.show"); await p.waitForTimeout(500);
const ipm = 1.0471975511965976 * 5;
let trO = +(await p.inputValue("#trObs"));
ok("Truing observed = stored 11.125 × 1.05 − offset", near(trO, 11.125 * 1.05 - cy / ipm, 0.006) && (await T("#trOut")).includes("dialed U 11.13 MOA"), `${trO} vs ${11.125 * 1.05 - cy / ipm}`);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });

/* ---------- reopen: collapsed; App dope re-fill rounds; Truing on the rounded value ---------- */
await p.click("#tabBtnLog"); await p.click(".slItem >> nth=0"); await p.waitForSelector("#slEditor.show");
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[0].id)); await p.waitForTimeout(150);
ok("reopening an existing target starts collapsed", (await sum()).exp === "false" && !(await sum()).set);
await p.click("#tgDialApp"); await p.waitForTimeout(500); d = await dial();
ok("App dope re-fill stores whole clicks again", d.src === "app" && Math.abs(d.e - d.c * 0.25) < 1e-9 && (await p.inputValue("#tgDialV")) === d.e.toFixed(2), JSON.stringify(d));
await p.click('label.tgl[for="tgAtDist"]'); await p.waitForTimeout(40);
await p.click("#tgTrue"); await p.waitForSelector("#trSheet.show"); await p.waitForTimeout(500); trO = +(await p.inputValue("#trObs"));
ok("Truing uses the rounded turret value × tracking − offset", near(trO, d.e * 1.05 - cy / ipm, 0.006) && (await T("#trOut")).includes(`dialed U ${d.e.toFixed(2)} MOA`), `${trO} vs ${d.e * 1.05 - cy / ipm}`);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });

/* ---------- legacy raw dials: shown rounded, stored value kept ---------- */
await p.click("#tabBtnLog"); await p.click(".slItem >> nth=0"); await p.waitForSelector("#slEditor.show");
const RAW = { e: 2.814, u: "MIL", c: 27, cl: "0.1 mil", k: 1.05, src: "app", wx: { temp: 59, hum: 0, alt: 0, press: 29.92, tp: 59, look: 0, yd: 500 }, at: 1 };
await p.evaluate(raw => { const st = window.__bc.ED.tg.strings[0]; st.dial = raw; window.__bc.openTgEd(st.id); }, RAW); await p.waitForTimeout(150);
const rc = Math.round(2.814 * 3.4377467707849396 / 0.25);   // 2.814 mil (old raw, 3 decimals) → 9.674 MOA → 39 clicks
ok("legacy raw dial (old mil string, ¼ MOA turret) shows rounded to clicks", (await sum()).t.endsWith(`U ${(rc * 0.25).toFixed(2)} MOA (${rc})`), (await sum()).t);
await openSet();
ok("…dial box shows it rounded too (no thousandths)", (await p.inputValue("#tgDialV")) === (rc * 0.25).toFixed(2) && (await T("#tgDialH")).includes(`U ${rc} clicks`), await p.inputValue("#tgDialV"));
await p.focus("#tgDialV"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60);
await p.selectOption("#tgTpl", "moa"); await p.waitForTimeout(40); await p.selectOption("#tgTpl", "grid1"); await p.waitForTimeout(40);
const SID = (await ED()).id; await p.click("#tgEdDone"); await p.waitForTimeout(200);
L = (await LOG()).filter(s => s.id === SID);
ok("…its stored value is unchanged after editing other things and saving", (q => q.e === RAW.e && q.u === "MIL" && q.c === 27 && q.src === "app" && q.k === 1.05 && q.at === 1)(L[0].tg.strings[0].dial), JSON.stringify(L[0].tg.strings[0].dial));
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[0].id)); await p.waitForTimeout(150);
await p.click('label.tgl[for="tgAtDist"]'); await p.waitForTimeout(40);
ok("…and the at-distance switch shows it rounded", (await T('label.tgl[for="tgAtDist"]')).includes(`U ${(rc * 0.25).toFixed(2)} MOA dialed`));
await p.click("#tgTrue"); await p.waitForSelector("#trSheet.show"); await p.waitForTimeout(500); trO = +(await p.inputValue("#trObs"));
ok("…Truing still uses its stored (raw) value", near(trO, 2.814 * 3.4377467707849396 * 1.05 - cy / ipm, 0.006), `${trO} vs ${2.814 * 3.4377467707849396 * 1.05 - cy / ipm}`);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });
await p.click("#tabBtnLog"); await p.click(".slItem >> nth=0"); await p.waitForSelector("#slEditor.show");
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; st.dial = { e: 11.137, u: "MOA", c: 45, cl: "¼ MOA", k: 1.05, src: "app", wx: { yd: 500 }, at: 1 }; window.__bc.openTgEd(st.id); }); await p.waitForTimeout(150);
ok("legacy raw dial in MOA shows 11.25 (45 clicks), not 11.137", (await sum()).t.endsWith("U 11.25 MOA (45)") && (await dial()).e === 11.137, (await sum()).t);
await p.click("#tgEdDone"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });

/* ---------- a new target missing its dial opens expanded ---------- */
await p.click("#tabBtnLog"); await p.click(".slItem >> nth=1"); await p.waitForSelector("#slEditor.show");
ok("(old session, no target yet)", (await ED()).id === "old1" && !(await ED()).tg);
await p.click("#tgMarkBtn"); await p.waitForSelector("#tgEd.show"); await p.waitForTimeout(500); let S2 = await sum();
ok("brand-new target with nothing to auto-fill the dial opens expanded", S2.exp === "true" && S2.set && S2.t.endsWith("dial?") && !(await dial()), JSON.stringify(S2));
await p.fill("#tgDialV", "9.5"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60);
ok("entering the dial updates the summary", (await sum()).t.endsWith("U 9.5 MOA (38)") && (await dial()).e === 9.5, (await sum()).t);
await p.click("#tgEdDone"); await p.waitForTimeout(200);
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[0].id)); await p.waitForTimeout(150);
ok("…and next time it opens collapsed", (await sum()).exp === "false");
// a new target whose dope is out of reach also opens expanded after the auto-fill fails
await p.click("#tgEdDone"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });
await p.click("#tabBtnLog"); await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show"); await add(2700);
await p.evaluate(() => { document.getElementById("target").value = "4000"; });
await p.click("#tgMarkBtn"); await p.waitForSelector("#tgEd.show"); await p.waitForTimeout(700);
const S3 = await sum(), d3 = await dial();
ok("new target where the auto-fill finds no dope (4000 yd) → opens expanded", !d3 && S3.exp === "true" && S3.set && S3.t.includes("4000 yd") && S3.t.endsWith("dial?"), JSON.stringify({ S3, d3 }));
await p.evaluate(() => { document.getElementById("target").value = "500"; });

/* ---------- AA for the summary line in all 5 themes (collapsed + expanded) ---------- */
for (const open of [false, true]) {
  if ((await sum()).exp !== String(open)) await p.click("#tgSum");
  for (const th of ["dark", "light", "od", "fde", "night"]) {
    await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(30);
    const c = await colors(["#tgSum .t", "#tgSum .i"]), bad = c.filter(([s, f, bg]) => cr(f, bg) < (s.endsWith(".t") ? 4.5 : 3));
    ok(`${th} (${open ? "expanded" : "collapsed"}): summary text AA ≥4.5, icon ≥3`, c.length === 2 && !bad.length, JSON.stringify(c.map(([s, f, bg]) => [s, cr(f, bg).toFixed(2)])));
  }
}
await p.evaluate(() => document.documentElement.dataset.theme = "dark");
// long summary wraps instead of clipping
await p.evaluate(() => { const e = window.__bc.ED, st = e.tg.strings[0], g = e.tg.targets.find(q => q.id === st.tid); g.tpl = "steel"; g.dist = 1000; g.du = "m"; g.u = "cm"; st.dial = { e: -12.25, u: "MOA", c: -49, k: 1, src: "user", wx: {}, at: 1 }; window.__bc.openTgEd(st.id); }); await p.waitForTimeout(100);
for (const [w, h] of [[360, 800], [412, 915]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(100); const s3 = await sum();
  ok(`${w}: long summary (${s3.t}) wraps, no clipping`, s3.sw <= s3.cw + 1 && !(await overflow()).length && s3.t === "Steel plate · 1000 m · cm · D 12.25 MOA (49)", JSON.stringify(s3)); }
await p.setViewportSize({ width: 412, height: 915 });
await p.screenshot({ path: OUT + "screenshot-tg-setup-summary.png" });

console.log("GEO", JSON.stringify(GEO));
console.log(`${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs)); assert.deepEqual(errs, []);
await b.close();
