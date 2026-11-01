// Round 2 review: flat dope card + kept angle, spin drift column, truing angle, gust bracket, table fit, chart labels,
// Details toggle, card cleanup, Log empty state, opens on Dope, optics (CRUD, units, turns, travel, SFP, tracking),
// zero-not-confirmed, migration, contrast + ⋯ menu / Undo per theme, console errors.
import { chromium } from "playwright"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand", ldCharge: "41.5" }] },
  { id: "r2", name: "308 Win", gunKind: "rifle", sightHeight: "1.6", zero: "100", twist: "10", barrel: "22", turret: "0.25moa", lastLoadId: "l2",
    loads: [{ id: "l2", name: "175 SMK", bc: "0.243", drag: "G7", weight: "175", diameter: "0.308", mv: "2600", length: "1.240", mvSource: "measured", ldKind: "factory" }] }],
  ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", tab: "gear", values: { target: "1000", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 44.98, longitude: -93.27 } });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))}); }`);
let wxCalls = 0;
await ctx.route("https://api.open-meteo.com/v1/forecast**", r => { wxCalls++; r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: 260,
  current: { temperature_2m: 59, relative_humidity_2m: 40, wind_speed_10m: 8, wind_direction_10m: 270, wind_gusts_10m: 14, surface_pressure: 984 } }) }); });
await ctx.route("https://api.open-meteo.com/v1/elevation**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: [260] }) }));
const p = await ctx.newPage();
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
let promptAns = null; p.on("dialog", d => d.type() === "prompt" ? d.accept(promptAns ?? d.defaultValue()) : d.accept());
const ready = () => p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done") && !document.getElementById("dopeCard").classList.contains("stale"), null, { timeout: 30000 });
const settle = async () => { await p.waitForTimeout(350); await ready(); };
const setv = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, String(v)]); };
const menu = async (k, item) => { await p.click(`#${k}Menu`); await p.waitForSelector("#pkMenu.show"); await p.click(`#${item}`); await p.waitForTimeout(80); };
const txt = s => p.textContent(s);
const nums = s => (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);
await p.goto(URL_); await ready();
await p.evaluate(async () => { window.__B = await import("https://cdn.jsdelivr.net/npm/js-ballistics@3/dist/index.js"); });
const reqMil = () => p.evaluate(() => -window.__bc.lastRun.tgt.dropAngle.In(window.__B.Angular.MRad));

/* 1) migration + opens on Dope */
const mig = await p.evaluate(() => { const P = window.__bc.P; return { v: P.version, n: P.optics.length, o1: P.optics.find(o => o.id === P.rifles[0].opticId), o2: P.optics.find(o => o.id === P.rifles[1].opticId),
  r1: P.rifles[0], r2: P.rifles[1], st: JSON.parse(localStorage.getItem("bcalc.presets.v1")) }; });
ok("migration: one optic per gun with turret settings, attached", mig.n === 2 && mig.o1 && mig.o2 && mig.o1.opTurret === "0.1mil" && mig.o1.opReticle === "mil" && mig.o2.opTurret === "0.25moa" && mig.o2.opReticle === "moa", JSON.stringify([mig.o1, mig.o2]));
ok("migration: optic takes the sight height; gun fields kept as fallback", mig.o1.opSH === "1.75" && mig.r1.sightHeight === "1.75" && mig.r1.turret === "0.1mil" && mig.r2.turret === "0.25moa");
ok("migration loses no data (loads, recipe, version 2, saved)", mig.v === 2 && mig.r1.loads[0].ldCharge === "41.5" && mig.r1.loads[0].length === "1.390" && mig.r2.loads[0].mv === "2600" && mig.st.optics.length === 2 && mig.st.version === 2);
ok("migration does not flag the zero", !mig.r1.zeroUnconf && !mig.r2.zeroUnconf);
ok("opens on Dope (saved tab was Gear)", await p.evaluate(() => document.getElementById("tabBtnDope").getAttribute("aria-selected") === "true" && !document.getElementById("tabDope").hidden));

/* 2) card cleanup */
ok("status line visually hidden but still in DOM ('Done …')", await p.evaluate(() => { const s = document.getElementById("status"), r = s.getBoundingClientRect(); return s.textContent.startsWith("Done") && (r.width <= 1 || r.height <= 1 || getComputedStyle(s).display === "none"); }));
ok("↻ button labelled “↻ Weather”", (await txt("#calcBtn")).trim() === "↻ Weather");
const tg = await p.evaluate(() => { const l = document.querySelector("label.tgl"), r = l.getBoundingClientRect(), par = l.parentElement.getBoundingClientRect(); return { h: r.height, w: r.width, pw: par.width, c: document.getElementById("roundClk").checked }; });
ok("round-to-click is a full-row toggle ≥ 44px", tg.h >= 44 && tg.w >= tg.pw - 40, JSON.stringify(tg));
await p.click("label.tgl"); await settle();
ok("tapping the row toggles round-to-click", (await p.evaluate(() => document.getElementById("roundClk").checked)) !== tg.c);
await p.click("label.tgl"); await settle();

/* 3) spin drift */
const sp = await p.evaluate(() => { const R = window.__bc.lastRun, M = window.__B.Angular.MRad; return { s: R.tgtN.windageAngle.In(M), d: R.tgtN.distance.In(window.__B.Distance.Yard) }; });
ok("spin drift 6.5 140 ELD-M 1:8 RH at 1000 yd ≈ 0.2 mil, drifts right", sp.s > 0.12 && sp.s < 0.35, sp.s.toFixed(3));
const row = await p.$$eval("#results tbody tr", a => a.map(r => [...r.children].map(c => c.textContent)).find(c => c[0].startsWith("1000")));
const hd = await p.$$eval("#results thead th", a => a.map(x => x.textContent));
ok("table has a Spin column; 1000 yd shows an L correction of ~0.2 mil + clicks", hd.some(h => h.startsWith("Spin")) && /^L 0\.[123]\d/.test(row[3]) && /L ?\d/.test(row[3].slice(6)), row.join(" | "));
ok("card Details state spin drift (L, in wind hold)", /spin drift L 0\.[123]\d MIL/.test(await txt("#dcInfo")), await txt("#dcInfo"));
await p.click('#viewSeg button[data-v="full"]'); await settle();
const hf = await p.$$eval("#results thead th", a => a.map(x => x.textContent));
const rf = await p.$$eval("#results tbody tr", a => a.map(r => [...r.children].map(c => c.textContent)).find(c => c[0].startsWith("1000")));
ok("full table Spin column", hf.includes("Spin MIL") && rf[hf.indexOf("Spin MIL")].startsWith("L"), rf.join(" | "));

/* 4) table fit */
for (const w of [360, 390, 412]) {
  await p.setViewportSize({ width: w, height: 915 });
  await p.click('#viewSeg button[data-v="dope"]'); await settle();
  const d = await p.evaluate(() => { const r = document.getElementById("results"), t = r.querySelector("table"), rr = r.getBoundingClientRect(), tr = t.getBoundingClientRect();
    return { doc: document.documentElement.scrollWidth, tw: Math.round(tr.right), rr: Math.round(rr.right), clip: [...t.querySelectorAll("th, td")].filter(c => c.scrollWidth > c.clientWidth + 1).length, sx: r.classList.contains("scrollX") }; });
  ok(`${w}px dope table fits (no clipping, no page scroll)`, d.doc <= w && d.tw <= d.rr + 1 && d.clip === 0 && !d.sx, JSON.stringify(d));
  await p.click('#viewSeg button[data-v="full"]'); await settle();
  const f = await p.evaluate(() => { const r = document.getElementById("results"), wr = r.querySelector(".tblWrap"); return { doc: document.documentElement.scrollWidth, sx: r.classList.contains("scrollX"), sw: getComputedStyle(r.querySelector(".swipe")).display !== "none", fade: getComputedStyle(r.querySelector(".fade")).display !== "none" && getComputedStyle(r.querySelector(".fade")).opacity !== "0", ov: wr.scrollWidth > wr.clientWidth }; });
  ok(`${w}px full table scrolls inside its box with fade + swipe hint`, f.doc <= w && f.sx && f.sw && f.fade && f.ov, JSON.stringify(f));
}
await p.evaluate(() => { const w = document.querySelector("#results .tblWrap"); w.scrollLeft = w.scrollWidth; w.dispatchEvent(new Event("scroll")); }); await p.waitForTimeout(100);
ok("fade hides at the scroll end", await p.evaluate(() => document.getElementById("results").classList.contains("atEnd")));
await p.setViewportSize({ width: 412, height: 915 }); await p.click('#viewSeg button[data-v="dope"]'); await settle();

/* 5) chart labels */
const ov = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
await setv("maxRange", "1500"); await settle();
const trR = await p.evaluate(() => window.__bc.lastRun.trans?.range);
ok("transonic inside 1500 yd for the chart test", trR > 1000 && trR < 1500, String(trR));
for (const tgt of [trR, trR - 25, 1000, 300]) {
  await setv("target", tgt); await settle();
  const L = await p.evaluate(() => { const c = document.getElementById("chart"); return { l: window.__bc.chartLabels, w: c.offsetWidth, h: c.offsetHeight }; });
  const bad = []; L.l.forEach((a, i) => L.l.slice(i + 1).forEach(c => { if (ov(a, c)) bad.push(a.text + "×" + c.text); }));
  const out = L.l.filter(a => a.x < 0 || a.y < 0 || a.x + a.w > L.w + 0.5 || a.y + a.h > L.h + 0.5).map(a => a.text);
  const ys = L.l.filter(a => a.kind === "y");
  ok(`chart @ ${tgt} yd: labels don't overlap or clip; target + Mach marks labelled`, !bad.length && !out.length && L.l.some(a => a.kind === "target") && L.l.some(a => a.kind === "mach") && ys.length >= 3, bad.concat(out).join(", ") + " kinds=" + [...new Set(L.l.map(a => a.kind))].join("/"));
}
await setv("target", "1000"); await setv("maxRange", "1000"); await settle();

/* 6) Details toggle + warnings promoted */
ok("Details hidden by default; dial, wind, clicks, stepper, bracket on card", await p.evaluate(() => document.getElementById("dcMore").hidden && ["dcElev", "dcWind", "dcElevClk", "dcBracket"].every(id => document.getElementById(id).offsetParent && document.getElementById(id).textContent.trim())));
await p.click("#dcMoreBtn");
const det = await txt("#dcMore");
ok("Details shows MV, energy, TOF, per-mph, stability", (await p.isVisible("#dcMore")) && /MV \d+ fps/.test(det) && det.includes("ft·lb") && / s · /.test(det) && det.includes("1 mph full") && det.includes("SG"), det);
await p.click("#dcMoreBtn"); ok("Details collapses again", await p.evaluate(() => document.getElementById("dcMore").hidden));
await p.click("#tabBtnGear"); await setv("twist", "10"); await p.click("#tabBtnDope"); await settle();
ok("marginal stability warning stays on the card (Details closed)", (await p.isVisible("#dcWarn")) && /marginal/.test(await txt("#dcWarn")));
await p.click("#tabBtnGear"); await setv("twist", "8"); await p.click("#tabBtnDope"); await settle();
ok("transonic before target warns on the card", (await txt("#dcWarn")).includes("before target") || !(await p.evaluate(() => window.__bc.lastRun.trans && window.__bc.lastRun.trans.range <= 1000)), await txt("#dcWarn"));
await p.screenshot({ path: OUT + "screenshot-r2-dope.png" });
await p.click("#dcMoreBtn"); await p.screenshot({ path: OUT + "screenshot-r2-dope-details.png" }); await p.click("#dcMoreBtn");

/* 7) gust bracket */
await p.click("#calcBtn"); await p.waitForFunction(() => window.__bc.wx && window.__bc.wx.gust === 14, null, { timeout: 15000 }); await settle();
const gb = await txt("#dcBracket"), gn = nums(gb.split("mph")[0]);
ok("live weather: bracket = call / call+spread/2 / call+spread (gust 14 vs 8 → 6)", wxCalls >= 1 && (await p.evaluate(() => window.__bc.gustSpread())) === 6 && near(gn[2] - gn[1], 3, 0.05) && near(gn[3] - gn[1], 6, 0.05) && near(gn[0], Math.max(0, gn[1] - 3), 0.05) && gb.includes("10 m"), gb);
ok("weather wind 10 m note shown", (await p.isVisible("#wxWindNote")) && (await txt("#wxWindNote")).includes("10 m"));
await setv("windSpeed", "10"); await setv("windDir", "90"); await settle();

/* 8) dope card print: 0° default, keep angle */
await setv("shotAngle", "12"); await settle();
await p.click("#dcBtn"); await p.waitForSelector("#dcPrint table");
let pr = await p.evaluate(() => ({ ang: !!document.querySelector("#dcPrint .ang"), hd: document.querySelector("#dcPrint .hd").textContent, h: [...document.querySelectorAll("#dcPrint thead th")].map(x => x.textContent).join("|"), r: [...document.querySelectorAll("#dcPrint tbody tr")].map(r => [...r.children].map(c => c.textContent)) }));
ok("dope card prints flat (0°) by default even with a 12° shot", !pr.ang && pr.hd.includes("flat (0°)") && (await txt("#dcvKeep")).includes("12"), pr.hd);
ok("dope card has a Spin column (L at 1000)", pr.h === "Yd|Elev MIL|Clk|10 mph MIL|Clk|Spin MIL|fps" && pr.r.find(r => r[0] === "1000")[5].startsWith("L"), pr.h);
const flat1000 = +pr.r.find(r => r[0] === "1000")[1];
await p.click("#dcvKeep"); await p.waitForTimeout(600);
pr = await p.evaluate(() => { const a = document.querySelector("#dcPrint .ang"); return { a: a && a.textContent, fs: a && parseFloat(getComputedStyle(a).fontSize), hd: document.querySelector("#dcPrint .hd").textContent, e: +[...document.querySelectorAll("#dcPrint tbody tr")].find(r => r.children[0].textContent === "1000").children[1].textContent }; });
ok("kept angle: large header “▲ UPHILL 12°”, less elevation than flat", pr.a && pr.a.includes("UPHILL 12°") && pr.fs >= 20 && pr.hd.includes("12° angle") && pr.e < flat1000, JSON.stringify(pr) + " flat " + flat1000);
await p.emulateMedia({ media: "print" }); await p.waitForTimeout(150);
await p.screenshot({ path: OUT + "screenshot-r2-dopecard-print.png" });
ok("print view shows the angle header", await p.evaluate(() => { const a = document.querySelector("#dcPrint .ang"); return !!a && a.getClientRects().length > 0; }));
await p.emulateMedia({ media: "screen" }); await p.click("#dcvClose");

/* 9) truing angle */
await p.click("#trueBtn"); await p.waitForSelector("#trSheet.show");
ok("truing sheet shows shot angle, default 0° (shot is 12°)", (await p.inputValue("#trAngle")) === "0" && (await p.isVisible("#trAngle")));
await p.fill("#trRange", "800"); await p.fill("#trObs", "6.5"); await p.fill("#trAngle", "12");
const ta = await p.evaluate(async () => { await window.__bc.solveTrue(); return document.getElementById("trOut").textContent; });
ok("truing solves with an edited angle", ta.length > 10 && !/Fix/.test(ta), ta.slice(0, 120));
await p.click("#trClose"); await setv("shotAngle", "0"); await settle();

/* 10) optics */
await p.click("#tabBtnGear");
await p.evaluate(() => document.querySelectorAll("#tabGear details").forEach(d => d.open = false));
const chev = await p.evaluate(() => [...document.querySelectorAll("#tabGear details > summary")].filter(s => s.offsetParent).map(s => { const c = getComputedStyle(s, "::before"); return c.content !== "none" && parseFloat(c.borderLeftWidth) >= 6 ? "▸" : "×"; }));
ok("Gear disclosure arrows on every summary", chev.length >= 3 && chev.every(c => c === "▸"), chev.join(" "));
await p.evaluate(() => document.getElementById("opMore").open = true);
ok("open disclosure arrow rotates", await p.evaluate(() => getComputedStyle(document.querySelector("#opMore > summary"), "::before").transform !== "none"));
await p.evaluate(() => document.getElementById("opMore").open = false);
const rs = await p.evaluate(() => { const s = document.getElementById("rangeSel"); return { t: s.options[s.selectedIndex]?.text, sw: s.scrollWidth, cw: s.clientWidth, w: s.getBoundingClientRect().width }; });
ok("empty range picker text not truncated", rs.t && rs.sw <= rs.cw + 1 && rs.w > rs.t.length * 6, JSON.stringify(rs));
ok("optic row: attached optic shown, required fields visible", (await p.isVisible("#opticPk")) && (await p.inputValue("#opticSel")) === mig.o1.id && (await p.isVisible("#opTurret")) && (await p.isVisible("#opReticle")) && (await p.evaluate(() => !document.getElementById("gunTurretRo").hidden && document.getElementById("turret").hidden)));  // round 3: read-only "set by optic"
promptAns = "Razor HD"; await menu("optic", "opRename");
ok("⋯ Rename optic", await p.evaluate(() => window.__bc.curOptic().name === "Razor HD" && document.getElementById("opticSel").selectedOptions[0].text === "Razor HD"));
await menu("optic", "opDup");
ok("⋯ Duplicate optic (not attached)", await p.evaluate(() => window.__bc.P.optics.length === 3 && window.__bc.P.optics.some(o => o.name === "Razor HD (copy)") && window.__bc.curOptic().name === "Razor HD"));
await p.click("#opMore > summary");
await setv("opTurn", "5"); await p.click("#tabBtnDope"); await settle();
const ec = await p.evaluate(() => window.__bc.angs(window.__bc.lastRun.tgt).ec), ct = await txt("#dcElevClk");
ok("turns + clicks on the card (5 mil/turn)", ec > 50 && ct.includes(`1 turn + ${ec - 50} click`) && ct.includes(`(${ec})`), ct);
await p.click("#tabBtnGear"); await setv("opTravel", "14"); await p.click("#tabBtnDope"); await settle();
ok("travel warning: needs > travel/2 (7 mil)", /up travel/.test(await txt("#dcWarn")), await txt("#dcWarn"));
await p.click("#tabBtnGear"); await setv("opCant", "20"); await p.click("#tabBtnDope"); await settle();
ok("20 MOA canted base adds ~5.8 mil → no travel warning", !/up travel/.test(await txt("#dcWarn")) && near(await p.evaluate(() => window.__bc.turretSpec().up), 7 + 20 * 0.290888, 0.02), String(await p.evaluate(() => window.__bc.turretSpec().up)));
await p.click("#tabBtnGear"); await p.selectOption("#opFP", "SFP"); await setv("opMag", "18"); await p.click("#tabBtnDope"); await settle();
ok("SFP note “holds true at 18×” on card", (await txt("#dopeCard")).includes("holds true at 18×"), await txt("#dcWindClk"));
const before = +nums(await txt("#dcElev"))[0];
await p.click("#tabBtnGear"); await setv("opTrack", "1.05"); await p.click("#tabBtnDope"); await settle();
const need = await reqMil(), dial = +nums(await txt("#dcElev"))[0], ex = await p.evaluate(() => { const a = window.__bc.angs(window.__bc.lastRun.tgt); return { e: a.e, ec: a.ec }; });
ok("tracking ×1.05: dial = required ÷ 1.05 (value + clicks)", near(ex.e, need / 1.05, 0.001) && near(dial, need / 1.05, 0.051) && Math.abs(ex.ec) === Math.round(need / 1.05 / 0.1) && near(before, need, 0.051), `need ${need.toFixed(3)} e ${ex.e.toFixed(3)} dial ${dial} before ${before}`);
await p.click("#tabBtnGear"); await setv("opTrack", ""); await setv("opReticle", "moa"); await p.click("#tabBtnDope"); await settle();
ok("units follow the optic's reticle (MOA)", (await p.evaluate(() => window.__bc.S.ang)) === "MOA" && (await txt("#dcElevK")).includes("MOA"));
ok("clicks follow the turret (still 0.1 mil)", (await txt("#dcElevClk")).includes("0.1 mil") && near(Math.abs(await p.evaluate(() => window.__bc.angs(window.__bc.lastRun.tgt).ec)), Math.round(await reqMil() / 0.1), 1));
await p.click("#tabBtnGear"); await setv("opReticle", "mil"); await setv("opTravel", ""); await setv("opCant", ""); await p.selectOption("#opFP", "FFP"); await setv("opTurn", "");
// new optic on the 308 (has an optic → replacing flags its zero)
await p.selectOption("#rifleSel", "r2"); await p.waitForTimeout(200);
ok("switching to the 308 follows its MOA reticle", (await p.evaluate(() => window.__bc.S.ang)) === "MOA" && (await p.inputValue("#opTurret")) === "0.25moa");
promptAns = "NF ATACR"; await menu("optic", "opNew");
ok("⋯ New optic attaches to this gun", await p.evaluate(() => window.__bc.curOptic().name === "NF ATACR" && window.__bc.P.optics.length === 4));
// delete + Undo
await menu("optic", "opDel");
ok("⋯ Delete optic falls back to gun turret", await p.evaluate(() => !window.__bc.curOptic() && window.__bc.P.optics.length === 3 && !document.getElementById("gunTurretRow").hidden));
await p.click("#toastAct");
ok("Undo restores the optic and attachment", await p.evaluate(() => window.__bc.curOptic()?.name === "NF ATACR" && window.__bc.P.optics.length === 4));
// attach existing optic from the other gun = move
await p.evaluate(() => { delete window.__bc.P.rifles[1].zeroUnconf; });
await menu("optic", "opAttach"); await p.waitForSelector("#opSheet.show");
await p.click(`#opList .opItem[data-id="${mig.o1.id}"]`); await p.waitForTimeout(200);
const mv = await p.evaluate(() => { const [a, c] = window.__bc.P.rifles; return { a: a.opticId, ua: !!a.zeroUnconf, c: c.opticId, uc: !!c.zeroUnconf, why: c.zeroUnconf?.why }; });
ok("⋯ Attach existing: moves Razor HD from 6.5 CM to 308, both zeros flagged", mv.c === mig.o1.id && mv.a === null && mv.ua && mv.uc, JSON.stringify(mv));
ok("Gear shows ‘Zero not confirmed’ + Confirm button", (await p.isVisible("#zeroFlag")) && (await txt("#zeroFlagTxt")).includes("Zero not confirmed") && (await p.isVisible("#zeroConfirm")));
await p.evaluate(() => { document.getElementById("toast").classList.remove("show"); document.getElementById("zeroFlag").scrollIntoView({ block: "start" }); window.scrollBy(0, -140); }); await p.waitForTimeout(250);
await p.screenshot({ path: OUT + "screenshot-r2-zero-unconfirmed.png" });
await p.click("#tabBtnDope"); await settle();
ok("Dope card warns zero not confirmed", (await txt("#dcWarn")).includes("Zero not confirmed"));
await p.click("#tabBtnGear"); await p.click("#zeroConfirm"); await p.waitForTimeout(150);
ok("Confirm zero clears flag (Gear + card)", !(await p.isVisible("#zeroFlag")) && !(await p.evaluate(() => window.__bc.P.rifles[1].zeroUnconf)) && !(await txt("#dcWarn")).includes("Zero not confirmed"));
ok("flags persist in storage", await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("bcalc.presets.v1")); return !s.rifles[1].zeroUnconf && !!s.rifles[0].zeroUnconf && s.optics.length === 4; }));
await p.evaluate(() => { document.getElementById("toast").classList.remove("show"); document.getElementById("opticPk").scrollIntoView({ block: "start" }); window.scrollBy(0, -60); }); await p.waitForTimeout(250);
await p.evaluate(() => { document.getElementById("opMore").open = true; }); await p.waitForTimeout(100);
await p.screenshot({ path: OUT + "screenshot-r2-gear-optic.png" });
// detach flags
await menu("optic", "opDetach");
ok("⋯ Detach flags the zero", await p.evaluate(() => !window.__bc.curOptic() && !!window.__bc.P.rifles[1].zeroUnconf));
await p.click("#zeroConfirm");

/* 11) Log empty state */
await p.click("#tabBtnLog");
ok("Log empty: Select + CSV hidden", !(await p.isVisible("#slSelBtn")) && !(await p.isVisible("#slCsvBtn")));
const c2 = await b.newContext({ viewport: { width: 412, height: 915 } });
await c2.addInitScript(`localStorage.setItem("bcalc.shotlog.v1", ${JSON.stringify(JSON.stringify([{ id: "s1", rifleId: "r1", loadId: "l1", date: "2026-10-01T15:00:00.000Z", source: "manual", shots: [{ v: 2705 }, { v: 2712 }], notes: "", wx: {} }]))});`);
const p2 = await c2.newPage(); p2.on("pageerror", e => errs.push("PAGEERR2 " + e.message));
await p2.goto(URL_); await p2.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 }); await p2.click("#tabBtnLog");
ok("Log with sessions: Select + CSV shown", (await p2.isVisible("#slSelBtn")) && (await p2.isVisible("#slCsvBtn")));
await p2.click("#tabBtnDope"); await p2.waitForTimeout(300);
const fbt = await p2.textContent("#dcBracket"), fb = nums(fbt.split("mph")[0]);
ok("no live weather (location denied): bracket ±2 mph", near(fb[1] - fb[0], 2, 0.01) && near(fb[2] - fb[1], 2, 0.01) && !fbt.includes("Gust"), fbt);
ok("10 m wind note hidden without weather", !(await p2.isVisible("#wxWindNote")));
await c2.close();

/* 12) contrast + ⋯ menu + Undo per theme */
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
const scan = () => p.evaluate(() => {   // every visible text node: its color vs. the first opaque background up the tree
  const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== "transparent") return c; } return getComputedStyle(document.body).backgroundColor; };
  const out = [], seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const e = n.parentElement; if (!n.textContent.trim() || seen.has(e) || !e.offsetParent || e.closest(".ovl:not(.show), #pkMenu:not(.show), script, style, option, canvas, [aria-hidden=true]")) continue;
    const s = getComputedStyle(e); if (s.visibility === "hidden" || +s.opacity < 0.5 || e.closest("[disabled], :disabled") || e.getBoundingClientRect().width < 2) continue; seen.add(e);
    out.push([(e.id || e.className || e.tagName) + ":" + n.textContent.trim().slice(0, 18), s.color, bgOf(e)]); }
  return out; });
for (const t of ["dark", "light", "od", "fde", "night"]) {
  await p.click("#themeBtn"); await p.click(`#themeBar button[data-t="${t}"]`); await p.click("#themeBtn"); await p.waitForTimeout(100);
  await p.evaluate(() => document.getElementById("toast").classList.remove("show"));
  const low = []; let scanned = 0;
  for (const tab of ["Dope", "Gear", "Log"]) {
    await p.click(`#tabBtn${tab}`); if (tab === "Dope") { await settle(); await p.click("#dcMoreBtn"); }
    await p.evaluate(() => document.querySelectorAll("details").forEach(d => d.open = true)); await p.waitForTimeout(80);
    const sc = await scan(); scanned += sc.length; for (const [s, col, bg] of sc) { const r = cr(col, bg); if (r < 4.5) low.push(`${tab}/${s} ${r.toFixed(2)}`); }
    if (tab === "Dope") await p.click("#dcMoreBtn");
  }
  ok(`theme ${t}: all visible text AA ≥ 4.5:1`, low.length === 0 && scanned > 150, `${scanned} text elements ` + low.slice(0, 12).join(", "));
  await p.click("#tabBtnGear"); await p.click("#rifleMenu"); await p.waitForSelector("#pkMenu.show");
  const mm = await p.evaluate(() => { const g = [...document.querySelectorAll('#pkMenu .grp')].find(x => !x.hidden && x.offsetParent); const bs = g ? [...g.querySelectorAll("button")].filter(x => x.offsetParent) : []; return { n: bs.length, k: g?.dataset.k }; });
  const lowM = (await scan()).filter(([s]) => true).map(([s, c, bg]) => [s, cr(c, bg)]).filter(([, r]) => r < 4.5);
  ok(`theme ${t}: ⋯ menu opens with readable items`, mm.n >= 3 && mm.k === "rifle" && lowM.length === 0, JSON.stringify(mm) + lowM.map(x => x.join(" ")).join(","));
  await p.click("#pkCancel"); await p.waitForTimeout(80);
  promptAns = `Theme ${t} optic`; await menu("optic", "opNew"); await p.waitForSelector("#zpDlg.show"); await p.click("#zpYes"); /* round 3: first optic asks once */ const nBefore = await p.evaluate(() => window.__bc.P.optics.length);
  await menu("optic", "opDel"); await p.waitForSelector("#toast.show #toastAct");
  const tc = await p.evaluate(() => { const b2 = document.getElementById("toastAct"), t2 = document.getElementById("toast"); return [getComputedStyle(b2).color, getComputedStyle(b2).backgroundColor, getComputedStyle(t2).color, getComputedStyle(t2).backgroundColor]; });
  await p.click("#toastAct"); await p.waitForTimeout(100);
  const und = await p.evaluate(([n, nm]) => window.__bc.P.optics.length === n && window.__bc.curOptic()?.name === nm, [nBefore, `Theme ${t} optic`]);
  const tbg = /rgba\(.*, 0\)$/.test(tc[1]) ? tc[3] : tc[1];
  ok(`theme ${t}: Delete → Undo works and toast is readable`, und && cr(tc[0], tbg) >= 4.5 && cr(tc[2], tc[3]) >= 4.5, tc.join(" / "));
  await p.evaluate(() => { const r = window.__bc.P.rifles.find(x => x.id === window.__bc.P.lastRifleId); const o = window.__bc.curOptic(); window.__bc.P.optics.splice(window.__bc.P.optics.indexOf(o), 1); r.opticId = null; delete r.zeroUnconf; });
  await p.evaluate(() => document.getElementById("toast").classList.remove("show"));
}
await p.click("#themeBtn"); await p.click('#themeBar button[data-t="dark"]'); await p.click("#themeBtn");

/* 13) reload keeps optics, opens on Dope */
await p.click("#tabBtnGear"); await p.reload(); await ready();
ok("reload: opens on Dope, optics kept", await p.evaluate(() => document.getElementById("tabBtnDope").getAttribute("aria-selected") === "true" && window.__bc.P.optics.length >= 4));
console.log("ERRORS", JSON.stringify(errs));
console.log(pass + " checks passed"); await b.close();
if (errs.length) process.exit(1);
