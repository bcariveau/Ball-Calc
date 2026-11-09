// Active string picker. The choice is the existing session.tg.cur field. No new key.
// Fresh Playwright profile. Does not write the fixture files.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8799;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/bb-active-string";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessions = JSON.parse(fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8"));
sessions[0].date = new Date().toISOString();
sessions[0].tg.cur = "st2";

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };
const keyset = (v, out = new Set()) => {
  if (!v || typeof v !== "object") return out;
  if (Array.isArray(v)) { v.forEach((x) => keyset(x, out)); return out; }
  Object.keys(v).forEach((k) => { out.add(k); keyset(v[k], out); });
  return out;
};

async function boot() {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "log", round: true, values: {} }));
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
  }, { preset: presetRaw, sessions: JSON.stringify(sessions) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "BallisticBench" && window.__bc?.log?.length);
}
const openSession = async () => {
  await page.click("#tabBtnLog");
  await page.waitForSelector(".slItem");
  await page.click(".slItem");
  await page.waitForSelector("#strRec");
};
const shotEntryShot = async (path) => {
  const box = await page.locator("#strRec").boundingBox();
  const add = await page.locator("#slAddRow").boundingBox();
  const y = Math.max(0, Math.min(box.y, add.y) - 8);
  const bottom = Math.max(box.y + box.height, add.y + add.height) + 8;
  await page.screenshot({ path, clip: { x: 0, y, width: 360, height: Math.min(740 - y, bottom - y) } });
};
const shotsOn = () => page.evaluate(() => {
  const s = window.__bc.ED || window.__bc.log.find((x) => x.id === "sess1");
  const of = (id) => (s.shots || []).filter((sh) => sh.str === id).map((sh) => sh.v);
  return { cur: s.tg.cur, st1: of("st1"), st2: of("st2"), strings: s.tg.strings.map((st) => st.id), holes: s.tg.strings.map((st) => ({ id: st.id, n: (st.holes || []).length })) };
});

try {
  await boot();
  const keysBefore = await page.evaluate(() => ({
    ls: Object.keys(localStorage).sort(),
    ss: Object.keys(sessionStorage).sort(),
    presets: localStorage.getItem("bcalc.presets.v1"),
    sess: JSON.parse(JSON.stringify(window.__bc.log.find((s) => s.id === "sess1"))),
  }));
  await openSession();
  const rec = () => page.locator("#strRec .strRecTo").innerText();
  const opt = () => page.locator("#strRec .strRecOpt").innerText();
  ok((await rec()) === "Recording to: String 2 · Rifle B · Load B", "the default active string is the saved current string, String 2");
  ok((await opt()) === "no optic saved", "a string with no saved optic says so");
  ok(await page.locator('.sgh[data-str="st2"]').getAttribute("aria-current") === "true", "the most recently current string is highlighted");
  ok(!(await page.locator("#slStats").innerText()).match(/\bavg\b|\bSD\b|\bES\b/i), "the session summary has no combined velocity stats");
  const s2before = await page.locator('.sgh[data-str="st2"] small').innerText();

  await page.locator("#strRec").scrollIntoViewIfNeeded();
  await shotEntryShot(ART + "/after-recording-control.png");
  await page.click("#strRec");
  await page.waitForSelector("#strPickSheet:not([hidden])");
  const pick = await page.locator("#strPickList").innerText();
  ok(/String 1 · Rifle A · Load A/.test(pick) && /Razor/.test(pick), "the picker names string 1's gun, load, and optic");
  ok(/String 2 · Rifle B · Load B/.test(pick) && /no optic saved/.test(pick) && !/Nothing was invented/.test(pick) && !/No as-fired optic/.test(pick), "the picker names string 2 without the old optic warning");
  const pickNote = await page.locator("#strPickNote").innerText();
  ok(pickNote === "Rifle B has no scope saved, and it has no turret click value. Add a scope in Gear to fix.", "the sheet states the missing scope once");
  ok((pickNote.match(/Add a scope in Gear to fix/g) || []).length === 1, "the approved missing-scope sentence is not repeated in the sheet");
  await page.screenshot({ path: ART + "/after-picker.png" });
  await page.locator("#strPickList button").filter({ hasText: "String 1 · Rifle A · Load A" }).click();
  await page.waitForFunction(() => document.querySelector("#strRec .strRecTo")?.textContent === "Recording to: String 1 · Rifle A · Load A");
  ok(await page.locator("#strPickSheet").isHidden(), "picking a string closes the sheet");
  ok((await opt()) === "Razor", "switching shows that string's optic");
  ok(await page.locator('.sgh[data-str="st1"]').getAttribute("aria-current") === "true", "the picked string is highlighted");
  ok(/Recording/.test(await page.locator(".sgh.active").innerText()), "the active string is labeled Recording");
  ok(await page.locator('.sgh[data-str="st2"]').getAttribute("aria-current") === "false", "the other string is not highlighted");
  await page.locator("#strRec").scrollIntoViewIfNeeded();
  await shotEntryShot(ART + "/after-shot-entry.png");
  await page.locator('.sgh[data-str="st1"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/after-active-highlight.png" });

  await page.fill("#slVel", "2720");
  await page.click("#slAdd");
  await page.waitForFunction(() => window.__bc.ED.shots.some((s) => s.v === 2720 && s.str === "st1"));
  await page.evaluate(() => {
    const el = document.getElementById("slVel");
    const dt = new DataTransfer();
    dt.setData("text", "2690 2695");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => window.__bc.ED.shots.some((s) => s.v === 2690 && s.str === "st1") && window.__bc.ED.shots.some((s) => s.v === 2695 && s.str === "st1"));
  let bag = await shotsOn();
  ok(bag.st1.includes(2720) && bag.st1.includes(2690) && bag.st1.includes(2695), "typed and pasted velocities land on the active string");
  ok(!bag.st2.includes(2720) && !bag.st2.includes(2690) && bag.st2.length === 1, "string 2 does not receive those shots");
  const statLine = (t) => t.replace(/Recording/g, "").replace(/[·\s]+/g, " ").trim();
  const now2 = await page.locator('.sgh[data-str="st2"] small').innerText();
  ok(statLine(now2) === statLine(s2before), "string 2's own stats stay unchanged: " + JSON.stringify([s2before, now2]));
  ok((await page.locator('.sgh[data-str="st1"] small').innerText()).includes("SD") && (await page.locator('.sgh[data-str="st1"] small').innerText()).includes("ES"), "string 1 stats are computed from its own kept shots");
  await page.locator('.sgh[data-str="st1"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/after-shots-landed.png" });

  const holesBefore = (await shotsOn()).holes.find((h) => h.id === "st1").n;
  await page.click("#tgMarkBtn");
  await page.waitForSelector("#tgEd.show");
  await page.waitForTimeout(200);
  const pt = await page.evaluate(() => {
    const svg = document.getElementById("tgSvg");
    const q = new DOMPoint(-1.2, -1.2).matrixTransform(svg.getScreenCTM());
    return [q.x, q.y];
  });
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForFunction((n) => { const st = window.__bc.ED.tg.strings.find((s) => s.id === "st1"); return st.holes.length === n + 1; }, holesBefore);
  await page.click("#tgEdDone");
  await page.waitForSelector("#tgEd.show", { state: "hidden" });
  await page.waitForFunction(async () => {
    const db = await new Promise((res, rej) => { const o = indexedDB.open("bcalc-db"); o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error); });
    const sess = await new Promise((res, rej) => { const r = db.transaction("kv", "readonly").objectStore("kv").get("shotlog"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    const s = (sess || []).find((x) => x.id === "sess1");
    return !!(s && s.tg.cur === "st1" && s.shots.some((sh) => sh.v === 2720) && s.tg.strings.find((st) => st.id === "st1").holes.length > 1);
  });
  bag = await shotsOn();
  ok(bag.holes.find((h) => h.id === "st1").n === holesBefore + 1, "a new hole is marked on the active string");
  ok(bag.holes.find((h) => h.id === "st2").n === 0, "the other string gains no hole");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent === "BallisticBench" && window.__bc?.log?.length);
  await openSession();
  ok((await rec()) === "Recording to: String 1 · Rifle A · Load A", "reload keeps the active string from the existing tg.cur field");
  ok((await shotsOn()).st1.includes(2720) && (await shotsOn()).cur === "st1", "reload keeps the shots on that string");
  const keysAfter = await page.evaluate(() => ({
    ls: Object.keys(localStorage).sort(),
    ss: Object.keys(sessionStorage).sort(),
    presets: localStorage.getItem("bcalc.presets.v1"),
    sess: JSON.parse(JSON.stringify(window.__bc.log.find((s) => s.id === "sess1"))),
  }));
  ok(JSON.stringify(keysAfter.ls) === JSON.stringify(keysBefore.ls), "reload adds no localStorage key");
  ok(JSON.stringify(keysAfter.ss) === JSON.stringify(keysBefore.ss) && keysAfter.ss.length === 0, "sessionStorage stays empty");
  ok(keysAfter.presets === keysBefore.presets, "switching does not rewrite presets");
  const beforeKeys = [...keyset(keysBefore.sess)].sort();
  const afterKeys = [...keyset(keysAfter.sess)].sort();
  ok(JSON.stringify(afterKeys) === JSON.stringify(beforeKeys), "the saved session has no new field names");

  await page.evaluate(() => window.__bc.shStart());
  await page.waitForSelector("#shView.show");
  const shFor = await page.locator("#shFor").innerText();
  ok(/Rifle A/.test(shFor) && /Load A/.test(shFor) && !/Nothing was invented/.test(shFor), "calculations and the shooting context use string 1's saved optic and load");
  await page.evaluate(() => window.__bc.addShotsToLiveSession([{ v: 2733 }], { source: "bluetooth", banner: false }));
  await page.waitForFunction(() => window.__bc.ED.shots.some((s) => s.v === 2733 && s.str === "st1"));
  ok(true, "a radar-path shot lands on the active string");
  await page.click("#shRec");
  await page.locator("#strPickList button").filter({ hasText: "String 2 · Rifle B · Load B" }).click();
  await page.waitForFunction(() => /Rifle B · Load B/.test(document.querySelector("#shFor")?.textContent || ""));
  const shForB = await page.locator("#shFor").innerText();
  ok(/Rifle B/.test(shForB) && /Load B/.test(shForB) && /Rifle B has no scope saved, and it has no turret click value/.test(shForB) && !/No as-fired optic/.test(shForB), "switching in the shooting view uses that string's setup and the missing-scope sentence");
  const shCopy = await page.evaluate(() => document.getElementById("shFor").textContent + "\n" + document.getElementById("shDope").textContent);
  ok((shCopy.match(/Add a scope in Gear to fix/g) || []).length === 1 && !/No as-fired optic/.test(shCopy), "the shooting view shows that sentence once");
  await page.click("#shExit");
  await page.waitForSelector("#shView.show", { state: "hidden" });

  await openSession();
  const nBefore = await page.locator(".sgh").count();
  await page.click("#tgNewStr");
  await page.waitForFunction((n) => document.querySelectorAll(".sgh").length === n + 1, nBefore);
  const neu = await rec();
  ok(/^Recording to: String 3 · Rifle A · Load A$/.test(neu), "a new string becomes the active string and shows its gun and load");
  ok(await page.locator(".sgh.active").count() === 1, "only one string is highlighted");
  await page.fill("#slVel", "2744");
  await page.click("#slAdd");
  await page.waitForFunction(() => { const s = window.__bc.ED; const id = s.tg.cur; return s.shots.some((sh) => sh.v === 2744 && sh.str === id) && id !== "st1" && id !== "st2"; });
  ok(true, "a shot after New string records on the new string");
  ok(!pageErrors.length, "no page errors: " + pageErrors.join(" | "));
  console.log("PASS active-string", asserts);
} catch (e) {
  console.error("FAIL", e);
  try { await page.screenshot({ path: ART + "/fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
