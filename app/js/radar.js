// app/js/radar.js — Bluetooth radar (Athlon Rangecraft Velocity PRO): the pure RADAR-PARSER block and the live connection.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { toast } from "./components.js";
import { $ } from "./core.js";
import { curLoad } from "./gear.js";
import { ED, LOG, addShotsToLiveSession, closeEditor } from "./log.js";
import { SH, shStatus } from "./shooting.js";
import { wakeSync } from "./shot-banner.js";
import { LIVE, fpsT, readings, set_LIVE, tgEnsure } from "./targets.js";


/* ---------------- Bluetooth radar: Athlon Rangecraft Velocity PRO (Web Bluetooth, Android Chrome) ---------------- */
/* RADAR-PARSER-BEGIN (pure functions; db/test-bluetooth.mjs extracts and tests this block) */
const VPR = {
  SVC: "6e40ff01-b5a3-f393-e0a9-4174686c6f6e", NOTIFY: "6e40ff03-b5a3-f393-e0a9-4174686c6f6e", WRITE: "6e40ff02-b5a3-f393-e0a9-4174686c6f6e",
  NAMES: ["ATHLONVPR", "AthlonVPR", "AthlonVpr", "athlonvpr", "ATHLON", "Athlon"]
};
const vprHex = b => Array.from(b, x => x.toString(16).toUpperCase().padStart(2, "0")).join(" ");
const vprU16 = (b, i) => b[i] | (b[i + 1] << 8);
const vprBcd = x => ((x >> 4) <= 9 && (x & 15) <= 9) ? (x >> 4) * 10 + (x & 15) : NaN;
const vprFps = raw => Math.round(raw / 10 * 3.28084 * 10) / 10;          // raw = tenths of m/s
// Frame: 0x80, len, type, ...payload; total bytes = len + 2 (last two are a 16-bit check value, not yet verified).
function vprParse(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const out = { ok: false, type: b[2], len: b[1], hex: vprHex(b) };
  if (b.length < 4 || b[0] !== 0x80) return out;
  if (b.length < b[1] + 2) return out;
  out.ok = true;
  if (b.length >= 10) {
    const [Y, M, D, h, m, s] = [4, 5, 6, 7, 8, 9].map(i => vprBcd(b[i]));
    if ([Y, M, D, h, m, s].every(Number.isFinite) && M >= 1 && M <= 12 && D >= 1 && D <= 31 && h < 24 && m < 60 && s < 60) {
      out.time = new Date(2000 + Y, M - 1, D, h, m, s);
      const p = n => String(n).padStart(2, "0");
      out.timeStr = `${2000 + Y}-${p(M)}-${p(D)} ${p(h)}:${p(m)}:${p(s)}`;
    }
  }
  if (b[2] === 0x22 && b.length >= 22) {
    const raw = vprU16(b, 12);
    out.shot = {
      n: b[3], raw, mps: raw / 10, fps: vprFps(raw),
      hiFps: vprFps(vprU16(b, 14)), loFps: vprFps(vprU16(b, 16)), avgFps: vprFps(vprU16(b, 18)), esFps: vprFps(vprU16(b, 20)),
      key: `${b[3]}|${vprHex(b.subarray(4, 10))}`,
      unknown: vprHex(b.subarray(10, 12)) + " / " + vprHex(b.subarray(22, Math.max(22, b.length - 2)))
    };
  }
  return out;
}
// Reassembles frames from notification chunks (Android usually delivers a whole frame per notification).
function vprReassemble(buf, chunk) {
  let a = new Uint8Array(buf.length + chunk.length); a.set(buf); a.set(chunk, buf.length);
  const frames = [];
  for (;;) {
    const st = a.indexOf(0x80); if (st < 0) { a = new Uint8Array(0); break; }
    if (st > 0) a = a.subarray(st);
    if (a.length < 2) break;
    const need = a[1] + 2;
    if (need < 4 || need > 255) { a = a.subarray(1); continue; }
    if (a.length < need) break;
    frames.push(a.slice(0, need)); a = a.subarray(need);
  }
  return { frames, rest: a.slice() };
}
/* RADAR-PARSER-END */
let RD;   // set in init (was const)
const K_RSEEN = "bcalc.radar.seen.v1";
const hasBT = !!(navigator.bluetooth && window.isSecureContext);
function radarPaint() {
  wakeSync(); shStatus();
  const st = $("radarStatus"), c = $("radarConnect"), rc = $("radarReconnect"), dc = $("radarDisconnect");
  if (!hasBT) {
    c.disabled = true; c.hidden = true; rc.hidden = true; dc.hidden = true; $("radarMore").hidden = true;
    const m = !window.isSecureContext ? "📡 Radar needs the https site — use ⇧ Athlon file to import shots." : "📡 Radar needs Chrome on Android — use ⇧ Athlon file to import shots.";
    st.textContent = m; st.className = "summary bad"; $("radarNo").textContent = m; $("radarNo").hidden = false; return;
  }
  $("radarMore").hidden = RD.status === "idle" && !RD.opened;
  const name = RD.dev?.name || "radar", bt = RD.battery != null ? ` · 🔋 ${RD.battery}%` : "", fw = RD.fw ? ` · fw ${RD.fw}` : "";
  const last = RD.last ? ` · last ${fpsT(RD.last.fps)} fps (#${RD.last.n})` : "";
  const wait = RD.pending.length ? ` · ${RD.pending.length} shot${RD.pending.length > 1 ? "s" : ""} waiting: pick a load` : "";
  const txt = {
    idle: "Not connected.", connecting: `Connecting to ${name}…`, connected: `🟢 Connected: ${name}${bt}${fw}${last}${wait}`,
    lost: `🟠 ${name} disconnected${RD.retries ? ", retrying…" : "."}${last}${wait}`, off: `Disconnected from ${name}.${last}${wait}`
  }[RD.status] || "";
  st.textContent = txt; st.className = "summary" + (RD.status === "connected" ? " ok" : RD.status === "lost" ? " bad" : "");
  c.hidden = RD.status === "connected" || RD.status === "connecting"; c.disabled = false;
  rc.hidden = !(RD.dev && (RD.status === "lost" || RD.status === "off")); rc.textContent = `↻ Reconnect${RD.dev?.name ? " " + RD.dev.name : ""}`;
  dc.hidden = !(RD.status === "connected" || RD.status === "connecting" || (RD.status === "lost" && RD.retries));
  const ed = $("slEdRadar"); if (ed) ed.textContent = RD.status === "idle" ? "" : "📡 " + txt.replace(/^[🟢🟠] /u, "");
}
function radarRawPush(dir, bytes, note) {
  RD.raw.unshift({ t: new Date(), dir, hex: vprHex(bytes), note: note || "" });
  if (RD.raw.length > 20) RD.raw.length = 20;
  $("radarRawN").textContent = RD.raw.length;
  $("radarRawPre").textContent = RD.raw.map(r => `${r.t.toLocaleTimeString()} ${r.dir} ${r.hex}${r.note ? "  ← " + r.note : ""}`).join("\n");
}
async function radarFlush() {
  if (RD.flushing || !RD.pending.length || !curLoad()) return;
  RD.flushing = true;
  try {
    while (RD.pending.length) {
      const s = RD.pending[0];
      // radar shot #1 = a new string on the radar → start a new app session if the live one already has radar shots
      if (s.n === 1 && SH.on && ED && ED.id === SH.sid) { const t = tgEnsure(ED); if (readings(ED, t.cur).length) SH.ended = t.cur; }   // shooting view: a new radar string = a new string in the same session
      else if (s.n === 1) { const L = LIVE && LOG.find(q => q.id === LIVE.id); if (ED && ED.source === "bluetooth" && ED.shots.length) { closeEditor(true); set_LIVE(null); } else if (L && L.shots.length) set_LIVE(null); }
      const id = await addShotsToLiveSession([{ v: s.fps, t: s.timeStr ? s.timeStr.slice(11) : "" }], { source: "bluetooth", open: false });
      if (!id) break;
      RD.pending.shift();
    }
  } finally { RD.flushing = false; radarPaint(); }
}
function radarFrame(f) {
  const p = vprParse(f);
  if (!p.ok) { radarRawPush("◇", f, "unparsed"); return; }
  if (!p.shot) { radarRawPush("·", f, `type 0x${(p.type ?? 0).toString(16).padStart(2, "0")}${p.timeStr ? " " + p.timeStr : ""}`); return; }
  const s = p.shot, dup = RD.seen.includes(s.key);
  radarRawPush(dup ? "=" : "★", f, `shot #${s.n} ${s.fps.toFixed(1)} fps${p.timeStr ? " " + p.timeStr : ""}${dup ? " (duplicate, ignored)" : ""} · hi ${s.hiFps} lo ${s.loFps} avg ${s.avgFps} es ${s.esFps}`);
  if (dup) return;
  RD.seen.push(s.key); if (RD.seen.length > 300) RD.seen.splice(0, RD.seen.length - 300);
  try { localStorage.setItem(K_RSEEN, JSON.stringify(RD.seen)); } catch {}
  RD.last = { n: s.n, fps: s.fps };
  RD.pending.push({ n: s.n, fps: s.fps, timeStr: p.timeStr });
  if (!curLoad()) toast(`Radar shot ${fpsT(s.fps)} fps held: pick a load to log it`);
  else if (!SH.on) toast(`📡 Shot #${s.n}: ${fpsT(s.fps)} fps`);
  if (navigator.vibrate) try { navigator.vibrate(40); } catch {}
  radarFlush();
}
function radarBytes(chunk) {
  const now = Date.now();
  if (RD.buf.length && now - RD.bufT > 600) RD.buf = new Uint8Array(0);   // stale partial frame
  RD.bufT = now;
  const { frames, rest } = vprReassemble(RD.buf, chunk);
  RD.buf = rest;
  if (!frames.length && !rest.length) radarRawPush("◇", chunk, "no frame header");
  frames.forEach(radarFrame);
  radarPaint();
}
const onRadarNotify = e => { const v = e.target.value; radarBytes(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); };
const onBattery = e => { RD.battery = e.target.value.getUint8(0); radarPaint(); };
function onRadarGone() {
  RD.chr = null; RD.batt = null; RD.buf = new Uint8Array(0);
  if (RD.manualOff) { RD.status = "off"; radarPaint(); return; }
  if (RD.retrying) return;   // a retry loop is already running
  RD.status = "lost"; radarPaint(); toast("Radar disconnected, retrying…");
  radarAutoRetry();
}
async function radarAutoRetry() {
  RD.retrying = true;
  try { await radarRetryLoop(); } finally { RD.retrying = false; }
}
async function radarRetryLoop() {
  for (let i = 1; i <= 3; i++) {
    RD.retries = i; RD.status = "lost"; radarPaint();
    await new Promise(r => setTimeout(r, 1500 * i));
    if (RD.manualOff || RD.status === "connected") { RD.retries = 0; return; }
    try { await radarGatt(true); RD.retries = 0; return; } catch {}
  }
  RD.retries = 0; RD.status = "lost"; radarPaint();
}
async function radarGatt(quiet) {
  const d = RD.dev; if (!d) return;
  RD.status = "connecting"; RD.manualOff = false; radarPaint();
  try {
    const srv = await d.gatt.connect();
    const svc = await srv.getPrimaryService(VPR.SVC);
    RD.chr = await svc.getCharacteristic(VPR.NOTIFY);
    RD.chr.removeEventListener("characteristicvaluechanged", onRadarNotify);
    RD.chr.addEventListener("characteristicvaluechanged", onRadarNotify);
    await RD.chr.startNotifications();
    RD.status = "connected"; RD.retries = 0; radarPaint(); toast(`Radar connected: ${d.name || "Athlon"}`);
    try {
      const bs = await srv.getPrimaryService("battery_service"); RD.batt = await bs.getCharacteristic("battery_level");
      RD.battery = (await RD.batt.readValue()).getUint8(0);
      try { RD.batt.removeEventListener("characteristicvaluechanged", onBattery); RD.batt.addEventListener("characteristicvaluechanged", onBattery); await RD.batt.startNotifications(); } catch {}
    } catch { RD.battery = null; }
    try {
      const di = await srv.getPrimaryService("device_information"), ch = await di.getCharacteristic("firmware_revision_string");
      RD.fw = new TextDecoder().decode(await ch.readValue()).replace(/\0/g, "").trim().slice(0, 20);
    } catch {}
    radarPaint();
  } catch (e) {
    if (!quiet) console.warn("radar connect failed:", e);
    try { d.gatt.connected && d.gatt.disconnect(); } catch {}
    RD.status = quiet ? "lost" : "off"; radarPaint();
    if (!quiet) toast(/NetworkError|connect/i.test(e.message || "") ? "Couldn't connect. Close Athlon's app, wake the radar, then try again." : "Radar: " + (e.message || e));
    throw e;
  }
}
function adoptDevice(d) {
  if (RD.dev && RD.dev !== d) RD.dev.removeEventListener("gattserverdisconnected", onRadarGone);
  RD.dev = d; d.removeEventListener("gattserverdisconnected", onRadarGone); d.addEventListener("gattserverdisconnected", onRadarGone);
}

export function init() {
  RD = { dev: null, chr: null, batt: null, buf: new Uint8Array(0), bufT: 0, raw: [], pending: [], seen: [], status: "idle", battery: null, last: null, fw: "", retries: 0, manualOff: false, flushing: false };
  try { RD.seen = JSON.parse(localStorage.getItem(K_RSEEN) || "[]"); if (!Array.isArray(RD.seen)) RD.seen = []; } catch { RD.seen = []; }
  $("radarConnect").onclick = async () => {
    if (!hasBT) return;
    RD.opened = true; radarPaint();
    if (navigator.bluetooth.getAvailability) { try { if (!(await navigator.bluetooth.getAvailability())) { const m = "Bluetooth isn't available to Chrome. Turn on Bluetooth and Location, and allow Chrome the Nearby devices permission."; toast(m); $("radarStatus").textContent = m; $("radarStatus").className = "summary bad"; } } catch {} }
    let d;
    try {
      d = await navigator.bluetooth.requestDevice({
        filters: [...VPR.NAMES.map(namePrefix => ({ namePrefix })), { services: [VPR.SVC] }],
        optionalServices: [VPR.SVC, "battery_service", "device_information"]
      });
    } catch (e) {
      const msg = e.message || String(e);
      if (e.name === "NotFoundError" && /cancel/i.test(msg)) return;   // picker cancelled
      const help = /adapter|not available|permission|globally disabled/i.test(msg)
        ? "Chrome can't use Bluetooth. Turn on Bluetooth and Location, and allow Chrome the Nearby devices permission in Android settings."
        : "Radar: " + msg;
      toast(help); const st = $("radarStatus"); st.textContent = help + " (" + e.name + ")"; st.className = "summary bad"; return;
    }
    adoptDevice(d); RD.retries = 0;
    try { await radarGatt(); } catch {}
  };
  $("radarReconnect").onclick = async () => { RD.retries = 0; try { await radarGatt(); } catch {} };
  $("radarDisconnect").onclick = () => {
    RD.manualOff = true; RD.retries = 0;
    try { RD.chr && RD.chr.stopNotifications().catch(() => {}); } catch {}
    try { RD.dev && RD.dev.gatt.connected ? RD.dev.gatt.disconnect() : onRadarGone(); } catch { onRadarGone(); }
  };
  $("radarCopy").onclick = async () => {
    const txt = RD.raw.map(r => `${r.t.toISOString()} ${r.dir} ${r.hex}${r.note ? "  ← " + r.note : ""}`).join("\n") || "(no packets yet)";
    try { await navigator.clipboard.writeText(txt); toast("Packets copied"); }
    catch { const r = document.createRange(); r.selectNodeContents($("radarRawPre")); getSelection().removeAllRanges(); getSelection().addRange(r); toast("Select-all done: long-press to copy"); }
  };
  $("radarClear").onclick = () => { RD.raw = []; $("radarRawN").textContent = 0; $("radarRawPre").textContent = ""; };
  if (hasBT && navigator.bluetooth.getDevices) {   // remembered permission → offer one-tap reconnect without the picker
    navigator.bluetooth.getDevices().then(list => {
      const d = list.find(x => /athlon/i.test(x.name || "")); if (d && !RD.dev) { adoptDevice(d); RD.status = "off"; radarPaint(); }
    }).catch(() => {});
  }
  radarPaint();
  window.__radarFlush = radarFlush;
}

export { VPR, vprHex, vprU16, vprBcd, vprFps, vprParse, vprReassemble, RD, K_RSEEN, hasBT, radarPaint, radarRawPush, radarFlush, radarFrame, radarBytes, onRadarNotify, onBattery, onRadarGone, radarAutoRetry, radarRetryLoop, radarGatt, adoptDevice };
