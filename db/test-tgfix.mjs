// Targets fixes round (tgfix): dial saved per string + Truing from it, velocity-vs-vertical thresholds, zero clicks ÷ tracking, measure pre-fill,
// one merged hole/reading list, label legibility + zoom bar + pinch/pan, Log thumbnails, full-row switches, whole-fps display, AA/clipping, migration.
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const LEGACY = fs.existsSync(OUT + "index.html") ? OUT + "index.html" : "/workspace/ballistic-calculator-pre-targets.html.bak";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", opticId: "o1", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] }],
  optics: [{ id: "o1", name: "Razor HD", opTurret: "0.1mil", opTurretV: "", opTurretU: "mil", opReticle: "mil", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.75", opWTravel: "", opTrack: "1.05" }],
  opticsMig: 1, ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", values: { target: "500", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
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
let L; await p.goto(URL_); await ready();

/* ---------- 8b) whole fps everywhere (stored precision kept) ---------- */
await p.click("#tabBtnLog"); await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show");
for (const v of [2700.4, 2690.2, 2680.6, 2710.6, 2685.4]) await add(v);
let E = await ED();
ok("stored speeds keep their precision", E.shots.map(x => x.v).join() === "2700.4,2690.2,2680.6,2710.6,2685.4");
ok("banner: speed, avg and ES in whole fps (SD keeps a decimal)", (await T("#sbV")) === "2685" && /avg 2693\b/.test(await T("#sbSt")) && /ES 30\b/.test(await T("#sbSt")) && /SD \d+\.\d/.test(await T("#sbSt")), await T("#sbSt"));
ok("shot rows + string header show whole fps", (await p.locator("#slShots .shot .v").allTextContents()).join() === "2685,2711,2681,2690,2700" && !/\d\.\d+ fps|avg \d+\.|ES \d+\./.test(await T("#slShots")), await T("#slShots"));
ok("session stats: Avg/ES/Min/Max whole fps", await p.evaluate(() => { const t = [...document.querySelectorAll("#slStats div")].map(d => d.querySelector("span").textContent + "=" + d.querySelector("b").textContent); return t.includes("Avg fps=2693") && t.includes("ES=30") && t.includes("Min=2681") && t.includes("Max=2711"); }), await T("#slStats"));
ok("Mark each shot is a full-row ≥44px switch", await p.evaluate(() => { const l = document.querySelector('label.tgl[for="tgMarkEach"]'), i = document.getElementById("tgMarkEach"); return l && i.getAttribute("role") === "switch" && l.getBoundingClientRect().height >= 44 && l.getBoundingClientRect().width > 250; }));
await p.click('label.tgl[for="tgMarkEach"]'); await p.waitForTimeout(40);
ok("tapping anywhere on the row toggles it", (await ED()).tg.mark === true); await p.click('label.tgl[for="tgMarkEach"]'); await p.waitForTimeout(40);

/* ---------- 1) dial saved with the string ---------- */
await p.click("#tgMarkBtn"); await p.waitForSelector("#tgEd.show"); await p.waitForTimeout(500);
E = await ED(); let d0 = E.tg.strings[0].dial;
ok("first mark (recent session) defaults the dial to the app's dope at the target distance", d0 && d0.src === "app" && d0.u === "MIL" && d0.e > 2 && d0.wx.yd === 500 && d0.wx.temp === 59 && d0.wx.look === 0 && d0.k === 1.05, JSON.stringify(d0));
ok("…stored with clicks and the tracking factor (turret reading = dope ÷ k)", d0.c === Math.round(d0.e / 0.1) && d0.cl.includes("0.1"), JSON.stringify(d0));
ok("dial box shows it in the display unit + clicks", +(await p.inputValue("#tgDialV")) === +d0.e.toFixed(3) && (await p.inputValue("#tgDialD")) === "U" && (await T("#tgDialU")) === "mil" && (await T("#tgDialH")).includes(`U ${d0.c} clicks`) && (await T("#tgDialH")).includes("tracking ×1.05") && (await T("#tgDialH")).includes("app dope"), await T("#tgDialH"));
await p.fill("#tgDist", "300"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(400); E = await ED();
ok("an unedited app dial follows a distance change", E.tg.strings[0].dial.wx.yd === 300 && E.tg.strings[0].dial.e < d0.e && E.tg.strings[0].dial.src === "app");
await p.fill("#tgDist", "500"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(400);
await p.fill("#tgDialV", "3.5"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60); E = await ED(); let d1 = E.tg.strings[0].dial;
ok("shooter edits the dial: value, clicks, source", d1.e === 3.5 && d1.c === 35 && d1.src === "user" && d1.k === 1.05 && d1.wx.yd === 500 && (await T("#tgDialH")).includes("edited"), JSON.stringify(d1));
await p.fill("#tgDist", "520"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(400); E = await ED();
ok("an edited dial is kept when the distance changes", E.tg.strings[0].dial.e === 3.5);
await p.fill("#tgDist", "500"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(300);
await p.click("#tgUndo"); await p.click("#tgUndo"); await p.click("#tgUndo"); await p.waitForTimeout(60);
ok("Undo restores the previous dial", (await ED()).tg.strings[0].dial.src === "app");
await p.fill("#tgDialV", "3.5"); await p.press("#tgDialV", "Tab"); await p.waitForTimeout(60);
ok("dial box controls ≥44px", (await small("#tgDialBox input, #tgDialBox select, #tgDialBox button")).length === 0, JSON.stringify(await small("#tgDialBox input, #tgDialBox select, #tgDialBox button")));

/* ---------- 2) velocity-vs-vertical thresholds ---------- */
// group 1.0″ high on average at 500 yd, fast shots high (r ≈ 0.98)
const H5 = [[0.2, 1.3], [0.1, 0.9], [-0.1, 0.5], [0.3, 1.7], [0, 0.6]];
await setHoles(0, H5); await p.waitForTimeout(80);
const vvT = () => T("#tgVV"), vvWarn = () => p.evaluate(() => !!document.querySelector("#tgVV") && !document.querySelector("#tgVV .pt") && /Fast shots printed high/.test(document.getElementById("tgVV").textContent));
ok("5 paired shots, r ≥ 0.7 → velocity-vs-vertical warning", await vvWarn(), await vvT());
await setHoles(0, H5.slice(0, 4)); await p.waitForTimeout(60);
ok("4 paired shots (strong r) → only a muted 'possible trend' note", !(await vvWarn()) && (await vvT()).includes("Possible velocity-vs-vertical trend") && (await p.locator("#tgVV .pt").count()) === 1 && (await vvT()).includes("5+ paired shots"), await vvT());
await setHoles(0, [[0, 1.0], [0, 0.9], [0, 1.2], [0, 1.6], [0, 0.6]]); await p.waitForTimeout(60);
const rW = await p.evaluate(() => window.__bc.velVert(window.__bc.ED, window.__bc.ED.tg.strings[0]).r);
ok("5 shots with 0.5 ≤ r < 0.7 → muted note, no warning", rW >= 0.5 && rW < 0.7 && !(await vvWarn()) && (await p.locator("#tgVV .pt").count()) === 1, `r=${rW} ${await vvT()}`);
await setHoles(0, [[0, 1.0], [0, 0.6], [0, 1.4], [0, 0.9], [0, 1.1]]); await p.waitForTimeout(60);
const rN = await p.evaluate(() => window.__bc.velVert(window.__bc.ED, window.__bc.ED.tg.strings[0]).r);
ok("weak r → 'No … trend', no note", Math.abs(rN) < 0.5 && (await vvT()).startsWith("No velocity-vs-vertical trend") && (await p.locator("#tgVV .pt").count()) === 0, `r=${rN} ${await vvT()}`);
await setHoles(0, H5); await p.waitForTimeout(60);

/* ---------- 1b) Send vertical to Truing = dialed − offset, with the string's conditions ---------- */
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; st.dial.wx = { ...st.dial.wx, temp: 20, alt: 5000, press: 24.9, hum: 10, tp: 25, look: 8 }; window.__bc.openTgEd(st.id); });
await p.waitForTimeout(60);
ok("the at-distance confirm is a full-row ≥44px switch naming the dial", await p.evaluate(() => { const l = document.querySelector('label.tgl[for="tgAtDist"]'); return l && l.getBoundingClientRect().height >= 44 && document.getElementById("tgAtDist").getAttribute("role") === "switch" && l.textContent.includes("U 3.50 mil dialed"); }), await T("#tgRes"));
await p.click('label.tgl[for="tgAtDist"]'); await p.waitForTimeout(40);
ok("…toggling it enables Send vertical to Truing", !(await p.isDisabled("#tgTrue")));
const cy = H5.reduce((a, q) => a + q[1], 0) / 5;
await p.click("#tgTrue"); await p.waitForSelector("#trSheet.show"); await p.waitForTimeout(500);
let trO = +(await p.inputValue("#trObs"));
ok("Truing observed = dialed × tracking − vertical offset (not a fresh prediction)", near(trO, 3.5 * 1.05 - cy / 18, 0.006) && +(await p.inputValue("#trRange")) === 500, `${trO} vs ${3.5 * 1.05 - cy / 18}`);
ok("Truing uses the string's saved angle + conditions", +(await p.inputValue("#trAngle")) === 8 && (await T("#trFor")).includes("using the string's conditions") && (await T("#trFor")).includes("20°F") && (await T("#trOut")).includes("dialed U 3.50 mil") && (await T("#trOut")).includes("×1.05 tracking"), (await T("#trFor")) + " | " + (await T("#trOut")));
ok("TR carries the saved conditions + powder temp", await p.evaluate(() => { const c = window.__bc.TR.cond; return c && c.cond.temp === 20 && c.cond.alt === 5000 && c.cond.press === 24.9 && c.Tp === 25; }));
await p.click("#trGo"); await p.waitForTimeout(700);
const outCold = await T("#trOut");
await p.evaluate(() => { window.__bc.TR.cond = null; }); await p.click("#trGo"); await p.waitForTimeout(700);
const outToday = await T("#trOut");
ok("solving under the saved (cold, high) conditions differs from today's weather", outCold !== outToday && /\d/.test(outCold), outCold.slice(0, 160) + " || " + outToday.slice(0, 160));
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
ok("opening Truing normally clears the string's conditions", await p.evaluate(() => { document.getElementById("trueBtn")?.click(); return window.__bc.TR.cond === null; }));
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });
// old string without a dial → today's prediction + note
await p.click("#tabBtnLog"); await p.click(".slItem >> nth=0"); await p.waitForSelector("#slEditor.show");
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; delete st.dial; window.__bc.openTgEd(st.id); }); await p.waitForTimeout(80);
ok("no dial saved → dial box says so", (await p.inputValue("#tgDialV")) === "" && (await T("#tgDialH")).includes("Not saved") && (await T('label.tgl[for="tgAtDist"]')).includes("No dial saved"));
await p.click('label.tgl[for="tgAtDist"]'); await p.click("#tgTrue"); await p.waitForSelector("#trSheet.show"); await p.waitForTimeout(500);
trO = +(await p.inputValue("#trObs")); const pred = +((await T("#trOut")).match(/app's ([\d.]+) mil/) || [])[1];
ok("old string falls back to today's prediction, with a note", pred > 0 && near(trO, pred - cy / 18, 0.011) && (await T("#trOut")).includes("No dial was saved with this string") && +(await p.inputValue("#trAngle")) === 0, `${trO} ${pred}`);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });

/* ---------- 3) zero correction ÷ tracking factor ---------- */
await p.click("#tabBtnLog"); await p.click(".slItem >> nth=0"); await p.waitForSelector("#slEditor.show");
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[0].id));
await p.fill("#tgDist", "100"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(200);
await setHoles(0, [[0.5, -1.3], [0.4, -1.2], [0.6, -1.4], [0.5, -1.3], [0.5, -1.3]]); await p.waitForTimeout(80);
ok("zero correction clicks divide elevation by the tracking factor (1.3″ low: 3 clicks at ×1.05, not 4)", /U 3(?!\d)/.test(await T("#tgZero")) && (await T("#tgZero")).includes("tracking ×1.05") && /L 1(?!\d)/.test(await T("#tgZero")), await T("#tgZero"));

/* ---------- 4) measure pre-fill ---------- */
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; st.holes = []; st.aim = null; window.__bc.openTgEd(st.id); });
await p.fill("#tgDist", "500"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(200);
await svgIntoView(); await tap(0, 0);
const TAPS = [[0.62, 0.41], [-0.33, 0.9], [0.1, -0.75]];
for (const h of TAPS) await tap(...h);
E = await ED(); let st0 = E.tg.strings[0]; const off = st0.holes.map(h => ({ x: h.x - st0.aim.x, y: h.y - st0.aim.y }));
await p.click("#tgAddShot"); await p.waitForTimeout(40);
await p.click('#tgMode button[data-v="meas"]'); await p.click('#tgList .lr:not(.rdu) >> nth=0 >> .lrM'); await p.waitForTimeout(40);
const fmtv = v => `${+Math.abs(v).toFixed(2)} in`, segOn = id => p.getAttribute(`#${id} button.on`, "data-v");
ok("measure pre-fills a tapped hole with its tapped offset (values + toggles)", (await T("#tgMX")) === fmtv(off[0].x) && (await T("#tgMY")) === fmtv(off[0].y) && (await segOn("tgMH")) === "R" && (await segOn("tgMV")) === "U" && (await T("#tgMPf")).includes("Pre-filled"), `${await T("#tgMX")} ${await T("#tgMY")} vs ${JSON.stringify(off[0])}`);
await p.click("#tgMNext"); await p.waitForTimeout(30);
ok("hole 2 pre-fills L/U from its tap", (await T("#tgMX")) === fmtv(off[1].x) && (await segOn("tgMH")) === "L" && (await segOn("tgMV")) === "U");
await p.click("#tgMNext"); await p.waitForTimeout(30);
ok("hole 3 pre-fills R/D", (await T("#tgMY")) === fmtv(off[2].y) && (await segOn("tgMV")) === "D");
await p.click("#tgMY"); await key("1.5"); await p.click("#tgMNext"); await p.waitForTimeout(30);
ok("typing replaces the pre-filled value (first key)", near((await ED()).tg.strings[0].holes[2].m.y, -1.5, 1e-6) && near((await ED()).tg.strings[0].holes[2].m.x, off[2].x, 0.006));
ok("a never-tapped hole (＋ Add shot) starts at 0", (await T("#tgMX")) === "0 in" && (await T("#tgMY")) === "0 in" && (await T("#tgMeasT")).includes("not placed yet") && (await T("#tgMPf")) === "");
await p.click("#tgMDone"); await p.waitForTimeout(40); E = await ED(); st0 = E.tg.strings[0];
ok("untouched pre-fills don't turn tapped holes into 📏 measured", !st0.holes[0].m && !st0.holes[1].m && !!st0.holes[2].m && (await p.locator("#tgList .lr:not(.rdu) i").allTextContents()).join("") === "👆👆📏👆");
await p.click('#tgMode button[data-v="meas"]'); await p.click('#tgList .lr:not(.rdu) >> nth=2 >> .lrM'); await p.waitForTimeout(40);
ok("a measured hole pre-fills its measurement", (await T("#tgMY")) === "1.5 in" && (await T("#tgMPf")).includes("saved measurement"));
await p.click("#tgMDone");

/* ---------- 5) merged list: reading row → Pair to hole ---------- */
await p.click('#tgList .lr:not(.rdu) >> nth=1 >> .lrX'); await p.click('#tgList .lmenu button[data-m="nr"]'); await p.waitForTimeout(40);
const freed = await p.locator("#tgList .lr.rdu").count();
ok("freed + extra readings sit below the holes as their own rows", freed >= 1 && (await T("#tgList .lsub")).includes("Readings without a hole"));
await p.click("#tgList .lr.rdu >> nth=0 >> .lrX"); await p.click('#tgList .lmenu button[data-m="pair"]'); await p.waitForTimeout(30);
ok("reading ⋯ → Pair to hole lists the holes", (await p.locator('#tgList .lmenu button[data-m="ph"]').count()) === 4);
await p.click('#tgList .lmenu button[data-m="ph"] >> nth=1'); await p.waitForTimeout(40); E = await ED();
ok("…and pairs it (explicitly, that hole only)", !!E.tg.strings[0].holes[1].sh && !E.tg.strings[0].holes[1].nr && (await p.locator("#tgList .lr.rdu").count()) === freed - 1);

/* ---------- 6) labels, zoom bar, pinch / pan ---------- */
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; const e = window.__bc.ED; st.aim = { x: 0, y: 0 };
  st.holes = [[0.1, 0.1], [0.18, 0.05], [0.12, 0.2], [0.02, 0.14], [0.2, 0.18], [0.08, 0.02], [0.15, 0.12], [-0.02, 0.06], [0.24, 0.1], [0.06, 0.24]].map((q, i) => ({ id: "L" + i, x: q[0], y: q[1], sh: null, nr: true }));
  window.__bc.openTgEd(st.id); });
await p.waitForTimeout(80); await svgIntoView();
const labelBoxes = () => p.evaluate(() => [...document.querySelectorAll("#tgSvg text.hn")].map(t => { const r = t.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, n: t.textContent, fs: parseFloat(t.getAttribute("font-size")) }; }));
const overlaps = bx => { let n = 0; for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) { const a = bx[i], c = bx[j], ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y); if (ox > 1 && oy > 1) n++; } return n; };
let LB = await labelBoxes();
ok("10 hole numbers in a tight group at ×1: legible (≥11 px) and not on top of each other", LB.length === 10 && LB.every(b => b.h >= 11) && overlaps(LB) === 0, JSON.stringify(LB.map(b => [b.n, Math.round(b.h), Math.round(b.x), Math.round(b.y)])));
ok("labels pushed out of a tight group get a leader line", (await p.locator("#tgSvg line.hl").count()) >= 1);
ok("zoom ＋/－/Fit live in a toolbar row above the target, not over it", await p.evaluate(() => { const z = document.getElementById("tgZbar"), w = document.getElementById("tgWrap"); return z && !w.contains(z) && z.getBoundingClientRect().bottom <= w.getBoundingClientRect().top + 0.5 && ["tgZin", "tgZout", "tgZfit"].every(id => z.contains(document.getElementById(id))); }) && (await small("#tgZbar button")).length === 0 && (await T("#tgZbar")).includes("Pinch to zoom"));
await p.click("#tgZin"); await p.click("#tgZin"); await p.waitForTimeout(40); LB = await labelBoxes();
ok("zoomed ×4: labels still ≥11 px, no overlaps", (await T("#tgZoomT")) === "×4" && LB.every(b => b.h >= 11) && overlaps(LB) === 0);
await p.click("#tgZfit"); await p.waitForTimeout(40);
ok("Fit returns to the whole sheet", (await T("#tgZoomT")) === "×1" && await p.isDisabled("#tgZfit"));
const vb = () => p.evaluate(() => document.getElementById("tgSvg").getAttribute("viewBox").split(" ").map(Number));
const PE = (type, id, x, y) => p.evaluate(([type, id, x, y]) => document.getElementById("tgSvg").dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: id === 11 })), [type, id, x, y]);
const nH = async () => (await ED()).tg.strings[0].holes.length, h0 = await nH();
const [cxp, cyp] = await sheetPt(1, 1);
await PE("pointerdown", 11, cxp - 30, cyp); await PE("pointerdown", 12, cxp + 30, cyp);
for (let k = 1; k <= 6; k++) { await PE("pointermove", 11, cxp - 30 - k * 15, cyp); await PE("pointermove", 12, cxp + 30 + k * 15, cyp); }
const zP = await p.evaluate(() => window.__bc.TE.zoom), vbP = await vb();
const [qx, qy] = await p.evaluate(([x, y]) => { const svg = document.getElementById("tgSvg"), q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse()); return [q.x, -q.y]; }, [cxp, cyp]);
ok("pinch zooms (×4 for 4× the finger spread) about the fingers' midpoint", near(zP, 4, 0.05) && near(qx, 1, 0.05) && near(qy, 1, 0.05), `z=${zP} mid→(${qx.toFixed(2)},${qy.toFixed(2)})`);
for (let k = 1; k <= 4; k++) { await PE("pointermove", 11, cxp - 120 - k * 10, cyp + k * 10); await PE("pointermove", 12, cxp + 120 - k * 10, cyp + k * 10); }
const vbQ = await vb();
ok("two-finger drag pans the zoomed view", vbQ[0] > vbP[0] + 0.01 && vbQ[1] < vbP[1] - 0.01 && near(await p.evaluate(() => window.__bc.TE.zoom), zP, 0.01), JSON.stringify([vbP, vbQ]));
await PE("pointerup", 12, cxp, cyp); await PE("pointerup", 11, cxp, cyp); await p.waitForTimeout(40);
ok("lifting after a pinch places no hole", (await nH()) === h0);
await PE("pointerdown", 11, cxp, cyp); await PE("pointerdown", 12, cxp + 50, cyp); await PE("pointermove", 12, cxp + 20, cyp); await PE("pointerup", 12, 0, 0); await PE("pointerup", 11, 0, 0); await p.waitForTimeout(40);
ok("a second finger cancels the first finger's pending tap", (await nH()) === h0);
await p.click("#tgZfit"); await svgIntoView(); await tap(-2, -2);
ok("single tap still adds a hole after pinching", (await nH()) === h0 + 1);
{ const [a, c] = await sheetPt(-2, -2); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(a - 30, c - 30, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(40); }
E = await ED(); const lastH = E.tg.strings[0].holes.at(-1);
const pxIn0 = await p.evaluate(() => window.__bc.TE.span / (window.__bc.TE.zoom || 1) / document.getElementById("tgSvg").clientWidth);
ok("…and drag still moves it", near(lastH.x - E.tg.strings[0].aim.x, -2 - 30 * pxIn0, 0.05 + 2 * pxIn0) && near(lastH.y - E.tg.strings[0].aim.y, -2 + 30 * pxIn0, 0.05 + 2 * pxIn0) && E.tg.strings[0].holes.length === h0 + 1, JSON.stringify([lastH, pxIn0]));
await p.click("#tgUndo"); await p.click("#tgUndo"); await p.waitForTimeout(40);
await p.evaluate(() => document.getElementById("tgEd").scrollTop = 0); await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.waitForTimeout(350);
await p.screenshot({ path: OUT + "screenshot-tg-target-edit.png" });

/* ---------- 7) Log thumbnails ---------- */
await setHoles(0, H5); await p.waitForTimeout(60);
await p.click("#tgEdDone"); await p.waitForTimeout(150); await p.click("#slSave").catch(() => {}); await p.waitForTimeout(200);
if (await vis("#slEditor")) { await p.click("#slEdClose"); await p.waitForTimeout(100); }
L = await LOG(); const MID = L.find(s => s.tg && s.source === "manual").id;
const G5 = (() => { let es = 0; for (const a of H5) for (const c of H5) es = Math.max(es, Math.hypot(a[0] - c[0], a[1] - c[1])); return es; })();
ok("log row shows a group thumbnail + size in inches and MOA/mil", await p.evaluate(id => { const b = document.querySelector(`.slTh[data-id="${id}"]`); return !!b && b.closest(".slRow") && b.querySelectorAll("svg.th g.hole").length === 5 && b.querySelectorAll("svg.th g.aim").length === 1; }, MID) && (await T(`.slTh[data-id="${MID}"] span`)) === `${G5.toFixed(2)}″ · ${(G5 / 18).toFixed(2)} mil`, await T(`.slTh[data-id="${MID}"] span`));
ok("sessions without holes get no thumbnail", (await p.locator('.slTh[data-id="old1"]').count()) === 0 && (await p.locator('.slItem[data-id="old1"]').count()) === 1);
ok("thumbnail is a ≥44px target", (await small(".slTh")).length === 0);
await p.evaluate(() => document.documentElement.scrollTop = 0); await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.waitForTimeout(350);
await p.evaluate(id => document.querySelector(`.slTh[data-id="${id}"]`).scrollIntoView({ block: "center" }), MID); await p.waitForTimeout(100);
await p.screenshot({ path: OUT + "screenshot-tg-log-thumb.png" });
await p.click(`.slTh[data-id="${MID}"]`); await p.waitForSelector("#slEditor.show"); await p.waitForTimeout(250);
ok("tapping the thumbnail opens the session at its target/overlay view", (await ED()).id === MID && await p.evaluate(() => { const r = document.getElementById("slTgView").getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && document.getElementById("slTgSvg"); }));
await p.click("#slEdClose"); await p.waitForTimeout(100);

/* ---------- AA (5 themes) + 360/412 clipping ---------- */
await p.click(`.slItem[data-id="${MID}"]`); await p.waitForSelector("#slEditor.show");
await p.evaluate(() => { const st = window.__bc.ED.tg.strings[0]; st.holes = st.holes.slice(0, 4); window.__bc.openTgEd(st.id); }); await p.waitForTimeout(60);
await p.click('#tgList .lr:not(.rdu) >> nth=0 >> .lrX'); await p.waitForTimeout(30);
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(30);
  const bad = (await colors(["#tgDialBox label", "#tgDialH", "#tgDialApp", "#tgDialD", "#tgDialV", "#tgVV", "#tgVV .pt", "#tgList .lsub", "#tgList .lmenu button", "#tgList .rv", "#tgList .rk", "#tgList .hn", "#tgZbar .zh", "#tgZoomT", "#tgZfit", ".tgl span", ".tgl small"])).filter(([, c, bg]) => cr(c, bg) < 4.5).map(([s, c, bg]) => `${s} ${cr(c, bg).toFixed(2)}`);
  ok(`${th}: new target-editor text AA`, !bad.length, JSON.stringify(bad.slice(0, 4)));
}
for (const w of [360, 412]) {
  await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(80);
  ok(`${w}px: editor with dial box, zoom bar and open ⋯ menu — no clipping`, (await overflow()).length === 0, JSON.stringify(await overflow()));
  await p.click('#tgMode button[data-v="meas"]'); await p.waitForTimeout(40);
  ok(`${w}px: measure panel with pre-fill note — no clipping`, (await overflow()).length === 0, JSON.stringify(await overflow()));
  await p.click("#tgMDone");
}
await p.click("#tgEdDone"); await p.waitForTimeout(100); await p.click("#slEdClose"); await p.waitForTimeout(100);
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(30);
  const bad = (await colors([".slTh span", "#slStats b", "#slStats span"])).filter(([, c, bg]) => cr(c, bg) < 4.5).map(([s, c, bg]) => `${s} ${cr(c, bg).toFixed(2)}`);
  ok(`${th}: Log thumbnail text AA`, !bad.length, JSON.stringify(bad));
}
await p.evaluate(() => document.documentElement.dataset.theme = "dark");
for (const w of [360, 412]) {
  await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(80);
  const ov = await p.evaluate(() => { const W = document.documentElement.clientWidth, bad = []; document.querySelectorAll("#slList *").forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > W + 0.5 || r.left < -0.5)) bad.push(e.className); }); return bad; });
  ok(`${w}px: Log list with thumbnails — no clipping`, ov.length === 0, JSON.stringify(ov.slice(0, 5)));
}
await p.setViewportSize({ width: 412, height: 915 });

/* ---------- data: dial + never-tapped flag persist, cleaned, survive the stable page ---------- */
const D0 = JSON.stringify((await LOG()).find(s => s.id === MID).tg.strings[0].dial);
await p.reload(); await ready(); L = await LOG(); let M = L.find(s => s.id === MID);
ok("reload keeps the dial with its clicks, tracking and conditions", JSON.stringify(M.tg.strings[0].dial) === D0 && M.tg.strings[0].dial.k === 1.05 && M.tg.strings[0].dial.c > 0 && M.tg.strings[0].dial.wx.yd === 500, D0);
ok("cleanDial rejects junk and clamps fields", await p.evaluate(() => { const c = window.__bc.cleanDial; const a = c({ e: "x" }), b = c({ e: 1.2, u: "zz", src: "?", k: 5, c: 11.6, wx: { temp: "hot", look: 99, yd: 500 } });
  return a === null && b.u === "MIL" && b.src === "user" && !("k" in b) && b.c === 12; }));
const q = await ctx.newPage(); hook(q);
await q.goto("http://localhost:8765/index-r31.html"); await ready(q);
await q.click("#tabBtnLog"); await q.click(`.slItem[data-id="${MID}"]`); await q.waitForSelector("#slEditor.show");
await q.click("#slEditor details > summary"); await q.fill("#slNotes", "stable edit"); await q.click("#slSave"); await q.waitForTimeout(300); await q.close();
await p.reload(); await ready(); L = await LOG(); M = L.find(s => s.id === MID);
ok("the dial comes back from the sidecar after a stable-page save", M.notes === "stable edit" && JSON.stringify(M.tg.strings[0].dial) === D0);
ok("old session still unchanged", JSON.stringify(L.find(s => s.id === "old1").shots) === JSON.stringify(OLD.shots) && !L.find(s => s.id === "old1").tg);
ok("no '.0 fps' anywhere on the Log tab", await p.evaluate(() => { document.getElementById("tabBtnLog").click(); return !/\d\.\d+ fps/.test(document.getElementById("tabLog")?.textContent || document.body.textContent); }));

console.log(`${pass} checks passed`);
console.log("ERRORS", JSON.stringify(errs));
await b.close();
