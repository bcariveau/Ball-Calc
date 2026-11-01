// shpolish: fps panel only from ＋ Add shot and closed after each add; outlier colours for ±; String ▾ menu; compact header + ≥5 rows at 360 px.
import { chromium } from "playwright"; import assert from "assert/strict"; import fs from "fs";
const URL_ = "http://localhost:8765/ballistic-calculator.html", SHOT = "/workspace/screenshot-shp-";
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
const sdOf = a => { const m = a.reduce((x, y) => x + y) / a.length; return { m, s: a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : 0 }; };
const expCls = kept => { const x = kept[kept.length - 1], { m, s } = sdOf(kept), d = x - m, a = Math.abs(d), n = kept.length; if (n < 2) return ""; if (n >= 5) return s > 0 ? (a > 3 * s ? "dvB" : a > 2 * s ? "dvW" : "") : ""; const r = Math.round(a); return r >= 50 ? "dvB" : r >= 25 ? "dvW" : ""; };

const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 });
await ctx.addInitScript(init); await ctx.addInitScript(fakes); await route(ctx);
const p = await ctx.newPage(); hook(p);
await p.goto(URL_); await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
const T = s => p.textContent(s), vis = s => p.isVisible(s);
const ED = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__bc.ED)));
const metaCls = () => p.evaluate(() => { const d = document.getElementById("shDev"); if (!d) return "none"; const c = d.classList; return c.contains("dvB") ? "dvB" : c.contains("dvW") ? "dvW" : ""; });
const add = async v => { await p.click("#shAdd"); await p.fill("#shVel", String(v)); await p.press("#shVel", "Enter"); await p.waitForTimeout(70); };
const newStr = async () => { await p.click("#shStrBtn"); await p.click("#shNewStr"); await p.waitForTimeout(80); };

/* ---------- 1) the fps panel ---------- */
await p.click("#shStartBtn"); await p.waitForSelector("#shView.show");
ok("panel closed when the view opens", !(await vis("#shAddBox")) && (await p.getAttribute("#shAdd", "aria-expanded")) === "false");
await p.click("#shTag"); await p.waitForTimeout(40);
ok("Tag opens the tag bar, not the fps panel", await vis("#shTagBar") && !(await vis("#shAddBox")));
await p.click("#shTag"); await p.click("#shStrBtn"); await p.waitForTimeout(40);
ok("String ▾ opens its menu, not the fps panel", await vis("#shStrMenu") && !(await vis("#shAddBox")));
await p.click("#shStrBtn");
await p.click("#shAdd"); await p.waitForTimeout(40);
ok("＋ Add shot opens it, focused and empty", await vis("#shAddBox") && (await p.evaluate(() => document.activeElement.id)) === "shVel" && (await p.inputValue("#shVel")) === "" && (await p.getAttribute("#shAdd", "aria-expanded")) === "true");
await p.fill("#shVel", "2700"); await p.press("#shVel", "Enter"); await p.waitForTimeout(80);
ok("Enter adds the shot and closes the panel", !(await vis("#shAddBox")) && (await T("#shV")) === "2700" && (await p.getAttribute("#shAdd", "aria-expanded")) === "false");
await p.click("#shAdd"); await p.fill("#shVel", "2710"); await p.click("#shAddGo"); await p.waitForTimeout(80);
ok("the Add button adds and closes too", !(await vis("#shAddBox")) && (await T("#shV")) === "2710");
await p.click("#shAdd"); await p.fill("#shVel", "12"); await p.click("#shAddGo"); await p.waitForTimeout(80);
ok("an out-of-range value keeps the panel open to fix (nothing added)", await vis("#shAddBox") && (await ED()).shots.length === 2);
await p.click("#shAddDone"); await p.waitForTimeout(40);
ok("Cancel closes it without adding", !(await vis("#shAddBox")) && (await ED()).shots.length === 2);
await p.click("#shAdd"); await p.fill("#shVel", "2705"); await p.keyboard.press("Escape"); await p.waitForTimeout(60);
ok("Escape closes it (no shot added, view stays open)", !(await vis("#shAddBox")) && await vis("#shView") && (await ED()).shots.length === 2);
await add(2701); await add(2699);
ok("each Add closes it again (2 more shots)", (await ED()).shots.length === 4 && !(await vis("#shAddBox")));
await p.click("#shAdd"); await p.waitForTimeout(30); await p.click("#shTag"); await p.waitForTimeout(30);
ok("only one panel at a time (Tag closes the fps panel)", !(await vis("#shAddBox")) && await vis("#shTagBar")); await p.click("#shTag");

/* ---------- 2) deviation colours ---------- */
const U = await p.evaluate(() => { const f = window.__bc.shDevCls; return {
  n4_24: f(24, 4, 30), n4_25: f(25, 4, 1), n4m25: f(-25, 4, 1), n4_49: f(49, 3, 1), n4_50: f(50, 3, 1), n2_244: f(24.4, 2, 1), n2_246: f(24.6, 2, 1),
  n5_2sd: f(20, 5, 10), n5_2sdp: f(20.01, 5, 10), n5_3sd: f(30, 5, 10), n5_3sdp: f(30.01, 7, 10), n5_m: f(-31, 9, 10), n5_big: f(60, 5, 40), sd0: f(0, 6, 0), n1: f(80, 1, 0), nul: f(null, 5, 3) }; });
ok("n<5: 24 fps neutral, 25 amber (either side), 49 amber, 50 red", U.n4_24 === "" && U.n4_25 === "dvW" && U.n4m25 === "dvW" && U.n4_49 === "dvW" && U.n4_50 === "dvB", JSON.stringify(U));
ok("n<5 uses the rounded fps shown (24.4 → neutral, 24.6 → shows 25 → amber)", U.n2_244 === "" && U.n2_246 === "dvW");
ok("n≥5: exactly 2 SD neutral, just over amber; exactly 3 SD amber, just over red (either side)", U.n5_2sd === "" && U.n5_2sdp === "dvW" && U.n5_3sd === "dvW" && U.n5_3sdp === "dvB" && U.n5_m === "dvB");
ok("n≥5 ignores the fps rule (60 fps at SD 40 = neutral); SD 0, one shot, no dev → neutral", U.n5_big === "" && U.sd0 === "" && U.n1 === "" && U.nul === "");
// live: string 1 = 2700, 2710, 2701, 2699 → last −3: neutral
ok("live: the ± is its own span; small ± is neutral (no colour class)", (await metaCls()) === "" && /#4 · −3/.test(await T("#shMeta")));
const col = s => p.evaluate(s => getComputedStyle(document.querySelector(s)).color, s), cssv = v => p.evaluate(v => { const d = document.createElement("i"); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, v);
ok("neutral ± uses the text colour, not the accent green", (await col("#shDev")) === (await cssv("--text")) && (await col("#shDev")) !== (await cssv("--accent")));
await newStr(); await add(2700); await add(2748);
ok("live n=2: +24 → neutral", (await T("#shMeta")) === "#2 · +24" && (await metaCls()) === "");
await p.click("#shBad"); await p.waitForTimeout(80); await add(2750);
ok("live n=2 (one discarded): +25 → amber, in the hero and its row; the other row (−25) too", (await T("#shMeta")) === "#3 · +25" && (await metaCls()) === "dvW" &&
  await p.evaluate(() => { const r = [...document.querySelectorAll("#shList .shRow")]; return r[0].querySelector(".dv").classList.contains("dvW") && !r[1].querySelector(".dv").classList.contains("dvW") && r[2].querySelector(".dv").classList.contains("dvW"); }));
ok("amber is the theme's warn colour; the discarded row stays neutral", (await col("#shDev")) === (await cssv("--warn")));
await add(2804);   // kept 2700, 2750, 2804 → n=3, avg 2751.3, +53 → red
ok("live n=3: +53 → red (err colour)", (await metaCls()) === "dvB" && (await col("#shDev")) === (await cssv("--err")), await T("#shMeta"));
// n ≥ 5
await newStr(); const A6 = [2700, 2702, 2698, 2701, 2699]; for (const v of A6) await add(v);
await add(2715); ok("live n=6: 1.99 SD → neutral", expCls([...A6, 2715]) === "" && (await metaCls()) === "", await T("#shMeta"));
await p.click("#shBad"); await p.waitForTimeout(60); await add(2730);
ok("live n=6: 2.03 SD → amber", expCls([...A6, 2730]) === "dvW" && (await metaCls()) === "dvW", await T("#shMeta"));
await newStr(); const A11 = [2700, 2701, 2699, 2700, 2701, 2699, 2700, 2701, 2699, 2700]; for (const v of A11) await add(v);
await add(2800); ok("live n=11: a 100 fps flier is > 3 SD → red", expCls([...A11, 2800]) === "dvB" && (await metaCls()) === "dvB", await T("#shMeta"));
ok("hero aria-label says the shot is far off the average", /far off the average/.test(await p.getAttribute("#shHero", "aria-label")));
const TH = ["dark", "light", "od", "fde", "night"], thr = [];
for (const th of TH) {
  await p.evaluate(t => { document.documentElement.dataset.theme = t; }, th); await p.waitForTimeout(40);
  const r = await p.evaluate(() => { const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== "transparent") return c; } return "rgb(0,0,0)"; };
    const m = document.getElementById("shDev"), out = {}; for (const c of ["", "dvW", "dvB"]) { m.classList.remove("dvW", "dvB"); if (c) m.classList.add(c); const cs = getComputedStyle(m); out[c || "n"] = { fg: cs.color, bg: bgOf(m), sh: cs.boxShadow, own: cs.backgroundColor }; }
    m.classList.remove("dvW"); m.classList.add("dvB"); return out; });
  const crs = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +cr(v.fg, v.bg).toFixed(2)]));
  const look = k => r[k].fg + "|" + r[k].bg + "|" + r[k].sh;
  thr.push(th + " " + JSON.stringify(crs));
  ok(`${th}: neutral / amber / red all AA and look different from each other`, Object.values(crs).every(x => x >= 4.5) && new Set(["n", "dvW", "dvB"].map(look)).size === 3, JSON.stringify(crs));
}
await p.evaluate(() => { document.documentElement.dataset.theme = "night"; });
ok("Night: amber gets an outline and red a filled badge (not just a shade of red)", await p.evaluate(() => { const m = document.getElementById("shDev"); const red = getComputedStyle(m); const rb = red.backgroundColor; m.classList.replace("dvB", "dvW"); const w = getComputedStyle(m).boxShadow; m.classList.replace("dvW", "dvB"); return rb !== "rgba(0, 0, 0, 0)" && w !== "none"; }));
await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act")); await p.waitForTimeout(450); await p.screenshot({ path: SHOT + "night.png" });
await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });

/* ---------- 3) buttons + String ▾ menu ---------- */
const bb = await p.evaluate(() => ["shBad", "shTag", "shAdd", "shMark", "shStrBtn"].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, Math.round(r.height), Math.round(r.width)]; }));
ok("big buttons: Bad read, Tag, ＋ Add shot, 🎯 Mark holes (+ String ▾), all ≥ 50 px tall", bb.every(([, h]) => h >= 50) && !(await vis("#shNewStr")) && !(await vis("#shNewTgt")) && !(await vis("#shEndStr")), JSON.stringify(bb));
ok("String ▾ starts closed", !(await vis("#shStrMenu")) && (await p.getAttribute("#shStrBtn", "aria-expanded")) === "false" && (await p.getAttribute("#shStrBtn", "aria-haspopup")) === "menu");
let e = await ED(); const s0 = e.tg.strings.length, t0 = e.tg.targets.length;
await p.click("#shStrBtn"); await p.waitForTimeout(40);
ok("String ▾ opens a menu with New string / New target / End string, titled with the string", await vis("#shNewStr") && await vis("#shNewTgt") && await vis("#shEndStr") && (await p.getAttribute("#shStrBtn", "aria-expanded")) === "true" && (await T("#shStrFor")) === (await T("#shStr")) && (await p.evaluate(() => document.activeElement.id)) === "shNewStr");
await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act")); await p.waitForTimeout(450); await p.screenshot({ path: SHOT + "string-menu.png" });
await p.click("#shNewStr"); await p.waitForTimeout(100); e = await ED();
ok("New string → next string, same target, menu closes", e.tg.strings.length === s0 + 1 && e.tg.targets.length === t0 && (await T("#shStr")) === `String ${s0 + 1} · Target A` && !(await vis("#shStrMenu")));
await add(2702); await p.click("#shStrBtn"); await p.click("#shNewTgt"); await p.waitForTimeout(100); e = await ED();
ok("New target → next string on Target B, menu closes", e.tg.strings.length === s0 + 2 && e.tg.targets.length === t0 + 1 && (await T("#shStr")) === `String ${s0 + 2} · Target B` && !(await vis("#shStrMenu")));
await add(2703); await p.click("#shStrBtn"); await p.click("#shEndStr"); await p.waitForTimeout(100);
ok("End string → ended note + toast, String ▾ shows 'ended', menu closes", await vis("#shEndNote") && /ended/.test(await T("#shStrBtn")) && !(await vis("#shStrMenu")) && /ended/.test(await p.textContent("#toast")));
await add(2704); e = await ED();
ok("…the next shot starts a new string", e.tg.strings.length === s0 + 3 && !/ended/.test(await T("#shStrBtn")));
await p.click("#shStrBtn"); await p.keyboard.press("Escape"); await p.waitForTimeout(50);
ok("Escape closes the menu (view stays)", !(await vis("#shStrMenu")) && await vis("#shView") && (await p.evaluate(() => document.activeElement.id)) === "shStrBtn");
await p.click("#shStrBtn"); await p.mouse.click(180, 200); await p.waitForTimeout(50);
ok("tapping elsewhere closes the menu", !(await vis("#shStrMenu")));
await p.click("#shStrBtn"); await p.click("#shAdd"); await p.waitForTimeout(40);
ok("＋ Add shot closes the menu", !(await vis("#shStrMenu")) && await vis("#shAddBox")); await p.click("#shAddDone");

/* ---------- 4) header + list room ---------- */
for (let i = 0; i < 3; i++) { await add(2700); await newStr(); }
const hd = await p.evaluate(() => { const b = document.getElementById("shStr"), lh = parseFloat(getComputedStyle(b).lineHeight) || 20; return { txt: b.textContent, sw: b.scrollWidth, cw: b.clientWidth, h: b.getBoundingClientRect().height, lh, for: getComputedStyle(document.getElementById("shFor")).display, conn: !document.getElementById("shConn").hidden, right: document.querySelector(".shRadBox").getBoundingClientRect().right }; });
ok("360 px: gun · load · distance line hidden; 'String N · Target M' on one line, not truncated (Connect showing)", hd.for === "none" && /^String \d{2} · Target B$/.test(hd.txt) && hd.sw <= hd.cw + 1 && hd.h < hd.lh * 1.5 && hd.conn && hd.right <= 360, JSON.stringify(hd));
await newStr(); for (const v of [2700, 2712, 2695, 2720, 2705, 2760, 2701]) await add(v); await p.waitForTimeout(300);
const rowsIn = () => p.evaluate(() => { const L = document.getElementById("shList").getBoundingClientRect(); return [...document.querySelectorAll(".shRow")].filter(e => { const r = e.getBoundingClientRect(); return r.top >= L.top - 1 && r.bottom <= L.bottom + 1; }).length; });
const lay = () => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, btnB: document.querySelector(".shBtns").getBoundingClientRect().bottom, H: innerHeight }));
let rws = await rowsIn(), ly = await lay();
ok("360×740 portrait: ≥ 5 full shot rows visible, nothing off screen", rws >= 5 && ly.sw <= 360 && ly.btnB <= 740, JSON.stringify({ rws, ...ly }));
await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act")); await p.waitForTimeout(450); await p.screenshot({ path: SHOT + "portrait.png" });
await p.click("#shAdd"); await p.waitForTimeout(40); const rOpen = await rowsIn(); await p.click("#shAddDone");
ok("(with the fps panel open, rows shrink but the list stays visible)", rOpen >= 2, String(rOpen));
for (const [w, h, n, shot] of [[740, 360, 4, "landscape"], [915, 412, 5, ""], [412, 915, 7, ""]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200);
  rws = await rowsIn(); ly = await lay();
  const f = await p.evaluate(() => { const b = document.getElementById("shStr"), s = document.getElementById("shFor"); return { for: getComputedStyle(s).display, fsw: s.scrollWidth, fcw: s.clientWidth, sw: b.scrollWidth, cw: b.clientWidth }; });
  const wide = w >= 480;
  ok(`${w}×${h}: ≥ ${n} rows visible; header line ${wide ? "kept and fits" : "hidden"}; label untruncated`, rws >= n && ly.sw <= w && ly.btnB <= h && f.sw <= f.cw + 1 && (wide ? f.for !== "none" && f.fsw <= f.fcw + 1 : f.for === "none"), JSON.stringify({ rws, ...ly, ...f }));
  if (shot) await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act")); await p.waitForTimeout(450); await p.screenshot({ path: SHOT + shot + ".png" });
}
await p.setViewportSize({ width: 360, height: 740 });
await p.click("#shExit"); await p.waitForTimeout(150);
ok("exit still works", !(await vis("#shView")) && (await p.evaluate(() => document.body.dataset.tab)) === "dope");
console.log(thr.join("\n"));
await b.close();
console.log(`${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs));
