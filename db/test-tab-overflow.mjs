// Gear tabs stay equal width and on the page when names are very long.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8919;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

const measure = () => page.evaluate(() => {
  const tabs = [...document.querySelectorAll("#gearSwitch button")];
  const widths = tabs.map((b) => Math.round(b.getBoundingClientRect().width * 10) / 10);
  const bar = document.getElementById("gearSwitch").getBoundingClientRect();
  const subs = [...document.querySelectorAll("#gearSwitch small")].map((s) => ({
    text: s.textContent,
    ellipsis: getComputedStyle(s).textOverflow === "ellipsis" && getComputedStyle(s).whiteSpace === "nowrap",
    clipped: s.scrollWidth > s.clientWidth + 1,
    title: s.closest("button").title,
  }));
  const doc = document.documentElement;
  const rows = [...document.querySelectorAll(".gearItem")].map((el) => el.getBoundingClientRect().right);
  return {
    widths,
    height: Math.round(bar.height * 10) / 10,
    scroll: doc.scrollWidth,
    client: doc.clientWidth,
    subs,
    rowRight: Math.max(0, ...rows),
  };
});

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
  await page.waitForSelector("#gearSwitch");
  const short = await measure();
  await page.evaluate(() => {
    const longName = (word) => `${word} ${"VeryLongName".repeat(8)}`;
    const P = window.__bc.P;
    const r = P.rifles.find((x) => x.id === "r1");
    r.name = longName("Rifle");
    r.cartridge = { id: "65cm", name: longName("6.5 Creedmoor"), short: longName("6.5"), diameter: 0.264 };
    P.optics.find((o) => o.id === "o1").name = longName("Optic");
    r.loads.find((l) => l.id === r.lastLoadId).name = longName("Load");
  });
  await page.click('#gearSwitch button[data-sec="gun"]');

  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 915 });
    const box = await measure();
    const spread = Math.max(...box.widths) - Math.min(...box.widths);
    ok(spread <= 1, `tabs are equal width at ${width}px (${box.widths.join(", ")})`);
    ok(Math.abs(box.height - short.height) <= 1, `tab bar height stays the same at ${width}px (${box.height} vs ${short.height})`);
    ok(box.scroll <= box.client + 1, `no horizontal scroll at ${width}px (${box.scroll} > ${box.client})`);
    ok(box.subs.every((s) => s.ellipsis && s.clipped && s.title.length > 40), `subtitles ellipsize and keep the full name at ${width}px`);
    ok(box.rowRight <= box.client + 1, `list rows stay inside the viewport at ${width}px`);
    await page.locator("#gearSec").screenshot({ path: ART + `/tabs-${width}.png` });
  }
  await page.locator("#gearList").screenshot({ path: ART + "/rows-long-names.png" });
  await page.setViewportSize({ width: 360, height: 915 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "130%"; });
  const zoom = await measure();
  ok(Math.max(...zoom.widths) - Math.min(...zoom.widths) <= 1, `tabs stay equal at 130% text (${zoom.widths.join(", ")})`);
  ok(zoom.scroll <= zoom.client + 1, `no horizontal scroll at 130% text (${zoom.scroll} > ${zoom.client})`);
  ok(zoom.subs.every((s) => s.clipped), "large text still ellipsizes the subtitles");
  await page.locator("#gearSec").screenshot({ path: ART + "/tabs-large-text.png" });
  console.log("PASS tab-overflow", n);
} catch (e) {
  console.error("FAIL tab-overflow", e);
  try { await page.screenshot({ path: ART + "/tabs-fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
