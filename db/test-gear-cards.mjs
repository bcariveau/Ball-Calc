// Gear list cards: three lines, chips, no repeated facts, no raw icon text.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8928;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", (d) => d.accept());
const pageErrors = [];
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

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
  await page.click("#tabBtnGear");
  await page.waitForSelector("#gearList .gearItem");
  const raw = await page.evaluate(() => {
    const bad = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      const t = node.nodeValue || "";
      if (t.includes("<svg") || t.includes("<path") || /m\d+ \d+/.test(t)) bad.push(t.trim().slice(0, 60));
    }
    return bad;
  });
  ok(!raw.length, "gear cards have no raw SVG text");
  const gun = page.locator('#gearList .gearItem[data-id="r1"]');
  const gunText = await gun.innerText();
  ok(/Rifle A/.test(gunText) && /In use/.test(gunText) && /100 yd zero · MIL/.test(gunText) && /Load A/.test(gunText), "a firearm card is name, zero, and load");
  ok(!/Razor|24"|1:8|Last used/.test(gunText), "barrel, twist, optic, and last used are not repeated on the firearm card");
  ok(!(await gun.evaluate((el) => el.classList.contains("on"))), "the current card has no green border class");
  const box = await gun.boundingBox();
  ok(box && box.height >= 56, "the firearm card is at least 56px tall");
  ok(await gun.locator("svg.chev").count() === 1, "the card shows a chevron");
  await page.locator("#gearList").screenshot({ path: ART + "/cards-firearms.png" });

  await page.click('#gearSwitch button[data-sec="optic"]');
  const optic = await page.locator('#gearList .gearItem[data-id="o1"]').innerText();
  ok(/Razor/.test(optic) && /0\.1 mil\/click/.test(optic) && /FFP/.test(optic) && /on Rifle A/.test(optic) && /In use/.test(optic), "an optic card is magnification or click, focal plane, and the gun it is on");
  ok(!/travel|reticle/i.test(optic), "reticle and travel stay off the optic card");
  await page.locator("#gearList").screenshot({ path: ART + "/cards-optics.png" });

  await page.click('#gearSwitch button[data-sec="load"]');
  const load = await page.locator('#gearList .gearItem[data-id="l1"]').innerText();
  ok(/Load A/.test(load) && /140 gr/.test(load) && /2737 fps · measured/.test(load) && /G7 0\.326/.test(load) && /In use/.test(load), "a load card is weight, velocity with source, and drag model");
  ok(!/\.264|fits|Rifle A/.test(load), "diameter and the firearm name are not repeated on the load card");
  await page.locator("#gearList").screenshot({ path: ART + "/cards-loads.png" });
  await page.click("#gearAllLoads");
  const mismatch = await page.locator("#gearList .gearItem.dim").innerText();
  ok(/Size mismatch/.test(mismatch) && !/Wrong size/.test(mismatch), "a bore mismatch is a chip, not a diameter sentence");

  await page.click('#gearSwitch button[data-sec="gun"]');
  await gun.click();
  await page.waitForSelector("#barrel");
  ok(await page.locator("#barrel").isVisible() && await page.locator("#twist").isVisible(), "the details view still has barrel and twist");
  ok((await page.locator("#gearBackLbl").innerText()).includes("Back"), "details has a back control");
  await page.locator("#gearSec").screenshot({ path: ART + "/cards-details.png" });
  await page.click("#gearBack");

  await page.evaluate(() => {
    const r = window.__bc.P.rifles.find((x) => x.id === "r1");
    r.name = "Rifle " + "VeryLongName".repeat(6);
    r.zeroUnconf = { why: "optic changed", at: "2026-06-01T00:00:00.000Z" };
  });
  await page.click('#gearSwitch button[data-sec="gun"]');
  const long = page.locator('#gearList .gearItem[data-id="r1"]');
  const clip = await long.evaluate((el) => {
    const name = el.querySelector(".gName");
    const chip = el.querySelector(".chip");
    const doc = document.documentElement;
    return {
      nameCut: name.scrollWidth > name.clientWidth + 1,
      chipFull: chip.scrollWidth <= chip.clientWidth + 1 && chip.textContent.length > 2,
      scroll: doc.scrollWidth <= doc.clientWidth + 1,
    };
  });
  ok(clip.nameCut && clip.chipFull && clip.scroll, "a long name ellipsizes, the chip stays whole, and the page does not scroll sideways");
  ok(/Unconfirmed/.test(await long.innerText()), "an unconfirmed zero is a chip");
  console.log("PASS gear-cards", n);
} catch (e) {
  console.error("FAIL gear-cards", e);
  try { await page.screenshot({ path: ART + "/cards-fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
