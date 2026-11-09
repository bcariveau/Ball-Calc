// Historical turret fidelity. Fresh Chrome profile, copied fixtures, beta.html only.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8773;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/ballisticbench-hist";
fs.mkdirSync(ART, { recursive: true });
const presetPath = ROOT + "/db/fixtures/hist-turret-v2.json";
const sessionPath = ROOT + "/db/fixtures/hist-turret-sessions.json";
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
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => { if (d.type() === "confirm") await d.accept(); else await d.dismiss(); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

async function openTarget(str) {
  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#slEditor.show");
  await page.click("#tgMarkBtn");
  await page.waitForSelector("#tgEd.show");
  if (str) {
    const cur = await page.evaluate(() => document.querySelector("#tgStrSel").value);
    if (cur !== str) {
      if (await page.locator("#tgStrSel").isHidden()) await page.click("#tgSum");
      await page.selectOption("#tgStrSel", str);
    }
  }
  await page.waitForSelector("#tgZero");
  await page.locator("#tgZero").scrollIntoViewIfNeeded();
}
async function readCalc() {
  return page.evaluate(() => {
    const s = window.__bc.ED || window.__bc.log.find((x) => x.id === "sessH");
    const st1 = s.tg.strings.find((x) => x.id === "st1");
    const st2 = s.tg.strings.find((x) => x.id === "st2");
    return {
      dial: document.querySelector("#tgDialH") ? document.querySelector("#tgDialH").textContent : "",
      zero: document.querySelector("#tgZero") ? document.querySelector("#tgZero").textContent : "",
      center: document.querySelector("#tgResCA") ? document.querySelector("#tgResCA").textContent : "",
      saved: st1.asFired.optic && st1.asFired.optic.opTurret,
      track: st1.asFired.optic && st1.asFired.optic.opTrack,
      sh: st1.asFired.optic && st1.asFired.optic.opSH,
      unknown: st2.asFired.optic,
      live: window.__bc.P.optics[0].opTurret,
    };
  });
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.some((s) => s.id === "sessH"));

  await openTarget("st1");
  let view = await readCalc();
  console.log("BEFORE", JSON.stringify(view));
  ok(view.dial.includes("28 clicks") && view.dial.includes("0.1 mil"), "saved dial stays 28 clicks of 0.1 mil");
  ok(view.zero.includes("D 3") && view.zero.includes("0.1 mil") && !view.zero.includes("current turret"), "1 inch at 100 yd is D 3 clicks on the recorded 0.1 mil turret");
  ok(view.center.includes("0.28 mil"), "group center uses the recorded mil unit");
  await page.screenshot({ path: ART + "/historical-snapshot-360.png" });

  await page.click("#tgEdDone");
  await page.click("#slEdClose");
  await page.click("#tabBtnGear");
  await page.selectOption("#opTurret", "0.25moa", { force: true });
  await page.locator("#opTrack").fill("1.02", { force: true });
  await page.locator("#opTrack").dispatchEvent("input");
  await page.locator("#opSH").fill("2", { force: true });
  await page.locator("#opSH").dispatchEvent("input");
  await openTarget("st1");
  view = await readCalc();
  console.log("AFTER-EDIT", JSON.stringify(view));
  ok(view.live === "0.25moa", "the live optic took the ¼ MOA edit");
  ok(view.saved === "0.1mil" && view.track === "1" && view.sh === "1.75", "the snapshot turret, tracking, and sight height were not rewritten");
  ok(view.dial.includes("28 clicks") && view.dial.includes("0.1 mil"), "saved click conversion is unchanged after the optic edit");
  ok(view.zero.includes("D 3") && view.zero.includes("0.1 mil") && !view.zero.includes("D 4"), "recomputed clicks stay D 3 on the recorded turret");
  ok(view.unknown === null, "the string with no optic is still null");

  if (await page.locator("#tgStrSel").isHidden()) await page.click("#tgSum");
  await page.selectOption("#tgStrSel", "st2");
  await page.waitForFunction(() => /current turret/.test(document.querySelector("#tgZero").textContent));
  view = await readCalc();
  console.log("FALLBACK", JSON.stringify(view));
  ok(view.zero.includes("D 4") && view.zero.includes("¼ MOA") && /Rifle A has no scope saved, so clicks use its current turret \(¼ MOA\)/.test(view.zero) && !/No as-fired optic/.test(view.zero), "unknown history converts the same inch with the current ¼ MOA turret and names the missing scope once");
  ok(view.center.includes("0.95 MOA"), "the fallback angular size follows the current unit");
  ok(view.saved === "0.1mil" && view.unknown === null, "fallback did not write the current turret into either string");
  await page.locator("#tgZero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/fallback-360.png" });

  await page.click("#tgEdDone");
  await page.click("#slEdClose");
  await page.click("#tabBtnGear");
  await page.selectOption("#opTurret", "custom", { force: true });
  await page.locator("#opTurretV").fill("", { force: true });
  await page.locator("#opTurretV").dispatchEvent("input");
  await openTarget("st2");
  view = await readCalc();
  console.log("BLOCKED", JSON.stringify(view));
  ok(/has no turret click value/.test(view.zero) && !/No as-fired optic/.test(view.zero) && !view.zero.includes("D 4"), "a missing current click value blocks the fallback calculation");
  await page.locator("#tgZero").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/blocked-360.png" });
  if (await page.locator("#tgStrSel").isHidden()) await page.click("#tgSum");
  await page.selectOption("#tgStrSel", "st1");
  await page.waitForFunction(() => /28 clicks/.test(document.querySelector("#tgDialH").textContent) && /D 3/.test(document.querySelector("#tgZero").textContent));
  view = await readCalc();
  ok(view.dial.includes("28 clicks") && view.zero.includes("D 3") && view.saved === "0.1mil", "the recorded string still calculates after the current turret is cleared");

  await page.click("#tgEdDone");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.some((s) => s.id === "sessH"));
  const persisted = await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sessH");
    return {
      saved: s.tg.strings.find((x) => x.id === "st1").asFired.optic.opTurret,
      dial: s.tg.strings.find((x) => x.id === "st1").dial.c,
      unknown: s.tg.strings.find((x) => x.id === "st2").asFired.optic,
      live: window.__bc.P.optics[0].opTurret,
      version: window.__bc.P.version,
    };
  });
  ok(persisted.saved === "0.1mil" && persisted.dial === 28 && persisted.unknown === null && persisted.live === "custom" && persisted.version === 2, "reload keeps the recorded turret, the null optic, and the edited live optic");

  await page.click("#tabBtnGear");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
  const exportPath = ART + "/export.json";
  await download.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  const exp1 = exported.shotSessions[0].tg.strings.find((s) => s.id === "st1");
  const exp2 = exported.shotSessions[0].tg.strings.find((s) => s.id === "st2");
  ok(exp1.asFired.optic.opTurret === "0.1mil" && exp1.dial.c === 28 && exp2.asFired.optic === null && exported.optics[0].opTurret === "custom", "export keeps the snapshot and the blank current turret apart");
  exported.optics[0].name = "Imported optic";
  const roundPath = ART + "/roundtrip.json";
  fs.writeFileSync(roundPath, JSON.stringify(exported));
  await page.setInputFiles("#importFile", roundPath);
  await page.waitForFunction(() => window.__bc.P.optics[0].name === "Imported optic");
  const imported = await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sessH");
    return { saved: s.tg.strings.find((x) => x.id === "st1").asFired.optic.opTurret, unknown: s.tg.strings.find((x) => x.id === "st2").asFired.optic, dial: s.tg.strings.find((x) => x.id === "st1").dial.c };
  });
  ok(imported.saved === "0.1mil" && imported.dial === 28 && imported.unknown === null, "import keeps the same distinction");

  let controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").textContent.replace("™","") === "BallisticBench");
    controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  }
  ok(controlled, "service worker controls the isolated page");
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.readyState === "complete" && window.__bc && window.__bc.log.some((s) => s.id === "sessH"));
  const offline = await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sessH");
    return { saved: s.tg.strings.find((x) => x.id === "st1").asFired.optic.opTurret, unknown: s.tg.strings.find((x) => x.id === "st2").asFired.optic, dial: s.tg.strings.find((x) => x.id === "st1").dial.c, live: window.__bc.P.optics[0].opTurret };
  });
  ok(offline.saved === "0.1mil" && offline.dial === 28 && offline.unknown === null && offline.live === "custom", "offline reload keeps recorded, unknown, and current turrets distinct");
  ok(pageErrors.length === 0, "no page errors: " + pageErrors.join(" | "));
  ok(fs.readFileSync(presetPath).equals(presetBytes) && fs.readFileSync(sessionPath).equals(sessionBytes), "fixture files were not modified");
  console.log("PASS hist-turret", n);
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGKILL");
}
