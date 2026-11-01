// beta/js/offline.js — Offline support: service-worker registration, update banner, offline pill.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { $ } from "./core.js";
import { ED, commitEditor, edDirty } from "./log.js";
import { refreshWeather } from "./weather.js";

/* ---------------- offline: service worker (beta only for now) · update banner · offline pill ---------------- */
// To promote to the main app later: put this same code in index.html and set SW_SCOPE = "./" — sw-beta.js serves index.html under that scope.
var SW_FILE = "sw-beta.js";
var SW_SCOPE = "./beta";
var SWS = { reg: null, on: false, kind: "", want: false, reloading: false, lastCheck: 0, version: "" };
function offPaint() {
  const off = navigator.onLine === false;
  $("offPill").hidden = !off; document.body.classList.toggle("isOffline", off);
}
function swInScope() { try { return location.pathname.startsWith(new URL(SW_SCOPE, location.href).pathname); } catch { return false; } }
function swAsk(w, msg, ms = 15000) {
  return new Promise(res => {
    if (!w) return res(null);
    const ch = new MessageChannel(), t = setTimeout(() => res(null), ms);
    ch.port1.onmessage = e => { clearTimeout(t); res(e.data); };
    try { w.postMessage(msg, [ch.port2]); } catch { clearTimeout(t); res(null); }
  });
}
function updShow(kind) {
  if (SWS.reloading) return;
  if (kind === "sw" || SWS.kind !== "sw") SWS.kind = kind;
  const b = $("updBar"); if (!b.hidden) return;
  $("updGo").disabled = false; $("updGo").textContent = "Reload"; b.hidden = false;
}
async function swCheck(force) {
  const reg = SWS.reg; if (!reg || navigator.onLine === false) return;
  const now = Date.now(); if (!force && now - SWS.lastCheck < 60e3) return; SWS.lastCheck = now;
  try { await reg.update(); } catch {}                                  // new sw-beta.js → "updatefound" → banner when installed
  if (reg.waiting && navigator.serviceWorker.controller) return updShow("sw");
  const r = await swAsk(navigator.serviceWorker.controller, { type: "CHECK" });   // page changed without a VERSION bump?
  if (r && r.ok && r.changed) updShow("content");
}
async function updGo() {
  if (SWS.reloading || $("updGo").disabled) return;
  $("updGo").disabled = true; $("updGo").textContent = "Updating…";
  try { if (ED && edDirty && ED.shots.length) await commitEditor(); } catch (e) { console.info("save before update:", e); }
  const reg = SWS.reg;
  if (reg && reg.installing) await new Promise(res => { const w = reg.installing, t = setTimeout(res, 10000); w.addEventListener("statechange", () => { if (w.state !== "installing") { clearTimeout(t); res(); } }); });
  if (reg && reg.waiting) {                                           // new worker: let it take over, then reload on controllerchange
    SWS.want = true; reg.waiting.postMessage({ type: "SKIP_WAITING" });
    setTimeout(() => { if (!SWS.reloading) { SWS.reloading = true; location.reload(); } }, 5000);
    return;
  }
  await swAsk(navigator.serviceWorker && navigator.serviceWorker.controller, { type: "REFRESH" });   // content-only update
  SWS.reloading = true; location.reload();
}

export function init() {
  window.addEventListener("offline", offPaint);
  window.addEventListener("online", () => {
    offPaint(); swCheck(true);
    if (/offline/i.test($("wxStatus").textContent)) refreshWeather();   // weather was skipped while offline → fetch it now
  });
  offPaint();
  $("updGo").onclick = updGo;
  $("updX").onclick = () => { $("updBar").hidden = true; };
  if ("serviceWorker" in navigator && window.isSecureContext && swInScope()) {
    SWS.on = true;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (SWS.want && !SWS.reloading) { SWS.reloading = true; location.reload(); } });
    navigator.serviceWorker.register(SW_FILE, { scope: SW_SCOPE, updateViaCache: "none" }).then(reg => {
      SWS.reg = reg;
      const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) updShow("sw"); });
      if (reg.waiting && navigator.serviceWorker.controller) updShow("sw");
      watch(reg.installing);
      reg.addEventListener("updatefound", () => watch(reg.installing));
      setTimeout(() => swCheck(true), 3000);
      setInterval(() => swCheck(true), 30 * 60e3);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") swCheck(false); });
      swAsk(navigator.serviceWorker.controller, { type: "VERSION" }, 3000).then(v => { if (v) SWS.version = v.version; });
    }).catch(e => console.info("Offline mode unavailable:", e && e.message));
  }
}

export { SW_FILE, SW_SCOPE, SWS, offPaint, swInScope, swAsk, updShow, swCheck, updGo };
