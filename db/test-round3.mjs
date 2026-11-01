// Round 3: up travel from zero, gust lull step, ⅔ shooter-height hint, first-optic zero question, Table-to width,
// Gear text fit (no ellipsis), read-only "set by optic" rows, 🎯 Truing button, AA contrast of new text, console errors.
import { chromium } from "playwright"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
// round-2 shaped data: optics without opUp, a third gun with no optic
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", opticId: "o1", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] },
  { id: "r2", name: "308 Win", gunKind: "rifle", sightHeight: "1.6", zero: "100", twist: "10", barrel: "22", turret: "0.25moa", opticId: "o2", lastLoadId: "l2",
    loads: [{ id: "l2", name: "175 SMK", bc: "0.243", drag: "G7", weight: "175", diameter: "0.308", mv: "2600", length: "1.240", mvSource: "measured", ldKind: "factory" }] },
  { id: "r3", name: "Tikka 6mm", gunKind: "rifle", sightHeight: "1.5", zero: "100", twist: "7.5", barrel: "24", lastLoadId: "l3",
    loads: [{ id: "l3", name: "108 ELD-M", bc: "0.270", drag: "G7", weight: "108", diameter: "0.243", mv: "2950", length: "1.250", mvSource: "measured", ldKind: "hand" }] }],
  optics: [{ id: "o1", name: "Razor HD", opTurret: "0.1mil", opTurretV: "", opTurretU: "mil", opReticle: "mil", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.75", opWTravel: "", opTrack: "" },
           { id: "o2", name: "308 scope", opTurret: "0.25moa", opTurretV: "", opTurretU: "mil", opReticle: "moa", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.6", opWTravel: "", opTrack: "" },
           { id: "o3", name: "Spare Vortex", opTurret: "0.1mil", opTurretV: "", opTurretU: "mil", opReticle: "mil", opFP: "SFP", opMag: "12", opTurn: "10", opTravel: "30", opCant: "", opSH: "", opWTravel: "", opTrack: "" }],
  opticsMig: 1, ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", values: { target: "1000", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
let WX = { w: 8, g: 14 };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 44.98, longitude: -93.27 } });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))}); }`);
await ctx.route("https://api.open-meteo.com/v1/forecast**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: 260,
  current: { temperature_2m: 59, relative_humidity_2m: 40, wind_speed_10m: WX.w, wind_direction_10m: 270, wind_gusts_10m: WX.g, surface_pressure: 984 } }) }));
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
const gun = async id => { await p.selectOption("#rifleSel", id); await p.waitForTimeout(250); };
const R = () => p.evaluate(() => window.__bc.P.rifles.map(r => ({ id: r.id, o: r.opticId || null, z: r.zeroUnconf ? r.zeroUnconf.why : null })));
const zOf = async id => (await R()).find(r => r.id === id);
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
const colors = sels => p.evaluate(sels => { const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== "transparent") return c; } return getComputedStyle(document.body).backgroundColor; };
  return sels.flatMap(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent || getComputedStyle(e).position === "fixed").map(e => [s, getComputedStyle(e).color, bgOf(e)])); }, sels);
// visible text that is cut off (ellipsis / overflow) or doesn't fit its input/select
const cutScan = () => p.evaluate(() => { const c = document.createElement("canvas").getContext("2d"), res = [];
  for (const e of document.querySelectorAll("main *")) { if (!e.offsetParent || e.closest(".ovl") || e.id === "status") continue; const s = getComputedStyle(e);
    if (e.tagName === "SELECT" || e.tagName === "INPUT" && !["checkbox", "radio", "range", "hidden"].includes(e.type)) {
      const tx = e.tagName === "SELECT" ? e.selectedOptions[0]?.text || "" : e.value || e.placeholder; c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const extra = e.tagName === "SELECT" ? 16 : 0, avail = e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - extra;
      if (c.measureText(tx).width > avail + 1) res.push(`${e.id} "${tx}" ${Math.round(c.measureText(tx).width)}>${Math.round(avail)}`);
    } else if ((s.textOverflow === "ellipsis" || s.overflow === "hidden" || s.whiteSpace === "nowrap") && e.scrollWidth > e.clientWidth + 1 && e.textContent.trim() && !e.matches("canvas"))
      res.push(`${e.id || e.className} "${e.textContent.trim().slice(0, 30)}" ${e.scrollWidth}>${e.clientWidth}`);
  } return res; });
await p.goto(URL_); await ready();
await p.evaluate(async () => { window.__B = await import("https://cdn.jsdelivr.net/npm/js-ballistics@3/dist/index.js"); });
const reqMil = () => p.evaluate(() => -window.__bc.lastRun.tgt.dropAngle.In(window.__B.Angular.MRad));

/* 0) round-2 data loads untouched */
ok("round-2 optics load: no zero question, no flags, opUp blank", !(await p.isVisible("#zpDlg")) && (await R()).every(r => !r.z) && (await p.evaluate(() => window.__bc.P.optics.length === 3 && window.__bc.P.optics.every(o => !o.opUp))));

/* 8) Truing button */
const tb = await p.evaluate(() => { const b2 = document.getElementById("trueBtn"), r = document.createRange(); r.selectNodeContents(b2); const lines = new Set([...r.getClientRects()].map(x => Math.round(x.top))); return { t: b2.textContent.trim(), lines: lines.size, h: b2.getBoundingClientRect().height, ws: getComputedStyle(b2).whiteSpace }; });
ok("button reads “🎯 Truing” on one line", tb.t === "🎯 Truing" && tb.lines === 1 && tb.ws === "nowrap", JSON.stringify(tb));

/* 1) up travel from zero */
await p.click("#tabBtnGear"); await p.click("#opMore > summary");
ok("More specs has “Up travel from zero” in the turret unit (blank = estimate)", (await p.isVisible("#opUp")) && (await txt('label[for="opUp"]')).includes("(mil)") && (await p.inputValue("#opUp")) === "" && (await p.getAttribute("#opUp", "placeholder")) === "estimate");
await setv("opTravel", "14"); await p.click("#tabBtnDope"); await settle();
const need = await reqMil();
let ts = await p.evaluate(() => { const t = window.__bc.turretSpec(); return { up: t.up, set: t.upSet }; });
ok("blank → estimate min(14, 14/2 + 0) = 7 mil, warning shows “~7.0”", ts.up === 7 && !ts.set && /only ~7\.0 mil up travel/.test(await txt("#dcWarn")), await txt("#dcWarn"));
await p.click('#viewSeg button[data-v="full"]'); await settle();
const ovr = () => p.$$eval("#results tbody tr", a => a.filter(r => r.children[1].classList.contains("ovr")).map(r => r.children[0].textContent));
const ov7 = await ovr();
ok("table underlines rows past the estimate", ov7.length >= 1 && ov7.includes("1000 yd"), ov7.join(","));
await p.click("#tabBtnGear"); await setv("opUp", "9"); await p.click("#tabBtnDope"); await settle();
ts = await p.evaluate(() => { const t = window.__bc.turretSpec(); return { up: t.up, set: t.upSet }; });
ok(`up travel 9 overrides the estimate (needs ${need.toFixed(2)}): no warning, no underline`, ts.up === 9 && ts.set && !/up travel/.test(await txt("#dcWarn")) && (await ovr()).length === 0, JSON.stringify(ts));
await p.click("#tabBtnGear"); await setv("opUp", "6"); await p.click("#tabBtnDope"); await settle();
const w6 = await txt("#dcWarn"), ov6 = await ovr();
ok("up travel 6 (< estimate 7): warning “only 6.0 mil” (no ~), more rows underlined", /only 6\.0 mil up travel/.test(w6) && !/~6\.0/.test(w6) && ov6.length > ov7.length, w6 + " | " + ov6.join(","));
ok("table note names the set travel", (await txt("#results")).includes("beyond 6 mil up travel"));
ok("opUp saved on the optic", await p.evaluate(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")).optics.find(o => o.id === "o1").opUp === "6"));
await p.click("#tabBtnGear"); await setv("opUp", ""); await p.click("#tabBtnDope"); await settle();
ok("clearing it returns to the estimate", (await p.evaluate(() => window.__bc.turretSpec().up)) === 7 && /~7\.0/.test(await txt("#dcWarn")));
await p.click('#viewSeg button[data-v="dope"]'); await settle();
// hands-on: turns + clicks with travel warning together
await p.click("#tabBtnGear"); await setv("opTurn", "5"); await p.click("#tabBtnDope"); await settle();
const ec = await p.evaluate(() => window.__bc.angs(window.__bc.lastRun.tgt).ec), ct = await txt("#dcElevClk");
ok("hands-on: turns + clicks on the card with the optic attached", ct.startsWith(`U 1 turn + ${ec - 50} click`) && ct.includes(`(${ec})`), ct);
await p.click("#tabBtnGear"); await setv("opTurn", ""); await setv("opTravel", "");

/* 7) read-only rows */
await p.evaluate(() => { document.getElementById("rifleDetails").open = true; });
const ro = await p.evaluate(() => ({ sh: !document.getElementById("gunSHRo").hidden && document.getElementById("sightHeight").hidden, shT: document.getElementById("gunSHRo").textContent, shL: document.getElementById("gunSHRoL").textContent, shLv: !document.getElementById("gunSHRoL").hidden,
  tu: !document.getElementById("gunTurretRo").hidden && document.getElementById("turret").hidden, tuT: document.getElementById("gunTurretRo").textContent, rowV: !document.getElementById("gunSHRow").hidden && !document.getElementById("gunTurretRow").hidden }));
ok("optic attached: gun sight height + turret rows shown read-only, “set by optic”", ro.rowV && ro.sh && ro.tu && ro.shLv && ro.shL === "set by optic" && ro.shT.includes('1.75"') && ro.shT.includes("gun's 1.75") && ro.tuT.includes("0.1 mil"), JSON.stringify(ro));
await gun("r3");
ok("gun with no optic: rows editable, no “set by optic”", await p.evaluate(() => document.getElementById("gunSHRo").hidden && !document.getElementById("sightHeight").hidden && document.getElementById("gunTurretRo").hidden && !document.getElementById("turret").hidden));
ok("optic picker says “No optic”", await p.evaluate(() => document.getElementById("opticSel").selectedOptions[0].text === "No optic"));

/* 4) first optic asks once */
promptAns = "Tikka scope"; await menu("optic", "opNew");
await p.waitForSelector("#zpDlg.show");
ok("new optic on a gun with none asks “Is this rifle already zeroed with this scope?”", (await txt("#zpQ")) === "Is this rifle already zeroed with this scope?" && (await p.isVisible("#zpYes")) && (await p.isVisible("#zpNo")));
await p.screenshot({ path: OUT + "screenshot-r3-optic-zero-prompt.png" });
const zpc = await colors(["#zpQ", "#zpFor", "#zpYes", "#zpNo"]);
await p.click("#zpYes"); await p.waitForTimeout(150);
ok("Yes → attached, zero stays confirmed", !(await p.isVisible("#zpDlg")) && (await zOf("r3")).o && !(await zOf("r3")).z && !(await p.isVisible("#zeroFlag")));
ok("optic with blank sight height: gun's sight height stays editable", await p.evaluate(() => document.getElementById("gunSHRo").hidden && !document.getElementById("sightHeight").hidden) || await p.evaluate(() => window.__bc.curOptic().opSH === "1.5"));
await menu("optic", "opDetach");
ok("detach still flags", !(await p.isVisible("#zpDlg")) && /removed/.test((await zOf("r3")).z || ""));
await p.click("#zeroConfirm");
await menu("optic", "opAttach"); await p.click('#opList .opItem[data-id="o3"]'); await p.waitForSelector("#zpDlg.show");
ok("attaching an unattached existing optic to a gun with none asks too", await p.isVisible("#zpDlg"));
await p.click("#zpNo"); await p.waitForTimeout(150);
ok("No → Zero not confirmed (Gear flag + card warning)", /not zeroed/.test((await zOf("r3")).z || "") && (await p.isVisible("#zeroFlag")) && (await txt("#zeroFlagTxt")).includes("Zero not confirmed"));
await p.click("#tabBtnDope"); await settle();
ok("hands-on: Dope card warns Zero not confirmed", (await txt("#dcWarn")).includes("Zero not confirmed"));
await p.click("#tabBtnGear"); await p.click("#zeroConfirm"); await p.waitForTimeout(100);
ok("Confirm zero clears it", !(await zOf("r3")).z && !(await p.isVisible("#zeroFlag")));
await p.selectOption("#opticSel", (await p.evaluate(() => window.__bc.P.optics.find(o => o.name === "Tikka scope").id))); await p.waitForTimeout(200);
ok("replacing an optic flags without asking", !(await p.isVisible("#zpDlg")) && /changed from/.test((await zOf("r3")).z || ""));
await p.click("#zeroConfirm");
await menu("optic", "opAttach"); await p.click('#opList .opItem[data-id="o1"]'); await p.waitForTimeout(200);
ok("moving an optic from another gun flags both without asking", !(await p.isVisible("#zpDlg")) && /moved here/.test((await zOf("r3")).z || "") && /moved to/.test((await zOf("r1")).z || ""));
await p.click("#zeroConfirm"); await gun("r1"); await p.click("#zeroConfirm");
await p.selectOption("#opticSel", "o1"); await p.waitForTimeout(200);   // move it back
ok("moving it back to a gun that had none still flags (move, not a first fit)", !(await p.isVisible("#zpDlg")) && /moved here/.test((await zOf("r1")).z || ""));
await p.click("#zeroConfirm"); await gun("r3"); await p.click("#zeroConfirm"); await gun("r1");
const nO = await p.evaluate(() => window.__bc.P.optics.length);
await gun("r3"); promptAns = "Temp"; await menu("optic", "opNew"); await p.waitForSelector("#zpDlg.show"); await p.keyboard.press("Escape"); await p.waitForTimeout(150);
ok("Escape on the question = No (safe)", !(await p.isVisible("#zpDlg")) && /not zeroed/.test((await zOf("r3")).z || ""));
await p.click("#zeroConfirm"); await menu("optic", "opDel");
ok("delete still flags without asking", !(await p.isVisible("#zpDlg")) && /deleted/.test((await zOf("r3")).z || "") && (await p.evaluate(() => window.__bc.P.optics.length)) === nO);
await p.click("#zeroConfirm"); await gun("r1");

/* 6) Gear text fits; 5) Table to */
await p.evaluate(() => document.querySelectorAll("details").forEach(d => d.open = true));
ok("drag model options shortened", await p.evaluate(() => [...document.getElementById("drag").options].map(o => o.text).join("|") === "G7 (boat-tail)|G1 (flat-base)"));
ok("zero conditions note shown in full (no ellipsis)", await p.evaluate(() => { const h = [...document.querySelectorAll("#tabGear .hint")].find(x => x.textContent.includes("Conditions on the day")); return h && !h.querySelector(".info") && h.scrollWidth <= h.clientWidth + 1; }));
ok("no helper text uses an ellipsis any more", await p.evaluate(() => [...document.querySelectorAll(".h1")].every(e => getComputedStyle(e).textOverflow !== "ellipsis" && getComputedStyle(e).whiteSpace !== "nowrap")));
for (const w of [360, 390, 412]) {
  await p.setViewportSize({ width: w, height: 915 }); await p.waitForTimeout(150);
  const all = [];
  for (const [g, tab] of [["r1", "Dope"], ["r1", "Gear"], ["r3", "Gear"], ["r1", "Log"]]) {
    await p.click(`#tabBtn${tab}`); if (tab === "Gear") await gun(g); await p.evaluate(() => document.querySelectorAll("details").forEach(d => d.open = true)); await p.waitForTimeout(100);
    all.push(...(await cutScan()).map(x => `${tab}/${g}: ${x}`));
  }
  ok(`${w}px: no cut-off or ellipsis text on Dope/Gear/Log`, all.length === 0 && (await p.evaluate(() => document.documentElement.scrollWidth)) <= w, all.join(" ; "));
  await p.click("#tabBtnDope");
  for (const v of ["1000", "3000"]) { await setv("maxRange", v); await p.waitForTimeout(50);
    const f = await p.evaluate(v => { const e = document.getElementById("maxRange"), s = getComputedStyle(e), c = document.createElement("canvas").getContext("2d"); c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      return { need: c.measureText(v + " yd").width, avail: e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), sw: e.scrollWidth, cw: e.clientWidth }; }, v);
    ok(`${w}px: “Table to” fits ${v} (+ unit room)`, f.need <= f.avail && f.sw <= f.cw, JSON.stringify(f)); }
}
await setv("maxRange", "1000"); await settle();

/* 2) + 3) wind: lull step + ⅔ hint */
await p.setViewportSize({ width: 412, height: 915 });
await p.click("#calcBtn"); await p.waitForFunction(() => window.__bc.wx && window.__bc.wx.gust === 14, null, { timeout: 15000 }); await settle();
let bt = await txt("#dcBracket"), bn = nums(bt.split("mph")[0]);
ok("gust bracket: lull 5 / call 8 / 11 / 14 (lull = call − spread/2)", bn.join("/") === "5/8/11/14" && nums(bt.split("→")[1]).length >= 4, bt);
ok("call keeps the weather value (not auto-reduced)", (await p.inputValue("#windSpeed")) === "8");
ok("⅔ shooter-height hint by the call", (await p.isVisible("#wxShHint")) && (await txt("#wxShHint")).includes("~5 mph") && (await txt("#wxShHint")).includes("⅔"), await txt("#wxShHint"));
const hl = await p.evaluate(() => { const e = document.getElementById("wxShHint"), r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; });
ok("hint is one line at 412px", hl === 1, String(hl));
await p.evaluate(() => document.getElementById("windSpeed").scrollIntoView({ block: "center" })); await p.waitForTimeout(150);
await p.screenshot({ path: OUT + "screenshot-r3-wind.png" });
const wc = await colors(["#wxShHint", "#dcBracket", "#dcBracket .gn", "#wxWindNote"]);
await setv("windSpeed", "12"); await settle();
ok("manual call hides the hint", !(await p.isVisible("#wxShHint")));
bn = nums((await txt("#dcBracket")).split("mph")[0]);
ok("manual call 12 with weather spread 6: 9 / 12 / 15 / 18", bn.join("/") === "9/12/15/18", bn.join("/"));
WX = { w: 4, g: 30 }; await p.click("#src-windSpeed"); await p.click("#calcBtn"); await p.waitForFunction(() => window.__bc.wx.gust === 30, null, { timeout: 15000 }); await settle();
await setv("windSpeed", "4"); await settle();
bn = nums((await txt("#dcBracket")).split("mph")[0]);
ok("lull clamps at 0 (call 4, spread 26)", bn[0] === 0 && bn[1] === 4 && bn[2] === 17 && bn[3] === 30, bn.join("/"));
// no weather: fallback lull = call − 2
const c2 = await b.newContext({ viewport: { width: 412, height: 915 } }); const p2 = await c2.newPage(); p2.on("pageerror", e => errs.push("PAGEERR2 " + e.message));
await p2.goto(URL_); await p2.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 }); await p2.waitForTimeout(400);
const fb = nums((await p2.textContent("#dcBracket")).split("mph")[0]), call2 = +(await p2.inputValue("#windSpeed"));
ok("no weather: lull step = call − 2 mph, first", fb[0] === Math.max(0, call2 - 2) && fb[1] === call2 && fb[2] === call2 + 2 && !(await p2.isVisible("#wxShHint")), fb.join("/"));
await c2.close();

/* gear screenshot: optic attached, read-only rows, up travel */
await p.click("#tabBtnGear"); await gun("r1"); await setv("opTravel", "29"); await setv("opUp", "11.5");
await p.evaluate(() => { document.querySelectorAll("#tabGear details").forEach(d => d.open = false); document.getElementById("rifleDetails").open = true; document.getElementById("opMore").open = true; document.getElementById("toast").classList.remove("show"); document.getElementById("gunSHRow").scrollIntoView({ block: "start" }); window.scrollBy(0, -70); });
await p.waitForTimeout(200); await p.screenshot({ path: OUT + "screenshot-r3-gear.png" });

/* contrast of the new text in all 5 themes */
const NEW = ["#wxShHint", "#dcBracket", "#dcBracket .gn", "#wxWindNote", ".roVal span", ".roVal small", "label .ro", 'label[for="opUp"]', "#opUp", "#opHint", "#trueBtn"];
for (const t of ["dark", "light", "od", "fde", "night"]) {
  await p.click("#themeBtn"); await p.click(`#themeBar button[data-t="${t}"]`); await p.click("#themeBtn"); await p.waitForTimeout(80);
  await p.evaluate(() => document.querySelectorAll("details").forEach(d => d.open = true));
  const rows = [];
  for (const tab of ["Dope", "Gear"]) { await p.click(`#tabBtn${tab}`); await p.waitForTimeout(80); rows.push(...await colors(NEW)); }
  await p.evaluate(() => { window.__bc.P.lastRifleId; document.getElementById("zpFor").textContent = "Test"; document.getElementById("zpDlg").classList.add("show"); });
  rows.push(...await colors(["#zpQ", "#zpFor", "#zpYes", "#zpNo"]));
  await p.evaluate(() => document.getElementById("zpDlg").classList.remove("show"));
  const low = rows.map(([s, c, bg]) => [s, cr(c, bg)]).filter(([, r]) => r < 4.5);
  const seen = new Set(rows.map(r => r[0]));
  ok(`theme ${t}: new text AA ≥ 4.5:1`, low.length === 0 && ["#wxShHint", ".roVal small", "label .ro", "#zpFor", "#zpNo"].every(x => seen.has(x)), low.map(x => x[0] + " " + x[1].toFixed(2)).join(", ") + " seen " + seen.size);
}
await p.click("#themeBtn"); await p.click('#themeBar button[data-t="dark"]'); await p.click("#themeBtn");
await p.click("#tabBtnGear"); await p.reload(); await ready();
ok("reload: opUp persists, opens on Dope, no zero question", (await p.evaluate(() => window.__bc.P.optics.find(o => o.id === "o1").opUp)) === "11.5" && !(await p.isVisible("#zpDlg")) && (await p.evaluate(() => document.getElementById("tabBtnDope").getAttribute("aria-selected") === "true")));
console.log("ERRORS", JSON.stringify(errs));
console.log(pass + " checks passed"); await b.close();
if (errs.length) process.exit(1);
