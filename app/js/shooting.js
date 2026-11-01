// app/js/shooting.js — Shooting view (SH state): start/continue shooting, live string capture.
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { setTab } from "./app.js";
import { B, angDec, angs, lastRun, solveShot, turretSpec } from "./calc.js";
import { shBtnPaint, toast } from "./components.js";
import { $, escapeHtml, fmt, num } from "./core.js";
import { CLOCK, lr, ud } from "./dope.js";
import { curLoad, curRifle } from "./gear.js";
import { ED, LOG, addVelocities, closeEditor, commitEditor, curKeyIds, edDirty, openEditor, renderEditor, set_edDirty, shotStats } from "./log.js";
import { RD, hasBT } from "./radar.js";
import { banHide, wakeSync } from "./shot-banner.js";
import { P, S } from "./storage.js";
import { dialView, tgAutoDial, tgNewString, tgSame } from "./strings.js";
import { closeTgEd, openTgEd } from "./target-editor.js";
import { LIVE, angU, fpsT, readings, strNo, tgDefDist, tgEnsure, tgYd, tgtLetter, tsFor, unpair } from "./targets.js";

var SH = { on: false, sid: null, back: null, ended: null, pend: null, closing: false, calcKey: "", tok: 0, es: null, dope: null, lastId: null };
/* ================= Shooting view (Start shooting on Dope) =================
   Full-screen chronograph view on top of the session editor: ED is the session, so strings, targets, Mark holes and the radar
   all keep working as before. Shots autosave. Radar shots land here live (no banner, no second session). */
function shLoadOf(s) { const r = P.rifles.find(x => x.id === s.rifleId); return r?.loads.find(x => x.id === s.loadId) || null; }
function shWeight() { const l = ED && shLoadOf(ED), w = parseFloat(l?.weight); return isFinite(w) && w > 0 ? w : num("weight"); }
function shEnergy(v, w) { return w > 0 && v > 0 ? w * v * v / 450240 : null; }   // ft-lb from grains + fps
function shPick() {   // the session to continue: the live radar one, else this gun + load's latest from the last 12 h
  const k = curKeyIds(); if (!k.loadId) return null;
  const mine = LOG.filter(s => s.rifleId === k.rifleId && s.loadId === k.loadId);
  const L = LIVE && mine.find(s => s.id === LIVE.id); if (L) return L;
  const last = mine.slice().sort((a, b) => a.date.localeCompare(b.date)).pop();
  return last && Date.now() - new Date(last.date).getTime() < 12 * 36e5 ? last : null;
}
function shNeedGear(kind) {   // no gun / load yet: show the pickers, then offer to carry on once one is picked
  SH.pend = kind; setTab("gear");
  const r = curRifle(), el = !r ? $("rifleSel") : $("loadSel"), pk = el.closest(".picker") || el;
  pk.scrollIntoView({ block: "center" }); pk.classList.add("pkFlash"); setTimeout(() => pk.classList.remove("pkFlash"), 2600);
  try { el.focus({ preventScroll: true }); } catch {}
  toast(!r ? "Pick a gun and its load first (⋯ adds a new one)" : "Pick a load for this gun first (⋯ adds a new one)");
}
function shPendCheck() {
  if (!SH.pend || SH.on || !curRifle() || !curLoad()) return;
  const k = SH.pend; SH.pend = null;
  toast(`Ready: ${curRifle().name} · ${curLoad().name}`, { label: k === "shoot" ? "▶ Start shooting" : "＋ Session", fn: () => k === "shoot" ? shStart() : openEditor(null) });
}
async function shStart() {
  if (SH.on) return;
  if (!curRifle() || !curLoad()) { shNeedGear("shoot"); return; }
  SH.back = { tab: S.tab || document.body.dataset.tab || "dope", y: window.scrollY };
  if (ED) { if (edDirty && ED.shots.length) await commitEditor(); closeEditor(true); }
  const s = shPick();
  SH.on = true; SH.ended = null; SH.calcKey = ""; SH.es = null; SH.dope = null; SH.lastId = null;
  openEditor(s || null); if (!ED) { SH.on = false; return; }
  SH.sid = ED.id; SH.cont = !!s;
  const t = tgEnsure(ED), st = t.strings.find(q => q.id === t.cur);
  shPanels(); 
  $("shView").hidden = false; $("shView").classList.add("show"); document.body.classList.add("shOn"); banHide();
  shPaint(); wakeSync();
  if (!readings(ED, st.id).length) tgAutoDial(ED, st).then(() => { if (SH.on) { SH.calcKey = ""; shPaint(); } });
  setTimeout(() => { if (SH.on) $("shExit").focus({ preventScroll: true }); }, 30);
}
function shHide() {
  SH.on = false; SH.sid = null; SH.ended = null;
  $("shView").classList.remove("show"); $("shView").hidden = true; document.body.classList.remove("shOn"); wakeSync(); shBtnPaint();
}
async function shExit() {
  if (!SH.on) return;
  if ($("tgEd").classList.contains("show")) await closeTgEd();
  let n = 0;
  if (ED && ED.id === SH.sid) { if (ED.shots.length && (edDirty || ED._new)) await commitEditor(); n = ED.shots.length; SH.closing = true; closeEditor(true); SH.closing = false; }
  const b = SH.back; shHide();
  if (b) { setTab(b.tab); window.scrollTo(0, b.y); requestAnimationFrame(() => window.scrollTo(0, b.y)); }
  if (n) toast(`Session saved · ${n} shot${n === 1 ? "" : "s"} (Log tab)`);
}
async function shSave() { if (ED && ED.shots.length) { await commitEditor(); $("slDel").style.display = ""; } }
function shCurStr() { const t = tgEnsure(ED); return { t, cur: t.strings.find(q => q.id === t.cur) }; }
function shRollIfEnded() {   // the string was ended: the next shot starts a new one
  if (!ED || !SH.ended) return; const t = tgEnsure(ED);
  if (SH.ended === t.cur && readings(ED, t.cur).length) tgNewString(false);
  SH.ended = null;
}
async function shAddText(text) {
  if (!ED) return 0;
  const vals = String(text).split(/[\s,;]+/).map(parseFloat).filter(v => isFinite(v) && v >= 50 && v <= 6000);
  if (!vals.length) { toast("Enter a velocity in fps (50–6000)"); return 0; }
  shRollIfEnded(); addVelocities(vals.join(" ")); SH.lastId = ED.shots[ED.shots.length - 1].id;
  renderEditor(); await shSave(); shPaint(); return vals.length;
}
function shStatsOf(rd, w) {   // string stats + last shot (shot #, ± from the string average, energy)
  const st = shotStats(rd), last = rd[rd.length - 1] || null;
  const dv = last && !last.x && st.n > 1 ? Math.round(last.v - st.avg) : null;
  return { ...st, total: rd.length, disc: rd.length - st.n, last, k: rd.length, dv, ftlb: last ? shEnergy(last.v, w) : null };
}
// ± colour (flier rule). d = v − the full kept average (the ± shown). Under 10 fps off: always neutral.
// Fixed flags at any count: 25+ fps amber, 50+ fps red. With 5+ kept shots, also leave-one-out: z = |v − mean of the OTHER kept shots| / their
// sample SD; z > 2 amber, z > 3 red (if the others' SD is 0, any shot 10+ fps off them is amber). The more severe result wins.
// kept = velocities of the string's kept shots (including this one); discarded shots never reach here.
function shDevCls(v, kept) {
  const n = kept ? kept.length : 0; if (!(n > 1) || !isFinite(v)) return "";
  const avg = kept.reduce((a, b) => a + b, 0) / n, a = Math.abs(v - avg);
  if (a < 10) return "";
  let lv = a >= 50 ? 2 : a >= 25 ? 1 : 0;
  if (n >= 5 && lv < 2) {
    const o = kept.slice(), k = o.indexOf(v); if (k >= 0) o.splice(k, 1);
    const m = o.reduce((x, y) => x + y, 0) / o.length, sd = Math.sqrt(o.reduce((s, x) => s + (x - m) ** 2, 0) / (o.length - 1)), ao = Math.abs(v - m);
    const lo = sd > 0 ? (ao / sd > 3 ? 2 : ao / sd > 2 ? 1 : 0) : ao >= 10 ? 1 : 0;
    lv = Math.max(lv, lo);
  }
  return lv === 2 ? "dvB" : lv === 1 ? "dvW" : "";
}
function shDevWord(c) { return c === "dvB" ? "far off the average" : c === "dvW" ? "off the average" : ""; }
function shSigned(n) { return n == null ? "" : (n >= 0 ? "+" : "−") + Math.abs(n); }
function shTags(s) { return [s.cold && "Cold", s.clean && "Clean", s.fl && "Flier", s.note && "✎ " + s.note].filter(Boolean).join(" · "); }
function shPaint() {
  if (!SH.on || !ED) return;
  const { t, cur } = shCurStr(), sn = strNo(t, cur.id), rd = readings(ED, cur.id), w = shWeight(), q = shStatsOf(rd, w), g = t.targets.find(x => x.id === cur.tid);
  const yd = Math.round(tgYd(g) || tgDefDist());
  $("shStr").textContent = `String ${sn} · Target ${tgtLetter(t, cur.tid)}`;
  const r = P.rifles.find(x => x.id === ED.rifleId), l = r?.loads.find(x => x.id === ED.loadId);
  $("shFor").textContent = [r?.name, l?.name, `${yd} yd`].filter(Boolean).join(" · ");
  const x = q.last;
  $("shV").textContent = x ? fpsT(x.v) : "—";
  const keptV = rd.filter(s => !s.x).map(s => s.v), mc = x && !x.x ? shDevCls(x.v, keptV) : "";
  $("shMeta").innerHTML = x ? `#${q.k}${x.x ? " · discarded" : q.dv != null ? ` · <span id="shDev"${mc ? ` class="${mc}"` : ""}>${shSigned(q.dv)}</span>` : ""}` : SH.ended ? "" : "Waiting for the first shot";
  $("shMeta").classList.toggle("wait", !x);
  $("shHero").classList.toggle("dis", !!(x && x.x));
  $("shHero").setAttribute("aria-label", x ? `Last shot ${fpsT(x.v)} fps, shot ${q.k}${x.x ? ", discarded" : q.dv != null ? `, ${shSigned(q.dv)} from the string average${mc ? `, ${shDevWord(mc)}` : ""}` : ""}` : "No shots yet");
  const en = SH.ended === cur.id; $("shEndNote").hidden = !en;
  if (en) $("shEndNote").textContent = `String ${sn} ended · the next shot starts String ${t.strings.length + 1}`;
  const f1 = v => (+v).toFixed(1);
  $("shStats").innerHTML = [["Avg", q.n ? fpsT(q.avg) : "—"], ["SD", q.n > 1 ? f1(q.sd) : "—"], ["ES", q.n > 1 ? fpsT(q.es) : "—"], ["Shots", q.n + (q.disc ? ` <small>+${q.disc}⊘</small>` : "")],
    ["Min", q.n ? fpsT(q.min) : "—"], ["Max", q.n ? fpsT(q.max) : "—"], ["Energy · last", q.ftlb != null ? `${Math.round(q.ftlb).toLocaleString()} ft-lb` : "—", "w2"]]
    .map(([k, v, c]) => `<div${c ? ` class="${c}"` : ""}><b>${v}</b><span>${k}</span></div>`).join("");
  $("shList").innerHTML = rd.length ? rd.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => `<div class="shRow${s.x ? " dis" : ""}${s.id === SH.lastId && i === rd.length - 1 ? " new" : ""}" data-id="${escapeHtml(s.id)}">
      <span class="n">#${i + 1}</span><span class="v">${fpsT(s.v)}</span>${(() => { const c = s.x ? "" : shDevCls(s.v, keptV); return `<span class="dv${c ? " " + c : ""}"${c ? ` title="${shDevWord(c)}"` : ""}>${s.x ? "discarded" : q.n > 1 ? shSigned(Math.round(s.v - q.avg)) : ""}</span>`; })()}<span class="shTg">${escapeHtml(shTags(s))}</span>
      <button type="button" data-a="x" aria-pressed="${!!s.x}" aria-label="${s.x ? "Restore" : "Discard"} shot ${i + 1}" title="${s.x ? "Restore" : "Discard (bad read)"}">${s.x ? "↺" : "⊘"}</button></div>`).join("")
    : `<div class="shEmpty">No shots in String ${sn} yet. Fire with the radar connected, or tap ＋ Add shot to type a velocity.</div>`;
  shTagPaint(); shStatus(); $("shEndStr").classList.toggle("on", en); $("shStrBtn").classList.toggle("on", en);
  $("shStrBtn").innerHTML = en ? `String ▾<small>ended</small>` : "String ▾"; $("shStrFor").textContent = `String ${sn} · Target ${tgtLetter(t, cur.tid)}`;
  $("shBad").disabled = !rd.some(s => !s.x);
  shCalc(q, yd, cur);
}
function shTagPaint() {
  if (!ED) return; const { cur } = shCurStr(), rd = readings(ED, cur.id), x = rd[rd.length - 1];
  $("shTagFor").textContent = x ? `Tag shot #${rd.length} (${fpsT(x.v)} fps)` : "No shot to tag yet";
  $("shTagBar").querySelectorAll("button[data-f]").forEach(b => { const on = !!(x && x[b.dataset.f]); b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.disabled = !x; });
  if (document.activeElement !== $("shNote")) $("shNote").value = x?.note || ""; $("shNote").disabled = !x;
}
function shStatus() {
  if (!SH.on) return; const st = $("shRadar"), c = $("shConn");
  if (!hasBT) { st.textContent = "📡 No radar here · type shots"; st.className = ""; c.hidden = true; return; }
  const bt = RD.battery != null ? ` · 🔋 ${RD.battery}%` : "";
  st.textContent = { connected: `📡 Connected${bt}`, connecting: "📡 Connecting…", lost: `📡 Lost${RD.retries ? " · retrying" : ""}${bt}` }[RD.status] || "📡 Disconnected";
  st.className = RD.status === "connected" ? "ok" : RD.status === "lost" ? "bad" : "";
  c.hidden = RD.status === "connected" || RD.status === "connecting";
  c.textContent = RD.dev && (RD.status === "lost" || RD.status === "off") ? "↻ Reconnect" : "📡 Connect";
}
// vertical spread at the target from the slowest vs fastest kept shot, same zero + conditions + angle as the Dope tab
async function shEsAt(min, max, yd) {
  if (typeof B === "undefined" || !B || !(yd >= 5 && yd <= 3000) || !(max > min)) return null;
  try {
    const sv = await solveShot({ winds: [] }), look = num("shotAngle") || 0, cosA = Math.cos(look * Math.PI / 180);
    const fire = async v => {
      const s2 = new B.Shot({ weapon: sv.shot.weapon, ammo: new B.Ammo({ dm: sv.shot.ammo.dm, mv: B.UNew.FPS(v) }), atmo: sv.shot.atmo, winds: [] });
      if (look) s2.lookAngle = B.UNew.Degree(look);
      const r = await sv.calc.fire({ shot: s2, trajectoryRange: B.UNew.Yard(yd * cosA), trajectoryStep: B.UNew.Yard(yd * cosA), raiseRangeError: false });
      const p = r.samples[r.samples.length - 1]; return p && Math.abs(p.distance.In(B.Distance.Yard) - yd * cosA) <= 1 ? p : null;
    };
    const a = await fire(min), b = await fire(max); if (!a || !b) return null;
    const A = S.ang === "MIL" ? B.Angular.MRad : B.Angular.MOA, spread = Math.abs(a.dropAngle.In(A) - b.dropAngle.In(A));
    return { spread, half: spread / 2, inch: Math.abs(a.height.In(B.Distance.Inch) - b.height.In(B.Distance.Inch)), yd, u: S.ang };
  } catch { return null; }
}
async function shDopeAt(yd, st) {   // dope strip: the string's dial (else the app's dope there) + the wind hold for the Dope-tab wind
  const ts = ED ? tsFor(ED.rifleId) : turretSpec(), o = { yd };
  if (st && st.dial) { const dv = dialView(st.dial, ts); o.elev = `${dv.txt}`; o.clk = dv.c != null ? `${Math.abs(dv.c)} clicks` : ""; o.src = st.dial.src === "app" ? "dialed" : "dialed (edited)"; }
  if (typeof B === "undefined" || !B || !tgSame() || !(yd >= 5 && yd <= 3000)) return o;
  try {
    const sv = await solveShot(), look = num("shotAngle") || 0, cosA = Math.cos(look * Math.PI / 180);
    if (look) sv.shot.lookAngle = B.UNew.Degree(look);
    const r = await sv.calc.fire({ shot: sv.shot, trajectoryRange: B.UNew.Yard(yd * cosA), trajectoryStep: B.UNew.Yard(yd * cosA), raiseRangeError: false });
    const p = r.samples[r.samples.length - 1]; if (!p) return o;
    const a = angs(p), dd = angDec(turretSpec()), u = angU(S.ang);
    if (!o.elev) { o.elev = `${ud(a.e, dd)} ${u}`; o.clk = `${Math.abs(a.ec)} clicks`; o.src = "app dope"; }
    const ws = num("windSpeed") || 0;
    o.wind = `${lr(a.w, dd)} ${u}`; o.wtxt = ws ? `${fmt(ws, 1)} mph @ ${CLOCK(num("windDir") || 0)} o'clock` : "no wind";
  } catch {}
  return o;
}
function shCalc(q, yd, st) {
  const key = [q.n > 1 ? q.min : "", q.n > 1 ? q.max : "", yd, S.ang, st.dial ? JSON.stringify(st.dial) : "", num("windSpeed"), num("windDir"), num("shotAngle"), lastRun?.tgt ? 1 : 0].join("|");
  if (key === SH.calcKey) { shCalcPaint(q); return; }
  SH.calcKey = key; const tok = ++SH.tok; shCalcPaint(q);
  (async () => {
    const es = q.n > 1 ? await shEsAt(q.min, q.max, yd) : null, dp = await shDopeAt(yd, st);
    if (tok !== SH.tok || !SH.on) return; SH.es = es; SH.dope = dp; shCalcPaint(q);
  })();
}
function shCalcPaint(q) {
  const u = angU(S.ang), es = SH.es, d = SH.dope, { t, cur } = ED ? shCurStr() : {}, g = t && t.targets.find(x => x.id === cur.tid), yd = Math.round(t ? tgYd(g) || tgDefDist() : 0);
  $("shEs").innerHTML = q.n < 2 ? `ES at ${yd} yd: needs 2+ kept shots` : es && es.yd === yd && es.u === S.ang ? `ES ±${fmt(es.half, 2)} ${u} at ${yd} yd <small>· ${fmt(es.spread, 2)} ${u} (${fmt(es.inch, 1)}″) top to bottom</small>` : `ES at ${yd} yd: …`;
  $("shDope").innerHTML = d && d.yd === yd ? `<span>🎯 ${yd} yd · ${escapeHtml(d.src || "dial")} <b>${escapeHtml(d.elev || "—")}</b>${d.clk ? ` (${escapeHtml(d.clk)})` : ""}</span><span>Wind hold <b>${escapeHtml(d.wind || "—")}</b>${d.wtxt ? ` · ${escapeHtml(d.wtxt)}` : ""}</span>` : `<span>🎯 ${yd} yd · dial …</span>`;
}
async function shBad() {
  if (!ED) return; const { cur } = shCurStr(), rd = readings(ED, cur.id), k = rd.map(s => !s.x).lastIndexOf(true);
  if (k < 0) { toast("No kept shot to discard"); return; }
  const x = rd[k]; x.x = true; if (x.id) unpair(ED, x.id); set_edDirty(true); renderEditor(); await shSave(); shPaint();
  toast(`Shot #${k + 1} (${fpsT(x.v)} fps) discarded · out of the stats`, { label: "Undo", ms: 5000, fn: async () => { if (!ED) return; delete x.x; set_edDirty(true); renderEditor(); await shSave(); shPaint(); } });
}
async function shToggle(id, f) {
  if (!ED) return; const x = ED.shots.find(s => s.id === id); if (!x) return;
  x[f] = !x[f]; if (!x[f]) delete x[f]; else if (f === "x" && x.id) unpair(ED, x.id);
  set_edDirty(true); renderEditor(); await shSave(); shPaint();
}
async function shNew(target) { if (!ED) return; SH.ended = null; tgNewString(target); SH.lastId = null; await shSave(); SH.calcKey = ""; shPaint(); }
async function shEnd() {
  if (!ED) return; const { t, cur } = shCurStr(), rd = readings(ED, cur.id), n = strNo(t, cur.id), st = shotStats(rd);
  if (!rd.length) { toast(`String ${n} has no shots yet`); return; }
  SH.ended = cur.id; await shSave(); shPaint();
  toast(`String ${n} ended · ${st.n} shot${st.n === 1 ? "" : "s"}${st.n > 1 ? `, SD ${st.sd.toFixed(1)}, ES ${fpsT(st.es)}` : ""}`, { label: "🎯 Mark holes", fn: () => shMark() });
}
function shMark() { if (!ED) return; const { t } = shCurStr(); openTgEd(SH.ended && t.strings.some(q => q.id === SH.ended) ? SH.ended : t.cur); }
// one panel at a time over the buttons: the fps entry, the tag bar or the String ▾ menu (all closed by default)
function shPanels(open) {
  [["shAddBox", "shAdd"], ["shTagBar", "shTag"], ["shStrMenu", "shStrBtn"]].forEach(([p, b]) => { const on = p === open; $(p).hidden = !on; $(b).setAttribute("aria-expanded", String(on)); });
}
function shPanelOpen() { return ["shAddBox", "shTagBar", "shStrMenu"].find(p => !$(p).hidden) || null; }
function shAddClose() { $("shVel").value = ""; $("shVel").blur(); shPanels(); $("shAdd").focus({ preventScroll: true }); }

export function init() {
  $("shStartBtn").onclick = () => shStart();
  $("slStartBtn").onclick = () => shStart();
  $("shExit").onclick = () => shExit();
  $("shConn").onclick = () => { const rc = $("radarReconnect"); if (!rc.hidden) rc.click(); else $("radarConnect").click(); };
  $("shBad").onclick = () => shBad();
  $("shNewStr").onclick = () => { shPanels(); shNew(false); };
  $("shNewTgt").onclick = () => { shPanels(); shNew(true); };
  $("shEndStr").onclick = () => { shPanels(); shEnd(); };
  $("shStrBtn").onclick = () => { const open = $("shStrMenu").hidden; shPanels(open ? "shStrMenu" : null); if (open) { shPaint(); $("shNewStr").focus({ preventScroll: true }); } };
  document.addEventListener("pointerdown", e => { if (SH.on && !$("shStrMenu").hidden && !e.target.closest("#shStrMenu, #shStrBtn")) shPanels(); }, true);
  $("shMark").onclick = () => shMark();
  $("shAdd").onclick = () => { const open = $("shAddBox").hidden; shPanels(open ? "shAddBox" : null); if (open) { $("shVel").value = ""; $("shVel").focus(); } else $("shVel").blur(); };
  $("shAddDone").onclick = () => shAddClose();
  // Add closes the panel (so the shot list stays in view); a bad value keeps it open to fix
  $("shAddGo").onclick = async () => { const v = $("shVel").value; if (!v.trim()) { $("shVel").focus(); return; } if (await shAddText(v)) shAddClose(); else $("shVel").focus(); };
  // Enter adds and keeps the panel open for the next velocity (keyboard / chrono-by-ear entry); Done or Escape closes it
  $("shVel").addEventListener("keydown", async e => { if (e.key !== "Enter") return; e.preventDefault(); const v = $("shVel").value; if (!v.trim()) return; if (await shAddText(v)) $("shVel").value = ""; $("shVel").focus(); });
  $("shTag").onclick = () => { const open = $("shTagBar").hidden; shPanels(open ? "shTagBar" : null); shTagPaint(); };
  $("shTagBar").addEventListener("click", e => { const b = e.target.closest("button[data-f]"); if (!b || !ED) return; const { cur } = shCurStr(), rd = readings(ED, cur.id), x = rd[rd.length - 1]; if (x) shToggle(x.id, b.dataset.f); });
  $("shNote").addEventListener("change", async () => { if (!ED) return; const { cur } = shCurStr(), rd = readings(ED, cur.id), x = rd[rd.length - 1]; if (!x) return; const v = $("shNote").value.trim(); if (v) x.note = v; else delete x.note; set_edDirty(true); renderEditor(); await shSave(); shPaint(); });
  $("shList").addEventListener("click", e => { const b = e.target.closest("button[data-a]"), row = e.target.closest(".shRow"); if (b && row) shToggle(row.dataset.id, b.dataset.a); });
  window.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !SH.on) return;
    if ($("tgEd").classList.contains("show") || document.querySelector(".ovl.show:not(#slEditor)") || $("pkMenu").style.display === "flex") return;
    e.stopImmediatePropagation(); e.preventDefault();
    const op = shPanelOpen(); if (op) { if (op === "shAddBox") shAddClose(); else { shPanels(); $(op === "shTagBar" ? "shTag" : "shStrBtn").focus({ preventScroll: true }); } return; }
    shExit();
  }, true);
  shBtnPaint();
}

export { SH, shLoadOf, shWeight, shEnergy, shPick, shNeedGear, shPendCheck, shStart, shHide, shExit, shSave, shCurStr, shRollIfEnded, shAddText, shStatsOf, shDevCls, shDevWord, shSigned, shTags, shPaint, shTagPaint, shStatus, shEsAt, shDopeAt, shCalc, shCalcPaint, shBad, shToggle, shNew, shEnd, shMark, shPanels, shPanelOpen, shAddClose };
