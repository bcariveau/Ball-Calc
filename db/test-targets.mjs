// Targets round: live shot banner (radar + manual), strings/targets, hole marking + loupe + undo, measure mode, pairing, per-string results,
// truing (vertical only) + zero correction, overlays, CSV, UX (44px / no clipping / AA contrast in 5 themes), migration + the stable page reading beta data.
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const LEGACY = fs.existsSync(OUT + "index.html") ? OUT + "index.html" : "/workspace/ballistic-calculator-pre-targets.html.bak";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", opticId: "o1", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] }],
  optics: [{ id: "o1", name: "Razor HD", opTurret: "0.1mil", opTurretV: "", opTurretU: "mil", opReticle: "mil", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.75", opWTravel: "", opTrack: "" }],
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

await p.goto(URL_); await ready();

/* ---------- migration: old session loads unchanged ---------- */
let L = await LOG();
const o1 = L.find(s => s.id === "old1");
ok("old session loads with its shots unchanged", JSON.stringify(o1.shots) === JSON.stringify(OLD.shots), JSON.stringify(o1.shots));
ok("old session gets no new fields on load (no tg, no shot ids)", !("tg" in o1) && o1.shots.every(x => !x.id && !x.str && !x.x && !x.fl));
ok("old session is viewed as 1 target, 1 string", await p.evaluate(() => { const v = window.__bc.tgView(window.__bc.log.find(s => s.id === "old1")); return v.targets.length === 1 && v.strings.length === 1 && v.strings[0].holes.length === 0; }));
await p.click("#tabBtnLog"); await p.click('.slItem[data-id="old1"]'); await p.waitForSelector("#slEditor.show");
ok("old session editor header reads String 1 · Target A", (await T("#tgHdrT")) === "String 1 · Target A" && (await T("#tgHdrS")).startsWith("3 shots · 0 holes"));
ok("old session shot rows keep Cold/Clean/note buttons (+ Flier, discard)", (await p.locator('#slShots .shot button[data-f="cold"]').count()) === 3 && (await p.locator('#slShots .shot button[data-f="fl"]').count()) === 3 && (await p.locator('#slShots .shot button[data-f="x"]').count()) === 3);
await p.click("#slEdClose"); await p.waitForTimeout(100);
ok("viewing an old session doesn't rewrite it", JSON.stringify((await LOG()).find(s => s.id === "old1").shots) === JSON.stringify(OLD.shots));

/* ---------- 1) live shot banner: radar ---------- */
await p.click("#radarConnect"); await p.waitForTimeout(250);
ok("wake lock requested while the radar is connected", await p.evaluate(() => window.__wl.req === 1 && window.__wl.active));
await p.evaluate(a => window.__fake.send(a), PA); await p.waitForTimeout(250);
const bt = () => p.evaluate(() => window.__bc.log.filter(s => s.source === "bluetooth"));
let B = await bt();
ok("radar shot lands in a live session without opening the editor", B.length === 1 && B[0].shots.length === 1 && !(await vis("#slEditor")));
ok("banner shows on top, floating (not a modal)", await vis("#shotBan") && await p.evaluate(() => { const e = document.getElementById("shotBan"), r = e.getBoundingClientRect(); return getComputedStyle(e).position === "fixed" && r.top < 20 && !e.closest("[aria-modal]") && e.getAttribute("role") === "status"; }));
const v1 = B[0].shots[0].v;
ok("banner: big speed + shot number + string/target", (await T("#sbV")) === v1.toFixed(1) && (await T("#sbN")) === "Shot 1 · String 1 · Target A" && await p.evaluate(() => parseFloat(getComputedStyle(document.getElementById("sbV")).fontSize) >= 36));
await p.evaluate(a => window.__fake.send(a), PB); await p.waitForTimeout(250);
B = await bt(); const v2 = B[0].shots[1].v, avg2 = (v1 + v2) / 2;
ok("banner: running avg / ES / SD of the string", (await T("#sbN")).startsWith("Shot 2") && (await T("#sbSt")).includes(`avg ${avg2.toFixed(1)}`) && (await T("#sbSt")).includes(`ES ${Math.abs(v1 - v2).toFixed(1)}`), await T("#sbSt"));
ok("banner doesn't block the page (tabs still work under it)", await (async () => { await p.click("#tabBtnDope"); const a = await p.evaluate(() => document.body.dataset.tab === "dope" && !document.getElementById("shotBan").hidden); await p.click("#tabBtnLog"); return a; })());
await p.click('#sbActs button[data-a="x"]'); await p.waitForTimeout(150);
B = await bt();
ok("Discard: shot kept + flagged, out of the stats", B[0].shots.length === 2 && B[0].shots[1].x === true && B[0].stats.n === 1 && (await T('#sbActs button[data-a="x"]')).includes("Restore") && await p.evaluate(() => document.getElementById("shotBan").classList.contains("dis")));
await p.click('#sbActs button[data-a="x"]'); await p.waitForTimeout(150); B = await bt();
ok("Restore undoes the discard", !B[0].shots[1].x && B[0].stats.n === 2);
await p.click('#sbActs button[data-a="cold"]'); await p.click('#sbActs button[data-a="fl"]'); await p.waitForTimeout(150); B = await bt();
ok("Cold bore + Flier tags from the banner", B[0].shots[1].cold === true && B[0].shots[1].fl === true && !B[0].shots[1].clean && await p.getAttribute('#sbActs button[data-a="cold"]', "aria-pressed") === "true");
await p.click('#sbActs button[data-a="clean"]'); await p.waitForTimeout(100); await p.click('#sbActs button[data-a="clean"]'); await p.waitForTimeout(100); B = await bt();
ok("Clean bore toggles on and off", !B[0].shots[1].clean);
ok("banner targets are ≥44px", (await small("#shotBan button:not([hidden])")).length === 0, JSON.stringify(await small("#shotBan button:not([hidden])")));
await p.waitForTimeout(5800);
ok("banner fades on its own after ~5 s (shot stays saved)", !(await vis("#shotBan")) && (await bt())[0].shots.length === 2);
await p.evaluate(a => window.__fake.send(hex => hex, a), PB);   // no-op (dupe guard is radar-side)
// tapping the banner opens the session
await p.evaluate(() => { const L = window.__bc.log.find(s => s.source === "bluetooth"); window.__bc.mutSess(L.id, () => {}); });
const C = [0x80,0x1C,0x22,0x03,0x26,0x10,0x31,0x20,0x35,0x05,0x04,0x50,0xC8,0x02,0xC8,0x02,0xC8,0x02,0xC8,0x02,0,0,0,0,0,0,0xE3,0x01,0x8D,0x03];
await p.evaluate(a => window.__fake.send(a), C); await p.waitForTimeout(250);
ok("next radar shot brings the banner back", await vis("#shotBan") && (await T("#sbN")).startsWith("Shot 3"));
await p.evaluate(() => { document.documentElement.scrollTop = 0; });
await p.screenshot({ path: OUT + "screenshot-tg-banner.png" });
await p.click("#sbMain"); await p.waitForSelector("#slEditor.show");
ok("tapping the banner opens that session; banner docks in the editor", (await ED()).source === "bluetooth" && (await ED()).shots.length === 3 && await p.evaluate(() => document.getElementById("shotBan").parentElement.id === "sbDock" && getComputedStyle(document.getElementById("shotBan")).position === "static"));
await p.evaluate(a => window.__fake.send(a), [0x80,0x1C,0x22,0x04,0x26,0x10,0x31,0x20,0x36,0x05,0x04,0x50,0xCE,0x02,0xCE,0x02,0xCE,0x02,0xCE,0x02,0,0,0,0,0,0,0xE3,0x01,0x8D,0x03]); await p.waitForTimeout(250);
ok("with the session open, radar shots go into the open editor + docked banner", (await ED()).shots.length === 4 && (await T("#sbN")).startsWith("Shot 4") && (await bt())[0].shots.length === 4);
await p.click("#slEdClose"); await p.waitForTimeout(100);
ok("closing the editor hides the docked banner", !(await vis("#shotBan")));
await p.click("#radarDisconnect"); await p.waitForTimeout(200);
ok("wake lock released when the radar disconnects", await p.evaluate(() => window.__wl.rel === 1 && !window.__wl.active));

/* ---------- 1b) manual add banner + 2) strings / targets ---------- */
await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show");
const add = async v => { await p.fill("#slVel", String(v)); await p.click("#slAdd"); await p.waitForTimeout(40); };
await add(2700);
ok("manual add shows the banner (docked in the open editor)", await vis("#shotBan") && (await T("#sbV")) === "2700.0" && (await T("#sbN")) === "Shot 1 · String 1 · Target A");
for (const v of [2690, 2680, 2710, 2685]) await add(v);
ok("banner follows manual adds", (await T("#sbN")).startsWith("Shot 5") && (await T("#sbSt")).includes("avg 2693.0"), await T("#sbSt"));
await p.click("#tgNewStr"); await p.waitForTimeout(100);
let E = await ED();
ok("New string: same sheet, String 2 · Target A", (await T("#tgHdrT")) === "String 2 · Target A" && E.tg.strings.length === 2 && E.tg.strings[1].tid === E.tg.strings[0].tid && E.tg.targets.length === 1);
ok("unmarked string → toast offers Mark holes (non-modal)", (await T("#toast")).includes("no holes marked") && await vis("#toastAct"));
ok("earlier shots belong to string 1 (ids assigned)", E.shots.every(x => x.id) && E.shots.every(x => !x.str || x.str === E.tg.strings[0].id));
for (const v of [2702, 2698]) await add(v);
E = await ED();
ok("new shots join string 2", E.shots.slice(5).every(x => x.str === E.tg.strings[1].id) && (await T("#sbN")) === "Shot 2 · String 2 · Target A");
await p.click("#tgNewTgt"); await p.waitForTimeout(100); E = await ED();
ok("New target: fresh sheet, String 3 · Target B", (await T("#tgHdrT")) === "String 3 · Target B" && E.tg.targets.length === 2 && E.tg.strings[2].tid === E.tg.targets[1].id);
for (const v of [2705, 2695, 2700]) await add(v);
ok("shot list groups by string with string stats", (await p.locator("#slShots .sgh").count()) === 3 && (await T("#slShots .sgh")).startsWith("String 3"));
await p.click("#slSave"); await p.waitForTimeout(200);
L = await LOG(); let M = L.find(s => s.tg && s.source === "manual"); const MID = M.id;
ok("saved session keeps strings/targets + string ids", M.tg.strings.length === 3 && M.shots.filter(x => x.str === M.tg.strings[2].id).length === 3 && M.stats.n === 10);

/* ---------- 3) mark holes ---------- */
const openS = async () => { await p.click(`.slItem[data-id="${MID}"]`); await p.waitForSelector("#slEditor.show"); };
await openS();
await p.selectOption("#slEditor select, #tgStrSel", { index: 0 }).catch(() => {});
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[0].id)); await p.waitForSelector("#tgEd.show");
ok("target editor opens on String 1 asking for the aim point", (await T("#tgEdT")) === "String 1 · Target A" && (await T("#tgTip")).includes("aim point") && await p.getAttribute('#tgMode button[data-v="aim"]', "aria-pressed") === "true");
ok("distance defaults to the current target distance", (await p.inputValue("#tgDist")) === "500");
await p.fill("#tgDist", "100"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(80);
const grid = () => p.evaluate(() => { const g = document.querySelector("#tgSvg .grid"); return { step: +g.dataset.step, unit: g.dataset.unit }; });
await p.selectOption("#tgTpl", "moa"); await p.waitForTimeout(50); let g1 = await grid();
await p.fill("#tgDist", "300"); await p.press("#tgDist", "Tab"); await p.waitForTimeout(50); let g3 = await grid();
ok("MOA grid is true angular size (1.047″ @100, 3.14″ @300)", near(g1.step, 1.0472, 0.001) && near(g3.step, 3.1416, 0.002) && g1.unit === "MOA", JSON.stringify([g1, g3]));
await p.selectOption("#tgTpl", "mil"); await p.waitForTimeout(50); let gm = await grid();
ok("MIL grid scales (0.2 mil = 2.16″ @300)", near(gm.step, 2.16, 0.002), JSON.stringify(gm));
await p.selectOption("#tgTpl", "steel"); await p.waitForTimeout(50);
ok("steel plate template (≥6″ or 2 MOA)", (await p.textContent("#tgSvg .pll")).includes("6″ plate"));
await p.selectOption("#tgTpl", "bull"); await p.waitForTimeout(50);
ok("bullseye template draws rings", (await p.locator("#tgSvg circle.b1, #tgSvg circle.b2").count()) === 6);
await p.fill("#tgDist", "100"); await p.press("#tgDist", "Tab"); await p.selectOption("#tgTpl", "grid1"); await p.waitForTimeout(50);
ok("1″ grid", (await grid()).step === 1 && (await grid()).unit === "in");
ok("template/distance/units controls are ≥44px", (await small("#tgEd select, #tgEd input:not([type=checkbox]), #tgEd #tgMode button, #tgEd #tgEdDone")).length === 0, JSON.stringify(await small("#tgEd select, #tgEd input, #tgEd button")));
await svgIntoView();
await tap(0, 0);
E = await ED();
ok("tap sets the aim point, then switches to holes", E.tg.strings[0].aim && near(E.tg.strings[0].aim.x, 0, 0.08) && near(E.tg.strings[0].aim.y, 0, 0.08) && await p.getAttribute('#tgMode button[data-v="hole"]', "aria-pressed") === "true");
const HOLES = [[0.2, 0.1], [-0.3, -0.2], [0.1, -0.5], [-0.1, 0.3], [0.4, -0.4]];
// drag with loupe for hole 1
{ const [a, c] = await sheetPt(1.5, 1.5), [a2, c2] = await sheetPt(...HOLES[0]); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move((a + a2) / 2, (c + c2) / 2, { steps: 3 });
  ok("magnifier loupe shows above the finger while placing", await vis("#tgLoupe") && await p.evaluate(([y]) => document.getElementById("tgLoupe").getBoundingClientRect().bottom < y, [(c + c2) / 2]));
  await p.mouse.move(a2, c2, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(50); }
ok("loupe hides on release", !(await vis("#tgLoupe")));
for (const h of HOLES.slice(1)) await tap(...h);
E = await ED(); let s1 = E.tg.strings[0];
ok("5 holes, numbered in tap order", s1.holes.length === 5 && (await p.locator("#tgSvg g.hole").evaluateAll(es => es.filter(e => e.dataset.h).map(e => e.dataset.n).join(","))) === "1,2,3,4,5");
ok("tapped positions land where tapped (drag-placed hole 1 too)", s1.holes.every((h, i) => near(h.x - s1.aim.x, HOLES[i][0], 0.09) && near(h.y - s1.aim.y, HOLES[i][1], 0.09)), JSON.stringify(s1.holes.map(h => [h.x, h.y])));
ok("holes auto-pair to readings in order (stored explicitly)", s1.holes.map(h => E.shots.find(x => x.id === h.sh)?.v).join(",") === "2700,2690,2680,2710,2685");
await tap(2, 2); E = await ED();
ok("extra tap adds an unpaired hole 6", E.tg.strings[0].holes.length === 6 && E.tg.strings[0].holes[5].sh === null);
await p.click("#tgUndo"); await p.waitForTimeout(50); E = await ED();
ok("Undo removes it", E.tg.strings[0].holes.length === 5);
// drag an existing hole
{ const [a, c] = await sheetPt(...HOLES[4]), [a2, c2] = await sheetPt(0.6, -0.6); await p.mouse.move(a, c); await p.mouse.down(); await p.mouse.move(a2, c2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(50); }
E = await ED(); s1 = E.tg.strings[0];
ok("drag moves a hole", near(s1.holes[4].x - s1.aim.x, 0.6, 0.09) && near(s1.holes[4].y - s1.aim.y, -0.6, 0.09));
await p.click("#tgUndo"); await p.waitForTimeout(50); E = await ED(); s1 = E.tg.strings[0];
ok("Undo restores the drag", near(s1.holes[4].x - s1.aim.x, 0.4, 0.09));
ok("tapped holes show 👆", (await p.locator("#tgHoles .hc i").allTextContents()).every(t => t === "👆"));
await p.evaluate(() => document.getElementById("tgEd").scrollTop = 0);
await p.screenshot({ path: OUT + "screenshot-tg-target-edit.png" });

/* ---------- 4) measure mode ---------- */
const MEAS = [["R", "1.25", "D", "0.9"], ["R", "0.7", "D", "1.2"], ["R", "1.1", "D", "1.5"], ["R", "0.9", "D", "0.7"], ["R", "1.4", "D", "1.4"]];   // low-right group
await p.click('#tgMode button[data-v="meas"]'); await p.waitForTimeout(80);
ok("measure mode steps: Hole 1 of 5", (await T("#tgMeasT")).startsWith("Hole 1 of 5"));
ok("direction toggles are words/arrows (no minus signs) + in/cm", (await T("#tgMH")).includes("L") && (await T("#tgMV")).includes("U") && !(await T("#tgMeas")).includes("−") && !(await T("#tgMeas .mval")).includes("-") && (await T("#tgMU")).includes("cm"));
const key = async s => { for (const ch of s) await p.click(`#tgKeys button[data-k="${ch === "<" ? "back" : ch}"]`); };
for (let i = 0; i < 5; i++) {
  const [hd, hx, vd, vy] = MEAS[i];
  await p.click(`#tgMH button[data-v="${hd}"]`); await p.click("#tgMX"); if (i === 0) { await key("9<"); } await key(hx);
  await p.click(`#tgMV button[data-v="${vd}"]`); await p.click("#tgMY"); await key(vy);
  if (i === 2) { await p.screenshot({ path: OUT + "screenshot-tg-measure.png" }); ok("measure: big Next/Done stay in the sheet", await vis("#tgMNext") && await vis("#tgMDone") && (await small("#tgMeas button")).length === 0); }
  if (i < 4) { await p.click("#tgMNext"); await p.waitForTimeout(40); ok(`Next → Hole ${i + 2} of 5 (sheet stays open)`, (await T("#tgMeasT")).startsWith(`Hole ${i + 2} of 5`) && await vis("#tgEd")); }
}
await p.click("#tgMDone"); await p.waitForTimeout(60); E = await ED(); s1 = E.tg.strings[0];
const sg = { L: -1, R: 1, D: -1, U: 1 }, EXP = MEAS.map(([hd, hx, vd, vy]) => ({ x: sg[hd] * +hx, y: sg[vd] * +vy }));
ok("measured offsets stored (aim → hole center, R/U positive)", s1.holes.every((h, i) => h.m && near(h.m.x, EXP[i].x, 1e-6) && near(h.m.y, EXP[i].y, 1e-6)), JSON.stringify(s1.holes.map(h => h.m)));
ok("Done measuring returns to holes; measured markers show 📏 + dashed ring", (await p.getAttribute('#tgMode button[data-v="hole"]', "aria-pressed")) === "true" && (await p.locator("#tgHoles .hc i").allTextContents()).every(t => t === "📏") && (await p.locator("#tgSvg g.hole.meas").count()) >= 5);
// cm entry on hole 1
await p.click('#tgMode button[data-v="meas"]');
ok("measure resumes on the selected hole (5)", (await T("#tgMeasT")).startsWith("Hole 5 of 5"));
await p.click('#tgHoles .hc >> nth=0'); ok("tapping hole chip 1 jumps to it", (await T("#tgMeasT")).startsWith("Hole 1 of 5"));
await p.click('#tgMU button[data-v="cm"]');
ok("switching to cm converts the shown value", /^3\.1[78] cm$/.test(await T("#tgMX")), await T("#tgMX"));
await p.click("#tgMX"); await key("<<<<"); await key("1.27"); await p.click("#tgMDone"); E = await ED();
ok("cm entry is stored in inches (1.27 cm = 0.5″)", near(E.tg.strings[0].holes[0].m.x, 0.5, 1e-3) && E.tg.targets[0].u === "cm");
await p.click("#tgUndo"); await p.waitForTimeout(40); E = await ED();
ok("Undo reverts the measurement", near(E.tg.strings[0].holes[0].m.x, 1.25, 1e-6));
await p.selectOption("#tgU", "in"); await p.waitForTimeout(40);

/* ---------- 6) results ---------- */
const gs = pts => { const n = pts.length, cx = pts.reduce((a, q) => a + q.x, 0) / n, cy = pts.reduce((a, q) => a + q.y, 0) / n; let es = 0; for (const a of pts) for (const c of pts) es = Math.max(es, Math.hypot(a.x - c.x, a.y - c.y)); return { cx, cy, es, mr: pts.reduce((a, q) => a + Math.hypot(q.x - cx, q.y - cy), 0) / n }; };
let G = gs(EXP);
ok("group size (c-c) from measured offsets", (await T("#tgResES")) === `${G.es.toFixed(2)}″` && (await T("#tgRes .resG small")).includes(`${(G.es / 3.6).toFixed(2)} mil`), `${await T("#tgResES")} vs ${G.es.toFixed(3)} / ${await T("#tgRes .resG small")}`);
ok("mean radius", (await T("#tgResMR")) === `${G.mr.toFixed(2)}″`);
ok("center offset from aim in in + mil (U/D, L/R words)", (await T("#tgResC")) === `D ${Math.abs(G.cy).toFixed(2)}″ · R ${G.cx.toFixed(2)}″` && (await T("#tgResCA")).includes(`D ${(Math.abs(G.cy) / 3.6).toFixed(2)} mil`), await T("#tgResC"));
ok("velocity-vs-vertical flagged (fast high / slow low, ≥3 paired)", (await T("#tgVV")).includes("Fast shots printed high"), await T("#tgVV"));
ok("at the zero distance: zero correction in clicks, both axes", await vis("#tgZero") && (await T("#tgZero")).includes(`U ${Math.round(Math.abs(G.cy) / 3.6 / 0.1)}`) && (await T("#tgZero")).includes(`L ${Math.round(G.cx / 3.6 / 0.1)}`) && (await T("#tgZero")).includes("0.1 mil"), await T("#tgZero"));
ok("no truing button at the zero distance", !(await vis("#tgTrue")));

/* ---------- 5) pairing ---------- */
const readsTxt = () => p.locator("#tgReads .rd").evaluateAll(es => es.map(e => e.querySelector(".hn").textContent + ":" + e.querySelector(".rv").textContent));
ok("readings listed, numbered to match holes", (await readsTxt()).join(",") === "1:2700.0 fps,2:2690.0 fps,3:2680.0 fps,4:2710.0 fps,5:2685.0 fps", (await readsTxt()).join(","));
await p.click('#tgHoles .hc >> nth=1'); await p.waitForTimeout(30);
ok("tap a hole selects it", (await T("#tgHoleActT")).includes("Hole 2 selected"));
await p.click("#tgReads .rd >> nth=3 >> .rdPick"); await p.waitForTimeout(40); E = await ED(); s1 = E.tg.strings[0];
const vOf = h => E.shots.find(x => x.id === h.sh)?.v ?? null;
ok("tap a reading re-pairs: hole 2 ↔ 2710, hole 4 freed (no cascade)", vOf(s1.holes[1]) === 2710 && s1.holes[3].sh === null && vOf(s1.holes[0]) === 2700 && vOf(s1.holes[2]) === 2680 && vOf(s1.holes[4]) === 2685);
ok("freed reading shows no hole number", (await readsTxt()).join(",") === "1:2700.0 fps,–:2690.0 fps,3:2680.0 fps,2:2710.0 fps,5:2685.0 fps", (await readsTxt()).join(","));
await p.click('#tgHoles .hc >> nth=3'); await p.click("#tgNoRd"); await p.waitForTimeout(30); E = await ED();
ok("hole marked 'no reading'", E.tg.strings[0].holes[3].nr === true && (await T('#tgHoles .hc >> nth=3')).includes("no reading"));
await p.fill("#tgAddV", "2706"); await p.click("#tgAddShot"); await p.waitForTimeout(40); E = await ED();
ok("+ Add shot with a typed velocity adds a paired hole + reading", E.tg.strings[0].holes.length === 6 && vOf.call(null, E.tg.strings[0].holes[5]) === 2706 || E.shots.find(x => x.id === E.tg.strings[0].holes[5].sh)?.v === 2706);
await p.click("#tgAddShot"); await p.waitForTimeout(40); E = await ED();
ok("+ Add shot blank adds a hole with no reading", E.tg.strings[0].holes.length === 7 && E.tg.strings[0].holes[6].nr === true && E.tg.strings[0].holes[6].sh === null);
ok("the added hole is selected, ready to drag/measure/remove", (await T("#tgHoleActT")).includes("Hole 7 selected"));
await p.click("#tgDelHole"); await p.waitForTimeout(30); E = await ED();
ok("remove hole", E.tg.strings[0].holes.length === 6);
await p.click("#tgReads .rd >> nth=1 >> .rdX"); await p.waitForTimeout(40); E = await ED();
const dbl = E.shots.find(x => x.v === 2690);
ok("double read discarded: stays listed, grayed, out of stats", dbl.x === true && (await p.locator("#tgReads .rd.dis").count()) === 1 && await p.evaluate(() => window.__bc.ED && true) && (await p.evaluate(() => { const e = window.__bc.ED; return e.shots.filter(x => !x.x).length; })) === E.shots.length - 1);
await p.evaluate(() => document.getElementById("tgHoles").scrollIntoView({ block: "start" }));
await p.click('#tgHoles .hc >> nth=0'); await p.waitForTimeout(30);
await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.waitForTimeout(350); await p.screenshot({ path: OUT + "screenshot-tg-pairing.png" });
await p.click('#tgHoles .hc >> nth=0');
ok("pairing controls ≥44px", (await small("#tgHoles .hc, #tgReads button, #tgTools button, #tgTools input")).length === 0, JSON.stringify(await small("#tgHoles .hc, #tgReads button, #tgTools button, #tgTools input")));
await p.click("#tgEdDone"); await p.waitForTimeout(150);
ok("Done saves (session not new) and returns to the session", !(await vis("#tgEd")) && await vis("#slEditor") && (await LOG()).find(s => s.id === MID).tg.strings[0].holes.length === 6);
ok("discarded reading is out of the session stats", (await LOG()).find(s => s.id === MID).stats.n === 10 && (await LOG()).find(s => s.id === MID).shots.length === 11, String((await LOG()).find(s => s.id === MID).stats.n));

/* ---------- truing (string 3 @ 300 yd) ---------- */
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[2].id)); await p.waitForSelector("#tgEd.show");
await p.fill("#tgDist", "300"); await p.press("#tgDist", "Tab"); await svgIntoView(); await tap(0, 0);
const vbW = () => p.evaluate(() => +document.getElementById("tgSvg").getAttribute("viewBox").split(" ")[2]);
const w0 = await vbW(); await p.click("#tgZin"); await p.click("#tgZin"); await p.waitForTimeout(40);
ok("zoom ＋ ×4 magnifies around the aim point for tight groups", near(await vbW(), w0 / 4, 0.01) && (await T("#tgZoomT")) === "×4" && (await small("#tgZoom button")).length === 0);
for (const h of [[0.5, 1.0], [-0.4, 0.8], [0.3, 1.2]]) await tap(...h);
ok("touching holes at 300 yd still add (3 holes)", (await ED()).tg.strings[2].holes.length === 3);
await p.click('#tgMode button[data-v="meas"]');
for (const [x, y] of [["0.5", "1"], ["0.4", "0.8"], ["0.3", "1.2"]]) { await p.click("#tgMX"); await key("<<<<<<" + x); await p.click('#tgMV button[data-v="U"]'); await p.click("#tgMY"); await key("<<<<<<" + y); await p.click("#tgMNext"); }
await p.click("#tgMDone"); await p.waitForTimeout(40);
ok("off the zero distance: truing offered, disabled until confirmed", await vis("#tgTrue") && await p.isDisabled("#tgTrue") && !(await vis("#tgZero")));
ok("truing sends vertical only (horizontal note)", (await T("#tgRes")).includes("Only the vertical offset is sent") && (await T("#tgRes")).includes("mostly wind") && (await T("#tgTrue")).includes("D 0.09 mil"), await T("#tgTrue"));
await p.check("#tgAtDist"); await p.waitForTimeout(30);
ok("confirm checkbox enables it", !(await p.isDisabled("#tgTrue")));
await p.click("#tgTrue"); await p.waitForSelector("#trSheet.show"); await p.waitForTimeout(500);
const trO = +(await p.inputValue("#trObs")), trR = +(await p.inputValue("#trRange")), pred = +((await T("#trOut")).match(/app's ([\d.]+) mil/) || [])[1];
ok("Truing opens at 300 yd with observed = predicted − 1.0″ high", trR === 300 && near(trO, pred - 1.0 / 10.8, 0.011) && (await T("#trOut")).includes("Vertical only"), `${trO} ${pred}`);
await p.keyboard.press("Escape"); await p.waitForTimeout(150);
await p.evaluate(() => { document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")); document.body.style.overflow = ""; });

/* ---------- 7) overlays ---------- */
await p.click("#tabBtnLog"); await openS();
await p.evaluate(() => document.getElementById("slTgView").scrollIntoView({ block: "start" }));
ok("overlay chips per string with holes (color + shape)", (await p.locator("#slTgView .sc").count()) === 2 && await p.evaluate(() => { const g = [...document.querySelectorAll("#slTgView .sc .mk g")].map(e => e.className.baseVal + "|" + e.firstElementChild.tagName); return new Set(g).size === g.length; }));
ok("mixed distances plot in mil with a note", (await T("#slTgNote")).includes("different distances (100, 300 yd)") && (await T("#slTgNote")).includes("mil"), await T("#slTgNote"));
ok("overlays align on aim points (aim drawn at 0,0)", await p.evaluate(() => [...document.querySelectorAll("#slTgSvg g.aim circle")].every(c => +c.getAttribute("cx") === 0 && +c.getAttribute("cy") === 0)) && (await p.locator("#slTgSvg g.aim").count()) === 2);
await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.waitForTimeout(350); await p.screenshot({ path: OUT + "screenshot-tg-overlay.png" });
await p.click("#slTgView .sc >> nth=1"); await p.waitForTimeout(40);
ok("hiding a string leaves one, back in inches", (await p.locator("#slTgSvg g.aim").count()) === 1 && (await T("#slTgNote")).includes("grid") && !(await T("#slTgNote")).includes("different"));
await p.click("#slTgView .sc >> nth=0"); await p.waitForTimeout(40);
ok("all hidden → prompt to show", (await T("#slTgView")).includes("All strings hidden"));
await p.click("#slTgView .sc >> nth=0"); await p.click("#slTgView .sc >> nth=1");
ok("overlay chips ≥44px", (await small("#slTgView .sc, #slStrBar button, #slShots button")).length === 0, JSON.stringify(await small("#slTgView .sc, #slStrBar button, #slShots button")));

/* ---------- UX: contrast in 5 themes, clipping at 360/412 ---------- */
const TXT = ["#tgHdrT", "#tgHdrS", "#slTgView .sc", "#slShots .sgh", "#slShots .sgh small", "#slShots .shot .v", "#slShots .tg", "#slTgNote", "#slStrBar button", ".tgChk span"];
const markerCR = () => p.evaluate(() => { const cs = getComputedStyle(document.documentElement), out = []; const card = cs.getPropertyValue("--card").trim(); for (let i = 1; i <= 6; i++) out.push([i, cs.getPropertyValue("--s" + i).trim(), card]); return out; });
const toRGB = h => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; };
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(40);
  const bad = (await colors(TXT)).filter(([, c, bg]) => cr(c, bg) < 4.5).map(([s, c, bg]) => `${s} ${cr(c, bg).toFixed(2)}`);
  const mk = (await markerCR()).map(([i, c, card]) => [i, cr(toRGB(c), toRGB(card))]).filter(([, r]) => r < 3);
  ok(`${th}: session targets UI text AA, string colors ≥3:1 on the sheet`, !bad.length && !mk.length, JSON.stringify([bad.slice(0, 4), mk]));
}
await p.evaluate(() => document.documentElement.dataset.theme = "dark");
await p.evaluate(() => window.__bc.openTgEd(window.__bc.ED.tg.strings[0].id)); await p.waitForSelector("#tgEd.show");
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(30);
  const bad = (await colors(["#tgEdT", "#tgTip", "#tgHoles .hc", "#tgReads .rv", "#tgReads .rk", "#tgReads .hn", "#tgReads .rdX", "#tgRes .resG span", "#tgRes .resG b", "#tgRes .resG small", "#tgRes .zc", "#tgRes .hint", "#tgMode button", "#tgEd label"])).filter(([, c, bg]) => cr(c, bg) < 4.5).map(([s, c, bg]) => `${s} ${cr(c, bg).toFixed(2)}`);
  ok(`${th}: target editor text AA`, !bad.length, JSON.stringify(bad.slice(0, 4)));
}
await p.click('#tgMode button[data-v="meas"]');
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(30);
  const bad = (await colors(["#tgMeasT", "#tgMeas .seg button", "#tgMeas .mval", "#tgKeys button", "#tgMeas .nav button"])).filter(([, c, bg]) => cr(c, bg) < 4.5).map(([s, c, bg]) => `${s} ${cr(c, bg).toFixed(2)}`);
  ok(`${th}: measure panel AA`, !bad.length, JSON.stringify(bad.slice(0, 4)));
}
await p.click("#tgMDone");
for (const w of [360, 412]) {
  await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(80);
  ok(`${w}px: target editor has no horizontal clipping`, (await overflow()).length === 0, JSON.stringify(await overflow()));
  await p.click('#tgMode button[data-v="meas"]'); await p.waitForTimeout(40);
  ok(`${w}px: measure panel has no horizontal clipping`, (await overflow()).length === 0, JSON.stringify(await overflow()));
  await p.click("#tgMDone");
}
await p.click("#tgEdDone"); await p.waitForTimeout(100);
await p.setViewportSize({ width: 360, height: 800 });
ok("360px: session editor (string bar, shots, overlay) no clipping", (await overflow()).length === 0, JSON.stringify(await overflow()));
await p.click("#slEdClose"); await p.waitForTimeout(80);
await p.evaluate(() => { const L = window.__bc.log.find(s => s.source === "bluetooth"); window.__bc.BAN.sid = L.id; window.__bc.BAN.shid = L.shots[3].id; });
await p.evaluate(() => window.__bc.mutSess(window.__bc.BAN.sid, () => {})); await p.evaluate(() => { const b = window.__bc.BAN; window.__bc.banHide(); });
await p.evaluate(async () => { const L = window.__bc.log.find(s => s.source === "bluetooth"); await window.__bc.addShotsToLiveSession([2711], { source: "bluetooth", open: false }); });
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.evaluate(t => document.documentElement.dataset.theme = t, th); await p.waitForTimeout(30);
  const bad = (await colors(["#sbV", "#sbN", "#sbSt", "#sbActs button:not([hidden])"])).filter(([, c, bg]) => cr(c, bg) < 4.5).map(([s, c, bg]) => `${s} ${cr(c, bg).toFixed(2)}`);
  ok(`${th}: banner text AA`, !bad.length, JSON.stringify(bad));
}
await p.evaluate(() => document.documentElement.dataset.theme = "dark");
ok("360px: banner fits (no clipping), all buttons ≥44px", (await overflow()).length === 0 && (await small("#shotBan button:not([hidden])")).length === 0, JSON.stringify(await overflow()));
await p.evaluate(() => window.__bc.banHide()); await p.setViewportSize({ width: 412, height: 915 });

/* ---------- Mark each shot ---------- */
await openS();
await p.check("#tgMarkEach"); await p.waitForTimeout(60);
await p.click("#tgNewStr"); await p.waitForTimeout(60);
await add(2699);
ok("Mark each shot adds Mark impact to the banner", await vis('#sbActs button[data-a="mark"]'));
await p.click('#sbActs button[data-a="mark"]'); await p.waitForSelector("#tgEd.show"); await svgIntoView();
E = await ED(); const s4 = E.tg.strings[3];
ok("Mark impact opens the target on that string", (await T("#tgEdT")).startsWith("String 4") && (await T("#tgTip")).includes("aim point"));
await tap(0, 0); ok("…then asks for shot 1's hole", (await T("#tgTip")).includes("shot 1 hit"), await T("#tgTip"));
await tap(0.3, 0.3); E = await ED();
ok("…and pairs that hole to the shot", E.tg.strings[3].holes.length === 1 && E.shots.find(x => x.id === E.tg.strings[3].holes[0].sh)?.v === 2699);
await p.click("#tgEdDone"); await p.click("#slSave"); await p.waitForTimeout(150);

/* ---------- CSV ---------- */
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#slCsvBtn")]);
const csv = fs.readFileSync(await dl.path(), "utf8").replace(/^\ufeff/, ""), hdr = csv.split("\n")[0].split(",");
ok("CSV appends strings/targets/discarded/shot_detail columns", hdr.slice(-4).join(",") === "strings,targets,discarded_shots,shot_detail" && hdr.indexOf("mv_at_powder_temp") === hdr.length - 5);
const row = csv.split("\n").find(r => r.includes("S1/A@100yd"));
ok("CSV shot detail: string/target, hole offsets, measured, discarded, tags, no-reading holes", row && /#1 2700 fps hole 1 R1\.25 D0\.90 in measured/.test(row) && row.includes("discarded") && row.includes("no reading") && row.includes("S3/B@300yd") && row.includes("S4/B@300yd"), row && row.slice(-400));
ok("CSV old session row has 1 string, 1 target, 0 discarded", csv.split("\n").find(r => r.includes("old session"))?.includes(",1,1,0,"));

/* ---------- persistence round-trip + export/import keep it ---------- */
await p.reload(); await ready(); L = await LOG(); M = L.find(s => s.id === MID);
ok("reload keeps strings, holes, measured offsets, pairings, discards", M.tg.strings.length === 4 && M.tg.strings[0].holes.filter(h => h.m).length === 5 && M.shots.find(x => x.v === 2690).x === true && M.tg.strings[0].holes.filter(h => h.sh).length === 5 && M.tg.strings[0].holes.some(h => h.nr), JSON.stringify([M.tg.strings.length, M.tg.strings[0].holes.map(h => [!!h.m, !!h.sh, h.nr]), M.shots.filter(x => x.x).map(x => x.v)]));
ok("cleanTg drops bad pairings (one reading per hole, unknown shots)", await p.evaluate(() => { const t = window.__bc.cleanTg({ targets: [{ id: "a", tpl: "zzz", dist: 100 }], strings: [{ id: "s", tid: "nope", aim: { x: "q" }, holes: [{ id: "h1", x: 1, y: 1, sh: "k" }, { id: "h2", x: 2, y: 2, sh: "k" }, { id: "h3", x: 0, y: 0, sh: "missing" }] }] }, new Set(["k"]));
  return t.targets[0].tpl === "grid1" && t.strings[0].tid === "a" && t.strings[0].aim === null && t.strings[0].holes.map(h => h.sh).join() === "k,," ; }));

/* ---------- stable page (round 3.1 index) reads beta data ---------- */
const before = await LOG();
const q = await ctx.newPage(); hook(q);
await q.goto("http://localhost:8765/index-r31.html"); await ready(q);
const oldL = await q.evaluate(() => JSON.parse(JSON.stringify(window.__bc.log)));
ok("stable round-3.1 page loads beta-saved data without errors", oldL.length === before.length && oldL.every(s => { const n = before.find(x => x.id === s.id); return n && n.shots.length === s.shots.length && n.shots.every((x, i) => x.v === s.shots[i].v); }) && !errs.length, JSON.stringify(errs));
ok("stable page byte-identical to the pre-targets backup", fs.readFileSync(LEGACY).equals(fs.readFileSync("/workspace/ballistic-calculator-pre-targets.html.bak")));
await q.click("#tabBtnLog"); await q.click(`.slItem[data-id="${MID}"]`); await q.waitForSelector("#slEditor.show");
ok("stable page opens a beta session with strings (shows all shots)", (await q.locator("#slShots .shot").count()) === M.shots.length);
await q.click("#slEditor details > summary"); await q.fill("#slNotes", "edited on stable"); await q.click("#slSave"); await q.waitForTimeout(300);
const stripped = await q.evaluate(() => new Promise(r => { const o = indexedDB.open("bcalc-db"); o.onsuccess = () => { const g = o.result.transaction("kv").objectStore("kv").get("shotlog"); g.onsuccess = () => r(g.result); }; }));
ok("(the stable page drops the new fields when it re-saves)", !stripped.find(s => s.id === MID).tg);
await q.close();
await p.reload(); await ready(); L = await LOG(); M = L.find(s => s.id === MID);
ok("beta re-attaches strings/holes/tags from the sidecar after a stable-page save", M.notes === "edited on stable" && M.tg && M.tg.strings.length === 4 && M.tg.strings[0].holes.filter(h => h.m).length === 5 && M.shots.find(x => x.v === 2690).x === true && M.shots.filter(x => x.str).length >= 5);
ok("old session still unchanged after everything", JSON.stringify(L.find(s => s.id === "old1").shots) === JSON.stringify(OLD.shots) && !L.find(s => s.id === "old1").tg);

console.log(`${pass} checks passed`);
console.log("ERRORS", JSON.stringify(errs));
await b.close();
