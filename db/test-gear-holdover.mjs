// Gear selection, optic switch, load fit, fixed power, and holdover. Beta page only.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8908;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("dialog", async (d) => { await d.accept(d.type() === "prompt" ? "Scope Two" : undefined); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const raw = async (sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  const bad = [];
  if (!root) return ["missing " + sel];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const t = node.nodeValue || "";
    if (/<svg|<path|function |const VERSION/.test(t)) bad.push(t.trim().slice(0, 80));
  }
  return bad;
}, sel);
const presetJson = () => page.evaluate(() => localStorage.getItem("bcalc.presets.v1"));

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MOA", view: "dope", tab: "gear", round: true, values: {} }));
    await new Promise((res) => { const d = indexedDB.deleteDatabase("bcalc-db"); d.onsuccess = d.onerror = d.onblocked = () => res(); });
    await new Promise((res, rej) => {
      const o = indexedDB.open("bcalc-db", 1);
      o.onupgradeneeded = () => o.result.createObjectStore("kv");
      o.onerror = () => rej(o.error);
      o.onsuccess = () => {
        const tx = o.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put(JSON.parse(sessions), "shotlog");
        tx.oncomplete = () => { o.result.close(); res(); };
      };
    });
  }, { preset: presetRaw, sessions: sessionRaw });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.click("#tabBtnGear");
  await page.waitForSelector("#gearNow");
  const before = await presetJson();
  const setup = await page.locator("#gearNow").innerText();
  ok(/Current setup/.test(setup) && /Rifle A/.test(setup) && /Razor/.test(setup) && /Load A/.test(setup), "Gear shows the current firearm, optic, and load");
  ok((await page.locator("#gearSubGun").innerText()) === "Rifle A" && (await page.locator("#gearSubOptic").innerText()) === "Razor", "each Gear tab carries the current name");
  await page.locator("#gearSec").screenshot({ path: ART + "/gear-current-setup.png" });
  const gun = await page.locator('#gearList .gearItem[data-id="r1"]').innerText();
  ok(/In use/.test(gun) && !(await page.locator('#gearList .gearItem[data-id="r1"]').evaluate((el) => el.classList.contains("on"))), "the current firearm has an In use chip and no green border");
  await page.locator("#gearList").screenshot({ path: ART + "/gear-firearms.png" });
  await page.click('#gearSwitch button[data-sec="optic"]');
  ok(/In use/.test(await page.locator('#gearList .gearItem[data-id="o1"]').innerText()), "the current optic is badged");
  await page.locator("#gearList").screenshot({ path: ART + "/gear-optics.png" });
  await page.click('#gearSwitch button[data-sec="load"]');
  const loads = await page.locator("#gearList .gearItem").allInnerTexts();
  ok(loads.length === 2 && loads.some((t) => /Load A2/.test(t)) && loads.some((t) => /G7 0\.326/.test(t)) && !loads.some((t) => /\.264" fits/.test(t)), "the default load list is the fitting bore only and leaves diameter off the card");
  await page.locator("#gearList").screenshot({ path: ART + "/gear-loads.png" });
  const stored = await presetJson();
  await page.click("#gearAllLoads");
  const all = await page.locator("#gearList .gearItem").allInnerTexts();
  ok(all.some((t) => /Size mismatch/.test(t)) && (await presetJson()) === stored, "Show all loads is session-only and chips the other bore");
  await page.locator("#gearList").screenshot({ path: ART + "/gear-loads-all.png" });
  await page.locator("#gearList .gearItem.dim").click();
  await page.waitForSelector("#gearDlg:not([hidden])");
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === "gearDlgCancel");
  const dlg = await page.evaluate(() => ({ msg: document.getElementById("gearDlgMsg").textContent, go: document.getElementById("gearDlgGo").textContent, focus: document.activeElement.id }));
  ok(/\.308"/.test(dlg.msg) && /\.264"/.test(dlg.msg) && dlg.go === "Use anyway" && dlg.focus === "gearDlgCancel", "a wrong-size load warns, and Cancel is focused " + JSON.stringify(dlg));
  await page.locator("#gearDlg").screenshot({ path: ART + "/dialog-wrong-size.png" });
  await page.click("#gearDlgCancel");
  ok((await presetJson()) === stored, "Cancel does not save the wrong-size load");
  ok(!(await raw("#tabGear")).length, "the Gear tab has no raw icon markup");

  await page.evaluate(() => {
    const P = window.__bc.P;
    P.optics.push({ id: "o2", name: "Spare", opTurret: "0.25moa", opReticle: "moa", opFP: "SFP", opMag: "6" });
  });
  await page.click('#gearSwitch button[data-sec="optic"]');
  const rifle = await page.evaluate(() => window.__bc.P.lastRifleId);
  await page.locator('#gearList .gearItem[data-id="o2"]').click();
  await page.waitForSelector("#gearDlg:not([hidden])");
  const sw = await page.locator("#gearDlgMsg").innerText();
  ok(/Switch optic on Rifle A\?/.test(sw) && /Current: Razor/.test(sw) && /New: Spare/.test(sw), "choosing another optic asks before it leaves this firearm");
  await page.locator("#gearDlg").screenshot({ path: ART + "/dialog-optic-switch.png" });
  await page.click("#gearDlgGo");
  await page.waitForFunction(() => window.__bc.P.rifles.find((r) => r.id === "r1").opticId === "o2");
  ok((await page.evaluate(() => window.__bc.P.lastRifleId)) === rifle, "Switch attaches the optic to the current firearm");
  await page.locator("#opMore > summary").click();
  await page.locator("#opticBody").screenshot({ path: ART + "/optic-form.png" });
  await page.check("#opFixed");
  ok(await page.locator("#opFpRow").isHidden() && await page.locator("#opMagLbl").innerText() === "Magnification (×)", "fixed power hides the focal plane and asks for one magnification");
  await page.locator("#holdBox").screenshot({ path: ART + "/optic-fixed.png" });
  await page.selectOption("#hoMode", "hash");
  await page.locator("#hoBody").screenshot({ path: ART + "/holdover-hash.png" });
  await page.selectOption("#hoMode", "bdc");
  await page.locator("#hoBody").screenshot({ path: ART + "/holdover-bdc.png" });
  await page.selectOption("#hoMode", "acss");
  await page.locator("#hoBody").screenshot({ path: ART + "/holdover-acss.png" });
  await page.selectOption("#hoMode", "cds");
  await page.locator("#hoBody").screenshot({ path: ART + "/holdover-cds.png" });
  await page.click("#hoFillFl6");
  const fl6 = await page.evaluate(() => document.getElementById("hoMarks").value);
  ok(/5\.95/.test(fl6) && !/\d{3}/.test(fl6), "the FL-6 example fills the published MOA marks and no yardages");
  await page.waitForFunction(() => window.__bc.P.optics.find((o) => o.id === "o2").holdover && window.__bc.P.optics.find((o) => o.id === "o2").holdover.marks[1].subtension === 5.95);
  ok(true, "saving the optic stores the holdover on that optic");
  await page.uncheck("#opFixed");
  await page.click("#tabBtnDope");
  await page.locator("#target").fill("300");
  await page.locator("#target").dispatchEvent("input");
  await page.waitForFunction(() => /hash/.test(document.getElementById("dcHold").textContent), null, { timeout: 8000 });
  const hold = await page.locator("#dcHold").innerText();
  ok(/hash/.test(hold) && /MOA/.test(hold), "Dope names the nearest hold for the current optic: " + hold);
  await page.locator("#dopeCard").screenshot({ path: ART + "/dope-hold.png" });
  await page.locator("#hoNow").fill("3");
  await page.locator("#hoNow").dispatchEvent("input");
  await page.waitForFunction(() => /calibrated at 6/.test(document.getElementById("dcMagWarn").textContent));
  ok(/calibrated at 6/.test(await page.locator("#dcMagWarn").innerText()), "SFP warns when the magnification is not the calibrated one");
  await page.locator("#dcMag").screenshot({ path: ART + "/dope-sfp-warn.png" });
  await page.click("#tabBtnGear");
  await page.click('#gearSwitch button[data-sec="optic"]');
  const legacyBefore = await page.evaluate(() => Object.keys(window.__bc.P.optics.find((o) => o.id === "o1")).sort());
  await page.locator('#gearList .gearItem[data-id="o1"]').click();
  await page.waitForSelector("#gearDlg:not([hidden])");
  await page.click("#gearDlgGo");
  await page.waitForFunction(() => window.__bc.P.rifles.find((r) => r.id === "r1").opticId === "o1");
  const legacyAfter = await page.evaluate(() => Object.keys(window.__bc.P.optics.find((o) => o.id === "o1")).sort());
  ok(!legacyAfter.includes("holdover") && !legacyAfter.includes("opFixed") && legacyAfter.join() === legacyBefore.join(), "a legacy optic gains no new fields just by being opened");
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  ok(keys.every((k) => k === "bcalc.presets.v1" || k === "bcalc.settings.v1"), "holdover adds no storage key");

  await page.click("#tabBtnLog");
  ok(!(await raw("#tabLog")).length, "the Log tab has no raw icon markup");
  await page.locator("#tabLog").screenshot({ path: ART + "/gear-log.png" });
  const csv = "SHOT #,SPEED (FPS)\n1,2700\n2,2710\n";
  await page.setInputFiles("#slFile", { name: "sample.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.waitForSelector("#slImport.show");
  await page.waitForFunction(() => !document.getElementById("toast").classList.contains("show")).catch(() => {});
  ok(!(await raw("#slImport")).length, "the import sheet has no raw icon markup");
  await page.locator("#slImport").screenshot({ path: ART + "/dialog-import.png" });
  await page.click("#slImpClose");
  console.log("PASS gear-holdover", n);
} catch (e) {
  console.error("FAIL gear-holdover", e);
  try { await page.screenshot({ path: ART + "/gear-holdover-fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
