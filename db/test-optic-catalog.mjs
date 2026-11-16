// Brand, model, search, prefill, and the Source link on the beta optic catalog.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8861;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
page.on("dialog", async (d) => { await d.accept(d.type() === "prompt" ? "Catalog scope" : undefined); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((preset) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "gear", round: true, values: {} }));
  }, presetRaw);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.click("#tabBtnGear");
  await page.click('#gearSwitch button[data-sec="optic"]');
  await page.click("#gearAdd");
  await page.waitForSelector("#opCatBrand");
  const brands = await page.locator("#opCatBrand").evaluate((el) => [...el.options].map((o) => o.textContent));
  ok(brands.includes("Nightforce") && brands.includes("March") && brands.includes("Tangent Theta") && brands.includes("Arken") && brands.includes("Athlon") && brands.includes("Bushnell") && brands.includes("Primary Arms") && brands.includes("Vortex"), "brand list includes the added makers");
  await page.evaluate(() => document.getElementById("toast").classList.remove("show", "act"));
  await page.setViewportSize({ width: 360, height: 1600 });
  await page.locator("#opCatBrand").evaluate((el) => { el.size = el.options.length; });
  await page.locator("#opCatBrand").screenshot({ path: ART + "/optics-brand-list.png" });
  await page.locator("#opCatBrand").screenshot({ path: ART + "/v2-optics-brand-list.png" });
  await page.locator("#opCatBrand").evaluate((el) => { el.size = 1; });
  await page.setViewportSize({ width: 360, height: 740 });

  await page.selectOption("#opCatBrand", "Nightforce");
  const models = await page.locator("#opCatalog").evaluate((el) => [...el.options].map((o) => o.textContent));
  ok(models.some((t) => /ATACR 7-35/.test(t)) && models.every((t) => t === "Choose a model" || /ATACR|NX8|SHV/.test(t)), "choosing a brand lists only that brand's models");
  await page.setViewportSize({ width: 360, height: 1800 });
  await page.locator("#opCatalog").evaluate((el) => { el.size = el.options.length; });
  await page.locator("#opCatalog").screenshot({ path: ART + "/optics-model-list.png" });
  await page.locator("#opCatalog").evaluate((el) => { el.size = 1; });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.selectOption("#opCatBrand", "March");
  await page.locator("#opCatalog").evaluate((el) => { el.size = el.options.length; });
  await page.locator("#opCatalog").screenshot({ path: ART + "/v2-optics-model-list.png" });
  await page.locator("#opCatalog").evaluate((el) => { el.size = 1; });

  await page.selectOption("#opCatBrand", "");
  await page.fill("#opCatSearch", "K525");
  const found = await page.locator("#opCatalog").evaluate((el) => [...el.options].map((o) => o.textContent));
  ok(found.some((t) => /K525i/.test(t)) && found.every((t) => t === "Choose a model" || /K525i/.test(t)), "search filters the model list");
  await page.locator("#opCatalog").evaluate((el) => { el.size = 4; });
  await page.locator("#opCatBox").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.getElementById("toast").classList.contains("show"));
  await page.locator("#opCatBox").screenshot({ path: ART + "/optics-search.png" });
  await page.locator("#opCatalog").evaluate((el) => { el.size = 1; });

  await page.fill("#opCatSearch", "");
  await page.selectOption("#opCatalog", "nf-atacr-735-mrad");
  await page.locator("#opMore > summary").click();
  const mil = await page.evaluate(() => ({
    turret: document.getElementById("opTurret").value,
    fp: document.getElementById("opFP").value,
    travel: document.getElementById("opTravel").value,
    wind: document.getElementById("opWTravel").value,
    sh: document.getElementById("opSH").value,
    cant: document.getElementById("opCant").value,
    track: document.getElementById("opTrack").value,
    name: document.getElementById("opticSel").selectedOptions[0].textContent,
  }));
  ok(mil.turret === "0.1mil" && mil.fp === "FFP" && mil.travel === "29" && mil.wind === "17" && mil.sh === "" && mil.cant === "" && mil.track === "" && /ATACR 7-35/.test(mil.name), "picking a model prefills the published turret and leaves sight height, cant, and tracking blank");
  await page.waitForFunction(() => !document.getElementById("toast").classList.contains("show"));
  await page.locator("#opticBody").screenshot({ path: ART + "/optics-prefilled.png" });
  await page.locator("#opticBody").screenshot({ path: ART + "/v2-optics-prefilled.png" });
  const chevronDir = () => page.evaluate(() => {
    const svg = document.querySelector("#opMore summary svg.ic.chev");
    const path = [...svg.querySelectorAll("path")].find((p) => getComputedStyle(p).display !== "none");
    const len = path.getTotalLength();
    const scr = (t) => {
      const p = path.getPointAtLength(len * t);
      const s = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM());
      return { x: s.x, y: s.y };
    };
    const a = scr(0), m = scr(0.5), b = scr(1);
    const armY = (a.y + b.y) / 2, armX = (a.x + b.x) / 2;
    const dy = m.y - armY, dx = m.x - armX;
    const pointing = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "down" : "up") : (dx < 0 ? "left" : "right");
    return { d: path.getAttribute("d"), pointing, transform: getComputedStyle(svg).transform };
  });
  const zoomChev = async (file) => {
    await page.evaluate(() => {
      const svg = document.querySelector("#opMore summary svg.ic.chev");
      svg.style.width = "140px";
      svg.style.height = "140px";
    });
    await page.locator("#opMore summary svg.ic.chev").screenshot({ path: ART + "/" + file });
    await page.evaluate(() => {
      const svg = document.querySelector("#opMore summary svg.ic.chev");
      svg.style.width = "";
      svg.style.height = "";
    });
  };
  await page.evaluate(() => { document.getElementById("opMore").open = false; });
  const closedChev = await chevronDir();
  ok(closedChev.d === "m6 9 6 6 6-6" && closedChev.pointing === "down" && closedChev.transform === "none", "closed More is a down chevron, apex below the arms");
  await zoomChev("v3-more-closed.png");
  await page.evaluate(() => { document.getElementById("opMore").open = true; });
  const openChev = await chevronDir();
  ok(openChev.d === "m6 15 6-6 6 6" && openChev.pointing === "up" && openChev.transform === "none", "open More is an up chevron, apex above the arms");
  await zoomChev("v3-more-open.png");

  const src = await page.evaluate(() => {
    const a = document.getElementById("opCatalogSrc");
    const clip = getComputedStyle(a.querySelector(".srcu"));
    return { href: a.getAttribute("href"), target: a.getAttribute("target"), shown: a.innerText.replace(/\s+/g, " ").trim(), text: a.textContent, hiddenUrl: clip.display === "none" };
  });
  ok(src.href === "https://www.nightforceoptics.com/riflescopes/atacr/atacr-7-35x56-f1" && src.target === "_blank" && src.shown === "Source" && src.hiddenUrl && /nightforceoptics.com/.test(src.text), "the source is a small Source link, not a raw URL");
  await page.locator("#opCatalogSrc").screenshot({ path: ART + "/optics-source-link.png" });

  await page.selectOption("#opCatalog", "nf-atacr-735-moa");
  const moa = await page.evaluate(() => ({ turret: document.getElementById("opTurret").value, travel: document.getElementById("opTravel").value, reticle: document.getElementById("opReticle").value }));
  ok(moa.turret === "0.25moa" && moa.travel === "100" && moa.reticle === "moa", "an MOA model prefills the MOA click and travel");

  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  ok(keys.length === 2 && keys.includes("bcalc.presets.v1") && keys.includes("bcalc.settings.v1"), "the catalog adds no storage key");
  console.log("PASS optic-catalog", n);
} catch (e) {
  console.error("FAIL optic-catalog", e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
