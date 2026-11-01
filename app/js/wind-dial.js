// app/js/wind-dial.js — Wind dial widget (WG/WU state, drag, clock positions).
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { toast } from "./components.js";
import { $, fmt, norm360, num } from "./core.js";
import { CLOCK } from "./dope.js";
import { K_SETTINGS, S, store } from "./storage.js";
import { cv } from "./themes.js";

var WG = null;
var WU = { from: null, t: 0, busy: false };

/* ---------------- wind dial ---------------- */
let dial;   // set in init (was const)
function dirWords(d) {
  if (d == null) return "";
  d = norm360(d);
  const clock = Math.round(d / 30) % 12 || 12;
  const cross = Math.abs(Math.sin(d * Math.PI / 180)), head = Math.cos(d * Math.PI / 180);
  const side = (d > 15 && d < 165) ? "from the right" : (d > 195 && d < 345) ? "from the left" : (d <= 15 || d >= 345) ? "headwind" : "tailwind";
  const value = cross > 0.9 ? "full value" : cross > 0.6 ? "¾ value" : cross > 0.35 ? "½ value" : "little crosswind";
  const sp = num("windSpeed") || 0;
  return `${clock} o'clock · ${side} · ${value} (${fmt(sp * cross, 1)} mph cross, ${fmt(Math.abs(sp * head), 1)} mph ${head >= 0 ? "head" : "tail"})`;
}
function drawDial() {
  const dpr = window.devicePixelRatio || 1, W = 150;
  dial.width = W * dpr; dial.height = W * dpr; const c = dial.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = W / 2, cy = W / 2, R = 66;
  c.clearRect(0, 0, W, W);
  c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fillStyle = cv("panel"); c.fill(); c.strokeStyle = cv("border"); c.lineWidth = 2; c.stroke();
  c.fillStyle = cv("muted"); c.font = "11px system-ui"; c.textAlign = "center"; c.textBaseline = "middle";
  for (let h = 1; h <= 12; h++) { const a = h * 30 * Math.PI / 180; c.fillText(h, cx + Math.sin(a) * (R - 11), cy - Math.cos(a) * (R - 11)); }
  c.fillStyle = cv("accent"); c.fillText("🎯", cx, cy - 30);   // target is straight ahead (12 o'clock)
  c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill();          // shooter
  const d = num("windDir");
  dial.setAttribute("aria-valuenow", d ?? "");
  $("dirText").textContent = dirWords(d);
  if (d == null) return;
  const a = d * Math.PI / 180, ox = cx + Math.sin(a) * (R - 22), oy = cy - Math.cos(a) * (R - 22);
  const tx = cx + Math.sin(a) * 12, ty = cy - Math.cos(a) * 12;
  c.strokeStyle = cv("warn"); c.fillStyle = cv("warn"); c.lineWidth = 3;
  c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx, ty); c.stroke();
  const ah = Math.atan2(ty - oy, tx - ox);
  c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - 9 * Math.cos(ah - 0.5), ty - 9 * Math.sin(ah - 0.5)); c.lineTo(tx - 9 * Math.cos(ah + 0.5), ty - 9 * Math.sin(ah + 0.5)); c.fill();
  c.beginPath(); c.arc(ox, oy, 7, 0, 7); c.fill();
}
/* Wind dial gestures: a vertical swipe over the dial scrolls the page (touch-action: pan-y; nothing is prevented until the dial engages).
   The dial engages when a drag starts on the handle or ring and follows the circle, or after a ~250 ms press-and-hold; a tap snaps to that hour. */
function dialPt(cx, cy) { const r = dial.getBoundingClientRect(), k = 150 / (r.width || 150); return { x: (cx - r.left - r.width / 2) * k, y: (cy - r.top - r.height / 2) * k }; }
function dialAng(p) { return norm360(Math.atan2(p.x, -p.y) * 180 / Math.PI); }
function dialZone(p) {
  const d = num("windDir"), rr = Math.hypot(p.x, p.y);
  if (d != null) { const a = d * Math.PI / 180; if (Math.hypot(p.x - Math.sin(a) * 44, p.y + Math.cos(a) * 44) <= 18) return "handle"; }
  return rr >= 40 && rr <= 80 ? "ring" : "face";
}
function dialDecide(zone, p, mx, my) {   // first real motion: "engage" (follows the circle from the handle/ring) | "scroll" | "wait"
  if (Math.hypot(mx, my) < 8) return "wait";
  if (zone === "face") return "scroll";
  const rr = Math.hypot(p.x, p.y) || 1, ux = p.x / rr, uy = p.y / rr, along = Math.abs(mx * ux + my * uy), tang = Math.abs(mx * uy - my * ux);
  if (tang < 1.5 * along) return "scroll";
  if (zone === "ring" && Math.abs(my) > 2 * Math.abs(mx)) return "scroll";   // straight down the side of the ring = a page scroll (grab the handle, or hold, to drag there)
  return "engage";
}
function windDirSet(d) { const el = $("windDir"); if (String(d) !== el.value) { el.value = d; el.dispatchEvent(new Event("input", { bubbles: true })); } }
function dialSetAt(p, snap) { if (Math.hypot(p.x, p.y) < 6) return; const a = dialAng(p); windDirSet(snap ? Math.round(a / 30) * 30 % 360 : Math.round(a / 5) * 5 % 360); }
function dialEngage() { if (!WG || WG.state === "on") return; WG.state = "on"; clearTimeout(WG.hold); dial.classList.add("on"); if (navigator.vibrate) try { navigator.vibrate(10); } catch {} }
function dialStart(cx, cy) {
  dialCancel(); if (S.windLock) return false;
  const p = dialPt(cx, cy); windUndoArm();
  WG = { x0: cx, y0: cy, p0: p, zone: dialZone(p), state: "wait", moved: false };
  WG.hold = setTimeout(() => { if (WG && WG.state === "wait") dialEngage(); }, 250);
  return true;
}
function dialMove(cx, cy) {   // → true when the move belongs to the dial (caller prevents the scroll)
  if (!WG || WG.state === "scroll") return false;
  const mx = cx - WG.x0, my = cy - WG.y0;
  if (WG.state === "wait") {
    const r = dialDecide(WG.zone, WG.p0, mx, my);
    if (r === "wait") return WG.zone === "handle" || (WG.zone === "ring" && (mx || my) && Math.abs(mx) >= Math.abs(my));   // hold off the scroll while it could still become a dial drag
    if (r === "scroll") { WG.state = "scroll"; clearTimeout(WG.hold); return false; }
    dialEngage();
  }
  if (Math.hypot(mx, my) >= 6) WG.moved = true;
  if (WG.moved) dialSetAt(dialPt(cx, cy));
  return true;
}
function dialEnd(cx, cy) {
  if (!WG) return false; const g = WG; WG = null; clearTimeout(g.hold); dial.classList.remove("on");
  if (g.state === "scroll") return false;
  if ((g.state === "wait" && Math.hypot(cx - g.x0, cy - g.y0) < 8) || (g.state === "on" && !g.moved)) dialSetAt(g.p0, true);   // a tap (or a hold without moving) snaps to that hour
  windUndoSoon(); return true;
}
function dialCancel() { if (WG) { clearTimeout(WG.hold); WG = null; dial.classList.remove("on"); } }
/* 🔒 wind lock: the dial ignores input (− / + still work) */
function windLockPaint() {
  const on = !!S.windLock, b = $("windLock"); b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "🔒 Dial locked" : "🔓 Lock dial";
  b.title = on ? "The wind dial ignores touches — tap to unlock" : "Lock the wind dial so a stray touch can't move it";
  dial.classList.toggle("locked", on); dial.setAttribute("aria-disabled", String(on));
}
/* every wind-direction change by hand: a brief "Wind now N o'clock · Undo" */
function windUndoArm() { if (WU.from == null) WU.from = $("windDir").value; }
function windUndoSoon() { clearTimeout(WU.t); WU.t = setTimeout(windUndoToast, 450); }
function windUndoToast() {
  if (WG) { windUndoSoon(); return; }
  const from = WU.from, now = $("windDir").value; WU.from = null;
  if (from == null || from === now || now === "") return;
  const d = num("windDir");
  toast(`Wind now ${CLOCK(d)} o'clock`, { label: "Undo", ms: 4000, fn: () => {
    WU.busy = true; try { $("windDir").value = from; $("windDir").dispatchEvent(new Event("input", { bubbles: true })); } finally { WU.busy = false; }
    WU.from = null; toast(`Wind back to ${from === "" ? "—" : CLOCK(+from) + " o'clock"}`);
  } });
}

export function init() {
  dial = $("dial");
  dial.addEventListener("touchstart", e => { if (e.touches.length !== 1) { dialCancel(); return; } const t = e.touches[0]; dialStart(t.clientX, t.clientY); }, { passive: true });
  dial.addEventListener("touchmove", e => { if (!WG) return; if (e.touches.length !== 1) { dialCancel(); return; } const t = e.touches[0]; if (dialMove(t.clientX, t.clientY) && e.cancelable) e.preventDefault(); }, { passive: false });
  dial.addEventListener("touchend", e => { if (!WG) return; const on = WG.state !== "scroll", t = e.changedTouches[0]; dialEnd(t.clientX, t.clientY); if (on && e.cancelable) e.preventDefault(); });
  dial.addEventListener("touchcancel", () => dialCancel());
  dial.addEventListener("pointerdown", e => { if (e.pointerType === "touch") return; e.preventDefault(); if (dialStart(e.clientX, e.clientY)) try { dial.setPointerCapture(e.pointerId); } catch {} });
  dial.addEventListener("pointermove", e => { if (e.pointerType !== "touch" && WG) dialMove(e.clientX, e.clientY); });
  dial.addEventListener("pointerup", e => { if (e.pointerType !== "touch") dialEnd(e.clientX, e.clientY); });
  dial.addEventListener("pointercancel", e => { if (e.pointerType !== "touch") dialCancel(); });
  $("windLock").onclick = () => { S.windLock = !S.windLock; if (!S.windLock) delete S.windLock; store(K_SETTINGS, S); windLockPaint(); toast(S.windLock ? "🔒 Wind dial locked (− / + still work)" : "🔓 Wind dial unlocked"); };
  windLockPaint();
  $("windDir").addEventListener("input", () => { if (!WU.busy && WU.from != null) windUndoSoon(); });
  $("windDir").addEventListener("focus", () => windUndoArm());
  $("windDir").addEventListener("keydown", () => windUndoArm(), true);
  $("windDir").closest(".stepper").addEventListener("pointerdown", () => windUndoArm(), true);
}

export { WG, WU, dial, dirWords, drawDial, dialPt, dialAng, dialZone, dialDecide, windDirSet, dialSetAt, dialEngage, dialStart, dialMove, dialEnd, dialCancel, windLockPaint, windUndoArm, windUndoSoon, windUndoToast };
