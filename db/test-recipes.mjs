// Saved recipes by projectile (match across guns, apply) + copy load to another gun / duplicate on this gun.
import { chromium } from "playwright"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const ELD = { bulletId: "hornady-26331", bulletName: "Hornady 6.5mm 140 gr ELD Match", bc: "0.32", drag: "G7", weight: "140", diameter: "0.264", length: "1.39" };
const L = (id, name, o) => ({ id, name, mvSource: "", refMV: "", refBarrel: "", fpsPerInch: "", bcBands: "", useBands: "", ldKind: "hand", ...o });
const PRE = { version: 2, lastRifleId: "g1", lastRangeId: null, ranges: [], rifles: [
  { id: "g1", name: "Tikka 6.5 CM", gunKind: "rifle", sightHeight: "1.6", zero: "100", twist: "8", barrel: "24", lastLoadId: "E", loads: [
    L("A", "ELD-M H4350", { ...ELD, mv: "2710", mvSource: "measured", ldPowder: "Hodgdon H4350", ldCharge: "42.5", ldPrimer: "CCI BR-2 (large rifle bench rest)", ldCOAL: "2.800", ldCase: "Lapua", ldFired: "2" }),
    L("E", "ELD-M new", { ...ELD, mv: "2700" }) ] },
  { id: "g2", name: "Bergara HMR", gunKind: "rifle", sightHeight: "1.8", zero: "100", twist: "8", barrel: "20", lastLoadId: "B", loads: [
    L("B", "Ladder 41.8", { ...ELD, mv: "2640", mvSource: "measured", ldPowder: "Hodgdon H4350", ldCharge: "41.8", ldPrimer: "Federal 210M (large rifle match)", ldCOAL: "2.810", ldCBTO: "2.220", ldJump: "0.020" }),
    L("C", "Hand-typed 140", { bc: "0.322", drag: "G7", weight: "140", diameter: "0.264", mv: "2650", ldPowder: "Hodgdon Varget", ldCharge: "38.0", ldPrimer: "CCI 200 (large rifle)" }) ] },
  { id: "g3", name: "AR-10 .308", gunKind: "rifle", sightHeight: "2.6", zero: "100", twist: "10", barrel: "18", lastLoadId: "D", loads: [
    L("D", "168 SMK", { bc: "0.218", drag: "G7", weight: "168", diameter: "0.308", mv: "2650", ldPowder: "Hodgdon Varget", ldCharge: "44.0" }) ] },
  { id: "g4", name: "New build", gunKind: "rifle", sightHeight: "1.5", zero: "100", twist: "8", barrel: "26", loads: [] } ] };
const sess = (id, lid, rid, v, ch) => ({ id, rifleId: rid, loadId: lid, date: "2026-10-2" + id.slice(-1) + "T15:00:00.000Z", source: "manual", shots: v.map(x => ({ v: x })), wx: {}, recipe: { ldKind: "hand", ldPowder: "Hodgdon H4350", ldCharge: ch } });
const LOG = [sess("s1", "B", "g2", [2641, 2648, 2650, 2639, 2644], "41.8"), sess("s2", "B", "g2", [2630, 2660, 2601], "41.8"), sess("s3", "A", "g1", [2709, 2713, 2706], "42.5")];

const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(PRE))}); localStorage.setItem("bcalc.shotlog.v1", ${JSON.stringify(JSON.stringify(LOG))}); }`);
const p = await ctx.newPage();
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
const dialogs = []; let dialogAnswer = true, promptText = "";
p.on("dialog", d => { dialogs.push(d.message()); d.type() === "prompt" ? d.accept(promptText) : dialogAnswer ? d.accept() : d.dismiss(); });
const menu = async id => { await p.click("#" + id.match(/^(rifle|load|range)/)[1] + "Menu"); await p.waitForSelector("#pkMenu.show"); await p.click("#" + id); };
await p.goto(URL_); await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
await p.click("#tabBtnGear");   // presets + load data live on the Gear tab
const preset = () => p.evaluate(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")));

/* matching rules */
const pm = await p.evaluate(E => { const m = window.__bc.projMatch; return {
  db: m(E, { ...E, bc: "0.4" }), diffId: m(E, { ...E, bulletId: "x" }), name: m({ ...E, bulletId: "" }, { ...E, bulletId: "", drag: "G1" }),
  spec: m({ weight: "140", diameter: "0.264", bc: "0.32", drag: "G7" }, { weight: "140.2", diameter: "0.2645", bc: "0.325", drag: "G7" }),
  bcOff: m({ weight: "140", diameter: "0.264", bc: "0.32", drag: "G7" }, { weight: "140", diameter: "0.264", bc: "0.30", drag: "G7" }),
  model: m({ weight: "140", diameter: "0.264", bc: "0.32", drag: "G7" }, { weight: "140", diameter: "0.264", bc: "0.32", drag: "G1" }),
  dia: m(E, { ...E, diameter: "0.308" }), wt: m({ weight: "140", diameter: "0.264", bc: "0.32" }, { weight: "147", diameter: "0.264", bc: "0.32" }) }; }, ELD);
ok("match rules: db id / name / diameter+weight+BC; diameter is required", pm.db === "db" && pm.diffId === "" && pm.name === "name" && pm.spec === "spec" && pm.bcOff === "" && pm.model === "" && pm.dia === "" && pm.wt === "", JSON.stringify(pm));

/* button + sheet */
ok("Load data shows 'Use a saved recipe for this bullet (3)'", await p.evaluate(() => !document.getElementById("rcFind").hidden && document.getElementById("rcFind").textContent.includes("(3)") && !document.getElementById("rcBulletBtn").hidden));
await p.click("#recipeDetails > summary"); await p.click("#rcFind"); await p.waitForSelector("#rcSheet.show");
const rows = await p.$$eval("#rcList .rcItem", a => a.map(x => x.innerText.replace(/\s+/g, " ")));
console.log(rows.join("\n"));
ok("3 recipes (same gun first, .308 excluded)", rows.length === 3 && rows[0].includes("42.5 gr Hodgdon H4350") && rows[0].includes("Tikka 6.5 CM · ELD-M H4350") && !rows.join().includes("168 SMK"));
ok("other gun: best session stats + barrel warning", rows[1].includes("41.8 gr Hodgdon H4350") && rows[1].includes("2644 fps") && rows[1].includes("SD 4.6") && rows[1].includes("best of 2") && rows[1].includes('20" barrel vs your 24"'), rows[1]);
ok("hand-typed bullet matched by weight + BC, saved MV shown", rows[2].includes("same weight + BC") && rows[2].includes("Hand-typed 140") && rows[2].includes("2650 fps"), rows[2]);
ok("same-gun row has no warning + own stats", rows[0].includes("2709 fps") && !rows[0].includes("⚠"));
ok("sheet title names the bullet", (await p.textContent("#rcFor")).includes("Hornady 6.5mm 140 gr ELD Match · 3 saved recipes"));
await p.screenshot({ path: OUT + "screenshot-saved-recipes.png" });

/* apply */
await p.click('#rcList .rcItem[data-i="1"]'); await p.waitForTimeout(100);
const ap = await p.evaluate(() => ({ ch: ldCharge.value, pw: ldPowder.value, pr: ldPrimer.value, coal: ldCOAL.value, cbto: ldCBTO.value, mv: mv.value, dirty: loadSaved.textContent, open: rcSheet.classList.contains("show") }));
ok("tap applies recipe (not MV), autosaves (✓ Saved), closes sheet", ap.ch === "41.8" && ap.pw === "Hodgdon H4350" && ap.pr.startsWith("Federal 210M") && ap.coal === "2.810" && ap.cbto === "2.220" && ap.mv === "2700" && ap.dirty.includes("Saved") && !ap.open && dialogs.length === 0, JSON.stringify(ap));
ok("applied recipe autosaved to storage", (await preset()).rifles[0].loads[1].ldCharge === "41.8");
await p.click("#rcFind"); await p.click('#rcList .rcItem[data-i="0"]'); await p.waitForTimeout(100);
ok("replacing existing data asks first", dialogs.length === 1 && dialogs[0].includes("Replace") && (await p.inputValue("#ldCharge")) === "42.5");
dialogAnswer = false; await p.click("#rcFind"); await p.click('#rcList .rcItem[data-i="2"]'); await p.waitForTimeout(100); dialogAnswer = true;
ok("cancel keeps current data", (await p.inputValue("#ldPowder")) === "Hodgdon H4350" && (await p.inputValue("#ldCharge")) === "42.5" && dialogs.length === 2);
if (await p.isVisible("#rcSheet")) await p.click("#rcClose");
// switching loads keeps the autosaved data
await p.selectOption("#loadSel", "A"); await p.selectOption("#loadSel", "E");
ok("autosaved recipe survives switching loads", (await p.inputValue("#ldCharge")) === "42.5");

/* picking the bullet from the database opens the recipes (new empty load, made via the ⋯ menu) */
promptText = "Scratch load"; await menu("loadNew"); promptText = "";
ok("⋯ New load added + selected", (await p.evaluate(() => loadSel.selectedOptions[0].text)) === "Scratch load");
await p.evaluate(() => { for (const id of ["bulletId", "bulletName", "ldPowder", "ldCharge", "ldPrimer", "ldCOAL", "ldCBTO", "ldJump"]) document.getElementById(id).value = ""; document.getElementById("weight").value = "150"; document.getElementById("diameter").value = "0.308"; document.getElementById("weight").dispatchEvent(new Event("input", { bubbles: true })); });
ok("no matches for a different bullet → buttons hidden", await p.evaluate(() => rcFind.hidden && rcBulletBtn.hidden));
await p.click("#loadDetails > summary"); await p.click("#dbOpen"); await p.waitForSelector("#dbList .dbItem", { timeout: 20000 });
await p.evaluate(() => { const c = document.getElementById("dbCal"); c.value = ""; c.dispatchEvent(new Event("change")); }); await p.fill("#dbQ", "26331"); await p.waitForTimeout(300); console.log("db:", await p.textContent("#dbStatus"), await p.$$eval("#dbList .dbItem", a => a.slice(0,3).map(x => x.dataset.id))); await p.click('#dbList .dbItem[data-id="hornady-26331"]');
await p.waitForSelector("#rcSheet.show", { timeout: 3000 });
// 4 now: "ELD-M new" autosaved the 42.5 gr recipe applied above, so it is a saved recipe too
ok("DB pick with no load data → saved recipes sheet opens", (await p.$$eval("#rcList .rcItem", a => a.length)) === 4);
if (await p.isVisible("#rcSheet")) await p.click("#rcClose");
// ⋯ Delete (with confirm) + Undo toast, then delete again for real
let dN0 = dialogs.length; await menu("loadDel"); await p.waitForTimeout(100);
ok("⋯ Delete asks to confirm, offers Undo", dialogs.length === dN0 + 1 && dialogs.at(-1).includes("Delete load") && (await p.textContent("#toast")).includes("Undo") && !(await p.evaluate(() => window.__bc.P.rifles[0].loads.some(l => l.name === "Scratch load"))));
await p.click("#toast button"); await p.waitForTimeout(100);
ok("Undo restores the deleted load", await p.evaluate(() => window.__bc.P.rifles[0].loads.some(l => l.name === "Scratch load") && loadSel.selectedOptions[0].text === "Scratch load"));
await menu("loadDel"); await p.waitForTimeout(100);
ok("deleted for real", await p.evaluate(() => !window.__bc.P.rifles[0].loads.some(l => l.name === "Scratch load") && !JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles[0].loads.some(l => l.name === "Scratch load")));
await p.evaluate(() => document.getElementById("toast").classList.remove("show"));
await p.selectOption("#loadSel", "A");

/* copy sheet */
await menu("loadCopy"); await p.waitForSelector("#cpSheet.show");
let guns = await p.$$eval("#cpList .rcItem", a => a.map(x => x.innerText.replace(/\s+/g, " ")));
console.log(guns.join("\n"));
ok("copy list: same-diameter guns + empty gun, .308 hidden", guns.length === 2 && guns[0].startsWith("Bergara HMR") && guns[0].includes("2 loads, bullets .264") && guns[1].includes("no loads yet") && guns[1].startsWith("New build") && !guns.join().includes("AR-10"));
ok("MV preview uses barrel estimate", guns[0].includes('MV 2610 fps est. for 20" (2710 @ 24")') && guns[1].includes('MV 2760 fps est. for 26"'), guns.join(" | "));
ok("show-all button counts hidden guns", (await p.textContent("#cpAllBtn")).includes("1 with other bullet diameters"));
await p.screenshot({ path: OUT + "screenshot-copy-load.png" });
await p.click("#cpAllBtn");
guns = await p.$$eval("#cpList .rcItem", a => a.map(x => x.innerText.replace(/\s+/g, " ")));
ok("show all: .308 gun listed with diameter warning", guns.length === 3 && guns.some(g => g.includes("AR-10 .308") && g.includes("Different bullet diameter (.308\")")));
await p.click("#cpAllBtn");
const logN = await p.evaluate(() => window.__bc.log.length);
await p.click('#cpList .rcItem[data-id="g2"]'); await p.waitForTimeout(150);
let st = await p.evaluate(() => { const P = window.__bc.P, r = P.rifles.find(g => g.id === P.lastRifleId), l = r.loads.find(x => x.id === r.lastLoadId);
  return { gun: r.name, name: l.name, mv: l.mv, src: l.mvSource, refMV: l.refMV, refB: l.refBarrel, ch: l.ldCharge, pw: l.ldPowder, bid: l.bulletId, form: { sel: loadSel.selectedOptions[0].text, gun: rifleSel.selectedOptions[0].text, mv: mv.value, ch: ldCharge.value, barrel: barrel.value },
    sess: window.__bc.log.filter(s => s.loadId === l.id).length, log: window.__bc.log.length, open: cpSheet.classList.contains("show") }; });
ok("copied to other gun, opened there, MV re-estimated + flagged", st.gun === "Bergara HMR" && st.name === "ELD-M H4350 (copy)" && st.mv === "2610" && st.src === "estimate" && st.refMV === "2710" && st.refB === "24" && st.ch === "42.5" && st.pw === "Hodgdon H4350" && st.bid === "hornady-26331"
  && st.form.sel === "ELD-M H4350 (copy)" && st.form.gun === "Bergara HMR" && st.form.mv === "2610" && st.form.barrel === "20" && !st.open, JSON.stringify(st));
ok("shot log sessions not copied", st.sess === 0 && st.log === logN);
ok("copy persisted; source untouched", await p.evaluate(() => { const P = JSON.parse(localStorage.getItem("bcalc.presets.v1")); const a = P.rifles[0].loads.find(l => l.id === "A"); return P.rifles[1].loads.length === 3 && a.mv === "2710" && a.mvSource === "measured"; }));
// keep mode → New build
await p.click("#rifleSel"); await p.selectOption("#rifleSel", "g1"); await p.selectOption("#loadSel", "A");
await menu("loadCopy"); await p.click('#cpMv button[data-v="keep"]');
ok("keep mode preview", (await p.textContent('#cpList .rcItem[data-id="g4"]')).includes("MV 2710 fps kept, marked estimated"));
await p.click('#cpList .rcItem[data-id="g4"]'); await p.waitForTimeout(150);
st = await p.evaluate(() => { const r = window.__bc.P.rifles.find(g => g.id === "g4"); return { n: r.loads.length, l: r.loads[0], cur: window.__bc.P.lastRifleId }; });
ok("copy to empty gun with MV kept (marked estimated)", st.n === 1 && st.cur === "g4" && st.l.mv === "2710" && st.l.mvSource === "estimate" && st.l.refMV === "2710" && st.l.refBarrel === "24" && st.l.ldCharge === "42.5", JSON.stringify(st.l));
// duplicate on this gun (twice); an edit autosaves first, so the copy and the source both carry it
await p.selectOption("#rifleSel", "g1"); await p.selectOption("#loadSel", "A");
await p.evaluate(() => { const e = document.getElementById("ldCharge"); e.value = "42.8"; e.dispatchEvent(new Event("input", { bubbles: true })); });
dialogAnswer = false; const dN = dialogs.length;
await menu("loadCopy"); await p.click("#cpDup"); await p.waitForTimeout(150); dialogAnswer = true;
st = await p.evaluate(() => { const r = window.__bc.P.rifles[0]; const l = r.loads.find(x => x.id === r.lastLoadId); return { names: r.loads.map(x => x.name), name: l.name, ch: l.ldCharge, mv: l.mv, src: l.mvSource, srcCh: r.loads.find(x => x.id === "A").ldCharge, gun: window.__bc.P.lastRifleId, recOpen: recipeDetails.open, focus: document.activeElement.id }; });
ok("duplicate on same gun keeps MV, no unsaved-changes prompt (autosaved), opens copy for editing", dialogs.length === dN && st.gun === "g1" && st.name === "ELD-M H4350 (copy)" && st.ch === "42.8" && st.srcCh === "42.8" && st.mv === "2710" && st.src === "measured" && st.recOpen, JSON.stringify(st));
await p.selectOption("#loadSel", "A"); await menu("loadCopy"); await p.click("#cpDup"); await p.waitForTimeout(150);
ok("second duplicate gets '(copy 2)'", (await p.evaluate(() => loadSel.selectedOptions[0].text)) === "ELD-M H4350 (copy 2)");
// the copies now show up as saved recipes for this bullet
await p.selectOption("#loadSel", "E");
ok("copies appear as saved recipes", (await p.textContent("#rcFind")).includes("(7)"), await p.textContent("#rcFind"));

/* themes: sheets render in all 5 */
for (const t of ["light", "od", "fde", "night", "dark"]) {
  await p.evaluate(t => { document.getElementById("themeBtn").click(); document.querySelector(`#themeBar button[data-t="${t}"]`).click(); }, t);
  await p.click("#rcFind"); await p.waitForSelector("#rcSheet.show");
  const c = await p.evaluate(() => { const i = document.querySelector("#rcList .rcItem"), cs = getComputedStyle(i), w = document.querySelector("#rcList .w"); return { bg: cs.backgroundColor, fg: cs.color, w: w && getComputedStyle(w).color }; });
  if (t === "light") await p.screenshot({ path: OUT + "screenshot-saved-recipes-light.png" });
  await p.click("#rcClose");
  ok(`theme ${t}: recipe rows use theme colors`, c.bg !== c.fg && c.w && c.w !== c.fg, JSON.stringify(c));
}
await p.reload(); await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"));
ok("after reload: copies persisted", await p.evaluate(() => window.__bc.P.rifles[0].loads.length === 4 && window.__bc.P.rifles[1].loads.length === 3));

console.log(`\n${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs)); await b.close();
if (errs.length) process.exit(1);
