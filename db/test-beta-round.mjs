// Beta target aim, hole marks, string colors, and optic catalog. Serves this repo. Does not publish.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8836;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
page.on("dialog", async (d) => { await d.accept(d.type() === "prompt" ? "Catalog scope" : undefined); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

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
      };
    });
  }, { preset: presetRaw, sessions: sessionRaw });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.evaluate(() => {
    const s = window.__bc.log.find((x) => x.id === "sess1");
    s.tg.strings.push({
      id: "st3", tid: "t", aim: { x: 0, y: 0 },
      holes: [{ id: "h3", x: -1.2, y: 0.8 }],
      asFired: { rifleId: "r1", opticId: "o1", loadId: "l1", optic: null, recipe: { loadName: "Load A", gunName: "Rifle A" } },
    });
    const b = s.tg.strings.find((x) => x.id === "st2");
    b.aim = { x: 0, y: 0 };
    b.holes = [{ id: "h2", x: 2, y: -1 }];
  });
  await page.click("#tabBtnLog");
  await page.locator(".slItem").click();
  await page.waitForSelector("#slTgRifle");
  const pick = await page.locator("#slTgRifle").inputValue();
  const names = await page.locator("#slTgRifle option").allInnerTexts();
  ok(pick === "r1" && names.includes("Rifle A") && names.includes("Rifle B"), "comparison defaults to the current string's rifle and lists the others");
  await page.locator("#slTgRifle").screenshot({ path: ART + "/compare-picker.png" });
  const marks = await page.evaluate(() => ({
    circles: document.querySelectorAll("#slTgSvg .hole .ms circle").length,
    polys: document.querySelectorAll("#slTgSvg .hole .ms polygon, #slTgSvg .hole .ms rect").length,
    legend: document.querySelector("#slTgLeg") && document.querySelector("#slTgLeg").innerText,
    classes: [...document.querySelectorAll("#slTgSvg .hole .ms")].map((el) => el.getAttribute("class")),
  }));
  ok(marks.circles >= 2 && marks.polys === 0, "compared holes are circles");
  ok(/Rifle A/.test(marks.legend) && /Load A/.test(marks.legend) && marks.classes.some((c) => c.includes("s1")) && marks.classes.some((c) => c.includes("s2")), "two strings use a color legend with rifle and load");
  await page.locator("#slTgView").screenshot({ path: ART + "/compare-colors.png" });
  await page.locator("#slTgView .sc").nth(1).click();
  const single = await page.evaluate(() => ({
    legend: !!document.querySelector("#slTgLeg"),
    solo: document.querySelectorAll("#slTgSvg .ms.solo").length,
    colored: document.querySelectorAll("#slTgSvg .ms.s1, #slTgSvg .ms.s2").length,
    polys: document.querySelectorAll("#slTgSvg .hole .ms polygon").length,
  }));
  ok(!single.legend && single.solo > 0 && single.colored === 0 && single.polys === 0, "one visible string stays a single color with no legend");
  await page.locator("#slTgView").screenshot({ path: ART + "/compare-single.png" });

  await page.click("#tgNewTgt");
  await page.waitForSelector("#tgEd.show");
  const aim = await page.evaluate(() => {
    const t = window.__bc.ED.tg, st = t.strings.find((s) => s.id === t.cur);
    const hole = document.querySelector('#tgMode button[data-v="hole"]');
    return { x: st.aim && st.aim.x, y: st.aim && st.aim.y, holes: hole.getAttribute("aria-pressed") === "true" && hole.classList.contains("on"), tip: document.querySelector("#tgTip").textContent };
  });
  ok(aim.x === 0 && aim.y === 0, "a new target aims at the sheet center");
  ok(aim.holes && /Tap each hole/.test(aim.tip), "Holes mode is already on after New target");
  await page.locator("#tgSvg").screenshot({ path: ART + "/aim-center.png" });
  await page.locator("#tgMode").screenshot({ path: ART + "/holes-active.png" });
  await page.click("#tgEdDone");
  await page.click("#slEdClose");

  await page.click("#tabBtnGear");
  await page.click('#gearSwitch button[data-sec="optic"]');
  await page.click("#gearAdd");
  await page.waitForSelector("#opCatalog");
  await page.selectOption("#opCatalog", "nf-atacr-735-mrad");
  const optic = await page.evaluate(() => ({
    turret: document.getElementById("opTurret").value,
    fp: document.getElementById("opFP").value,
    travel: document.getElementById("opTravel").value,
    sh: document.getElementById("opSH").value,
    name: document.getElementById("opticSel").selectedOptions[0].textContent,
    src: document.getElementById("opCatalogSrc").textContent,
  }));
  ok(optic.turret === "0.1mil" && optic.fp === "FFP" && optic.travel === "29" && optic.sh === "" && /ATACR 7-35/.test(optic.name) && /nightforceoptics.com/.test(optic.src), "a catalog optic prefills published settings and leaves sight height blank");
  await page.locator("#opticBody").screenshot({ path: ART + "/optic-catalog.png" });

  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="gun"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  await page.locator("#rifleDetails > summary").click();
  const more = await page.evaluate(() => {
    const chev = (sel) => {
      const el = document.querySelector(sel);
      const svg = el && el.querySelector("svg.ic.chev");
      const path = svg && [...svg.querySelectorAll("path")].find((p) => getComputedStyle(p).display !== "none");
      return { svg: !!svg, open: el && el.parentElement.open, up: path && path.getAttribute("d") === "m6 15 6-6 6 6", still: svg && getComputedStyle(svg).transform === "none" };
    };
    return { more: chev("#rifleDetails > summary"), zero: chev("#zeroDetails > summary") };
  });
  ok(more.more.svg && more.more.open && more.more.up && more.more.still && more.zero.svg && more.zero.open && more.zero.up && more.zero.still, "open More and the headers inside it use an upward Lucide chevron");
  await page.locator("#rifleDetails").screenshot({ path: ART + "/more-fixed.png" });
  console.log("PASS beta-round", n);
} catch (e) {
  console.error("FAIL", e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
