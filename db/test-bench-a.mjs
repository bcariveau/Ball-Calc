// Beta release A: BallisticBench display name, true-diameter holes, tags, and Remove.
// Serves this repo and drives the live beta page. Does not touch production files.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import assert from "node:assert/strict";

const PORT = 8765;
const ROOT = "/workspace";
const SHOT = "/opt/cursor/artifacts/ballisticbench-a";
fs.mkdirSync(SHOT, { recursive: true });
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(300);

const profile = "/tmp/chrome-bench-a";
fs.rmSync(profile, { recursive: true, force: true });
const chrome = spawn("/opt/google/chrome/chrome", [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
  `--user-data-dir=${profile}`, "--remote-debugging-port=9333", "--no-first-run", "about:blank",
], { stdio: "ignore" });

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port: 9333, path }, (res) => {
      let d = ""; res.on("data", (c) => d += c); res.on("end", () => resolve(d));
    }).on("error", reject);
  });
}
let id = 0; const pending = new Map();
function send(ws, method, params = {}, sessionId) {
  const msgId = ++id;
  const msg = { id: msgId, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    setTimeout(() => { if (pending.has(msgId)) { pending.delete(msgId); reject(new Error("timeout " + method)); } }, 20000);
  });
}
const errors = []; const failed = []; const geo = [];
let ws;
try {
  let ver;
  for (let i = 0; i < 40; i++) { try { ver = JSON.parse(await get("/json/version")); break; } catch { await sleep(200); } }
  if (!ver) throw new Error("chrome did not start");
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", () => rej(new Error("ws"))); });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
    }
  });
  const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send(ws, "Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(ws, method, params, sessionId);
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    window.__geo = [];
    const g = navigator.geolocation;
    if (g) {
      const gp = g.getCurrentPosition.bind(g), wp = g.watchPosition.bind(g);
      g.getCurrentPosition = function() { window.__geo.push("getCurrentPosition"); return gp.apply(g, arguments); };
      g.watchPosition = function() { window.__geo.push("watchPosition"); return wp.apply(g, arguments); };
    }
  })();` });
  const seed = { version: 2, rifles: [{ id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", ldKind: "hand" }] }],
    optics: [], ranges: [], lastRifleId: "r1" };
  await call("Page.navigate", { url: "http://127.0.0.1:8765/beta.html" });
  await sleep(1500);
  await call("Runtime.evaluate", { expression: `localStorage.clear(); localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(seed))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify({ ang: "MIL", view: "dope", tab: "dope", values: {} }))});` });
  await call("Page.reload", { ignoreCache: true });
  await sleep(2500);

  const ev = async (expr) => {
    const r = await call("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  };

  const name = await ev("document.querySelector('h1').textContent");
  assert.equal(name, "BallisticBench");
  const title = await ev("document.title");
  assert.equal(title, "BallisticBench");
  const icons = await ev(`JSON.stringify([...document.querySelectorAll('#tabBar svg')].map(s => s.outerHTML.length))`);
  assert.deepEqual(JSON.parse(icons), [3].map(() => JSON.parse(icons)[0]) && JSON.parse(icons).length === 3 ? JSON.parse(icons) : JSON.parse(icons));
  assert.equal(JSON.parse(icons).length, 3, "three inline tab icons");
  assert.ok(JSON.parse(icons).every((n) => n > 40), "icons are inline svg, not emoji");
  const tabHtml = await ev("document.getElementById('tabBar').innerHTML");
  assert.match(tabHtml, /class="lucide lucide-crosshair"/);
  assert.match(tabHtml, /<line x1="22" x2="18" y1="12" y2="12"/);
  assert.match(tabHtml, /class="lucide lucide-wrench"/);
  assert.match(tabHtml, /l3\.106-3\.105c\.32-\.322\.863-\.22\.983\.218a6 6 0 0 1-8\.259 7\.057l-7\.91 7\.91a1 1 0 0 1-2\.999-3/);
  assert.match(tabHtml, /class="lucide lucide-clipboard-list"/);
  assert.match(tabHtml, /<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/);
  const labels = await ev(`JSON.stringify([...document.querySelectorAll('#tabBar [role=tab]')].map(b => b.getAttribute('aria-label')))`);
  assert.deepEqual(JSON.parse(labels), ["Dope", "Gear", "Log"]);
  const manifest = await ev(`document.querySelector('link[rel=manifest]').href`);
  assert.ok(manifest.endsWith("manifest-beta.webmanifest"), manifest);

  // Hole radius: true diameter grows with zoom; unknown diameter does not shrink.
  const radii = await ev(`JSON.stringify((() => {
    const z1 = window.__bc.holeRadii(12, 1, 0.308);
    const z4 = window.__bc.holeRadii(12 / 4, 1, 0.308);
    const oldMk = window.__bc.holeRadii(12 / 4, Math.max(0.5, 1 / Math.sqrt(4)), null);
    const unk1 = window.__bc.holeRadii(12, 1, null);
    const unk4 = window.__bc.holeRadii(12 / 4, 1, null);
    const legacy = window.__bc.bulletDiaIn({ recipe: {} });
    const blank = window.__bc.bulletDiaIn({ recipe: { diameter: "" } });
    const saved = window.__bc.bulletDiaIn({ recipe: { diameter: "0.308" } });
    return { z1, z4, oldMk, unk1, unk4, legacy, blank, saved,
      screenTrue1: z1.hole / 12, screenTrue4: z4.hole / (12 / 4),
      screenUnk1: unk1.hole / 12, screenUnk4: unk4.hole / (12 / 4),
      screenOld: oldMk.hole / (12 / 4) };
  })())`);
  const R = JSON.parse(radii);
  assert.equal(R.z1.hole, 0.154);
  assert.equal(R.z4.hole, 0.154);
  assert.ok(R.screenTrue4 > R.screenTrue1 * 3.9, "true diameter grows ~4x when zoomed 4x");
  assert.ok(Math.abs(R.screenUnk1 - R.screenUnk4) < 1e-9, "unknown diameter stays the same screen size");
  assert.ok(R.screenOld < R.screenUnk1 * 0.6, "the old 1/sqrt(zoom) factor is what shrank the dots");
  assert.equal(R.legacy, null);
  assert.equal(R.blank, null);
  assert.equal(R.saved, 0.308);
  console.log("HOLES", JSON.stringify({ screenTrue1: R.screenTrue1, screenTrue4: R.screenTrue4, screenUnk: R.screenUnk1, screenOld: R.screenOld }));

  // One velocity list, three states. The only change in state 2 is ie on shot d. State 3 removes that same shot.
  const example = await ev(`JSON.stringify((() => {
    const base = [
      { id: "a", v: 2700 }, { id: "b", v: 2710 }, { id: "c", v: 2720 }, { id: "d", v: 2800 },
      { id: "e", v: 2695 }, { id: "f", v: 2735 }, { id: "g", v: 2688 }, { id: "h", v: 2500 }
    ];
    const holes = [
      { id: "ha", x: 0, y: 0, sh: "a" }, { id: "hb", x: 1, y: 0, sh: "b" }, { id: "hd", x: 0, y: 2, sh: "d" }
    ];
    const pack = (shots) => {
      const st = { holes };
      const sess = { shots, tg: { strings: [st] } };
      const kept = window.__bc.statHoles(sess, st);
      const gs = window.__bc.grpStats(kept.map(h => ({ x: h.x, y: h.y })));
      const vv = window.__bc.velVert(sess, st);
      const keptV = shots.filter(s => !s.x).map(s => s.v);
      return { stats: window.__bc.shotStats(shots), gs, vv, dev: window.__bc.shDevCls(2800, keptV), keptV };
    };
    const untagged = pack(base.map(s => ({ ...s })));
    const tagged = pack(base.map(s => s.id === "d" ? { ...s, ie: true } : { ...s }));
    const removed = pack(base.map(s => s.id === "d" ? { ...s, ie: true, x: true } : { ...s }));
    return { untagged, tagged, removed };
  })())`);
  const E = JSON.parse(example);
  const sameStats = (a, b) => ["n", "avg", "sd", "es", "min", "max"].every((k) => a[k] === b[k]);
  assert.ok(sameStats(E.untagged.stats, E.tagged.stats), "Input error on a kept shot must not change avg/SD/ES/count");
  assert.equal(E.untagged.stats.n, 8);
  assert.equal(E.untagged.stats.avg, 2693.5);
  assert.equal(E.untagged.stats.sd, 85.8);
  assert.equal(E.untagged.stats.es, 300);
  assert.equal(E.untagged.stats.min, 2500);
  assert.equal(E.untagged.stats.max, 2800);
  assert.equal(E.tagged.stats.n, 8);
  assert.equal(E.tagged.stats.avg, 2693.5);
  assert.equal(E.tagged.stats.sd, 85.8);
  assert.equal(E.tagged.stats.es, 300);
  assert.equal(E.removed.stats.n, 7);
  assert.equal(E.removed.stats.avg, 2678.3);
  assert.equal(E.removed.stats.sd, 80.2);
  assert.equal(E.removed.stats.es, 235);
  assert.equal(E.removed.stats.min, 2500);
  assert.equal(E.removed.stats.max, 2735);
  assert.notEqual(E.removed.stats.avg, E.untagged.stats.avg);
  const poi = (g) => [g.n, g.cx, g.cy, g.es, g.mr];
  assert.deepEqual(poi(E.untagged.gs), poi(E.tagged.gs));
  assert.equal(E.untagged.gs.n, 3);
  assert.ok(Math.abs(E.untagged.gs.cx - 1 / 3) < 1e-12);
  assert.ok(Math.abs(E.untagged.gs.cy - 2 / 3) < 1e-12);
  assert.ok(Math.abs(E.untagged.gs.es - Math.hypot(1, 2)) < 1e-12);
  assert.equal(E.removed.gs.n, 2);
  assert.equal(E.removed.gs.cx, 0.5);
  assert.equal(E.removed.gs.cy, 0);
  assert.equal(E.removed.gs.es, 1);
  assert.equal(E.removed.gs.mr, 0.5);
  assert.equal(E.untagged.vv.n, 3);
  assert.equal(E.tagged.vv.n, 3);
  assert.equal(E.untagged.vv.r, E.tagged.vv.r);
  assert.equal(E.removed.vv.n, 2);
  assert.equal(E.removed.vv.r, null);
  assert.equal(E.untagged.dev, E.tagged.dev);
  assert.equal(E.untagged.dev, "dvB");
  assert.ok(!E.removed.keptV.includes(2800));
  console.log("STATE untagged", JSON.stringify(E.untagged.stats), "POI", JSON.stringify(E.untagged.gs), "vv", JSON.stringify(E.untagged.vv));
  console.log("STATE input-error-only", JSON.stringify(E.tagged.stats), "POI", JSON.stringify(E.tagged.gs), "vv", JSON.stringify(E.tagged.vv));
  console.log("STATE that shot removed", JSON.stringify(E.removed.stats), "POI", JSON.stringify(E.removed.gs), "vv", JSON.stringify(E.removed.vv));

  const csv = await ev(`window.__bc.sessionsCSV()`);
  assert.ok(csv.startsWith("date,"), csv.slice(0, 40));
  assert.ok(csv.includes("discarded_shots"));

  // Persistence: save a session through the editor path by calling cleanSession and checking export text via shotDetail.
  const detail = await ev(`(() => {
    const shots = [
      { id: "a", v: 2700, clean: true }, { id: "b", v: 2800, ie: true }, { id: "c", v: 2500, x: true, cold: true, fl: true }
    ];
    const s = window.__bc.cleanSession({ id: "s", rifleId: "r1", loadId: "l1", date: "2026-06-01T12:00:00.000Z", source: "manual", notes: "", wx: {}, shots,
      tg: { targets: [{ id: "t", tpl: "grid1", dist: 100, du: "yd", u: "in" }], strings: [{ id: "st", tid: "t", aim: { x: 0, y: 0 }, holes: [{ id: "h", x: 1, y: 0, sh: "a" }] }], cur: "st" } });
    return window.__bc.shotDetail(s);
  })()`);
  assert.match(detail, /Clean/);
  assert.match(detail, /Input error/);
  assert.match(detail, /removed/);
  assert.doesNotMatch(detail, /Hot/);

  const geo = await ev("JSON.stringify(window.__geo || [])");
  assert.equal(geo, "[]", "no geolocation request on load");

  const themes = ["dark", "light", "od", "fde", "night"];
  for (const t of themes) {
    await ev(`document.documentElement.dataset.theme = ${JSON.stringify(t)}; "ok"`);
    await sleep(150);
    const shot = await call("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${SHOT}/theme-${t}.png`, Buffer.from(shot.data, "base64"));
  }
  await ev(`document.querySelector('#tabBtnLog').click(); "ok"`);
  await sleep(200);
  const logShot = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${SHOT}/log-360.png`, Buffer.from(logShot.data, "base64"));

  let sw = false, swState = "";
  for (let i = 0; i < 16 && !sw; i++) {
    swState = await ev(`(async () => { const r = await navigator.serviceWorker.getRegistration(); return JSON.stringify({ c: !!navigator.serviceWorker.controller, scope: r && r.scope, state: r && (r.active || r.waiting || r.installing) && (r.active || r.waiting || r.installing).state }); })()`);
    sw = JSON.parse(swState).c;
    if (!sw && JSON.parse(swState).state === "activated") break;
    if (!sw) await sleep(400);
  }
  if (!sw) {
    await call("Page.reload");
    await sleep(2500);
    swState = await ev(`JSON.stringify({ c: !!navigator.serviceWorker.controller, script: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL })`);
    sw = JSON.parse(swState).c;
  }
  assert.equal(sw, true, "service worker controlling the page " + swState);
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await call("Page.reload");
  await sleep(2000);
  const off = await ev(`JSON.stringify({ title: document.title, h1: document.querySelector('h1') && document.querySelector('h1').textContent, ready: document.readyState })`);
  const offJ = JSON.parse(off);
  assert.equal(offJ.h1, "BallisticBench");
  assert.equal(offJ.ready, "complete");
  console.log("OFFLINE", off);
  console.log("PASS bench-a");
} finally {
  try { chrome.kill("SIGKILL"); } catch {}
  try { server.kill("SIGKILL"); } catch {}
}
