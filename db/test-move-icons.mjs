// Browser coverage for moving a shot onto any existing string, plus the beta icon sweep.
// Fresh Playwright profile only. Does not read a user profile or write the fixture files.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");

const PORT = 8782;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/beta-move-icons";
fs.mkdirSync(ART, { recursive: true });
const presetPath = ROOT + "/db/fixtures/link-v3-v2.json";
const sessionPath = ROOT + "/db/fixtures/link-v3-sessions.json";
const presetBytes = fs.readFileSync(presetPath);
const sessionBytes = fs.readFileSync(sessionPath);

const ICON = /[\u2300-\u27BF\u2B00-\u2BFF\u{1F300}-\u{1FAFF}]/u;
const ALLOW = new Set(["·"]);
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function iconHits(src) {
  const found = new Set();
  for (const ch of stripComments(src)) if (ICON.test(ch) && !ALLOW.has(ch)) found.add(ch);
  return [...found];
}
let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };
const iconFiles = [];
function walk(rel) {
  for (const name of fs.readdirSync(ROOT + "/" + rel)) {
    const next = rel + "/" + name;
    if (fs.statSync(ROOT + "/" + next).isDirectory()) walk(next);
    else if (/\.(js|css|html)$/.test(name)) iconFiles.push(next);
  }
}
walk("beta");
for (const rel of iconFiles) {
  const hits = iconHits(fs.readFileSync(ROOT + "/" + rel, "utf8"));
  ok(!hits.length, rel + " still has icon glyphs " + hits.join(" "));
}
ok(fs.existsSync(ROOT + "/beta/lucide-license.txt") && /ISC/.test(fs.readFileSync(ROOT + "/beta/lucide-license.txt", "utf8")), "Lucide license notice stays");
ok(/class="logo"/.test(fs.readFileSync(ROOT + "/beta/js/views/chrome.js", "utf8")), "the header logo artwork stays");

const preset = JSON.parse(presetBytes.toString());
preset.rifles[0].loads[1].mv = "2900";
preset.rifles[0].loads[1].mvSource = "measured";
preset.rifles[1].loads[0].mv = "2810";
preset.rifles[1].loads[0].mvSource = "measured";
const sessions = JSON.parse(sessionBytes.toString());
sessions[0].shots.find((s) => s.id === "b").fl = true;
sessions.push({
  id: "sess2", rifleId: "r1", loadId: "l2", date: "2026-06-02T15:00:00.000Z", source: "manual", notes: "other session",
  shots: [{ id: "g", v: 2900, str: "st9", cold: true }],
  tg: {
    targets: [{ id: "t2", tpl: "grid1", dist: 100, du: "yd", u: "in" }],
    strings: [{
      id: "st9", tid: "t2", aim: null, holes: [{ id: "h9", x: 0, y: 0, sh: "g" }],
      asFired: {
        rifleId: "r1", opticId: "o1", loadId: "l2",
        optic: { id: "o1", opTurret: "0.1mil", opReticle: "mil", opFP: "FFP", opTrack: "1", opSH: "1.75" },
        recipe: { loadName: "Load A2", gunName: "Rifle A", mv: "2900", diameter: "0.264" },
      },
    }],
    cur: "st9", mark: false,
  },
});

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 300));
const browser = await chromium.launch({
  executablePath: "/opt/google/chrome/chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
const pageErrors = [];
let promptAnswer = null;
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => {
  if (d.type() === "prompt") {
    if (promptAnswer == null) { await d.dismiss(); return; }
    const a = promptAnswer; promptAnswer = null; await d.accept(a);
  } else if (d.type() === "confirm") await d.accept();
  else await d.dismiss();
});

async function seed() {
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
        tx.onerror = () => rej(tx.error);
      };
    });
  }, { preset: JSON.stringify(preset), sessions: JSON.stringify(sessions) });
}
async function boot() {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await seed();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1") && document.querySelector("h1").textContent === "BallisticBench" && window.__bc && window.__bc.log.length === 2);
}
async function openFirst() {
  await page.click("#tabBtnLog");
  await page.waitForSelector(".slItem");
  await page.click(".slItem");
  await page.waitForSelector("#shotSelBtn");
}
async function startSelect() {
  if (await page.locator("#shotSelBtn").isHidden()) await page.click("#shotSelDone");
  await page.click("#shotSelBtn");
  await page.waitForSelector("#shotDestKind");
}
const snap = () => page.evaluate(() => {
  const log = window.__bc.log.map((s) => (window.__bc.ED && window.__bc.ED.id === s.id ? window.__bc.ED : s));
  const pack = (s) => ({
    id: s.id,
    shots: s.shots.map((x) => ({ id: x.id, v: x.v, str: x.str, x: !!x.x, ie: !!x.ie, fl: !!x.fl, cold: !!x.cold })),
    holes: (s.tg?.strings || []).map((st) => ({ id: st.id, sh: (st.holes || []).map((h) => h.sh), af: st.asFired })),
  });
  const load = (rid, lid) => {
    const r = window.__bc.P.rifles.find((g) => g.id === rid);
    const l = r.loads.find((x) => x.id === lid);
    return { mv: l.mv, src: l.mvSource };
  };
  return { sessions: log.map(pack), l1: load("r1", "l1"), l2: load("r1", "l2"), l3: load("r2", "l3") };
});

try {
  await boot();
  ok((await page.locator("h1").innerText()) === "BallisticBench", "beta page shows BallisticBench");
  await openFirst();
  const before = await snap();
  await startSelect();
  await page.click("input.shotCk[data-sel='c']");
  await page.selectOption("#shotDestKind", "existing");
  await page.click("#shotSelDone");
  const cancelled = await snap();
  ok(JSON.stringify(cancelled.sessions) === JSON.stringify(before.sessions), "cancel leaves every shot, tag, and hole where it was");

  await startSelect();
  await page.click("input.shotCk[data-sel='c']");
  await page.selectOption("#shotDestKind", "existing");
  await page.selectOption("#shotDestStr", "sess1::st2");
  const note = await page.locator("#shotDestNote").innerText();
  ok(/Rifle B/.test(note) && /Load B/.test(note) && /not changed/.test(note), "the picker says the shot lands under the destination string");
  ok(/Nothing was invented/.test(note), "a destination with no optic warns instead of inventing one");
  await page.locator("#shotSelBar").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/move-picker-360.png" });
  await page.screenshot({ path: ART + "/move-warning-360.png" });
  const moveH = await page.locator("#shotMoveGo").evaluate((el) => el.getBoundingClientRect().height);
  ok(moveH >= 44, "the move control stays at least 44 px");
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toastAct");
  const toast1 = await page.locator("#toast").innerText();
  ok(/Nothing was invented/.test(toast1), "the move repeats the missing-optic warning");
  ok(/was not changed/.test(toast1) && /Redo dest MV/.test(toast1), "both loads say their measured MV was left alone");
  const moved = await snap();
  const s1 = moved.sessions.find((s) => s.id === "sess1");
  const shotC = s1.shots.find((s) => s.id === "c");
  ok(shotC.str === "st2" && shotC.ie && !shotC.x, "the moved shot keeps Input error and lands on the other string");
  ok(s1.shots.find((s) => s.id === "d").x && s1.shots.find((s) => s.id === "b").fl, "a shot that stayed keeps Remove and Flier");
  ok(s1.holes.find((h) => h.id === "st1").sh[0] === null, "the moved shot drops its hole pairing");
  ok(JSON.stringify(s1.holes.find((h) => h.id === "st2").af) === JSON.stringify(before.sessions[0].holes.find((h) => h.id === "st2").af), "the destination as-fired snapshot is unchanged");
  ok(JSON.stringify(s1.holes.find((h) => h.id === "st1").af) === JSON.stringify(before.sessions[0].holes.find((h) => h.id === "st1").af), "the source as-fired snapshot is unchanged");
  const heads = await page.locator(".sgh").allInnerTexts();
  ok(heads.some((t) => /String 1/.test(t) && /avg 2705/.test(t)), "the source string recomputes without the moved shot");
  ok(heads.some((t) => /String 2/.test(t) && /avg 2805/.test(t)), "the destination string recomputes with the moved shot");
  ok(moved.l1.mv === "2737" && moved.l3.mv === "2810", "neither MV is rewritten by the move itself");

  await page.click("#toastAct");
  await page.waitForFunction(() => (window.__bc.ED.shots.find((s) => s.id === "c") || {}).str === "st1");
  const undone = await snap();
  ok(JSON.stringify(undone.sessions[0].shots) === JSON.stringify(before.sessions[0].shots), "undo puts the same-session shot back exactly");
  ok(undone.sessions[0].holes.find((h) => h.id === "st1").sh[0] === "c", "undo restores the hole pairing");
  ok(undone.l1.mv === "2737" && undone.l3.mv === "2810", "undo does not change either MV");

  await startSelect();
  await page.click("input.shotCk[data-sel='c']");
  await page.selectOption("#shotDestKind", "existing");
  await page.selectOption("#shotDestStr", "sess1::st2");
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toastAct1");
  promptAnswer = "70";
  await page.click("#toastAct1");
  await page.waitForFunction(() => {
    const l = window.__bc.P.rifles.find((r) => r.id === "r1").loads.find((x) => x.id === "l1");
    return l.mv === "2705";
  });
  await page.waitForSelector("#toastAct1");
  await page.click("#toastAct1");
  await page.waitForFunction(() => {
    const l = window.__bc.P.rifles.find((r) => r.id === "r2").loads.find((x) => x.id === "l3");
    return l.mv === "2805";
  });
  const redone = await snap();
  ok(redone.l1.mv === "2705" && redone.l1.src === "measured", "Redo source MV uses the shots that stayed");
  ok(redone.l3.mv === "2805" && redone.l3.src === "measured", "Redo dest MV uses the shots now on that load");
  await page.click("#slSave");
  await page.waitForFunction(() => !document.getElementById("slEditor").classList.contains("show") && window.__bc.log.find((s) => s.id === "sess1").shots.some((x) => x.id === "c" && x.str === "st2"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.find((s) => s.id === "sess1") && window.__bc.log.find((s) => s.id === "sess1").shots.some((x) => x.id === "c" && x.str === "st2"));
  const saved = await snap();
  const ids = saved.sessions.flatMap((s) => s.shots.map((x) => x.id));
  ok(ids.filter((id) => id === "c").length === 1 && saved.sessions.find((s) => s.id === "sess1").shots.length === 5, "reload keeps the moved shot once and loses none");
  ok(saved.l1.mv === "2705" && saved.l3.mv === "2805", "both redone MVs are still there after reload");

  await boot();
  await openFirst();
  await startSelect();
  await page.click("input.shotCk[data-sel='b']");
  await page.selectOption("#shotDestKind", "existing");
  await page.selectOption("#shotDestStr", "sess2::st9");
  const crossNote = await page.locator("#shotDestNote").innerText();
  ok(/Load A2/.test(crossNote) && /not changed/.test(crossNote) && !/Nothing was invented/.test(crossNote), "a different session and load says where the shot will count");
  const afBefore = JSON.stringify((await snap()).sessions.find((s) => s.id === "sess2").holes[0].af);
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toastAct");
  await page.waitForFunction(() => !window.__bc.log.find((s) => s.id === "sess1").shots.some((x) => x.id === "b") && window.__bc.log.find((s) => s.id === "sess2").shots.some((x) => x.id === "b"));
  let crossed = await snap();
  ok(crossed.sessions.find((s) => s.id === "sess2").shots.find((s) => s.id === "b").fl, "a cross-session move keeps Flier");
  ok(crossed.sessions.find((s) => s.id === "sess2").shots.find((s) => s.id === "g").cold, "the destination shot keeps Cold bore");
  ok(JSON.stringify(crossed.sessions.find((s) => s.id === "sess2").holes[0].af) === afBefore, "the other session's as-fired snapshot is unchanged");
  ok(crossed.l1.mv === "2737" && crossed.l2.mv === "2900", "a cross-session move does not rewrite either MV");
  await page.click("#toastAct");
  await page.waitForFunction(() => document.getElementById("toast").innerText.includes("Both sessions are saved"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.find((s) => s.id === "sess1").shots.some((x) => x.id === "b" && x.str === "st1"));
  const back = await snap();
  ok(!back.sessions.find((s) => s.id === "sess2").shots.some((s) => s.id === "b"), "undo saves both sessions, so reload does not leave a copy behind");

  await openFirst();
  await startSelect();
  await page.click("input.shotCk[data-sel='b']");
  await page.selectOption("#shotDestKind", "existing");
  await page.selectOption("#shotDestStr", "sess2::st9");
  await page.click("#shotMoveGo");
  await page.waitForFunction(() => document.getElementById("toast").innerText.includes("These shots will count under"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__bc && window.__bc.log.length === 2);
  crossed = await snap();
  const all = crossed.sessions.flatMap((s) => s.shots.map((x) => x.id));
  ok(all.filter((id) => id === "b").length === 1 && all.includes("a") && all.includes("c") && all.includes("d") && all.includes("f") && all.includes("g"), "reload after a cross-session move has no duplicate and no missing shot");
  ok(crossed.sessions.find((s) => s.id === "sess2").shots.find((s) => s.id === "b").str === "st9", "the shot is on the other session's string after reload");

  await page.click("#tabBtnDope");
  await page.screenshot({ path: ART + "/icons-dope-360.png" });
  await page.click("#tabBtnGear");
  await page.screenshot({ path: ART + "/icons-gear-360.png" });
  await page.click("#tabBtnLog");
  await page.screenshot({ path: ART + "/icons-log-360.png" });
  const ui = await page.evaluate(() => {
    const hits = (document.body.innerText.match(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu) || []).filter((ch) => ch !== "·");
    const imgs = [...document.images].map((img) => img.getAttribute("src") || img.currentSrc).filter((src) => src && !/logo/i.test(src));
    const unlabeled = [...document.querySelectorAll("button")].filter((b) => (b.checkVisibility ? b.checkVisibility() : b.getClientRects().length) && !(b.getAttribute("aria-label") || b.textContent || "").trim()).map((b) => (b.id || b.className || "button") + " in " + (b.parentElement && b.parentElement.id));
    return { hits, imgs, unlabeled, logo: !!document.querySelector("svg.logo"), icons: document.querySelectorAll("svg.ic, svg.lucide").length };
  });
  ok(!ui.hits.length, "the rendered beta has no leftover icon glyphs");
  ok(!ui.imgs.length, "the rendered beta has no icon images");
  ok(ui.logo, "the logo is still the header artwork");
  ok(!ui.unlabeled.length, "visible buttons still have a name: " + ui.unlabeled.join(", "));
  ok(ui.icons > 5, "Lucide-style icons are on the screen");
  ok(!pageErrors.length, "no page errors: " + pageErrors.join(" | "));
  ok(presetBytes.equals(fs.readFileSync(presetPath)) && sessionBytes.equals(fs.readFileSync(sessionPath)), "fixture files were not rewritten");
  console.log("PASS move-icons", asserts);
} finally {
  await browser.close();
  server.kill();
}
