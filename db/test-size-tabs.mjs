// Wrong-size warnings on every load change, and one Gear tab bar with a labeled back control.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8912;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("dialog", async (d) => { await d.accept(); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const bars = () => page.evaluate(() => document.querySelectorAll("#tabGear [role=tablist]").length);
const dlg = async () => {
  await page.waitForSelector("#gearDlg:not([hidden])");
  return page.evaluate(() => ({ msg: document.getElementById("gearDlgMsg").textContent, go: document.getElementById("gearDlgGo").textContent, focus: document.activeElement.id }));
};

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "gear", round: true, values: {} }));
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
  await page.evaluate(() => {
    const r = window.__bc.P.rifles.find((x) => x.id === "r1");
    r.loads.push({ id: "lbad", name: "Wrong", diameter: "0.308", bc: "0.2", drag: "G1", weight: "150", mv: "2700" });
    r.loads.push({ id: "lunk", name: "Blank", diameter: "", bc: "0.2", drag: "G1", weight: "140", mv: "2700" });
  });
  await page.click("#tabBtnGear");
  await page.click('#gearSwitch button[data-sec="load"]');
  ok(await bars() === 1, "the load list has one Gear tab bar");
  ok((await page.locator("#gearSubLoad").innerText()) === "Load A", "the tab bar keeps the current load name");
  const hidden = await page.locator("#gearList .gearItem").allInnerTexts();
  ok(!hidden.some((t) => /Wrong/.test(t)) && hidden.some((t) => /Blank/.test(t)) && !hidden.some((t) => /Unknown size/.test(t)), "a mixed gun still filters by the current load and leaves unknown size off the card");
  await page.locator("#gearList").screenshot({ path: ART + "/fix-gear-loads.png" });
  await page.click("#gearAllLoads");
  ok((await page.locator("#gearList .gearItem.dim").allInnerTexts()).every((t) => /Size mismatch/.test(t)), "Show all chips every other size");
  await page.locator("#gearList").screenshot({ path: ART + "/fix-gear-loads-all.png" });
  const before = await page.evaluate(() => window.__bc.P.rifles.find((r) => r.id === "r1").lastLoadId);
  await page.locator('#gearList .gearItem[data-id="lbad"]').click();
  const warn = await dlg();
  ok(/\.308"/.test(warn.msg) && /\.264"/.test(warn.msg) && warn.go === "Use anyway" && warn.focus === "gearDlgCancel", "the list warns and Cancel is focused");
  await page.locator("#gearDlg").screenshot({ path: ART + "/fix-dialog-wrong-size.png" });
  await page.click("#gearDlgCancel");
  ok((await page.evaluate(() => window.__bc.P.rifles.find((r) => r.id === "r1").lastLoadId)) === before, "Cancel leaves the active load unchanged");
  await page.locator('#gearList .gearItem[data-id="lbad"]').click();
  await page.click("#gearDlgGo");
  await page.waitForFunction(() => window.__bc.P.rifles.find((r) => r.id === "r1").lastLoadId === "lbad");
  ok(true, "Use anyway makes the other size the active load");

  await page.evaluate(() => { const el = document.getElementById("loadSel"); el.value = "l1"; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.click("#gearDlgGo");
  await page.waitForFunction(() => window.__bc.P.rifles.find((r) => r.id === "r1").lastLoadId === "l1");
  await page.evaluate(() => { const el = document.getElementById("loadSel"); el.value = "lbad"; el.dispatchEvent(new Event("change", { bubbles: true })); });
  ok((await dlg()).go === "Use anyway", "the load form select warns");
  await page.click("#gearDlgCancel");
  ok((await page.evaluate(() => window.__bc.P.rifles.find((r) => r.id === "r1").lastLoadId)) === "l1", "Cancel on the form select keeps Load A");

  await page.click("#loadMenu");
  await page.click("#loadCopy");
  await page.waitForSelector("#cpSheet.show");
  await page.click("#cpAllBtn");
  await page.locator('#cpList .rcItem[data-id="r2"]').click();
  ok(/\.264"/.test((await dlg()).msg), "copying this load onto the other gun warns");
  await page.click("#gearDlgCancel");
  ok(!(await page.evaluate(() => window.__bc.P.rifles.find((r) => r.id === "r2").loads.some((l) => /copy/i.test(l.name)))), "Cancel does not copy the load");
  await page.click("#cpClose");

  await page.click("#tabBtnLog");
  await page.locator(".slItem").first().click();
  await page.click("#shotSelBtn");
  await page.locator(".shotCk").first().click();
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestGun", "r1");
  await page.selectOption("#shotDestLoad", "lbad");
  await page.click("#shotMoveGo");
  ok((await dlg()).go === "Use anyway", "moving a shot onto the wrong-size load warns");
  await page.click("#gearDlgCancel");
  await page.click("#shotDestClose");

  const csv = "SHOT #,SPEED (FPS)\n1,2700\n";
  await page.setInputFiles("#slFile", { name: "sample.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.waitForSelector("#slImport.show");
  await page.selectOption("#slImpRifle", "r1");
  await page.selectOption("#slImpLoad", "lbad");
  await page.click("#slImpGo");
  ok((await dlg()).go === "Use anyway", "importing onto a wrong-size load warns");
  await page.click("#gearDlgCancel");
  ok(!(await page.evaluate(() => window.__bc.log.some((s) => (s.shots || []).some((x) => x.v === 2700 && s.notes !== "fixture")))), "Cancel does not import");
  await page.click("#slImpClose");
  await page.click("#slEdClose").catch(() => {});

  await page.click("#tabBtnGear");
  ok(await bars() === 1 && (await page.locator("#gearSubGun").innerText()) === "Rifle A", "Gear still has one subtitled tab bar");
  await page.locator("#gearSec").screenshot({ path: ART + "/fix-gear-list.png" });
  await page.click('#gearSwitch button[data-sec="gun"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  ok(await bars() === 1 && (await page.locator("#gearBackLbl").innerText()) === "Back to Firearms" && await page.locator("#gearBack").isVisible(), "firearm edit has one tab bar and a labeled back control");
  await page.locator("#gearBack").screenshot({ path: ART + "/fix-back-firearms.png" });
  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="optic"]');
  await page.locator("#gearList .gearItem").first().click();
  ok((await page.locator("#gearBackLbl").innerText()) === "Back to Optics" && await bars() === 1, "optic edit names the back control");
  await page.locator("#gearBack").screenshot({ path: ART + "/fix-back-optics.png" });
  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="load"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Load A" }).first().click();
  ok((await page.locator("#gearBackLbl").innerText()) === "Back to Loads" && await bars() === 1, "load edit names the back control");
  await page.locator("#gearBack").screenshot({ path: ART + "/fix-back-loads.png" });
  await page.locator("#tabGear").screenshot({ path: ART + "/fix-gear-load-edit.png" });
  console.log("PASS size-tabs", n);
} catch (e) {
  console.error("FAIL size-tabs", e);
  try { await page.screenshot({ path: ART + "/fix-gear-fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
