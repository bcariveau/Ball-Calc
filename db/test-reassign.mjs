// Move / reassign chrono sessions: other load, other gun, snapshot replace vs keep, undo, bulk select, orphans, live Bluetooth, persistence.
import { chromium } from "playwright"; import fs from "fs"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const ELD = { bulletId: "hornady-26331", bulletName: "Hornady 6.5mm 140 gr ELD Match", bc: "0.32", drag: "G7", weight: "140", diameter: "0.264" };
const L = (id, name, o) => ({ id, name, mvSource: "", refMV: "", refBarrel: "", fpsPerInch: "", bcBands: "", useBands: "", length: "", ldKind: "hand", ...o });
const PRE = { version: 2, lastRifleId: "g1", lastRangeId: null, ranges: [], rifles: [
  { id: "g1", name: "Tikka 6.5 CM", gunKind: "rifle", sightHeight: "1.6", zero: "100", twist: "8", barrel: "24", lastLoadId: "A", loads: [
    L("A", "ELD-M 42.5", { ...ELD, mv: "2710", ldPowder: "Hodgdon H4350", ldCharge: "42.5", ldPrimer: "CCI BR-2 (large rifle bench rest)", ldCOAL: "2.800" }),
    L("B", "ELD-M 43.0", { ...ELD, mv: "2735", ldPowder: "Hodgdon H4350", ldCharge: "43.0", ldPrimer: "CCI BR-2 (large rifle bench rest)", ldCOAL: "2.810" }) ] },
  { id: "g2", name: "Bergara HMR", gunKind: "rifle", sightHeight: "1.8", zero: "100", twist: "8", barrel: "20", lastLoadId: "C", loads: [
    L("C", "Bergara ELD-M", { ...ELD, mv: "2640", ldPowder: "Hodgdon H4350", ldCharge: "41.8", ldPrimer: "Federal 210M (large rifle match)", ldCOAL: "2.790" }),
    L("D", "Federal GMM", { ...ELD, mv: "2650", mvSource: "factory", ldKind: "factory", ldMaker: "Federal", ldProduct: "Gold Medal Match 140 ELD-M", ldLot: "A1" }) ] },
  { id: "g3", name: "Glock 19", gunKind: "handgun", sightHeight: "0.5", zero: "25", twist: "10", barrel: "4", lastLoadId: "H", loads: [
    L("H", "124 gr FMJ", { bc: "0.15", drag: "G1", weight: "124", diameter: "0.355", mv: "1150", ldPowder: "Hodgdon Titegroup", ldCharge: "4.4" }) ] } ] };
const rc = (gun, load, ch, extra = {}) => ({ gunName: gun, loadName: load, gunKind: "rifle", ...ELD, ldKind: "hand", ldPowder: "Hodgdon H4350", ldCharge: ch, ldPrimer: "CCI BR-2 (large rifle bench rest)", ...extra });
const S = (id, rid, lid, day, v, recipe) => ({ id, rifleId: rid, loadId: lid, date: `2026-10-${day}T15:00:00.000Z`, source: "manual", shots: v.map(x => ({ v: x })), wx: {}, barrel: 24, recipe });
const LOG = [S("s1", "g1", "A", "10", [2705, 2711, 2709], rc("Tikka 6.5 CM", "ELD-M 42.5", "42.5")),
  S("s2", "g1", "A", "12", [2731, 2738, 2736], rc("Tikka 6.5 CM", "ELD-M 42.5", "43.0")),
  S("s3", "g1", "A", "14", [2712, 2708, 2715, 2710, 2711], rc("Tikka 6.5 CM", "ELD-M 42.5", "42.5")),
  S("s4", "g1", "Zgone", "05", [2690, 2702], rc("Tikka 6.5 CM", "Old 140 load", "41.0")),
  S("s5", "gSold", "Zgone2", "03", [2601, 2610, 2598], rc("Sold rifle", "Old Sold load", "40.0"))];

const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(PRE))}); localStorage.setItem("bcalc.shotlog.v1", ${JSON.stringify(JSON.stringify(LOG))}); }`);
const p = await ctx.newPage();
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
p.on("dialog", d => d.accept());
const ready = () => p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
await p.goto(URL_); await ready(); await p.click("#tabBtnLog");   // shot log lives on the Log tab
const sess = id => p.evaluate(id => { const s = window.__bc.log.find(x => x.id === id); return s && { r: s.rifleId, l: s.loadId, ch: s.recipe?.ldCharge, coal: s.recipe?.ldCOAL, pr: s.recipe?.ldPrimer, gn: s.recipe?.gunName, ln: s.recipe?.loadName, bar: s.barrel, n: s.shots.length, kind: s.recipe?.ldKind }; }, id);
const diff = () => p.$$eval("#mvDiff tr", a => Object.fromEntries(a.map(r => [r.children[0].textContent, [r.children[1].textContent, r.children[3].textContent]])));
const listIds = () => p.$$eval("#slList .slItem", a => a.map(x => x.dataset.id));
// gun/load pickers live on the Gear tab; come back to the Log tab afterwards
const pickSel = async (gun, load) => { await p.click("#tabBtnGear"); await p.selectOption("#rifleSel", gun); if (load) await p.selectOption("#loadSel", load); await p.waitForTimeout(80); await p.click("#tabBtnLog"); };
const undoToast = async () => { await p.waitForSelector("#toast.show #toastAct"); await p.click("#toastAct"); await p.waitForTimeout(150); };

/* orphans */
let txt = await p.textContent("#slList");
ok("unassigned group lists sessions whose load/gun was deleted", txt.includes("Unassigned sessions (2)") && txt.includes("Unassigned (deleted load) · was Tikka 6.5 CM · Old 140 load") && txt.includes("Unassigned (deleted gun) · was Sold rifle · Old Sold load"));
ok("current load list = 3 sessions + 2 orphans", (await listIds()).join() === "s3,s2,s1,s4,s5", (await listIds()).join());

/* 1) another load on the same gun (s2 was really the 43.0 load) */
await p.click('#slList .slItem[data-id="s2"]'); await p.waitForSelector("#slEditor.show");
ok("editor has Move button", await p.isVisible("#slMoveBtn") && (await p.textContent("#slEdFor")) === "Tikka 6.5 CM · ELD-M 42.5");
await p.click("#slMoveBtn"); await p.waitForSelector("#mvSheet.show");
ok("sheet preselects session's gun + load (marked current)", (await p.inputValue("#mvGun")) === "g1" && (await p.$$eval("#mvLoads .rcItem.on", a => a.map(x => x.dataset.id))).join() === "A" && (await p.textContent("#mvLoads .rcItem.on")).includes("current"));
const gunOpts = await p.$$eval("#mvGun option", a => a.map(o => o.textContent));
ok("gun choices are saved presets with type", gunOpts.length === 3 && gunOpts[0].includes("Rifle") && gunOpts[2].includes("Glock 19 — Handgun"), gunOpts.join(" | "));
const loadRows = await p.$$eval("#mvLoads .rcItem", a => a.map(x => x.innerText.replace(/\s+/g, " ")));
ok("load rows show bullet + recipe", loadRows.length === 2 && loadRows[1].includes("Hornady 6.5mm 140 gr ELD Match") && loadRows[1].includes('43.0 gr Hodgdon H4350 · CCI BR-2 · COAL 2.810"'), loadRows[1]);
await p.uncheck("#mvUpd");
ok("same load + keep snapshot = nothing to do (Move disabled)", await p.isDisabled("#mvGo"));
await p.check("#mvUpd");
await p.click('#mvLoads .rcItem[data-id="B"]');
let d = await diff();
ok("before → after: load + load data change, gun same", d.Gun[1] === "no change" && d.Load[0] === "ELD-M 42.5" && d.Load[1] === "ELD-M 43.0" && d["Load data"][0].includes("43.0 gr Hodgdon H4350 · CCI BR-2") && d["Load data"][1].includes('COAL 2.810"') && !(await p.isDisabled("#mvGo")), JSON.stringify(d));
await p.click("#mvGo"); await p.waitForTimeout(200);
let s2 = await sess("s2");
ok("moved to load B, snapshot = B's saved data", s2.r === "g1" && s2.l === "B" && s2.ch === "43.0" && s2.coal === "2.810" && s2.ln === "ELD-M 43.0" && s2.n === 3, JSON.stringify(s2));
ok("editor header + toast with Undo", (await p.textContent("#slEdFor")) === "Tikka 6.5 CM · ELD-M 43.0" && (await p.textContent("#toast")).includes("Moved session to Tikka 6.5 CM · ELD-M 43.0") && await p.isVisible("#toastAct"));
await p.screenshot({ path: "/workspace/bt/mv/toast.png" });
/* undo */
await undoToast();
s2 = await sess("s2");
ok("Undo restores ids + original snapshot", s2.l === "A" && s2.ch === "43.0" && s2.coal === undefined && s2.ln === "ELD-M 42.5" && (await p.textContent("#slEdFor")) === "Tikka 6.5 CM · ELD-M 42.5", JSON.stringify(s2));
await p.click("#slMoveBtn"); await p.click('#mvLoads .rcItem[data-id="B"]'); await p.click("#mvGo"); await p.waitForTimeout(150);
await p.click("#slEdClose"); await p.waitForTimeout(100);
ok("list for load A no longer has s2", !(await listIds()).includes("s2"));
await pickSel("g1", "B");
ok("list for load B has s2", (await listIds())[0] === "s2");

/* 2) snapshot uses the load's saved data; edits autosave, so a re-sync picks them up */
await pickSel("g1", "A");
const setCh = v => p.evaluate(v => { const e = document.getElementById("ldCharge"); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }, v);
await setCh("49.0");
ok("on-screen edit autosaves to load A", (await p.evaluate(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles[0].loads.find(l => l.id === "A").ldCharge)) === "49.0");
await p.click('#slList .slItem[data-id="s1"]'); await p.click("#slMoveBtn"); await p.click('#mvLoads .rcItem[data-id="A"]');
await p.click("#mvGo"); await p.waitForTimeout(150); await p.click("#slEdClose");
ok("re-sync to own load uses the (autosaved) 49.0 + keeps the rest", (await sess("s1")).ch === "49.0" && (await sess("s1")).coal === "2.800");
await setCh("42.5");   // put load A back
await p.click('#slList .slItem[data-id="s1"]'); await p.click("#slMoveBtn"); await p.click('#mvLoads .rcItem[data-id="A"]');
await p.click("#mvGo"); await p.waitForTimeout(150); await p.click("#slEdClose");
ok("re-sync again after reverting: 42.5", (await sess("s1")).ch === "42.5");

/* 3) another gun: keep snapshot (unchecked) vs replace */
await p.click('#slList .slItem[data-id="s3"]'); await p.click("#slMoveBtn");
await p.selectOption("#mvGun", "g2");
ok("changing gun resets the load choice", (await p.$$eval("#mvLoads .rcItem.on", a => a.length)) === 0 && await p.isDisabled("#mvGo") && (await p.textContent("#mvDiff")).includes("Pick a load"));
await p.selectOption("#mvGun", "g3");
ok("gun with one load auto-selects it", (await p.$$eval("#mvLoads .rcItem.on", a => a.map(x => x.dataset.id))).join() === "H");
await p.selectOption("#mvGun", "g2"); await p.click('#mvLoads .rcItem[data-id="C"]'); await p.uncheck("#mvUpd");
d = await diff();
ok("keep-snapshot preview: gun/load/barrel change, load data unchanged", d.Gun[1] === "Bergara HMR" && d.Load[1] === "Bergara ELD-M" && d["Load data"][1] === "no change" && d.Barrel[0] === '24"' && d.Barrel[1] === '20"', JSON.stringify(d));
await p.screenshot({ path: "/workspace/bt/mv/keep.png" });
await p.check("#mvUpd"); d = await diff();
ok("replace preview shows C's recipe", d["Load data"][1].includes("41.8 gr Hodgdon H4350 · Federal 210M"));
await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act")); await p.waitForTimeout(400); await p.screenshot({ path: OUT + "screenshot-move-session.png" });
await p.uncheck("#mvUpd"); await p.click("#mvGo"); await p.waitForTimeout(150); await p.click("#slEdClose");
let s3 = await sess("s3");
ok("moved to other gun keeping exact recipe; names + barrel updated", s3.r === "g2" && s3.l === "C" && s3.ch === "42.5" && s3.pr.startsWith("CCI BR-2") && s3.gn === "Bergara HMR" && s3.ln === "Bergara ELD-M" && s3.bar === 20, JSON.stringify(s3));
await p.click('#slList .slItem[data-id="s1"]'); await p.click("#slMoveBtn"); await p.selectOption("#mvGun", "g2"); await p.click('#mvLoads .rcItem[data-id="C"]');
await p.click("#mvGo"); await p.waitForTimeout(150); await p.click("#slEdClose");
let s1 = await sess("s1");
ok("moved to other gun with load data replaced", s1.r === "g2" && s1.l === "C" && s1.ch === "41.8" && s1.pr.startsWith("Federal 210M") && s1.bar === 20, JSON.stringify(s1));

/* 4) compare table + saved-recipes best-session stats follow the move */
await pickSel("g2", "C");
await p.click("#slCmp > summary").catch(() => {}); await p.waitForTimeout(80);
const cmp = await p.$$eval("#slCmpTbl tbody tr", a => a.map(r => r.dataset.id));
ok("compare table on Bergara/C shows moved sessions", cmp.sort().join() === "s1,s3" && (await listIds()).slice(0, 2).join() === "s3,s1", cmp.join());
await pickSel("g1", "B"); await p.click("#tabBtnGear");
await p.click("#recipeDetails > summary"); await p.click("#rcFind"); await p.waitForSelector("#rcSheet.show");
const rcRow = await p.$$eval("#rcList .rcItem", a => a.map(x => x.innerText.replace(/\s+/g, " ")).find(t => t.includes("Bergara ELD-M")));
ok("saved-recipes best session for C now from moved session", rcRow.includes("2708 fps") && rcRow.includes("SD 3.1") && rcRow.includes("best of 2"), rcRow);
await p.click("#rcClose"); await p.click("#tabBtnLog");

/* 5) bulk move via select mode: orphans → B, then undo */
await p.click("#slSelBtn");
ok("select mode on: bar + checkboxes", await p.isVisible("#slSelBar") && (await p.getAttribute("#slList", "class")).includes("selecting") && await p.isDisabled("#slSelMove"));
await p.click('#slList .slItem[data-id="s4"]'); await p.click('#slList .slItem[data-id="s5"]');
ok("tapping selects (no editor opens)", (await p.textContent("#slSelN")) === "2 selected" && !(await p.isVisible("#slEditor")));
await p.evaluate(() => document.getElementById("slSelBar").scrollIntoView({ block: "end" })); await p.waitForTimeout(200);
await p.evaluate(() => document.getElementById("toast").classList.remove("show"));
await p.waitForTimeout(2400); await p.screenshot({ path: OUT + "screenshot-select-mode.png" });
await p.click("#slSelMove"); await p.waitForSelector("#mvSheet.show");
ok("bulk sheet title + mixed before values", (await p.textContent("#mvTitle")) === "↔ Move 2 sessions" && (await p.$$eval("#mvLoads .rcItem.on", a => a.length)) === 0);
await p.click('#mvLoads .rcItem[data-id="B"]'); d = await diff();
ok("bulk diff lists both origins", d.Gun[0].includes("Tikka 6.5 CM") && d.Gun[0].includes("Sold rifle (deleted)") && d.Load[0].includes("Old 140 load (deleted)"), JSON.stringify(d));
await p.evaluate(() => document.getElementById("toast").classList.remove("show", "act")); await p.waitForTimeout(400); await p.screenshot({ path: OUT + "screenshot-move-bulk.png" });
await p.click("#mvGo"); await p.waitForTimeout(200);
let s4 = await sess("s4"), s5 = await sess("s5");
ok("bulk move assigns both, select mode exits, orphans gone", s4.l === "B" && s5.r === "g1" && s5.l === "B" && s5.ch === "43.0" && !(await p.isVisible("#slSelBar")) && !(await p.textContent("#slList")).includes("Unassigned"), JSON.stringify([s4, s5]));
ok("toast says 2 sessions", (await p.textContent("#toast")).includes("Moved 2 sessions"));
await undoToast();
s4 = await sess("s4"); s5 = await sess("s5");
ok("bulk undo restores both as unassigned", s4.l === "Zgone" && s5.r === "gSold" && s5.ch === "40.0" && (await p.textContent("#slList")).includes("Unassigned sessions (2)"));
// long-press enters select mode with that session selected
const box = await (await p.$('#slList .slItem[data-id="s2"]')).boundingBox();
await p.mouse.move(box.x + 60, box.y + 15); await p.mouse.down(); await p.waitForTimeout(750); await p.mouse.up(); await p.waitForTimeout(100);
ok("long-press selects", (await p.textContent("#slSelN")) === "1 selected" && !(await p.isVisible("#slEditor")));
await p.click("#slSelAll"); ok("select all", (await p.textContent("#slSelN")) === "3 selected");
await p.click("#slSelDone"); ok("done leaves select mode", !(await p.isVisible("#slSelBar")));

/* 6) reassign a deleted-load session from its editor */
await p.click('#slList .slItem[data-id="s4"]'); await p.waitForSelector("#slEditor.show");
ok("orphan editor: warning header + highlighted assign button", (await p.textContent("#slEdFor")).startsWith("Unassigned (deleted load)") && (await p.textContent("#slMoveBtn")).includes("Assign") && (await p.getAttribute("#slMoveBtn", "class")).includes("hot"));
await p.click("#slMoveBtn"); await p.click('#mvLoads .rcItem[data-id="A"]');
d = await diff(); ok("orphan before shows deleted name", d.Load[0] === "Old 140 load (deleted)" && d.Load[1] === "ELD-M 42.5");
await p.click("#mvGo"); await p.waitForTimeout(150);
ok("orphan assigned to A", (await sess("s4")).l === "A" && (await p.textContent("#slEdFor")) === "Tikka 6.5 CM · ELD-M 42.5");
await p.click("#slEdClose");

/* 7) live Bluetooth session moved, later shots land in it */
await pickSel("g1", "A");
const nBefore = await p.evaluate(() => window.__bc.log.length);
const liveId = await p.evaluate(() => window.__bc.addShotsToLiveSession([{ v: 2701.4 }], { source: "bluetooth" }));
await p.click("#slMoveBtn"); await p.selectOption("#mvGun", "g2"); await p.click('#mvLoads .rcItem[data-id="C"]');
ok("live note shown", (await p.textContent("#mvNote")).includes("Radar shots keep going into this session"));
await p.click("#mvGo"); await p.waitForTimeout(150);
const id2 = await p.evaluate(() => window.__bc.addShotsToLiveSession([{ v: 2705.0 }, { v: 2699.2 }], { source: "bluetooth" }));
const live = await sess(liveId);
ok("radar shots after move go into the moved live session", id2 === liveId && live.r === "g2" && live.l === "C" && live.n === 3 && live.ch === "41.8" && (await p.evaluate(() => window.__bc.log.length)) === nBefore + 1, JSON.stringify(live));
ok("live editor shows new home + barrel", (await p.textContent("#slEdFor")) === "Bergara HMR · Bergara ELD-M" && (await p.inputValue("#slBarrel")) === "20");
await p.click("#slEdClose");

/* 8) exports */
let [dl] = await Promise.all([p.waitForEvent("download"), p.click("#slCsvBtn")]);
const csv = fs.readFileSync(await dl.path(), "utf8").replace(/^\ufeff/, "").trim().split("\n"); const hdr = csv[0].split(",");
const byVel = v => csv.find(l => l.includes(v))?.split(",");
ok("CSV reflects moves + unassigned", byVel("2705 2711 2709")[hdr.indexOf("gun")] === "Bergara HMR" && byVel("2705 2711 2709")[hdr.indexOf("charge_gr")] === "41.8" && byVel("2601 2610 2598")[hdr.indexOf("load")] === "Old Sold load (deleted gun)");
await p.click("#tabBtnGear");
[dl] = await Promise.all([p.waitForEvent("download"), p.click("#exportBtn")]);
const js = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
ok("JSON export reflects moves", js.shotSessions.find(s => s.id === "s3").rifleId === "g2" && js.shotSessions.find(s => s.id === "s2").loadId === "B");

/* 9) persistence */
await p.reload(); await ready(); await p.click("#tabBtnLog");
const all = await p.evaluate(() => Object.fromEntries(window.__bc.log.map(s => [s.id, s.rifleId + "/" + s.loadId + "/" + (s.recipe?.ldCharge || "")])));
ok("moves persist after reload", all.s1 === "g2/C/41.8" && all.s2 === "g1/B/43.0" && all.s3 === "g2/C/42.5" && all.s4 === "g1/A/42.5" && all.s5 === "gSold/Zgone2/40.0", JSON.stringify(all));

/* 10) themes */
for (const t of ["light", "od", "fde", "night", "dark"]) {
  await p.evaluate(t => { document.getElementById("themeBtn").click(); document.querySelector(`#themeBar button[data-t="${t}"]`).click(); document.getElementById("themeBtn").click(); }, t);
  await p.click('#slList .slItem[data-id="s5"]'); await p.click("#slMoveBtn"); await p.click('#mvLoads .rcItem[data-id="A"]');
  const c = await p.evaluate(() => { const g = e => getComputedStyle(document.querySelector(e)); return { bg: g("#mvSheet").backgroundColor, on: g("#mvLoads .rcItem.on").borderTopColor, ch: g("#mvDiff tr.ch td.b").color, txt: g("#mvLoads .rcItem").color }; });
  if (t === "light") await p.screenshot({ path: OUT + "screenshot-move-session-light.png" });
  await p.click("#mvCancel"); await p.click("#slEdClose");
  ok(`theme ${t}: move sheet themed`, c.bg !== c.txt && c.on !== c.txt && c.ch !== c.txt, JSON.stringify(c));
}
console.log(`\n${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs)); await b.close();
if (errs.length) process.exit(1);
