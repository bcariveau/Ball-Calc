// New target opens centered, already in Holes mode. Phone viewport and the beta service worker.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8844;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true, userAgent: UA, isMobile: true });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

async function seed(sessions) {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "log", round: true, values: {} }));
    await new Promise((res) => { const d = indexedDB.deleteDatabase("bcalc-db"); d.onsuccess = d.onerror = d.onblocked = () => res(); });
    if (!sessions) return;
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
  }, { preset: presetRaw, sessions });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.waitForSelector("h1");
}

async function readAim() {
  return page.evaluate(() => {
    const t = window.__bc.ED.tg, st = t.strings.find((s) => s.id === t.cur);
    const hole = document.querySelector('#tgMode button[data-v="hole"]');
    const aim = document.querySelector("#tgSvg .aim");
    return {
      editor: document.getElementById("tgEd").classList.contains("show"),
      x: st.aim && st.aim.x, y: st.aim && st.aim.y,
      holes: !!(hole && hole.getAttribute("aria-pressed") === "true" && hole.classList.contains("on")),
      cross: !!aim,
      mode: window.__bc.TE && window.__bc.TE.mode,
    };
  });
}

try {
  await seed(sessionRaw);
  await page.click("#tabBtnLog");
  await page.locator(".slItem").click();
  await page.waitForSelector("#tgNewTgt");
  await page.click("#tgNewTgt");
  await page.waitForSelector("#tgEd.show");
  let state = await readAim();
  ok(state.editor && state.x === 0 && state.y === 0 && state.holes && state.mode === "hole" && state.cross, "an existing session's new target opens centered in Holes mode");
  await page.screenshot({ path: ART + "/aimfix-after-existing-session.png" });

  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate((preset) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "log", round: true, values: {} }));
  }, presetRaw);
  await page.evaluate(() => new Promise((res) => { const d = indexedDB.deleteDatabase("bcalc-db"); d.onsuccess = d.onerror = d.onblocked = () => res(); }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.click("#tabBtnLog");
  await page.click("#slNewBtn");
  await page.waitForSelector("#tgNewTgt");
  await page.click("#tgNewTgt");
  await page.waitForSelector("#tgEd.show");
  state = await readAim();
  ok(state.editor && state.x === 0 && state.y === 0 && state.holes && state.mode === "hole" && state.cross, "a new session's new target opens centered in Holes mode");
  await page.screenshot({ path: ART + "/aimfix-after-new-session.png" });
  console.log("PASS aimfix", n);
} catch (e) {
  console.error("FAIL", e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
