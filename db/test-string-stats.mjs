// Per-string velocity stats. A session is a container: no surface shows a combined n/avg/SD/ES.
// Fresh Playwright profile. Does not write the fixture files.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8798;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/bb-string-fix";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const sessions = JSON.parse(sessionRaw);
sessions.push({
  id: "sess2", rifleId: "r1", loadId: "l2", date: "2026-11-09T16:00:00.000Z", source: "manual", notes: "other",
  shots: [{ id: "g", v: 2900, str: "st9" }],
  tg: { targets: [{ id: "t2", tpl: "grid1", dist: 100, du: "yd", u: "in" }], strings: [{ id: "st9", tid: "t2", aim: null, holes: [], asFired: { rifleId: "r1", opticId: "o1", loadId: "l2", optic: { id: "o1", opTurret: "0.1mil" }, recipe: { loadName: "Load A2", gunName: "Rifle A" } } }], cur: "st9", mark: false },
});

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => { if (d.type() === "prompt") await d.accept("70"); else await d.accept(); });
let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };
const expect = (shots) => {
  const v = shots.filter((s) => !s.x).map((s) => s.v);
  const n = v.length;
  if (!n) return { n: 0 };
  const avg = +(v.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const sd = n > 1 ? +Math.sqrt(v.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)).toFixed(1) : null;
  const es = n > 1 ? +(Math.max(...v) - Math.min(...v)).toFixed(1) : null;
  return { n, avg, sd, es };
};

async function boot(list) {
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
  }, { preset: presetRaw, sessions: JSON.stringify(list) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent.replace("™","") === "BallisticBench" && window.__bc?.log?.length);
}
const small = (label) => page.locator(".sgh").filter({ hasText: label }).locator("small").innerText();
const who = (label) => page.locator(".sgh").filter({ hasText: label }).locator(".sghWho").innerText();

try {
  await boot(sessions);
  await page.click("#tabBtnLog");
  await page.waitForSelector(".slItem");
  const summary = await page.locator("#slSum").innerText();
  const listText = await page.locator("#slList").innerText();
  ok(/session/.test(summary) && !/\bavg\b|\bSD\b|\bES\b|\bfps\b/i.test(summary), "the session summary has no combined velocity stats");
  ok(/string/.test(listText) && /Rifle A/.test(listText) && !/\bSD\b|\bES\b|\bfps\b/.test(listText), "the session list shows strings and gear, not a combined average");
  ok(await page.locator("#slChartBox").isHidden(), "the session average chart is not shown");
  await page.screenshot({ path: ART + "/session-summary-after.png" });

  await page.click(".slItem");
  await page.waitForSelector(".sgh");
  const before = expect([{ v: 2700 }, { v: 2710 }, { v: 2800 }, { v: 2500, x: true }]);
  ok((await small("String 1 ·")).includes(`${before.n} shots`) && (await small("String 1 ·")).includes(`avg ${Math.round(before.avg)}`), "string 1 uses only its kept shots");
  ok((await small("String 1 ·")).includes("1 removed"), "a removed shot stays out of that string's n and average");
  ok((await who("String 1 ·")) === "Rifle A · Load A", "string 1 shows its firearm and load");
  ok((await who("String 2 ·")) === "Rifle B · Load B", "string 2 shows its own firearm and load");
  const panel = await page.locator("#slStats").innerText();
  ok(/2 strings/.test(panel) && /Rifle A · Load A/.test(panel) && !/\bAvg\b|\bSD\b|\bES\b|\bfps\b|\d{3,}/.test(panel), "the open session summary is not a velocity total");

  await page.click("#shotSelBtn");
  await page.click("input.shotCk[data-sel='b']");
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestGun", "r1");
  await page.selectOption("#shotDestLoad", "l2");
  await page.click("#shotDestClose");
  await page.click("#shotSplit");
  await page.waitForFunction(() => document.querySelectorAll(".sgh").length === 3);
  await page.waitForSelector("#toast.show");
  const toastInfo = await page.evaluate(() => {
    const t = document.getElementById("toast");
    const span = t.querySelector("span");
    const tr = t.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(span).lineHeight) || 16;
    const hits = [...document.querySelectorAll("#slShots .shot, #slShots .sgh")].some((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 2 || r.bottom < 0 || r.top > innerHeight) return false;
      return !(tr.bottom <= r.top || tr.top >= r.bottom || tr.right <= r.left || tr.left >= r.right);
    });
    return { text: span.textContent.trim(), oneLine: span.getBoundingClientRect().height <= lh * 1.35, fits: span.scrollWidth <= span.clientWidth + 2, hits, buttons: [...t.querySelectorAll("button")].map((b) => b.textContent.trim()) };
  });
  ok(/^Moved \d+ shots? to .+ · String \d+\. .+ MV (stale|unchanged|redone)\.$/.test(toastInfo.text), "the move toast is one short sentence: " + toastInfo.text);
  ok(toastInfo.oneLine && toastInfo.fits, "the toast message stays on one line at 360 px");
  ok(!toastInfo.hits, "the toast does not cover the string list");
  ok(toastInfo.buttons[0] === "Undo" && toastInfo.buttons.includes("Redo MV"), "Undo and Redo MV stay compact");
  await page.evaluate(() => {
    const sc = document.getElementById("slEdScroll");
    const toast = document.getElementById("toast").getBoundingClientRect();
    const head = document.querySelector("#slShots .sgh");
    if (sc && head) sc.scrollTop += head.getBoundingClientRect().top - (toast.bottom + 12);
  });
  await page.screenshot({ path: ART + "/toast-after.png" });
  const left = expect([{ v: 2700 }]);
  const right = expect([{ v: 2710 }, { v: 2800 }, { v: 2500, x: true }]);
  const stay = expect([{ v: 2810 }]);
  const s1 = await small("String 1 ·"), sNew = await small("String 3 ·"), s2 = await small("String 2 ·");
  ok(s1.includes(`${left.n} shot`) && s1.includes(`avg ${Math.round(left.avg)}`) && !/SD|ES/.test(s1), "the string that stayed has only its own shot");
  ok(sNew.includes(`${right.n} shots`) && sNew.includes(`avg ${Math.round(right.avg)}`) && sNew.includes(`SD ${right.sd.toFixed(1)}`) && sNew.includes(`ES ${Math.round(right.es)}`), "the new string's SD and ES are from its own kept shots");
  ok(s2.includes(`avg ${Math.round(stay.avg)}`) && !s2.includes("2755") && !s2.includes("2700"), "the untouched string does not pick up the split");
  ok((await who("String 3 ·")) === "Rifle A · Load A2", "the new string header names the firearm and load it was split onto");
  ok((await page.locator("#slUseMV").innerText()).includes("2700"), "Use as MV uses only the shots still on that load");
  const sum = await page.locator("#slStats").innerText();
  ok(/3 strings/.test(sum) && !/Avg fps|\bSD\b|\bES\b/.test(sum), "after a split the session line still has no combined stats");
  await page.locator(".sgh").filter({ hasText: "String 3 ·" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/string-stats-after.png" });
  await page.locator(".sghWho").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/string-header-after.png" });

  await page.click("#slSave");
  await page.waitForFunction(() => !document.getElementById("slEditor").classList.contains("show"));
  const raw = await page.evaluate(() => JSON.stringify(window.__bc.log));
  const csv = await page.evaluate(() => window.__bc.sessionsCSV());
  const exported = await page.evaluate(() => window.__bc.exportSessions());
  ok(JSON.stringify(await page.evaluate(() => window.__bc.log)) === raw, "building an export does not rewrite the stored log");
  ok(!csv.includes("avg_fps") && csv.includes("string_stats") && /S1 Rifle A · Load A n=1 avg=2700/.test(csv) && /n=2 avg=2755 sd=63.6 es=90/.test(csv), "the CSV carries each string and not a session average column");
  ok(exported.every((s) => s.stats == null && s.stringStats.every((r) => r.n === r.n)) && exported[0].stringStats.some((r) => r.n === 2 && r.avg === 2755 && r.load === "Load A2"), "the JSON export has per-string stats and no session stats field");

  await boot(JSON.parse(sessionRaw).concat(sessions.slice(-1)));
  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#shotSelBtn");
  await page.click("#shotSelBtn");
  await page.click("input.shotCk[data-sel='c']");
  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestKind", "existing");
  await page.click(".destPick[data-dest='sess2::st9']");
  await page.click("#shotMoveGo");
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll(".sgh")].find((n) => n.textContent.includes("String 1 ·"));
    return el && el.querySelector("small").textContent.includes("2 shots");
  });
  const src = expect([{ v: 2700 }, { v: 2710 }, { v: 2500, x: true }]);
  const dst = expect([{ v: 2900 }, { v: 2800 }]);
  const srcText = await small("String 1 ·");
  ok(srcText.includes(`${src.n} shots`) && srcText.includes(`avg ${Math.round(src.avg)}`) && srcText.includes(`SD ${src.sd.toFixed(1)}`), "the source string drops the moved shot from its own stats");
  ok((await who("String 1 ·")) === "Rifle A · Load A", "the source header keeps its firearm and load");
  await page.click("#shotSelDone");
  await page.click("#slEdClose");
  await page.click("#tabBtnGear");
  await page.selectOption("#loadSel", "l2", { force: true });
  await page.click("#tabBtnLog");
  await page.waitForFunction(() => [...document.querySelectorAll(".slItem")].some((el) => el.dataset.id === "sess2"));
  await page.locator(".slItem[data-id='sess2']").click();
  await page.waitForSelector(".sgh");
  ok((await small("String 1 ·")).includes(`${dst.n} shots`) && (await small("String 1 ·")).includes(`avg ${Math.round(dst.avg)}`) && (await small("String 1 ·")).includes(`ES ${Math.round(dst.es)}`), "the other session's string counts the moved shot with its own");
  ok((await who("String 1 ·")) === "Rifle A · Load A2", "the destination header shows that string's firearm and load");
  await page.screenshot({ path: ART + "/post-move-after.png" });
  ok(!pageErrors.length, "no page errors: " + pageErrors.join(" | "));
  console.log("PASS string-stats", asserts);
} finally {
  await browser.close();
  server.kill();
}
