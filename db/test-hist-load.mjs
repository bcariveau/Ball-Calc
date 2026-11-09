// Recorded load + dial unit. Fresh Chrome profile and copied fixtures only.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8774;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/ballisticbench-hist-load";
fs.mkdirSync(ART, { recursive: true });
const presetPath = ROOT + "/db/fixtures/hist-load-v2.json";
const sessionPath = ROOT + "/db/fixtures/hist-load-sessions.json";
const presetRaw = fs.readFileSync(presetPath, "utf8");
const sessionRaw = fs.readFileSync(sessionPath, "utf8");
const presetBytes = fs.readFileSync(presetPath);
const sessionBytes = fs.readFileSync(sessionPath);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 300));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => { if (d.type() === "confirm") await d.accept(); else await d.dismiss(); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

async function openTarget() {
  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#slEditor.show");
  await page.click("#tgMarkBtn");
  await page.waitForSelector("#tgEd.show");
  await page.waitForFunction(() => {
    const t = document.querySelector("#tgHist") && document.querySelector("#tgHist").textContent;
    return t && !t.endsWith("…") && !t.endsWith("...");
  }, null, { timeout: 20000 });
  await page.locator("#tgHist").scrollIntoViewIfNeeded();
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
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
  await page.waitForFunction(() => {
    const t = document.querySelector("#status") && document.querySelector("#status").textContent;
    return window.__bc && window.__bc.log.some((s) => s.id === "sessL") && t && /Done|Ready|points|Enter a turret/.test(t);
  }, null, { timeout: 25000 });

  await openTarget();
  const before = await page.locator("#tgHist").innerText();
  console.log("BEFORE", before);
  ok(/2710 fps/.test(before) && /0\.326/.test(before) && /clicks/.test(before), "historical dope names the recorded bullet, BC, and MV");
  await page.screenshot({ path: ART + "/recorded-load-360.png" });
  const beforeClicks = (before.match(/\((\d+) clicks\)/) || [])[1];

  await page.click("#tgEdDone");
  await page.click("#slEdClose");
  await page.click("#tabBtnGear");
  await page.fill("#mv", "3200");
  await page.fill("#bc", "0.550");
  await page.selectOption("#drag", "G1");
  await page.selectOption("#opTurret", "0.25moa");
  await page.click("#tabBtnDope");
  await page.fill("#target", "600");
  await page.waitForFunction(() => /Done|points/.test(document.querySelector("#status").textContent), null, { timeout: 20000 });
  const live = await page.locator("#dcElevClk").innerText();
  console.log("LIVE", live, await page.locator("#dcElev").innerText());
  await page.screenshot({ path: ART + "/live-dope-after-edit-360.png" });

  await openTarget();
  const after = await page.locator("#tgHist").innerText();
  const saved = await page.evaluate(() => {
    const s = window.__bc.ED;
    const st = s.tg.strings.find((x) => x.id === "st1");
    return { mv: st.asFired.recipe.mv, bc: st.asFired.recipe.bc, drag: st.asFired.recipe.drag, turret: st.asFired.optic.opTurret, sh: st.asFired.optic.opSH };
  });
  console.log("AFTER", after, JSON.stringify(saved));
  ok(after === before, "recorded dope does not change after the current load and optic change");
  ok(saved.mv === "2710" && saved.bc === "0.326" && saved.drag === "G7" && saved.turret === "0.1mil" && saved.sh === "1.75", "the snapshot was not backfilled from the current load or optic");
  ok(/MOA|¼/.test(live), "live dope is using the edited ¼ MOA optic");
  await page.screenshot({ path: ART + "/recorded-stable-360.png" });

  if (await page.locator("#tgStrSel").isHidden()) await page.click("#tgSum");
  await page.selectOption("#tgStrSel", "st2");
  await page.waitForFunction(() => /not written|Current load/.test(document.querySelector("#tgHist").textContent));
  const fallback = await page.locator("#tgHist").innerText();
  console.log("FALLBACK", fallback);
  ok(/not written/.test(fallback) && /0\.550|3200/.test(fallback), "missing recorded BC uses the current load and says it is not saved");
  const unknown = await page.evaluate(() => window.__bc.ED.tg.strings.find((s) => s.id === "st2").asFired);
  ok(unknown.optic === null && unknown.recipe.mv === "2710" && unknown.recipe.bc == null, "the fallback did not write the current BC or optic into the string");
  await page.locator("#tgHist").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/load-fallback-360.png" });

  await page.selectOption("#loadSel", "l2", { force: true });
  await page.selectOption("#tgStrSel", "st1");
  await page.locator("#tgAtDist").check();
  await page.click("#tgTrue");
  await page.waitForSelector("#trSheet.show, #trObs");
  const milObs = await page.locator("#trObs").inputValue();
  const trFor = await page.locator("#trFor").innerText();
  console.log("TRUING-MIL", milObs, trFor);
  ok(Math.abs(parseFloat(milObs) - 2.7306) < 0.02, "the saved mil dial is sent in mil");
  ok(/not the load on screen/.test(trFor), "a recorded dial is not applied to the other load silently");
  await page.screenshot({ path: ART + "/truing-mil-360.png" });
  await page.click("#trUnit button[data-v='MOA']");
  const moaObs = await page.locator("#trObs").inputValue();
  console.log("TRUING-MOA", moaObs);
  ok(Math.abs(parseFloat(moaObs) - 9.387) < 0.02, "switching the truing unit converts the same angle to MOA");
  ok(Math.abs(parseFloat(moaObs) / parseFloat(milObs) - 3.437747) < 0.01, "the mil and MOA observations are one physical angle");
  await page.screenshot({ path: ART + "/truing-moa-360.png" });

  await page.click("#trClose");
  await page.click("#tabBtnGear");
  await page.selectOption("#loadSel", "l1");
  await page.locator("#bc").fill("", { force: true });
  await page.locator("#bc").dispatchEvent("input");
  await page.locator("#weight").fill("", { force: true });
  await page.locator("#weight").dispatchEvent("input");
  await page.locator("#diameter").fill("", { force: true });
  await page.locator("#diameter").dispatchEvent("input");
  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.click("#tgMarkBtn");
  await page.waitForSelector("#tgEd.show");
  if (await page.locator("#tgStrSel").isHidden()) await page.click("#tgSum");
  await page.selectOption("#tgStrSel", "st2");
  await page.waitForFunction(() => /Nothing was invented/.test(document.querySelector("#tgHist").textContent));
  const blocked = await page.locator("#tgHist").innerText();
  console.log("BLOCKED", blocked);
  ok(/Nothing was invented/.test(blocked), "missing required load inputs block the calculation");
  await page.screenshot({ path: ART + "/load-blocked-360.png" });

  const still = await page.evaluate(() => window.__bc.ED.tg.strings.find((s) => s.id === "st1").asFired.recipe);
  ok(still.mv === "2710" && still.bc === "0.326", "blocking did not invent load fields on the recorded string");

  await page.click("#tgEdDone");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.some((s) => s.id === "sessL"));
  const persisted = await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sessL");
    return { mv: s.tg.strings[0].asFired.recipe.mv, bc: s.tg.strings[0].asFired.recipe.bc, turret: s.tg.strings[0].asFired.optic.opTurret, dial: s.tg.strings[0].dial, unknown: s.tg.strings[1].asFired.optic, version: window.__bc.P.version };
  });
  ok(persisted.mv === "2710" && persisted.bc === "0.326" && persisted.turret === "0.1mil" && persisted.dial.u === "MIL" && persisted.dial.c === 28 && persisted.unknown === null && persisted.version === 2, "reload keeps the recorded load, optic, and dial");

  await page.click("#tabBtnGear");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportBtn")]);
  const exportPath = ART + "/export.json";
  await download.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  ok(exported.shotSessions[0].tg.strings[0].asFired.recipe.mv === "2710" && exported.shotSessions[0].tg.strings[1].asFired.optic === null, "export keeps the recorded load and the null optic apart");
  await page.click("#tabBtnDope");
  await page.context().setOffline(true);
  let controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) {
    await page.context().setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").textContent === "BallisticBench");
    controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  ok(controlled, "service worker controls the isolated page");
  await page.waitForFunction(() => document.readyState === "complete" && window.__bc && window.__bc.log.some((s) => s.id === "sessL"));
  const offline = await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sessL");
    return { mv: s.tg.strings[0].asFired.recipe.mv, turret: s.tg.strings[0].asFired.optic.opTurret, dial: s.tg.strings[0].dial.u };
  });
  ok(offline.mv === "2710" && offline.turret === "0.1mil" && offline.dial === "MIL", "offline reload keeps the recorded load, optic, and dial unit");
  ok(pageErrors.length === 0, "no page errors: " + pageErrors.join(" | "));
  ok(fs.readFileSync(presetPath).equals(presetBytes) && fs.readFileSync(sessionPath).equals(sessionBytes), "fixture files were not modified");
  console.log("PASS hist-load", n);
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGKILL");
}
