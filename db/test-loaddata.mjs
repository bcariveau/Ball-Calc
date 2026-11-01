// Load data (recipe), gun type, session snapshots, compare table, CSV/JSON export, migration of old saved data, themes.
import { chromium } from "playwright"; import fs from "fs"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
async function newPage(init) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, acceptDownloads: true });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
  return p;
}
const ready = p => p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
const go = async p => { await p.goto(URL_); await ready(p); };

/* 1) migration: v1 presets + old session saved by the previous version */
const OLD = { version: 1, rifles: [{ id: "r1", name: "Old 6.5", sightHeight: "1.6", zero: "100", twist: "8", barrel: "26", lastLoadId: "l1",
  loads: [{ id: "l1", name: "140 ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured" }] }],
  ranges: [], lastRifleId: "r1", lastRangeId: null };
const OLDLOG = [{ id: "s1", rifleId: "r1", loadId: "l1", date: "2026-10-01T15:00:00.000Z", source: "manual", shots: [{ v: 2705 }, { v: 2712 }, { v: 2701 }], notes: "old", wx: {}, barrel: 26 }];
let p = await newPage(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(OLD))}); localStorage.setItem("bcalc.shotlog.v1", ${JSON.stringify(JSON.stringify(OLDLOG))}); }`);
await go(p); await p.click("#tabBtnGear");
const mig = await p.evaluate(() => { const P = window.__bc.P; return { v: P.version, gk: P.rifles[0].gunKind, lk: P.rifles[0].loads[0].ldKind, mv: P.rifles[0].loads[0].mv,
  dirtyR: document.getElementById("rifleSaved").classList.contains("show"), dirtyL: document.getElementById("loadSaved").classList.contains("show"), log: window.__bc.log.length, rec: window.__bc.log[0]?.recipe,
  saved: JSON.parse(localStorage.getItem("bcalc.presets.v1")).version, gunSel: document.getElementById("gunKind").value }; });
ok("old presets load: version 2, gunKind rifle, ldKind hand, data kept", mig.v === 2 && mig.gk === "rifle" && mig.lk === "hand" && mig.mv === "2710" && mig.saved === 2, JSON.stringify(mig));
ok("old presets: nothing re-saved on load (no ✓ Saved flash)", !mig.dirtyR && !mig.dirtyL);
ok("old session (no recipe) still loads", mig.log === 1 && mig.rec === undefined);
ok("old session list renders without recipe line", (await p.$$eval(".slItem .r", a => a.length)) === 0 && (await p.$$eval(".slItem", a => a.length)) === 1);

/* 2) load data: fill, autosave, reload */
await p.click("#recipeDetails > summary");
await p.fill("#ldPowder", "Hodgdon H4350");
await p.evaluate(() => { for (const [id, v] of [["ldCharge", "42.5"], ["ldCOAL", "2.800"]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } });
await p.fill("#ldPrimer", "CCI BR-2 (large rifle bench rest)"); await p.fill("#ldCBTO", "2.215"); await p.fill("#ldJump", "0.020");
await p.fill("#ldCase", "Lapua"); await p.fill("#ldFired", "3"); await p.fill("#ldTrim", "1.910"); await p.fill("#ldPrep", "annealed, mandrel"); await p.fill("#ldNotes", "lot 2391");
ok("recipe edits autosave to the load + ✓ Saved", (await p.evaluate(() => window.__bc.P.rifles[0].loads[0].ldCharge)) === "42.5" && (await p.textContent("#loadSaved")).includes("Saved"));
ok("load summary shows recipe", (await p.textContent("#loadRecipe")).includes('42.5 gr Hodgdon H4350 · CCI BR-2 · COAL 2.800"'), await p.textContent("#loadRecipe"));
ok("datalists present", (await p.$$eval("#dlPowder option", a => a.length)) > 100 && (await p.$$eval("#dlPrimer option", a => a.length)) > 30);
await p.evaluate(() => document.getElementById("loadDetails").scrollIntoView()); await p.waitForTimeout(200);
await p.screenshot({ path: OUT + "screenshot-loaddata.png" });
ok("autosaved to storage (last field typed)", (await p.evaluate(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles[0].loads[0].ldNotes)) === "lot 2391");
// gun type → handgun label
await p.click("#rifleDetails > summary"); await p.selectOption("#gunKind", "handgun");
ok("handgun type autosaves gun + summary", (await p.evaluate(() => window.__bc.P.rifles[0].gunKind)) === "handgun" && (await p.textContent("#rifleSaved")).includes("Saved") && (await p.textContent("#rifleSum")).startsWith("Handgun"));
await p.reload(); await ready(p);
const after = await p.evaluate(() => { const l = window.__bc.P.rifles[0].loads[0]; return { ch: l.ldCharge, pw: l.ldPowder, coal: l.ldCOAL, pr: l.ldPrimer, gk: window.__bc.P.rifles[0].gunKind,
  form: document.getElementById("ldCharge").value, sum: document.getElementById("rifleSum").textContent }; });
ok("recipe + gun type persist after reload", after.ch === "42.5" && after.pw === "Hodgdon H4350" && after.coal === "2.800" && after.gk === "handgun" && after.form === "42.5" && after.sum.startsWith("Handgun"), JSON.stringify(after));
await p.click("#tabBtnGear");  // app always opens on Dope (round 2)
await p.click("#rifleDetails > summary"); await p.click("#recipeDetails > summary");
await p.selectOption("#gunKind", "rifle");

/* 3) snapshot into sessions */
await p.click("#tabBtnLog");
await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show");
for (const v of ["2741", "2748", "2737", "2744"]) { await p.fill("#slVel", v); await p.press("#slVel", "Enter"); }
ok("editor shows recipe for new session", (await p.textContent("#slEdRecipe")).includes("42.5 gr Hodgdon H4350") && (await p.textContent("#slEdRecipe")).includes("Lapua ×3"), await p.textContent("#slEdRecipe"));
await p.screenshot({ path: OUT + "screenshot-session-recipe.png" });
await p.click("#slSave"); await p.waitForTimeout(200);
// change the load: 43.0 gr, save, then another session
await p.evaluate(() => { const e = document.getElementById("ldCharge"); e.value = "43.0"; e.dispatchEvent(new Event("input", { bubbles: true })); });   // autosaves
await p.click("#slNewBtn"); await p.waitForSelector("#slEditor.show");
for (const v of ["2771", "2775", "2769"]) { await p.fill("#slVel", v); await p.press("#slVel", "Enter"); }
await p.click("#slSave"); await p.waitForTimeout(200);
// bluetooth path gets a snapshot too
await p.evaluate(() => window.__bc.addShotsToLiveSession([{ v: 2780.2 }], { source: "bluetooth" })); await p.click("#slEdClose"); await p.waitForTimeout(100);
const snaps = await p.evaluate(() => window.__bc.log.filter(s => s.loadId === "l1").map(s => ({ src: s.source, ch: s.recipe?.ldCharge, pw: s.recipe?.ldPowder, ln: s.recipe?.loadName, gn: s.recipe?.gunName })));
ok("history kept: first session 42.5, later 43.0, bluetooth 43.0", snaps.length === 4 && snaps[1].ch === "42.5" && snaps[2].ch === "43.0" && snaps[3].src === "bluetooth" && snaps[3].ch === "43.0" && snaps[1].ln === "140 ELD-M" && snaps[1].gn === "Old 6.5", JSON.stringify(snaps));
ok("session list shows recipe lines", (await p.$$eval(".slItem .r", a => a.map(x => x.textContent))).some(t => t.includes("42.5 gr Hodgdon H4350")));
// attach recipe to the old session
await p.click('.slItem >> text=old'); await p.waitForSelector("#slEditor.show");
ok("old session says no load data", (await p.textContent("#slEdRecipe")).includes("No load data"));
await p.click("#slEdRecipeBtn"); await p.click("#slSave"); await p.waitForTimeout(150);
ok("attach current data to old session", (await p.evaluate(() => window.__bc.log.find(s => s.id === "s1").recipe?.ldCharge)) === "43.0");
// compare table
await p.click("#slCmp > summary"); await p.waitForTimeout(100);
const cmp = await p.$$eval("#slCmpTbl tbody tr", a => a.map(r => [...r.children].map(c => c.textContent.trim())));
ok("compare table sorted by charge with fps/gr", cmp.length === 4 && cmp[0][0] === "42.5" && cmp[1][0] === "43.0" && cmp[1][7] !== "", JSON.stringify(cmp));
await p.click('#slCmpScope button[data-v="gun"]');
ok("compare scope: all loads on gun adds Load column", (await p.$$eval("#slCmpTbl thead th", a => a[0].textContent)) === "Load");
await p.click('#slCmpScope button[data-v="load"]');
await p.evaluate(() => { document.getElementById("slSection").scrollIntoView(); document.getElementById("toast").classList.remove("show"); }); await p.waitForTimeout(400);
await p.screenshot({ path: OUT + "screenshot-session-list.png" });
// factory ammo
await p.click("#tabBtnGear");
await p.click('#ldKindSeg button[data-v="factory"]');
ok("factory toggle shows factory fields", await p.isVisible("#ldMaker") && !(await p.isVisible("#ldPowder")));
await p.fill("#ldMaker", "Federal"); await p.fill("#ldProduct", "Gold Medal Match"); await p.fill("#ldLot", "A123");
ok("factory recipe text", (await p.textContent("#loadRecipe")).includes("Factory · Federal Gold Medal Match · lot A123"), await p.textContent("#loadRecipe"));
await p.click('#ldKindSeg button[data-v="hand"]');

/* 4) exports */
await p.click("#tabBtnLog");
let [dl] = await Promise.all([p.waitForEvent("download"), p.click("#slCsvBtn")]);
const csv = fs.readFileSync(await dl.path(), "utf8").replace(/^\ufeff/, ""); const lines = csv.trim().split("\n"), hdr = lines[0].split(",");
const iCh = hdr.indexOf("charge_gr"), iPw = hdr.indexOf("powder");
ok("CSV has recipe columns + values", iCh > 0 && lines.length === 5 && lines.some(l => l.split(",")[iCh] === "42.5" && l.split(",")[iPw] === "Hodgdon H4350"), hdr.length + " cols");
await p.click("#tabBtnGear");
[dl] = await Promise.all([p.waitForEvent("download"), p.click("#exportBtn")]);
const js = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
ok("JSON export includes recipes + gunKind + load fields", js.shotSessions.filter(s => s.recipe?.ldPowder).length === 4 && js.rifles[0].gunKind === "rifle" && js.rifles[0].loads[0].ldPowder === "Hodgdon H4350");
// re-import roundtrip keeps recipes
await p.evaluate(() => { window.__bc.log.length = 0; });
p.once("dialog", d => d.accept()); await p.setInputFiles("#importFile", await dl.path()); await p.waitForTimeout(600);
ok("import roundtrip keeps recipes", (await p.evaluate(() => window.__bc.log.filter(s => s.recipe?.ldCharge).length)) === 4);

/* 5) themes: persistence + contrast */
const lum = h => { const c = h.replace("#", "").match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b2) => { const [x, y] = [lum(a), lum(b2)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const shots = [];
await p.click("#tabBtnDope");
for (const t of ["dark", "light", "od", "fde", "night"]) {
  await p.click("#themeBtn"); await p.click(`#themeBar button[data-t="${t}"]`); await p.click("#themeBtn");
  const v = await p.evaluate(() => { const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue("--" + n).trim(); return { theme: document.documentElement.dataset.theme, meta: document.querySelector('meta[name="theme-color"]').content,
    bg: g("bg"), card: g("card"), text: g("text"), muted: g("muted"), hint: g("hint"), accent: g("accent"), on: g("on-accent"), warn: g("warn"), err: g("err"), input: g("input"), fav: document.getElementById("favicon").href.length }; });
  const c = { text: cr(v.text, v.card), muted: cr(v.muted, v.card), hint: cr(v.hint, v.card), accent: cr(v.accent, v.card), onAccent: cr(v.on, v.accent), warn: cr(v.warn, v.input), err: cr(v.err, v.card) };
  ok(`theme ${t}: applied + readable`, v.theme === t && v.meta === v.bg && c.text >= 7 && c.muted >= 4.5 && c.hint >= 4.5 && c.accent >= 3 && c.onAccent >= 4.5 && c.warn >= 3 && c.err >= 3,
    Object.entries(c).map(([k, x]) => k + " " + x.toFixed(1)).join(", "));
  await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById("toast").classList.remove("show"); }); await p.waitForTimeout(400);
  const f = `/workspace/bt/ld/theme-${t}.png`; await p.screenshot({ path: f }); shots.push([t, f]);
  if (t === "dark") await p.screenshot({ path: OUT + "screenshot-header.png", clip: { x: 0, y: 0, width: 412, height: 80 } });
}
await p.click("#themeBtn"); await p.click('#themeBar button[data-t="light"]');
await p.reload(); await ready(p);
ok("theme persists after reload (light)", (await p.evaluate(() => document.documentElement.dataset.theme)) === "light");
// pre-paint: theme attribute present before the module runs
const p2 = await newPage(); await p2.goto(URL_);  // fresh context → default dark
ok("fresh install defaults to dark", (await p2.evaluate(() => document.documentElement.dataset.theme)) === "dark");
const early = await p.evaluate(async () => { const r = await fetch(location.href); const t = await r.text(); return t.indexOf("bcalc.theme.v1") < t.indexOf("<style>"); });
ok("theme script runs before CSS (no flash)", early);

// combined theme grid
const imgs = shots.map(([t, f]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${t}</figcaption></figure>`).join("");
const g = await b.newPage({ viewport: { width: 5 * 420 + 20, height: 960 } });
await g.setContent(`<body style="margin:0;padding:10px;background:#555;display:flex;gap:10px;font:16px system-ui;color:#fff">${imgs.replace(/<figure>/g, '<figure style="margin:0;width:412px">').replace(/<img /g, '<img style="width:412px;border-radius:10px" ').replace(/<figcaption>/g, '<figcaption style="text-align:center;padding-top:4px">')}</body>`);
await g.screenshot({ path: OUT + "screenshot-themes.png", fullPage: true });

console.log(`\n${pass} checks passed`); console.log("ERRORS", JSON.stringify(errs)); await b.close();
if (errs.length) process.exit(1);
