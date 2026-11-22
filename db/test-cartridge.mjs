// Firearm cartridge: catalog diameters, override, unset fallback, and no write until the firearm is saved.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { CARTRIDGES, softNote } from "../beta/js/cartridges.js";
import { sizeRef, sizeWarn } from "../beta/js/holdover.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const by = (id) => CARTRIDGES.find((c) => c.id === id);
const want = { "22lr": 0.223, "223": 0.224, "6cm": 0.243, "65cm": 0.264, "65prc": 0.264, "270": 0.277, "7mm08": 0.284, "308": 0.308, "300blk": 0.308, "762x39": 0.311, "338": 0.338, "9mm": 0.355, "40": 0.4, "10mm": 0.4, "45acp": 0.451, "357": 0.357, "38": 0.357 };
ok(Object.entries(want).every(([id, dia]) => by(id) && by(id).diameter === dia), "catalog diameters match the SAAMI nominal sizes");
const gun = { lastLoadId: "a", loads: [{ id: "a", diameter: "0.308" }, { id: "b", diameter: "0.264" }] };
ok(sizeRef(gun).from === "current" && sizeRef(gun).dia === 0.308, "unset firearm keeps the .25 current-load reference");
gun.cartridge = { id: "65cm", name: "6.5 Creedmoor", diameter: 0.264 };
ok(sizeRef(gun).from === "firearm" && sizeRef(gun).dia === 0.264 && sizeWarn(sizeRef(gun), { diameter: "0.308" }), "a saved cartridge overrides the load diameters");
ok(softNote(gun, { name: "300 BLK 220 gr", diameter: "0.308" }) === "" && softNote({ cartridge: { name: ".308 Winchester", diameter: 0.308 } }, { name: "300 BLK" }) === "name says 300 BLK", "same-diameter names are a note, not a different size");

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8916;
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
      o.onsuccess = () => { const tx = o.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(JSON.parse(sessions), "shotlog"); tx.oncomplete = () => { o.result.close(); res(); }; };
    });
  }, { preset: presetRaw, sessions: sessionRaw });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  ok(!("cartridge" in JSON.parse(await page.evaluate(() => localStorage.getItem("bcalc.presets.v1"))).rifles[0]), "opening the app does not write a cartridge");
  await page.click("#tabBtnGear");
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  await page.click("#gearBack");
  ok(!("cartridge" in JSON.parse(await page.evaluate(() => localStorage.getItem("bcalc.presets.v1"))).rifles.find((r) => r.id === "r1")), "viewing a legacy firearm does not add a cartridge");
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  await page.locator("#rifleDetails > summary").click();
  await page.selectOption("#cartPick", "65cm");
  await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles.find((x) => x.id === "r1"); return r.cartridge && r.cartridge.diameter === 0.264 && r.cartridge.name === "6.5 Creedmoor"; });
  ok((await page.locator("#gearNowNames").innerText()).includes("6.5 Creedmoor"), "the current setup names the cartridge");
  await page.locator("#cartBox").screenshot({ path: ART + "/cal-picker.png" });
  await page.click("#gearBack");
  ok((await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).innerText()).includes("6.5 Creedmoor"), "the firearm row names the cartridge");
  await page.locator("#gearSec").screenshot({ path: ART + "/cal-setup.png" });
  await page.click('#gearSwitch button[data-sec="load"]');
  await page.click("#gearAllLoads");
  const row = await page.locator("#gearList .gearItem").filter({ hasText: "Load B" }).innerText();
  ok(/Wrong size \.308"/.test(row), "the firearm diameter, not the current load, marks .308 wrong");
  await page.locator("#gearList").screenshot({ path: ART + "/cal-loads.png" });
  await page.locator("#gearList .gearItem").filter({ hasText: "Load B" }).click();
  await page.waitForSelector("#gearDlg:not([hidden])");
  ok(/\.308"/.test(await page.locator("#gearDlgMsg").innerText()) && (await page.evaluate(() => document.activeElement.id)) === "gearDlgCancel", "the list warning uses the firearm diameter");
  await page.locator("#gearDlg").screenshot({ path: ART + "/cal-dialog.png" });
  await page.click("#gearDlgCancel");
  await page.evaluate(() => {
    const r = window.__bc.P.rifles.find((x) => x.id === "r1");
    r.loads.push({ id: "l30", name: "Thirty", diameter: "0.308", bc: "0.2", drag: "G1", weight: "150", mv: "2700" });
    const el = document.getElementById("loadSel");
    el.add(new Option("Thirty", "l30"));
    el.value = "l30";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForSelector("#gearDlg:not([hidden])");
  ok(/bore is \.264"/.test(await page.locator("#gearDlgMsg").innerText()), "the load select uses the firearm diameter");
  await page.click("#gearDlgCancel");
  await page.click('#gearSwitch button[data-sec="gun"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  if (await page.locator("#cartPick").isHidden()) await page.locator("#rifleDetails > summary").click();
  await page.selectOption("#cartPick", "custom");
  await page.fill("#cartName", "Wildcat");
  await page.fill("#cartDia", "0.250");
  await page.locator("#cartDia").dispatchEvent("input");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles.find((r) => r.id === "r1").cartridge.diameter === 0.25);
  ok(true, "a custom diameter is stored only after the firearm form changes");
  await page.locator("#cartBox").screenshot({ path: ART + "/cal-custom.png" });
  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="optic"]');
  await page.locator("#gearList .gearItem").first().click();
  await page.locator("#opMore > summary").click();
  await page.selectOption("#hoMode", "hash");
  await page.locator("#tabGear").screenshot({ path: ART + "/cal-optic.png" });
  await page.click("#tabBtnDope");
  await page.locator("#tabDope").screenshot({ path: ART + "/cal-dope.png" });
  await page.click("#tabBtnLog");
  await page.locator("#tabLog").screenshot({ path: ART + "/cal-log.png" });
  await page.click("#tabBtnGear");
  const raw = await page.evaluate(() => {
    const bad = [];
    const walk = document.createTreeWalker(document.getElementById("tabGear"), NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) if (/<svg|<path/.test(node.nodeValue || "")) bad.push(node.nodeValue.trim().slice(0, 60));
    return bad;
  });
  ok(!raw.length, "the Gear tab has no raw icon markup");
  console.log("PASS cartridge", n);
} catch (e) {
  console.error("FAIL cartridge", e);
  try { await page.screenshot({ path: ART + "/cal-fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
