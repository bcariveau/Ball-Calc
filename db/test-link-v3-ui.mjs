// Integrated beta UI for linked firearms, as-fired history, move/split/undo, and MV redo.
// Serves this repo and drives beta.html in a fresh Playwright profile. Does not read a user profile,
// does not write the fixture files, and does not publish.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");

const PORT = 8771;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/ballisticbench-b-gaps";
fs.mkdirSync(ART, { recursive: true });
const presetPath = ROOT + "/db/fixtures/link-v3-v2.json";
const sessionPath = ROOT + "/db/fixtures/link-v3-sessions.json";
const presetRaw = fs.readFileSync(presetPath, "utf8");
const sessionRaw = fs.readFileSync(sessionPath, "utf8");
const presetBytes = fs.readFileSync(presetPath);
const sessionBytes = fs.readFileSync(sessionPath);

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 300));

const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
const pageErrors = [];
const dialogs = [];
let promptAnswer = null;
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => {
  dialogs.push(d.type() + ": " + d.message().slice(0, 90));
  if (d.type() === "prompt") {
    if (promptAnswer == null) { await d.dismiss(); return; }
    const a = promptAnswer; promptAnswer = null; await d.accept(a);
  } else if (d.type() === "confirm") await d.accept();
  else await d.dismiss();
});

let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };
async function startSelect() {
  if (await page.locator("#shotSelBtn").isHidden()) await page.click("#shotSelDone");
  await page.click("#shotSelBtn");
}

async function seed() {
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "dope", round: true, values: {} }));
    await new Promise((res) => { const d = indexedDB.deleteDatabase("bcalc-db"); d.onsuccess = d.onerror = d.onblocked = () => res(); });
    await new Promise((res, rej) => {
      const o = indexedDB.open("bcalc-db", 1);
      o.onupgradeneeded = () => o.result.createObjectStore("kv");
      o.onerror = () => rej(o.error);
      o.onsuccess = () => {
        const tx = o.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put(JSON.parse(sessions), "shotlog");
        tx.oncomplete = () => { o.result.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
    });
  }, { preset: presetRaw, sessions: sessionRaw });
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await seed();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").textContent === "BallisticBench" && window.__bc && window.__bc.P.rifles.length === 2);
  ok((await page.locator("h1").innerText()) === "BallisticBench", "beta page shows BallisticBench");

  const mig = await page.evaluate(async ({ preset, sessions }) => {
    const liveBefore = localStorage.getItem("bcalc.presets.v1");
    const mod = await import("/beta/js/link-v3.js");
    const copyP = JSON.parse(preset), copyS = JSON.parse(sessions);
    const rawP = JSON.stringify(copyP), rawS = JSON.stringify(copyS);
    const out = mod.migrateToV3(copyP, copyS);
    const back = mod.rollback(out.backup);
    const live = JSON.parse(localStorage.getItem("bcalc.presets.v1"));
    return {
      liveUntouched: localStorage.getItem("bcalc.presets.v1") === liveBefore,
      liveVersion: live.version,
      inputsUntouched: JSON.stringify(copyP) === rawP && JSON.stringify(copyS) === rawS,
      backup: JSON.stringify(out.backup.presets) === rawP && JSON.stringify(out.backup.sessions) === rawS,
      rollback: JSON.stringify(back.presets) === rawP && JSON.stringify(back.sessions) === rawS,
      lifted: out.presets.version === 3 && !out.presets.rifles[0].loads && out.presets.loads.length === 3,
      nullOptic: out.sessions[0].tg.strings[1].asFired.optic === null,
    };
  }, { preset: presetRaw, sessions: sessionRaw });
  ok(mig.liveUntouched && mig.liveVersion === 2, "opening the app and calling migrate does not rewrite the live v2 save");
  ok(mig.inputsUntouched && mig.backup && mig.rollback, "backup and rollback keep the original v2 bytes");
  ok(mig.lifted && mig.nullOptic, "the copy lifts loads and leaves the missing optic null");

  await page.click("#tabBtnGear");
  await page.selectOption("#rifleSel", "r2");
  await page.waitForFunction(() => document.querySelector("#loadSel").value === "l3" && document.querySelector("#opticSel").value === "");
  ok((await page.evaluate(() => window.__bc.P.rifles.find((r) => r.id === "r2").turret || "")) === "", "recalling a gun with no turret does not store a click value");
  ok(true, "Rifle B recalls Load B and no optic");
  await page.screenshot({ path: ART + "/recall-rifle-b-360.png" });
  await page.selectOption("#rifleSel", "r1");
  await page.waitForFunction(() => document.querySelector("#loadSel").value === "l1" && document.querySelector("#opticSel").value === "o1" && document.querySelector("#opTurret").value === "0.1mil");
  ok(true, "Rifle A recalls Razor and Load A");

  await page.fill("#mv", "2999");
  await page.selectOption("#opTurret", "0.25moa");
  promptAnswer = "Rifle A edited";
  await page.click("#rifleMenu");
  await page.click("#rifleRename");
  await page.waitForFunction(() => document.querySelector("#rifleSel").selectedOptions[0].textContent === "Rifle A edited");
  promptAnswer = "Load A edited";
  await page.click("#loadMenu");
  await page.click("#loadRename");
  await page.waitForFunction(() => document.querySelector("#loadSel").selectedOptions[0].textContent === "Load A edited");
  promptAnswer = "Razor edited";
  await page.click("#opticMenu");
  await page.click("#opRename");
  await page.waitForFunction(() => document.querySelector("#opticSel").selectedOptions[0].textContent.startsWith("Razor edited"));
  const edited = await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sess1");
    const st = s.tg.strings.find((x) => x.id === "st1").asFired;
    const live = window.__bc.P;
    return {
      recipeMv: st.recipe.mv, gun: st.recipe.gunName, load: st.recipe.loadName, turret: st.optic.opTurret, opticId: st.opticId,
      other: s.tg.strings.find((x) => x.id === "st2").asFired,
      liveMv: live.rifles[0].loads[0].mv, liveTurret: live.optics[0].opTurret, liveGun: live.rifles[0].name,
    };
  });
  ok(edited.recipeMv === "2737" && edited.gun === "Rifle A" && edited.load === "Load A" && edited.turret === "0.1mil", "as-fired history stays put after the live gun, optic, and load change");
  ok(edited.other.optic === null && edited.other.rifleId === "r2" && edited.other.recipe.mv === "2800", "the other firearm's string is not rewritten");
  ok(edited.liveMv === "2999" && edited.liveTurret === "0.25moa" && edited.liveGun === "Rifle A edited", "the live records did take the edits");

  await page.fill("#mv", "2737");
  await page.selectOption("#opTurret", "0.1mil");

  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#slEditor.show");
  const str1 = () => page.locator(".sgh").filter({ hasText: "String 1 ·" }).locator("small").innerText();
  const beforeRemove = await str1();
  ok(beforeRemove.includes("3 shots") && beforeRemove.includes("avg 2737"), "string 1 stats leave out the removed 2500");
  await page.locator(".shot[data-id='a'] button[data-f='x']").click();
  const removed = await str1();
  ok(removed.includes("2 shots") && removed.includes("avg 2755"), "Remove drops that shot from its string only");
  await page.locator(".shot[data-id='a'] button[data-f='x']").click();
  ok((await str1()).includes("avg 2737") && (await str1()).includes("3 shots"), "Restore puts the shot back on its string");

  await startSelect();
  await page.locator(".shot[data-id='c'] .shotCk").check();
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestGun", "r2");
  await page.selectOption("#shotDestLoad", "l3");
  await page.screenshot({ path: ART + "/move-360.png" });
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toastAct1");
  const toast1 = await page.locator("#toast").innerText();
  ok(/Moved 1 shot to Rifle B/.test(toast1) && toast1.includes("Redo MV") && toast1.includes("Undo"), "the move toast names the destination and still offers Undo and Redo");
  const moved = await page.evaluate(() => {
    const s = window.__bc.ED;
    const dest = s.tg.strings.find((st) => st.id !== "st1" && st.id !== "st2");
    const src = s.tg.strings.find((st) => st.id === "st1");
    const stay = s.tg.strings.find((st) => st.id === "st2");
    const hdr = document.querySelector("#tgHdrS").textContent;
    return {
      c: s.shots.find((x) => x.id === "c").str,
      a: s.shots.find((x) => x.id === "a").str,
      f: s.shots.find((x) => x.id === "f").str,
      dest: dest && dest.asFired,
      srcOptic: src.asFired.optic.opTurret,
      srcLoad: src.asFired.loadId,
      hole: src.holes[0].sh,
      stayOptic: stay.asFired.optic,
      stayShot: stay && s.shots.find((x) => x.id === "f").str === "st2",
      hdr,
      text: document.querySelector("#slShots").innerText,
    };
  });
  ok(moved.c !== "st1" && moved.dest.rifleId === "r2" && moved.dest.loadId === "l3" && moved.dest.optic === null, "the selected shot moves to Rifle B / Load B with a null optic");
  ok(moved.a === "st1" && moved.f === "st2" && moved.stayShot && moved.srcLoad === "l1", "unrelated shots and the source as-fired load stay");
  ok(moved.hole === null && moved.srcOptic === "0.1mil", "the moved shot's hole pairing is dropped and the source optic snapshot stays");
  ok(moved.text.includes("avg 2705") && moved.text.includes("avg 2800"), "source and destination averages both redraw");
  await page.click("#strRec");
  const scopeNote = await page.locator("#strPickNote").innerText();
  await page.click("#strPickClose");
  ok(/Rifle B has no scope saved, and it has no turret click value/.test(scopeNote) && !/No as-fired optic/.test(scopeNote) && moved.dest.optic === null, "a string with no optic and no current turret asks for a scope and does not store one");
  await page.screenshot({ path: ART + "/fallback-360.png" });
  const beforeUndo = JSON.stringify(moved.dest);
  await page.click("#toastAct");
  await page.waitForFunction(() => window.__bc.ED.shots.find((s) => s.id === "c").str === "st1");
  const undone = await page.evaluate(() => {
    const s = window.__bc.ED;
    return { c: s.shots.find((x) => x.id === "c").str, hole: s.tg.strings.find((st) => st.id === "st1").holes[0].sh, n: s.tg.strings.length };
  });
  ok(undone.c === "st1" && undone.hole === "c" && undone.n === 2, "Undo restores the shot and the hole pairing");
  ok(beforeUndo.includes('"rifleId":"r2"'), "the destination attribution existed before undo");

  await startSelect();
  await page.locator(".shot[data-id='b'] .shotCk").check();
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestGun", "r1");
  await page.selectOption("#shotDestLoad", "l2");
  await page.click("#shotDestClose");
  await page.click("#shotSplit");
  await page.waitForFunction(() => window.__bc.ED.shots.find((s) => s.id === "b").str !== "st1" && window.__bc.ED.shots.find((s) => s.id === "a").str === "st1");
  const split = await page.evaluate(() => {
    const s = window.__bc.ED;
    const dest = s.tg.strings.find((st) => st.asFired && st.asFired.loadId === "l2");
    return {
      a: s.shots.find((x) => x.id === "a").str,
      b: s.shots.find((x) => x.id === "b").str,
      c: s.shots.find((x) => x.id === "c").str,
      load: dest && dest.asFired.loadId,
      optic: dest && dest.asFired.opticId,
      date: s.date,
    };
  });
  ok(split.a === "st1" && split.b === split.c && split.load === "l2" && split.optic === "o1" && split.date === "2026-06-01T15:00:00.000Z", "split from the chosen shot keeps the earlier shot and stamps Load A2");
  await page.click("#toastAct");
  await page.waitForFunction(() => window.__bc.ED.shots.every((s) => s.str === "st1" || s.str === "st2"));

  await startSelect();
  await page.locator(".shot[data-id='c'] .shotCk").check();
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestGun", "r2");
  await page.selectOption("#shotDestLoad", "l3");
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toastAct1");
  promptAnswer = "61";
  const promptsBefore = dialogs.length;
  await page.click("#toastAct1");
  await page.waitForFunction(() => { const l = window.__bc.P.rifles.find((r) => r.id === "r1").loads.find((x) => x.id === "l1"); return l.mv === "2705" && l.mvTemp === "61"; });
  ok(dialogs.length > promptsBefore && dialogs.some((d) => d.startsWith("prompt:")), "missing temperature asks instead of inventing one");
  ok(true, "Redo MV uses the kept shots that stayed and the temperature that was entered");

  await page.click("#toastAct");
  await page.waitForFunction(() => window.__bc.ED.shots.find((s) => s.id === "c").str === "st1");
  await page.click("#slEdClose");
  await page.waitForFunction(() => !document.querySelector("#slEditor").classList.contains("show"));
  await page.click("#tabBtnGear");
  await page.fill("#mv", "2737");
  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#slEditor.show");
  await page.getByText("Session details (date, notes, weather, barrel)").click();
  await page.fill("#slTemp", "70");
  await startSelect();
  await page.locator(".shot[data-id='c'] .shotCk").check();
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestGun", "r2");
  await page.selectOption("#shotDestLoad", "l3");
  const promptsMid = dialogs.length;
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toastAct1");
  await page.click("#toastAct1");
  await page.waitForFunction(() => window.__bc.P.rifles.find((r) => r.id === "r1").loads.find((x) => x.id === "l1").mvTemp === "70");
  ok(dialogs.length === promptsMid, "a session temperature is used and no second prompt appears");

  await page.click("#slSave");
  await page.waitForFunction(() => !document.querySelector("#slEditor").classList.contains("show"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.some((s) => s.id === "sess1"));
  const persisted = await page.evaluate(async () => {
    const s = window.__bc.log.find((x) => x.id === "sess1");
    const dest = s.tg.strings.find((st) => st.asFired && st.asFired.loadId === "l3" && st.id !== "st2");
    const idb = await new Promise((res, rej) => {
      const o = indexedDB.open("bcalc-db", 1);
      o.onsuccess = () => { const tx = o.result.transaction("kv", "readonly"); const r = tx.objectStore("kv").get("shotlog"); r.onsuccess = () => { o.result.close(); res(r.result); }; };
      o.onerror = () => rej(o.error);
    });
    const stored = idb.find((x) => x.id === "sess1");
    return {
      dest: dest && dest.asFired, c: s.shots.find((x) => x.id === "c").str === (dest && dest.id),
      src: s.tg.strings.find((st) => st.id === "st1").asFired.recipe.mv,
      mv: window.__bc.P.rifles.find((r) => r.id === "r1").loads.find((l) => l.id === "l1").mv,
      version: window.__bc.P.version,
      storedOptic: stored.tg.strings.find((st) => st.id !== "st1" && st.id !== "st2").asFired.optic,
    };
  });
  ok(persisted.c && persisted.dest.rifleId === "r2" && persisted.dest.optic === null && persisted.storedOptic === null, "the move survives reload and IndexedDB");
  ok(persisted.src === "2737" && persisted.mv === "2705" && persisted.version === 2, "history MV stays 2737, the live MV stays redone, and the save stays version 2");

  await page.click("#tabBtnGear");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
  const exportPath = ART + "/export.json";
  await download.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  ok(exported.rifles.length === 2 && exported.shotSessions.some((s) => s.id === "sess1") && exported.version === 2, "export contains both firearms and the session");
  promptAnswer = "Temporary name";
  await page.click("#rifleMenu");
  await page.click("#rifleRename");
  await page.waitForFunction(() => document.querySelector("#rifleSel").selectedOptions[0].textContent === "Temporary name");
  await page.setInputFiles("#importFile", exportPath);
  await page.waitForFunction(() => document.querySelector("#rifleSel").selectedOptions[0].textContent === "Rifle A edited");
  ok(true, "import replaces the renamed gun with the exported copy");

  await page.click("#tabBtnDope");
  await page.click("#tabBtnGear");
  await page.selectOption("#rifleSel", "r2");
  await page.locator("#rifleDetails").evaluate((el) => { el.open = true; });
  await page.selectOption("#turret", "custom");
  await page.fill("#turretV", "");
  await page.click("#tabBtnDope");
  await page.click("#calcBtn");
  await page.waitForFunction(() => /Nothing was invented/.test(document.querySelector("#status").textContent));
  const status = await page.locator("#status").innerText();
  ok(/Enter a turret click value/.test(status) && /Nothing was invented/.test(status), "a missing turret blocks the calculation and asks for a value");
  await page.screenshot({ path: ART + "/blocked-360.png" });

  let controlled = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { c: !!navigator.serviceWorker.controller, state: r && (r.active || r.waiting || r.installing) && (r.active || r.waiting || r.installing).state };
  });
  if (!controlled.c) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").textContent === "BallisticBench");
    controlled = await page.evaluate(() => ({ c: !!navigator.serviceWorker.controller }));
  }
  ok(controlled.c, "the beta service worker is controlling this isolated page");
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.readyState === "complete" && document.querySelector("h1") && document.querySelector("h1").textContent === "BallisticBench");
  const offline = await page.evaluate(async () => {
    const idb = await new Promise((res, rej) => {
      const o = indexedDB.open("bcalc-db", 1);
      o.onsuccess = () => { const r = o.result.transaction("kv", "readonly").objectStore("kv").get("shotlog"); r.onsuccess = () => { o.result.close(); res(r.result); }; };
      o.onerror = () => rej(o.error);
    });
    return { h1: document.querySelector("h1").textContent, ready: document.readyState, version: JSON.parse(localStorage.getItem("bcalc.presets.v1")).version, shots: idb.find((s) => s.id === "sess1").shots.length };
  });
  ok(offline.h1 === "BallisticBench" && offline.ready === "complete" && offline.version === 2 && offline.shots === 5, "offline reload still has the page, the v2 save, and the five shots");
  await page.click("#tabBtnGear");
  await page.selectOption("#rifleSel", "r1");
  await page.selectOption("#loadSel", "l1");
  await page.click("#tabBtnLog");
  await page.waitForSelector(".slItem");
  await page.screenshot({ path: ART + "/offline-log-360.png" });

  ok(pageErrors.length === 0, "no page errors: " + pageErrors.join(" | "));
  ok(fs.readFileSync(presetPath).equals(presetBytes) && fs.readFileSync(sessionPath).equals(sessionBytes), "fixture files on disk are unchanged");
  console.log("DIALOGS", JSON.stringify(dialogs));
  console.log("PASS link-v3-ui", asserts);
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGKILL");
}
