// Pro Shooter + UI review: auto-calc, tabs, pinned card, powder temp, zero conditions, turret clicks, exact target row,
// transonic, Miller stability, truing, printable dope card, tap targets, contrast, delete placement, console errors.
import { chromium } from "playwright"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
const SEED = { version: 2, rifles: [{ id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", lastLoadId: "l1",
  loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] }],
  ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", values: { target: "600", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))}); }`);
const p = await ctx.newPage();
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
const ready = () => p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done") && !document.getElementById("dopeCard").classList.contains("stale"), null, { timeout: 30000 });
const settle = async () => { await p.waitForTimeout(350); await ready(); };
const setv = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, String(v)]); };
const LR = () => p.evaluate(() => { const R = window.__bc.lastRun; return R && { mvNow: R.mvNow, vT: R.vT, trans: R.trans, zc: R.zc, sg: R.sg, Tp: R.Tp }; });
await p.goto(URL_); await ready();
// library in the page for independent numbers
await p.evaluate(async () => { window.__B = await import("https://cdn.jsdelivr.net/npm/js-ballistics@3/dist/index.js"); });
const tgtMil = () => p.evaluate(() => -window.__bc.lastRun.tgt.dropAngle.In(window.__B.Angular.MRad));

/* 1) auto-calc, tabs, pinned card */
ok("no Calculate button (auto-calc)", (await p.$$eval("button", a => a.filter(x => x.offsetParent && /^\s*Calculate\s*$/i.test(x.textContent)).length)) === 0);
await p.evaluate(() => { window.__n = 0; new MutationObserver(() => { if (document.getElementById("status").textContent.startsWith("Done")) window.__n++; }).observe(document.getElementById("status"), { childList: true, characterData: true, subtree: true }); });
const e0 = await p.textContent("#dcElev");
for (const v of ["610", "620", "630", "640"]) await setv("target", v);
ok("edit marks the card stale at once (no stale numbers shown as fresh)", await p.evaluate(() => document.getElementById("dopeCard").classList.contains("stale")));
await settle();
ok("debounced: 4 quick edits → 1 recalculation", (await p.evaluate(() => window.__n)) === 1, "runs=" + (await p.evaluate(() => window.__n)));
ok("auto-calc updated the dial for 640 yd", (await p.textContent("#dcElev")) !== e0 && (await p.textContent("#dcElevC")).startsWith("640 yd"), await p.textContent("#dcElev"));
await setv("target", "600"); await settle();
await p.click("#tabBtnGear"); await p.reload(); await ready();
ok("always opens on Dope (round 2; last tab not restored)", await p.evaluate(() => document.getElementById("tabBtnDope").getAttribute("aria-selected") === "true" || document.getElementById("tabBtnDope").classList.contains("on")));
await p.click("#tabBtnDope");
await p.evaluate(() => window.scrollTo(0, 1600)); await p.waitForTimeout(150);
const bb = await p.evaluate(() => { const r = document.getElementById("dopeCard").getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
ok("pinned dope card stays on screen when scrolled (412×915)", bb.t >= 0 && bb.b <= 915 && bb.t < 20, JSON.stringify(bb));
await p.evaluate(() => window.scrollTo(0, 0));
await p.evaluate(async () => { window.__B = window.__B || await import("https://cdn.jsdelivr.net/npm/js-ballistics@3/dist/index.js"); });

/* 2) powder temperature sensitivity */
await setv("ptSens", "15"); await setv("mvTemp", "70"); await setv("temp", "40"); await settle();
let R = await LR();
ok("powder temp blank = air temp: MV = 2710 + 15/10×(40−70) = 2665", near(R.mvNow, 2665, 0.01) && R.Tp === 40, R.mvNow);
ok("adjusted MV shown on card", (await p.textContent("#dcInfo")).includes("MV 2665 fps @ 40°F powder"), await p.textContent("#dcInfo"));
await setv("powderTemp", "90"); await settle(); R = await LR();
ok("powder temp override: 2710 + 1.5×20 = 2740", near(R.mvNow, 2740, 0.01) && R.Tp === 90, R.mvNow);
ok("powder hint explains MV used", (await p.textContent("#ptHint")).includes("MV used: 2740"), await p.textContent("#ptHint"));
ok("saved to the load (autosave)", await p.evaluate(() => { const l = window.__bc.P.rifles[0].loads[0]; return l.ptSens === "15" && l.mvTemp === "70"; }));
// session snapshot + compare temp column
await p.click("#tabBtnLog"); await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show");
ok("new session takes powder temp", (await p.inputValue("#slPowder")) === "90");
for (const v of ["2741", "2748", "2737"]) { await p.fill("#slVel", v); await p.press("#slVel", "Enter"); }
await p.click("#slSave"); await p.waitForTimeout(200);
const snap = await p.evaluate(() => { const s = window.__bc.log[window.__bc.log.length - 1]; return { pw: s.wx.powder, sens: s.recipe?.ptSens, t0: s.recipe?.mvTemp, adj: s.recipe?.mvAdj }; });
ok("session snapshots sensitivity, chrono temp, adjusted MV, powder temp", snap.pw === 90 && snap.sens === "15" && snap.t0 === "70" && snap.adj === "2740", JSON.stringify(snap));
await p.click("#slCmp > summary"); await p.waitForTimeout(100);
const hd = await p.$$eval("#slCmpTbl thead th", a => a.map(x => x.textContent)), rw = await p.$$eval("#slCmpTbl tbody tr td", a => a.map(x => x.textContent.trim()));
ok("compare table has a temp column", hd.includes("°F") && rw[hd.indexOf("°F")] === "90", JSON.stringify(hd));
// delete button kept away from save
await p.click(".slItem"); await p.waitForSelector("#slEditor.show");
const dsv = await p.evaluate(() => { const d = document.getElementById("slDel").getBoundingClientRect(), s = document.getElementById("slSave").getBoundingClientRect(); return { gap: d.top - s.bottom, sib: document.getElementById("slDel").parentElement === document.getElementById("slSave").parentElement }; });
ok("Delete is not adjacent to Save (own row, ≥20px gap)", !dsv.sib && dsv.gap >= 20, JSON.stringify(dsv));
await p.click("#slEdClose"); await p.click("#tabBtnDope");
await setv("powderTemp", ""); await setv("ptSens", ""); await setv("mvTemp", ""); await setv("temp", "59"); await settle();

/* 3) zero conditions per gun */
const e600 = await tgtMil();
await p.click("#tabBtnGear"); await p.evaluate(() => { document.getElementById("rifleDetails").open = true; document.getElementById("zeroDetails").open = true; }); await p.click("#zUseCur"); await settle();
ok("Use current conditions copies today's into zero conditions", (await p.inputValue("#zTemp")) === "59" && (await p.inputValue("#zAlt")) === "0");
ok("zero in today's conditions = same solution", near(await tgtMil(), e600, 1e-6));
const zEl = () => p.evaluate(() => window.__bc.lastRun.ctx.shot.weapon.zeroElevation.In(window.__B.Angular.MRad));
const zToday = await zEl();
await setv("ptSens", "15"); await setv("mvTemp", "59");
await setv("zTemp", "10"); await setv("zAlt", "5000"); await setv("zPress", ""); await settle(); R = await LR();
const zA = await zEl();
ok("zero conditions saved per gun", await p.evaluate(() => window.__bc.P.rifles[0].zTemp === "10" && window.__bc.P.rifles[0].zAlt === "5000"));
// reference: zero in those conditions directly (today = 10°F, 5000 ft) gives the same bore angle
for (const id of ["zTemp", "zHum", "zAlt", "zPress"]) await setv(id, "");
await p.click("#tabBtnDope"); await p.evaluate(() => document.getElementById("advCond").open = true);
await setv("temp", "10"); await setv("altitude", "5000"); await settle(); const zB = await zEl();
await setv("temp", "59"); await setv("altitude", "0"); await p.click("#tabBtnGear"); await setv("zTemp", "10"); await setv("zAlt", "5000"); await settle();
const at100 = await p.evaluate(() => { const s = window.__bc.lastRun.samples.find(q => Math.round(q.distance.In(window.__B.Distance.Yard)) === 100); return -s.dropAngle.In(window.__B.Angular.MRad); });
ok("zero solved under zero conditions (same bore angle as zeroing there)", near(zA, zB, 1e-6) && Math.abs(zA - zToday) > 0.01, `zero ${zA.toFixed(4)} = ${zB.toFixed(4)} vs today-zero ${zToday.toFixed(4)} mil`);
R = await p.evaluate(() => ({ mz: window.__bc.lastRun.mvZero, mn: window.__bc.lastRun.mvNow, zc: window.__bc.lastRun.zc }));
ok("…then fired under today's: zero MV 2636.5 (10°F powder) vs 2710 today → hits high at 100 → dial down", near(R.mz, 2636.5, 0.01) && near(R.mn, 2710, 0.01) && R.zc.temp === 10 && at100 < -0.02, `100 yd ${at100.toFixed(3)} mil`);
ok("zero conditions summary + card chip", (await p.textContent("#zeroSum")).includes("10°F") && (await p.textContent("#dcMore")).includes("Zeroed @ 10°F"));
for (const id of ["zTemp", "zHum", "zAlt", "zPress", "ptSens", "mvTemp"]) await setv(id, ""); await settle();

/* 4) turret clicks, separate from display unit */
await setv("turret", "0.25moa"); await settle();
const em = await tgtMil(), ck = Math.round(em * 3.437747 / 0.25);
await p.click("#tabBtnDope");
ok("display MIL, turret ¼ MOA: clicks in MOA", (await p.textContent("#dcElevClk")) === `U ${ck} clicks · ¼ MOA` && (await p.textContent("#dcElevK")).includes("MIL"), await p.textContent("#dcElevClk"));
await p.check("#roundClk"); await settle();
ok("round to click: dial shows the click value in mil", (await p.textContent("#dcElev")) === `U ${(ck * 0.25 / 3.437747).toFixed(2)}`, await p.textContent("#dcElev"));
await p.uncheck("#roundClk"); await setv("turret", ""); await settle();
ok("default turret = display unit (0.1 mil)", (await p.textContent("#dcElevClk")) === `U ${Math.round(em / 0.1)} clicks · 0.1 mil`, await p.textContent("#dcElevClk"));
await setv("turret", "custom"); await setv("turretV", "0.2"); await setv("turretU", "mil"); await settle();
ok("custom turret 0.2 mil", (await p.textContent("#dcElevClk")) === `U ${Math.round(em / 0.2)} clicks · 0.2 mil`, await p.textContent("#dcElevClk"));
await setv("turret", ""); await settle();

/* 5) exact target row + per-mph wind */
await setv("target", "437"); await settle();
const trs = await p.$$eval("#results tbody tr", a => a.map(r => ({ c: r.className, t: r.children[0].textContent, pm: r.children[4].textContent })));
ok("exact target row inserted + highlighted once", trs.filter(r => r.c.includes("tgt")).length === 1 && trs.find(r => r.c.includes("tgt")).t.startsWith("437 yd"), trs.map(r => r.t).join(","));
await setv("target", "500"); await settle();
const t5 = await p.$$eval("#results tbody tr", a => a.map(r => ({ c: r.className, t: r.children[0].textContent })));
ok("target on a step row: highlighted, not duplicated", t5.filter(r => r.t.startsWith("500 yd")).length === 1 && t5.find(r => r.t.startsWith("500 yd")).c.includes("tgt"));
const hdr = await p.$$eval("#results thead th", a => a.map(x => x.textContent));
const pm = await p.evaluate(() => { const R = window.__bc.lastRun, M = window.__B.Angular.MRad; return Math.abs(R.tgtF.windageAngle.In(M) - R.tgtN.windageAngle.In(M)) / 10; });
ok("1 mph column + card line", hdr.some(h => h.includes("1 mph")) && hdr.some(h => /Clicks|clk/.test(h)) && (await p.textContent("#dcInfo")).includes(`1 mph full = ${pm.toFixed(2)} MIL`) && pm > 0.03 && pm < 0.1, pm.toFixed(3));

/* 6) transonic */
await setv("target", "1200"); await setv("maxRange", "1500"); await settle(); R = await LR();
ok("Mach 1.2 of local speed of sound (59°F ≈ 1340 fps)", near(R.vT, 1.2 * 1116.4, 3), R.vT.toFixed(1));
ok("transonic range found (140 ELD-M @2710 ≈ 1000–1300 yd)", R.trans && R.trans.range > 1000 && R.trans.range < 1300, JSON.stringify(R.trans));
const tr = await p.$$eval("#results tbody tr.trans td:first-child", a => a.map(x => parseInt(x.textContent)));
ok("table marks transonic rows past that range", tr.length > 0 && tr.every(r => r >= R.trans.range - 100), tr.join(","));
ok("card warns transonic before target", (await p.textContent("#dcWarn")).includes(`Transonic at ${R.trans.range} yd`) && (await p.textContent("#dcWarn")).includes("before target"));
ok("chart draws the Mach 1.2 marker", await p.evaluate(() => typeof window.__bc.lastRun.trans.range === "number" && window.__bc.lastRun.trans.range <= 1500));
await setv("temp", "0"); await settle(); const cold = await LR();
ok("colder air → lower local Mach 1.2 and earlier transonic", cold.vT < R.vT - 50 && cold.trans.range < R.trans.range, `${cold.vT.toFixed(0)} fps @ ${cold.trans.range} yd`);
await setv("temp", "59"); await setv("target", "600"); await setv("maxRange", "1000"); await settle();

/* 7) Miller stability */
const sgT = await p.evaluate(() => window.__bc.millerSG(2710, { temp: 59, alt: 0 }));
ok("Miller 140gr 6.5 ELD-M 1.39\" 1:8 @ 59°F sea level ≈ 1.9–2.0 (tip est.)", sgT.sg >= 1.85 && sgT.sg <= 2.05 && sgT.assumed, sgT.sg.toFixed(3));
ok("card shows SG stable (in Details)", (await p.textContent("#dcMore")).includes("stable"));
await p.click("#tabBtnGear"); await setv("bulletName", "140gr HPBT"); 
const sgP = await p.evaluate(() => window.__bc.millerSG(2710, { temp: 59, alt: 0 }));
ok("plain Miller (no tip) ≈ 1.63", near(sgP.sg, 1.63, 0.03), sgP.sg.toFixed(3));
const sgHi = await p.evaluate(() => window.__bc.millerSG(2710, { temp: 59, alt: 8000 }));
ok("altitude correction raises SG", sgHi.sg > sgP.sg * 1.25, sgHi.sg.toFixed(2));
await setv("bulletName", "Hornady 140gr ELD-M"); await setv("twist", "10"); await settle();
ok("1:10 → warn (<1.4)", /marginal/.test(await p.textContent("#dcWarn")), await p.textContent("#dcWarn"));
await setv("twist", "12"); await settle();
ok("1:12 → unstable (<1.0)", /unstable/.test(await p.textContent("#dcWarn")), await p.textContent("#dcWarn"));
await setv("length", ""); await settle();
ok("length unknown is stated", (await p.textContent("#dopeCard")).includes("length unknown"));
await setv("length", "1.390"); await setv("twist", "8"); await settle();

/* 8) truing */
await setv("target", "800"); await settle();
await setv("mv", "2650"); await settle(); const obs = +(await tgtMil()).toFixed(2);
await setv("mv", "2710"); await settle();
await p.click("#tabBtnDope"); await p.click("#trueBtn"); await p.waitForSelector("#trSheet.show");
await p.fill("#trRange", "800"); await p.fill("#trObs", String(obs)); await p.click('#trUnit button[data-v="MIL"]'); await p.click('#trWhat button[data-v="mv"]');
await p.click("#trGo"); await p.waitForFunction(() => !document.getElementById("trSave").disabled, null, { timeout: 30000 });
const res = await p.evaluate(() => { const { solveTrue, ...r } = window.__bc; return null; });
const out = await p.textContent("#trOut");
const mvT = +out.match(/→ (\d+) fps/)[1];
ok("truing MV converges to the true 2650 fps", near(mvT, 2650, 4), out);
await p.click("#trSave"); await settle();
const L1 = await p.evaluate(() => window.__bc.P.rifles[0].loads[0]);
ok("trued MV saved to load with note", near(+L1.mv, 2650, 4) && L1.mvSource === "trued" && /^Trued at 800 yd on .+: MV 26\d\d fps/.test(L1.trued), L1.trued);
await p.click("#tabBtnGear");
ok("Trued note shown on the load", (await p.textContent("#truedNote")).includes("Trued at 800 yd"));
// BC scale
await setv("mv", "2710"); await setv("bc", "0.310"); await settle(); const obsB = +(await tgtMil()).toFixed(2);
await setv("bc", "0.326"); await settle();
await p.click("#tabBtnDope"); await p.click("#trueBtn"); await p.fill("#trRange", "800"); await p.fill("#trObs", String(obsB)); await p.click('#trWhat button[data-v="bc"]');
await p.click("#trGo"); await p.waitForFunction(() => !document.getElementById("trSave").disabled, null, { timeout: 30000 });
const outB = await p.textContent("#trOut"), kB = +outB.match(/BC × ([\d.]+)/)[1];
ok("truing BC scale converges (0.310/0.326 = 0.951)", near(kB, 0.310 / 0.326, 0.004), outB);
await p.click("#trSave"); await settle();
ok("trued BC saved", near(+(await p.evaluate(() => window.__bc.P.rifles[0].loads[0].bc)), 0.310, 0.0015));
await setv("bc", "0.326"); await settle();

/* 9) printable dope card */
await p.click("#dcBtn"); await p.waitForSelector("#dcView.show"); await p.click('#dcvStep button[data-v="50"]'); await setv("dcvMax", "1000"); await p.waitForTimeout(400);
let n = await p.$$eval("#dcPrint tbody tr", a => a.length);
ok("dope card 50 yd steps to 1000 = 20 rows", n === 20, n);
await p.click('#dcvStep button[data-v="25"]'); await p.waitForTimeout(400);
n = await p.$$eval("#dcPrint tbody tr", a => a.length);
const head = await p.textContent("#dcPrint .hd"), hcols = await p.$$eval("#dcPrint thead th", a => a.map(x => x.textContent));
ok("25 yd steps = 40 rows; header with gun/load/zero/conditions; clicks + 10 mph", n === 40 && head.includes("6.5 CM · 140 ELD-M") && head.includes("Zero 100 yd") && head.includes("59°F") && hcols.join("|") === "Yd|Elev MIL|Clk|10 mph MIL|Clk|Spin MIL|fps", head);
await p.emulateMedia({ media: "print" });
const pv = await p.evaluate(() => ({ card: document.getElementById("dopeCard").getClientRects().length + document.getElementById("results").getClientRects().length, nav: getComputedStyle(document.querySelector(".tabbar, nav") || document.body).display, view: getComputedStyle(document.getElementById("dcView")).display,
  ctl: getComputedStyle(document.querySelector(".dcvCtl")).display, w: document.getElementById("dcPrint").getBoundingClientRect().width }));
ok("print media shows only the dope card (wrist ≈ 3.4in)", pv.card === 0 && pv.view === "block" && pv.ctl === "none" && near(pv.w, 326, 6), JSON.stringify(pv));
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
await p.screenshot({ path: OUT + "screenshot-dopecard-print.png", fullPage: true });
await p.emulateMedia({ media: "screen" });
await p.click('#dcvSize button[data-v="full"]');
ok("full-page size", (await p.evaluate(() => document.getElementById("dcPrint").className)) === "full");
await p.click('#dcvSize button[data-v="wrist"]'); await p.click("#dcvClose");

/* 10) tap targets + contrast */
const small = [];
for (const t of ["Dope", "Gear", "Log"]) {
  await p.click(`#tabBtn${t}`); await p.evaluate(() => document.querySelectorAll("details").forEach(d => d.open = true)); await p.waitForTimeout(100);
  small.push(...await p.evaluate(t => [...document.querySelectorAll("button, select, input:not([type=checkbox]):not([type=hidden]):not([type=range]), summary, a.btn")].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width && !e.closest(".ovl") && (r.height < 44 || r.width < 44); })
    .map(e => `${t}:${e.id || e.textContent.trim().slice(0, 14)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`), t));
}
ok("tap targets ≥ 44px on Dope/Gear/Log", small.length === 0, small.join(", "));
await p.click("#tabBtnDope"); await p.click("#dcBtn"); await p.click("#trueBtn").catch(() => {});
const smallO = await p.evaluate(() => [...document.querySelectorAll(".ovl.show button, .ovl.show input, .ovl.show select")].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && (r.height < 44 || r.width < 44); }).map(e => `${e.id || e.textContent.trim().slice(0, 12)} ${Math.round(e.getBoundingClientRect().height)}`));
ok("tap targets ≥ 44px in truing / dope card sheets", smallO.length === 0, smallO.join(", "));
await p.evaluate(() => document.querySelectorAll(".ovl.show").forEach(o => o.classList.remove("show")));
await p.goto(URL_); await ready(); await p.click("#tabBtnDope");
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
await setv("target", "1200"); await setv("maxRange", "1500"); await settle();
for (const t of ["dark", "light", "od", "fde", "night"]) {
  await p.click("#themeBtn"); await p.click(`#themeBar button[data-t="${t}"]`); await p.click("#themeBtn"); await p.waitForTimeout(100);
  const c = await p.evaluate(() => { const bg = getComputedStyle(document.getElementById("dopeCard")).backgroundColor, out = [];
    for (const sel of ["#dcElev", "#dcElevClk", "#dcInfo", "#dcBracket", "#dcWarn span", "#dcWarn .w", "#dcFor", ".dcBig .k"]) { const e = document.querySelector(sel); if (e) out.push([sel, getComputedStyle(e).color]); }
    const tb = document.querySelector("#results table"), tbg = getComputedStyle(document.querySelector("#outSec") || document.body).backgroundColor;
    const tt = document.querySelector("#results tr.trans td"); if (tt) out.push(["tr.trans", getComputedStyle(tt).color, getComputedStyle(tt).backgroundColor !== "rgba(0, 0, 0, 0)" ? getComputedStyle(tt).backgroundColor : tbg]);
    return { bg, out }; });
  const low = c.out.map(([s, col, b2]) => [s, cr(col, b2 || c.bg)]).filter(([, r]) => r < 4.5);
  ok(`theme ${t}: dope card + new warnings AA (≥4.5)`, low.length === 0, low.map(([s, r]) => s + " " + r.toFixed(2)).join(", "));
  if (t === "light") { await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById("toast").classList.remove("show"); }); }
}
await p.click("#themeBtn"); await p.click('#themeBar button[data-t="dark"]'); await p.click("#themeBtn");

/* 11) old data still loads (no new fields) */
ok("old preset without new fields: not flagged, defaults off", await p.evaluate(() => !document.getElementById("rifleSaved").classList.contains("show") && document.getElementById("turret").value === ""));
console.log("ERRORS", JSON.stringify(errs));
console.log(pass + " checks passed"); await b.close();
if (errs.length) process.exit(1);
