// Icon markup must render, never show up as text. Also checks the recording-sheet
// active row and the one missing-scope sentence. Fresh Playwright profile.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8801;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/bb-active-string";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => { if (d.type() === "prompt") await d.accept("70"); else await d.accept(); });
let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };

async function boot() {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    sessionStorage.clear();
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
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "BallisticBench");
}
async function leaks() {
  return page.evaluate(() => {
    const bad = [];
    const hidden = (el) => {
      for (let n = el; n; n = n.parentElement) {
        if (n.hidden) return true;
        if (n.classList && n.classList.contains("ovl") && !n.classList.contains("show")) return true;
        if (n.id === "shView" && !n.classList.contains("show")) return true;
        if (n.id === "pkMenu" && !n.classList.contains("show")) return true;
      }
      return false;
    };
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      const t = node.nodeValue || "";
      if (!t.includes("<svg") && !t.includes("<path")) continue;
      if (hidden(node.parentElement)) continue;
      bad.push("text:" + t.trim().slice(0, 120));
    }
    document.querySelectorAll("[aria-label], [title], option").forEach((el) => {
      if (hidden(el)) return;
      for (const a of ["aria-label", "title"]) {
        const v = el.getAttribute(a);
        if (v && (v.includes("<svg") || v.includes("<path"))) bad.push(a + ":" + v.slice(0, 120));
      }
      if (el.tagName === "OPTION" && (el.textContent.includes("<svg") || el.textContent.includes("<path"))) bad.push("option:" + el.textContent.slice(0, 80));
    });
    return bad;
  });
}
async function scan(where) {
  const bad = await leaks();
  ok(!bad.length, where + " has no raw icon markup: " + bad.join(" | "));
}

try {
  await boot();
  await scan("Dope");
  await page.click("#tabBtnGear");
  await page.waitForSelector("#rifleMenu");
  for (const id of ["#rifleMenu", "#opticMenu", "#loadMenu"]) {
    await page.click(id);
    await page.waitForSelector("#pkMenu.show");
    await scan("Gear " + id);
    await page.click("#pkCancel");
    await page.waitForSelector("#pkMenu.show", { state: "hidden" });
  }
  await page.selectOption("#rifleSel", "r2");
  await page.click("#tabBtnLog");
  await page.waitForFunction(() => /No sessions yet/.test(document.querySelector("#slSum")?.textContent || ""));
  ok(await page.locator("#slSum svg.ic").count() > 0, "the empty log summary renders the plus icon");
  await scan("empty Log");
  await page.click("#tabBtnGear");
  await page.selectOption("#rifleSel", "r1");
  await page.selectOption("#loadSel", "l1");
  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#slMvNote");
  ok(await page.locator("#slMvNote svg.ic").count() === 1, "the MV note renders one warning icon");
  ok(!(await page.locator("#slMvNote").innerText()).includes("<svg") && !(await page.locator("#slMvNote").innerText()).includes("<path"), "the MV note text has no icon markup");
  await page.locator("#slMvNote").scrollIntoViewIfNeeded();
  const noteBox = await page.locator("#slMvRow").boundingBox();
  await page.screenshot({ path: ART + "/fix-mv-note.png", clip: { x: 0, y: Math.max(0, noteBox.y - 8), width: 360, height: Math.min(220, noteBox.height + 16) } });
  await scan("session editor");

  await page.evaluate(() => { const r = window.__bc.P.rifles.find((x) => x.id === "r2"); r.turret = "0.1mil"; });
  await page.click("#strRec");
  await page.locator("#strPickList .strOpt").filter({ hasText: "String 2" }).click();
  await page.waitForFunction(() => /Rifle B/.test(document.querySelector("#strRec .strRecTo")?.textContent || ""));
  await page.click("#strRec");
  await page.waitForSelector("#strPickSheet:not([hidden])");
  const sheet = await page.locator("#strPickSheet").innerText();
  const approved = "Rifle B has no scope saved, so clicks use its current turret (0.1 mil). Add a scope in Gear to fix.";
  ok(sheet.includes(approved), "the recording sheet shows the approved missing-scope sentence");
  ok((sheet.match(/Add a scope in Gear to fix/g) || []).length === 1, "that sentence appears once in the sheet");
  ok(!/No as-fired optic/.test(sheet) && !/Nothing was invented/.test(sheet), "the old optic warning is gone from the sheet");
  const style = await page.evaluate(() => {
    const on = document.querySelector("#strPickList .strOpt.on");
    const off = document.querySelector("#strPickList .strOpt:not(.on)");
    const cs = (el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, border: s.borderTopColor, bw: s.borderTopWidth }; };
    return { on: cs(on), off: cs(off), onBadge: !!on.querySelector(".recBadge"), offBadge: !!off.querySelector(".recBadge"), onText: on.innerText, offText: off.innerText };
  });
  ok(style.onBadge && /Recording/.test(style.onText), "the active string has a Recording badge");
  ok(!style.offBadge && !/Recording/.test(style.offText), "the other string has no Recording badge");
  ok(style.on.bg !== style.off.bg || style.on.border !== style.off.border || style.on.bw !== style.off.bw, "the active string is styled differently from the others");
  await page.screenshot({ path: ART + "/fix-sheet-active.png" });
  await page.locator("#strPickNote").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/fix-optic-warning.png" });
  await scan("recording sheet");
  await page.click("#strPickClose");

  await page.click("#shotSelBtn");
  await page.locator("input.shotCk").first().click();
  await page.click("#shotMoveOpen");
  await page.waitForSelector("#shotDestSheet:not([hidden])");
  await scan("move sheet");
  await page.selectOption("#shotDestKind", "existing");
  await page.locator(".destPick").first().click();
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toast.show");
  await scan("move toast");
  ok(/Redo/.test(await page.locator("#toast").innerText()) && !(await page.locator("#toast").innerText()).includes("<svg"), "the move toast buttons are words, not icon markup");

  await page.evaluate(() => window.__bc.shStart());
  await page.waitForSelector("#shView.show");
  await scan("shooting view");
  ok(!pageErrors.length, "no page errors: " + pageErrors.join(" | "));
  console.log("PASS svg-text", asserts);
} catch (e) {
  console.error("FAIL", e);
  try { await page.screenshot({ path: ART + "/svg-fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
