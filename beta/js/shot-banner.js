// beta/js/shot-banner.js — Live shot banner and screen wake-lock.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { $ } from "./core.js";
import { ED, LOG, cleanSession, closeEditor, commitEditor, edDirty, maybeRenderLog, openEditor, renderEditor, saveLog, set_edDirty, set_slKey, shotStats, slKey } from "./log.js";
import { RD } from "./radar.js";
import { SH, shPaint } from "./shooting.js";
import { openTgEd, teRender } from "./target-editor.js";
import { BAN, TE, WL, WLbusy, fpsT, readings, set_WL, set_WLbusy, strNo, strOf, tgView, tgtLetter, unpair } from "./targets.js";


/* ---- live shot banner ---- */
function banSess() { return ED && ED.id === BAN.sid ? ED : LOG.find(s => s.id === BAN.sid); }
function banDocked() { return !!(ED && ED.id === BAN.sid && $("slEditor").classList.contains("show") && !$("tgEd").classList.contains("show")); }
function banShow(sid, shid) { if (SH.on) { shPaint(); return; } BAN.sid = sid; BAN.shid = shid; if ($("tgEd").classList.contains("show")) { if (TE && ED && ED.id === sid) teRender(); return; } banPaint(); banArm(); }
function banHide() { const el = $("shotBan"); clearTimeout(BAN.t); el.hidden = true; el.classList.remove("fade"); if (el.parentElement !== document.body) document.body.appendChild(el); el.classList.remove("dock"); BAN.sid = null; }
function banPaint() {
  const el = $("shotBan"); if (!BAN.sid) return;
  const s = banSess(), x = s && s.shots.find(q => q.id === BAN.shid); if (!x) { banHide(); return; }
  const t = tgView(s), sid = strOf(s, x), rd = readings(s, sid), st = shotStats(rd), k = rd.indexOf(x) + 1;
  $("sbV").textContent = fpsT(x.v);
  $("sbN").textContent = `Shot ${k} · String ${strNo(t, sid)} · Target ${tgtLetter(t, t.strings.find(q => q.id === sid).tid)}`;
  $("sbSt").textContent = st.n ? `avg ${fpsT(st.avg)} · ES ${st.n > 1 ? fpsT(st.es) : "—"} · SD ${st.n > 1 ? st.sd.toFixed(1) : "—"}${st.n < rd.length ? ` · ${rd.length - st.n} removed` : ""}` : "no kept shots";
  el.querySelectorAll("#sbActs button[data-a]").forEach(b => { const a = b.dataset.a; if (a === "mark") { b.hidden = !t.mark; return; }
    const on = !!x[a]; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); if (a === "x") b.innerHTML = on ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 7v6h6'/><path d='M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'/></svg> Restore" : "Remove"; });
  el.classList.toggle("dis", !!x.x);
  const dock = banDocked();
  if (dock && el.parentElement !== $("sbDock")) $("sbDock").appendChild(el);
  if (!dock && el.parentElement !== document.body) document.body.appendChild(el);
  el.classList.toggle("dock", dock); el.hidden = false;
}
function banArm() {
  const el = $("shotBan"); el.classList.remove("fade"); clearTimeout(BAN.t); if (el.classList.contains("dock")) return;
  BAN.t = setTimeout(() => { el.classList.add("fade"); BAN.t = setTimeout(() => { if (!el.classList.contains("dock")) { el.hidden = true; el.classList.remove("fade"); } }, 450); }, 5000);
}
async function mutSess(id, fn) {
  if (ED && ED.id === id) { fn(ED); set_edDirty(true); renderEditor(); if (ED.source === "bluetooth" && !ED._new) await commitEditor(); return; }
  const i = LOG.findIndex(s => s.id === id); if (i < 0) return;
  fn(LOG[i]); LOG[i] = cleanSession(LOG[i]); await saveLog(); set_slKey(null); maybeRenderLog();
}
async function banOpen() {
  if (ED && ED.id === BAN.sid) { if ($("tgEd").classList.contains("show")) return; banPaint(); return; }
  const s = LOG.find(q => q.id === BAN.sid); if (!s) return;
  if (ED) { if (edDirty && ED.shots.length) await commitEditor(); closeEditor(true); }
  const keep = { ...BAN }; openEditor(s); BAN.sid = keep.sid; BAN.shid = keep.shid; banPaint();
}

/* ---- wake lock while a radar session is live or the shooting view is open ---- */
async function wakeSync() {
  const want = ((typeof RD !== "undefined" && RD.status === "connected") || SH.on) && document.visibilityState === "visible";
  if (WLbusy || !navigator.wakeLock) return; set_WLbusy(true);
  try {
    if (want && !WL) { set_WL(await navigator.wakeLock.request("screen")); WL.addEventListener("release", () => { set_WL(null); }); }
    else if (!want && WL) { const w = WL; set_WL(null); await w.release(); }
  } catch { set_WL(null); } finally { set_WLbusy(false); }
}

export function init() {
  $("sbMain").onclick = () => banOpen();
  $("sbActs").addEventListener("click", async e => {
    const b = e.target.closest("button[data-a]"); if (!b) return; e.stopPropagation(); const a = b.dataset.a, sid = BAN.sid, shid = BAN.shid;
    if (a === "mark") { await banOpen(); if (!ED) return; const x = ED.shots.find(q => q.id === shid); if (x) openTgEd(strOf(ED, x), { pairNext: shid }); return; }
    await mutSess(sid, s => { const x = s.shots.find(q => q.id === shid); if (!x) return; x[a] = !x[a]; if (!x[a]) delete x[a]; else if (a === "x") unpair(s, x.id); });
    BAN.sid = sid; BAN.shid = shid; banPaint(); banArm();
  });
  document.addEventListener("visibilitychange", () => wakeSync());
}

export { banSess, banDocked, banShow, banHide, banPaint, banArm, mutSess, banOpen, wakeSync };
