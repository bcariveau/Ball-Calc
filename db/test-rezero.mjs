// Re-zero math and the rule that nothing is written until the user acts.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { activeStack, analyze, axisStats, evaluate, rebaseOffsets, tCrit, zeroReminder, REMIND_MS } from "../beta/js/rezero.js";
import { inPerU } from "../beta/js/targets.js";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const spec = { u: "MIL", v: 0.1, k: 1 };
const pt = (v, h, yd, id, date = "2026-01-01", cold = false) => ({ v, h, yd, stringId: id, date, cold });

ok(Math.abs(tCrit(4) - 2.776) < 1e-9 && Math.abs(tCrit(9) - 2.262) < 1e-9, "95% t values for 5 and 10 shots");
const st = axisStats([0.4, 0.5, 0.45, 0.55, 0.42]);
const mean = (0.4 + 0.5 + 0.45 + 0.55 + 0.42) / 5;
const sd = Math.sqrt([0.4, 0.5, 0.45, 0.55, 0.42].reduce((a, v) => a + (v - mean) ** 2, 0) / 4);
ok(st.n === 5 && Math.abs(st.mean - mean) < 1e-12 && Math.abs(st.sd - sd) < 1e-12, "sample SD uses n-1");
ok(Math.abs(st.ci - tCrit(4) * sd / Math.sqrt(5)) < 1e-12, "95% CI is t times s over sqrt(n)");

const quiet = analyze(Array.from({ length: 8 }, () => pt(0.05, 0, 100, "s1")), { spec, zeroYd: 100 });
ok(quiet == null, "0.05 mil is under the 0.15 mil floor");
const wide = analyze([0.0, 0.4, -0.1, 0.5, 0.05, 0.35].map((v, i) => pt(v, 0, 100, "s" + (i % 2), "2026-01-0" + (i + 1))), { spec, zeroYd: 100 });
ok(wide == null || Math.abs(wide.v) < 0.2, "a mean inside its CI does not become a dial change");
const oneClick = analyze(Array.from({ length: 6 }, (_, i) => pt(0.2, 0, 100, i < 3 ? "s1" : "s2")), { spec: { u: "MIL", v: 0.25, k: 1 }, zeroYd: 100 });
ok(oneClick == null, "0.20 mil is less than one 0.25 mil click");

const snapPts = [0.22, 0.23, 0.24, 0.23, 0.22, 0.24].map((v, i) => pt(v, 0, 100, i < 3 ? "a" : "b"));
const snapped = analyze(snapPts, { spec, zeroYd: 100 });
ok(snapped && snapped.v === -0.2 && snapped.clicks.v === -2 && snapped.followUp === false && snapped.showResidual === true, "0.23 mil snaps to 2 clicks down and the residual is shown once");
ok(Math.abs(snapped.residual.v - (-0.03)) < 0.015, "the residual is the part of the correction a click cannot take");

const possible = analyze(Array.from({ length: 6 }, () => pt(0.3, 0.02, 100, "s1")), { spec, zeroYd: 100 });
ok(possible && possible.mode === "possible" && possible.class === "zero" && possible.h === 0, "5 to 9 shots offer Save offset only, and a tiny windage is not a zero");
const applied = analyze([
  ...Array.from({ length: 6 }, () => pt(0.3, 0.02, 100, "s1", "2026-01-01")),
  ...Array.from({ length: 6 }, () => pt(0.32, 0.01, 100, "s2", "2026-01-02")),
], { spec, zeroYd: 100 });
ok(applied && applied.mode === "apply" && applied.strings === 2, "10 shots on 2 strings can be applied as a dial change");
const oneString = analyze(Array.from({ length: 10 }, () => pt(0.3, 0, 100, "only")), { spec, zeroYd: 100 });
ok(oneString && oneString.mode === "possible", "10 shots on one string stay Save offset only");

const filtered = [];
for (let i = 0; i < 6; i++) filtered.push(pt(0.3, 0, 100, "keep"));
filtered.push(pt(2, 0, 100, "keep", "2026-01-01", true));
ok(analyze(filtered, { spec, zeroYd: 100 }).shots === 6, "cold bore is tracked apart from the suggestion");

const inch = 0.3 * inPerU("MIL", 100);
function hole(id, y, sh) { return { id, x: 0, y, sh }; }
function shot(id, flags = {}) { return { id, v: 2700, ...flags }; }
function session(strings, shots, date = "2026-06-01T00:00:00.000Z") {
  return { id: "sess", rifleId: "r1", loadId: "l1", date, shots, tg: { targets: [{ id: "t", dist: 100, du: "yd" }], strings } };
}
const good = ["a", "b", "c", "d", "e", "f"].map((id) => hole(id, inch, id));
const shots = ["a", "b", "c", "d", "e", "f"].map((id) => shot(id));
shots.push(shot("fl", { fl: true }), shot("ie", { ie: true }), shot("x", { x: true }), shot("cold", { cold: true }));
const holes = [...good, hole("hfl", inch * 4, "fl"), hole("hie", inch * 4, "ie"), hole("hx", inch * 4, "x"), hole("hc", inch * 4, "cold"), hole("hu", inch * 4, null)];
const rifle = { id: "r1", zero: "100" };
const load = { id: "l1" };
const base = [session([{ id: "s1", tid: "t", aim: { x: 0, y: 0 }, holes }], shots)];
const before = JSON.stringify(base);
const hit = evaluate({ sessions: base, rifle, load, spec, zeroYd: 100, dismissed: [] });
ok(hit && hit.shots === 6 && hit.mode === "possible", "fliers, input error, removed, unpaired, and cold shots stay out of the suggestion");
ok(JSON.stringify(base) === before, "reading a suggestion does not change the sessions");
const dismissed = [{ id: "d1", at: "2026-06-02T00:00:00.000Z", sourceStringIds: ["s1"], rifleId: "r1", loadId: "l1", reason: "zero" }];
ok(evaluate({ sessions: base, rifle, load, spec, zeroYd: 100, dismissed }) == null, "a dismissed string does not suggest again");
const extra = JSON.parse(JSON.stringify(base[0]));
extra.tg.strings.push({ id: "s2", tid: "t", aim: { x: 0, y: 0 }, holes: good.map((h, i) => ({ ...h, id: "n" + i, sh: "n" + i })) });
extra.shots.push(...["a", "b", "c", "d", "e", "f"].map((_, i) => shot("n" + i)));
extra.date = "2026-06-03T00:00:00.000Z";
const again = evaluate({ sessions: [extra], rifle, load, spec, zeroYd: 100, dismissed });
ok(again && again.sourceStringIds.includes("s2") && !again.sourceStringIds.includes("s1"), "new strings can suggest after a dismissal");

const grown = [
  ...Array.from({ length: 6 }, () => pt(0.05, 0, 100, "z", "2026-01-01")),
  ...Array.from({ length: 6 }, () => pt(0.4, 0, 300, "m", "2026-02-01")),
  ...Array.from({ length: 6 }, () => pt(0.9, 0, 600, "f", "2026-03-01")),
];
ok(analyze(grown, { spec, zeroYd: 100, nearTransonic: false }).class === "truing", "vertical that grows with distance is a truing suggestion");
ok(analyze(grown, { spec, zeroYd: 100, nearTransonic: true }).what === "bc", "near transonic offers the existing BC scale");
const level = [
  ...Array.from({ length: 6 }, () => pt(0.02, 0.2, 200, "h1")),
  ...Array.from({ length: 6 }, () => pt(0.02, 0.45, 400, "h2", "2026-02-01")),
  ...Array.from({ length: 6 }, () => pt(0.02, 0.8, 600, "h3", "2026-03-01")),
];
ok(analyze(level, { spec, zeroYd: 100 }).class === "level" && analyze(level, { spec, zeroYd: 100 }).mode === "report", "horizontal that grows with distance is check level, report only");
const farH = Array.from({ length: 8 }, (_, i) => pt(0.02, 0.4, 400, i < 4 ? "p" : "q"));
ok(analyze(farH, { spec, zeroYd: 100 }).class === "report", "horizontal at distance is report only");

const stackRifle = { offsets: [
  { type: "zero", status: "active", v: 0.2, h: 0, unit: "MIL" },
  { type: "config", status: "active", v: 0.5, h: 0, unit: "MIL" },
  { type: "truing", status: "active", v: 0.05, h: 0, unit: "MIL" },
] };
const stackLoad = { offsets: [{ type: "load", status: "active", v: 0.1, h: 0.1, unit: "MIL" }] };
const off = activeStack(stackRifle, stackLoad, { configOn: false, displayUnit: "MIL" });
const on = activeStack(stackRifle, stackLoad, { configOn: true, displayUnit: "MIL" });
ok(Math.abs(off.sum.v - 0.35) < 1e-9 && Math.abs(off.sum.h - 0.1) < 1e-9 && !/Config/.test(off.line), "the stack adds zero, load, and truing and leaves config off");
ok(Math.abs(on.sum.v - 0.85) < 1e-9 && /Config/.test(on.line), "config joins the stack only while its session toggle is on");
ok(off.sum.v !== 0.2 * 0.1, "layers add; they do not compound");
const rebased = rebaseOffsets(stackLoad.offsets, 0.2, 0, "MIL");
ok(rebased[0].v === -0.1 && stackLoad.offsets[0].v === 0.1, "re-base subtracts the new zero from a lower layer without editing the original");

const now = Date.parse("2026-08-01T00:00:00.000Z");
ok(zeroReminder({ zeroUnconf: { why: "optic" } }, now).kind === "unconf", "an optic change still asks for confirmation");
ok(zeroReminder({ lastZeroConfirm: { at: "2026-07-20T00:00:00.000Z" } }, now) == null, "a recent confirmation does not nag");
ok(zeroReminder({ lastZeroConfirm: { at: "2026-06-01T00:00:00.000Z" } }, now).kind === "stale", "30 days after the last confirmation reminds");
ok(zeroReminder({ lastZeroConfirm: { at: "2026-06-01T00:00:00.000Z" }, dismissedSuggestions: [{ reason: "reminder", at: "2026-07-20T00:00:00.000Z" }] }, now) == null, "dismissing the reminder snoozes it for 30 days");
ok(REMIND_MS === 30 * 864e5, "the reminder window is 30 days");

const PORT = 8927;
const ROOT = "/workspace";
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("dialog", (d) => d.accept());
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
      o.onsuccess = () => { const tx = o.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(JSON.parse(sessions), "shotlog"); tx.oncomplete = () => { o.result.close(); res(); }; };
    });
  }, { preset: presetRaw, sessions: sessionRaw });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  const settings = await page.evaluate(() => localStorage.getItem("bcalc.settings.v1"));
  const presets = await page.evaluate(() => localStorage.getItem("bcalc.presets.v1"));
  await page.click("#tabBtnGear");
  await page.click("#tabBtnLog");
  await page.click("#tabBtnDope");
  ok((await page.evaluate(() => localStorage.getItem("bcalc.presets.v1"))) === presets, "opening Gear, Log, and Dope does not write presets");
  ok((await page.evaluate(() => localStorage.getItem("bcalc.settings.v1"))) === settings, "re-zero does not write settings");
  ok(await page.evaluate(() => !JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles.some((r) => r.offsets || r.lastZeroConfirm || r.dismissedSuggestions)), "startup does not add offset fields");
  console.log("PASS rezero", n);
} catch (e) {
  console.error("FAIL rezero", e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
