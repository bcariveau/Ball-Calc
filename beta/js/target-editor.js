// beta/js/target-editor.js — Target editor sheet (tgEd).
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { setTab } from "./app.js";
import { B, angDec, angs, solveShot } from "./calc.js";
import { toast } from "./components.js";
import { $, escapeHtml, fmt, num, setVal, val } from "./core.js";
import { curLoad, curRifle } from "./gear.js";
import { dialComeUp, histLoad, scopeSentence } from "./link-v3.js";
import { ED, LOG, closeEditor, commitEditor, edDirty, openEditor, renderEditor, set_edDirty } from "./log.js";
import { SEL, paintSel } from "./reassign.js";
import { SH, shPaint } from "./shooting.js";
import { banHide, banPaint } from "./shot-banner.js";
import { P, S, uid } from "./storage.js";
import { dialTxt, teDialPaint, teSumPaint, tgAutoDial, tgRecent, tgRedope, tgSame } from "./strings.js";
import { tgSvg } from "./target-draw.js";
import { BAN, TE, angConv, angU, bulletDiaIn, fpsT, grpStats, hoff, hpos, inPerU, lenTxt, readings, set_TE, statHoles, strNo, tgDefDist, tgEnsure, tgView, tgYd, tgtLetter, tsFor, unpair, velVert } from "./targets.js";
import { TR, openTrue, predAt, trPaint } from "./truing.js";


/* ---- target editor ---- */
function teStr() { return ED && ED.tg && ED.tg.strings.find(s => s.id === TE.str); }
function teTgt() { const st = teStr(); return st && ED.tg.targets.find(g => g.id === st.tid); }
function teSnap() { TE.undo.push(JSON.stringify({ tg: ED.tg, shots: ED.shots })); if (TE.undo.length > 60) TE.undo.shift(); $("tgUndo").disabled = false; }
function teNextReading(st) {
  const used = new Set(); ED.tg.strings.forEach(q => q.holes.forEach(h => h.sh && used.add(h.sh)));
  if (TE.pairNext && !used.has(TE.pairNext)) { const id = TE.pairNext; TE.pairNext = null; return id; }
  const x = readings(ED, st.id).find(q => !q.x && !used.has(q.id)); return x ? x.id : null;
}
function openTgEd(strId, opts = {}) {
  if (!ED) return; const t = tgEnsure(ED); if (!t.strings.some(s => s.id === strId)) strId = t.cur;
  banHide();   // the editor is now the focus; the banner would sit over its buttons
  const st = t.strings.find(s => s.id === strId);
  const g = t.targets.find(q => q.id === st.tid), fresh = !t.strings.some(s => s.tid === g.id && (s.aim || s.holes.length || s.dial));
  const willDial = !st.dial && !st.holes.length && tgRecent(ED) && tgSame();   // the app's dope fills it in a moment
  set_TE({ str: strId, mode: st.aim ? "hole" : "aim", sel: null, undo: [], drag: null, span: null, pairNext: opts.pairNext || null, m: null,
    setOpen: fresh && !(g.dist > 0 || tgDefDist() > 0) || fresh && !st.dial && !willDial, fresh });   // collapsed unless a new target is missing something
  if (!(g.dist > 0)) g.dist = tgDefDist();
  $("tgEd").classList.add("show"); $("tgEd").scrollTop = 0; $("tgUndo").disabled = true;
  if (BAN.sid === ED.id) banPaint();
  teRender();
  if (!st.holes.length && !st.dial && tgRecent(ED)) tgAutoDial(ED, st).then(() => { if (TE && TE.fresh && teStr() === st && !st.dial && !TE.setOpen) { TE.setOpen = true; teRender(); } });   // first marked: default to the dope at this moment (no dope → open the setup)
}
async function closeTgEd() {
  if (!TE) return; if (TE.mode === "meas") teMeasCommit();
  $("tgEd").classList.remove("show"); $("tgLoupe").hidden = true; set_TE(null);
  set_edDirty(true); if (ED && !ED._new) await commitEditor(); if (ED) renderEditor();
  if (ED && BAN.sid === ED.id) banPaint();
  if (SH.on) { SH.calcKey = ""; shPaint(); }
}
function teSpan(t, g) {
  const yd = tgYd(g) || 100; let base = Math.max(12, 10 * inPerU("MOA", yd)), mx = 0;
  t.strings.filter(s => s.tid === g.id).forEach(s => { if (s.aim) mx = Math.max(mx, Math.abs(s.aim.x), Math.abs(s.aim.y)); s.holes.forEach(h => { const p = hpos(s, h); mx = Math.max(mx, Math.abs(p.x), Math.abs(p.y)); }); });
  return Math.max(base, mx * 2.3);
}
function teDraw() {
  const t = ED.tg, st = teStr(), g = teTgt(), yd = tgYd(g) || 100;
  if (!TE.drag || !TE.span) TE.span = teSpan(t, g);
  const layers = t.strings.map((s, i) => ({ s, i })).filter(o => o.s.tid === g.id).map(o => ({ i: o.i, sid: o.s.id, dim: o.s.id !== st.id, aim: o.s.aim,
    holes: o.s.holes.map((h, k) => ({ p: hpos(o.s, h), n: k + 1, meas: !!h.m, rm: !statHoles(ED, { holes: [h] }).length, sel: o.s.id === st.id && h.id === TE.sel, id: o.s.id === st.id ? h.id : "" })) }));
  layers.sort((a, b) => (a.dim ? 0 : 1) - (b.dim ? 0 : 1));
  const z = TE.zoom || 1, c = teCenter(z), W = TE.span / z, dia = bulletDiaIn(ED);
  // No mk shrink: a real diameter is a fixed length on the sheet and grows with zoom. An unknown diameter stays a steady screen marker.
  const sv = tgSvg({ span: W, gspan: TE.span, cx: c.x, cy: c.y, tpl: g.tpl, yd, layers, dia, px: W / Math.max(120, $("tgSvg").clientWidth || 380) });
  $("tgZoomT").textContent = `×${+z.toFixed(1)}`; $("tgZin").disabled = z >= 8; $("tgZout").disabled = z <= 1; $("tgZfit").disabled = z <= 1;
  const svg = $("tgSvg"); svg.setAttribute("viewBox", sv.vb); svg.innerHTML = sv.html; TE.vb = sv; TE.grid = sv.grid;
  return sv;
}
function teCenter(z) {   // view center (sheet in), kept inside the sheet
  if (z <= 1) return { x: 0, y: 0 }; const st = teStr(), c = TE.zc || (st && st.aim) || { x: 0, y: 0 }, lim = TE.span / 2 - TE.span / z / 2;
  return { x: Math.max(-lim, Math.min(lim, c.x)), y: Math.max(-lim, Math.min(lim, c.y)) };
}
function teZoomTo(z) { z = Math.max(1, Math.min(8, z)); TE.zoom = z; TE.zc = z <= 1 ? null : teCenter(z); teDraw(); }   // /－ keep the current center (the aim point when starting from ×1)
function teRender() {
  if (!TE || !ED) return; const t = ED.tg, st = teStr(), g = teTgt(), n = strNo(t, st.id);
  $("tgEdT").textContent = `String ${n} · Target ${tgtLetter(t, g.id)}`;
  $("tgTpl").value = g.tpl; setVal("tgDist", g.dist ?? ""); $("tgDu").value = g.du; $("tgU").value = g.u;
  $("tgStrSel").innerHTML = t.strings.map((s, i) => `<option value="${escapeHtml(s.id)}">String ${i + 1} · Target ${tgtLetter(t, s.tid)}</option>`).join(""); $("tgStrSel").value = st.id;
  $("tgEd").classList.toggle("meas", TE.mode === "meas"); teSumPaint();
  $("tgMode").querySelectorAll("button").forEach(b => { const on = b.dataset.v === TE.mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  const rd = readings(ED, st.id), pn = TE.pairNext && rd.findIndex(x => x.id === TE.pairNext) + 1;
  $("tgTip").textContent = TE.mode === "aim" ? `Tap the aim point for String ${n} (drag to adjust).`
    : TE.mode === "meas" ? (st.holes.length ? "Measure from the aim point to the center of each hole." : "Tap holes first (or <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> Add shot), then measure them.")
    : !st.aim ? "Set the aim point first (<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M12 5v14'/><path d='M5 12h14'/></svg> Aim point)." : pn ? `Tap where shot ${pn} hit.` : "Tap each hole in the order fired · drag a hole to adjust · tap its center (or its row below) to select it.";
  teDraw(); teMeasPaint(); tePair(); teDialPaint(); teResults();
  const dia = bulletDiaIn(ED), note = $("tgHoleNote");
  if (note) note.textContent = dia ? `Holes are drawn at ${dia.toFixed(3)}" (the bullet diameter saved with this session) and get larger as you zoom in.`
    : "Hole marks are not to scale — this session has no saved bullet diameter, so nothing is invented.";
}
function teMeasPaint() {
  const box = $("tgMeas"), st = teStr(); box.hidden = TE.mode !== "meas"; if (box.hidden) return;
  if (!st.holes.length) { $("tgMeasT").textContent = "No holes yet"; $("tgMeasBody").hidden = true; return; }
  $("tgMeasBody").hidden = false;
  if (!TE.m || TE.m.i >= st.holes.length) teMeasEnter(Math.min(TE.m ? TE.m.i : 0, st.holes.length - 1), true);
  const m = TE.m, u = teTgt().u;
  $("tgMeasT").innerHTML = `Hole ${m.i + 1} of ${st.holes.length}${st.holes[m.i].m ? " · <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z'/><path d='m14.5 12.5 2-2'/><path d='m11.5 9.5 2-2'/><path d='m8.5 6.5 2-2'/><path d='m17.5 15.5 2-2'/></svg> measured" : st.holes[m.i].ad ? " · not placed yet" : " · <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></svg> tapped"}`;
  $("tgMPf").textContent = m.fr && (m.fr.xs || m.fr.ys) ? (st.holes[m.i].m ? "Showing the saved measurement — type to replace it." : "Pre-filled from where you tapped — type to replace, or Next to keep it.") : "";
  [["tgMH", m.hd], ["tgMV", m.vd], ["tgMU", u]].forEach(([id, v]) => $(id).querySelectorAll("button").forEach(b => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }));
  $("tgMX").textContent = `${m.xs || "0"} ${u}`; $("tgMY").textContent = `${m.ys || "0"} ${u}`;
  $("tgMX").classList.toggle("on", m.f === "x"); $("tgMY").classList.toggle("on", m.f === "y"); $("tgMX").classList.toggle("pf", !!(m.fr && m.fr.xs)); $("tgMY").classList.toggle("pf", !!(m.fr && m.fr.ys));
  $("tgMNext").innerHTML = m.i < st.holes.length - 1 ? `Next · hole ${m.i + 2} <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg>` : "Next <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg>";
}
function teMeasEnter(i, quiet) {
  // pre-fill with the measured offset, else the tapped one (so you only correct it); only never-tapped holes ( Add shot) start at 0
  const st = teStr(), h = st.holes[i], u = teTgt().u, k = u === "cm" ? 2.54 : 1, o = h.m || (h.ad ? null : hoff(st, h));
  const f = v => v == null ? "" : String(+(Math.abs(v) * k).toFixed(2));
  TE.m = { i, f: "x", xs: o ? f(o.x) : "", ys: o ? f(o.y) : "", hd: o && o.x < 0 ? "L" : "R", vd: o && o.y < 0 ? "D" : "U", dirty: false, fr: { xs: !!o, ys: !!o } };   // fr: pre-filled, the first digit replaces it
  TE.sel = h.id; if (!quiet) teRender();
}
function teMeasCommit() {
  const m = TE && TE.m, st = TE && teStr(); if (!m || !st || !st.holes[m.i] || !m.dirty || (m.xs === "" && m.ys === "")) return false;   // untouched pre-fill stays  tapped
  const k = teTgt().u === "cm" ? 1 / 2.54 : 1, x = (parseFloat(m.xs) || 0) * k * (m.hd === "L" ? -1 : 1), y = (parseFloat(m.ys) || 0) * k * (m.vd === "D" ? -1 : 1), h = st.holes[m.i];
  if (h.m && Math.abs(h.m.x - x) < 1e-6 && Math.abs(h.m.y - y) < 1e-6) return false;
  teSnap(); h.m = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }; delete h.ad; m.dirty = false; TE.span = null; return true;
}
function tgAfterEditQuiet() { set_edDirty(true); }
function tePair() {   // one list: a row per hole (number, fps or "no reading", /, ⋯), then readings with no hole (discarded double reads included)
  const st = teStr(), rd = readings(ED, st.id), rk = new Map(rd.map((x, k) => [x.id, k + 1])), used = new Set(), M = TE.menu;
  ED.tg.strings.forEach(q => q.holes.forEach(h => h.sh && used.add(h.sh)));
  const tags = x => [x.clean && "Clean", x.cold && "Cold bore", x.fl && "Flier", x.ie && "Input error"].filter(Boolean).join(" · "), E = escapeHtml, B2 = (m, t, cl, ex) => `<button type="button" class="${cl || ""}" data-m="${m}"${ex || ""}>${t}</button>`;
  let h = st.holes.map((ho, i) => { const x = ho.sh && ED.shots.find(q => q.id === ho.sh), op = M && M.k === "h" && M.id === ho.id, tg = x && tags(x);
    let r = `<div class="lr${ho.id === TE.sel ? " on" : ""}${x ? "" : " np"}" data-h="${E(ho.id)}"><button type="button" class="lrM" aria-pressed="${ho.id === TE.sel}" aria-label="Hole ${i + 1}"><span class="hn">${i + 1}</span><span class="rv">${x ? `${fpsT(x.v)} fps` : ho.nr ? "no reading" : "unpaired"}</span><span class="rk">${x ? `reading ${rk.get(x.id) || "?"}${tg ? " · " + tg : ""}` : ho.nr ? "" : "tap ⋯ to pair"}</span><i title="${ho.m ? "measured" : "tapped"}">${ho.m ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z'/><path d='m14.5 12.5 2-2'/><path d='m11.5 9.5 2-2'/><path d='m8.5 6.5 2-2'/><path d='m17.5 15.5 2-2'/></svg>" : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2'/><path d='M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2'/><path d='M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></svg>"}</i></button><button type="button" class="lrX" aria-label="Hole ${i + 1} options" aria-expanded="${!!op}"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/></svg></button></div>`;
    if (op) r += `<div class="lmenu" role="menu" aria-label="Hole ${i + 1}">` + (M.step === "pair"
      ? `<div class="lmT">Pair hole ${i + 1} to a reading:</div>` + (rd.filter(q => !q.x).map(q => { const oh = st.holes.findIndex(z => z.sh === q.id); return B2("pk", `Reading ${rk.get(q.id)} · ${fpsT(q.v)} fps${oh >= 0 ? ` <small>(hole ${oh + 1})</small>` : ""}`, q.id === ho.sh ? "on" : "", ` data-s="${E(q.id)}"`); }).join("") || `<div class="hint">No kept readings in this string.</div>`) + B2("back", "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m15 18-6-6 6-6'/></svg> Back", "ghost")
      : B2("pair", "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Re-pair to reading") + B2("nr", "No reading") + B2("meas", "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z'/><path d='m14.5 12.5 2-2'/><path d='m11.5 9.5 2-2'/><path d='m8.5 6.5 2-2'/><path d='m17.5 15.5 2-2'/></svg> Measure") + B2("del", "Remove hole", "danger")) + `</div>`;
    return r; }).join("");
  const un = rd.filter(x => !used.has(x.id));
  if (un.length) h += `<div class="lsub">Readings without a hole</div>` + un.map(x => { const op = M && M.k === "r" && M.id === x.id, tg = tags(x);
    let r = `<div class="lr rdu${x.x ? " dis" : ""}" data-s="${E(x.id)}"><button type="button" class="lrM" aria-label="Reading ${rk.get(x.id)} options"><span class="hn">–</span><span class="rv">${fpsT(x.v)} fps</span><span class="rk">reading ${rk.get(x.id)}${x.x ? " · removed" : " · no hole"}${tg ? " · " + tg : ""}</span><i></i></button><button type="button" class="lrX" aria-label="Reading ${rk.get(x.id)} options" aria-expanded="${!!op}"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/></svg></button></div>`;
    if (op) r += `<div class="lmenu" role="menu" aria-label="Reading ${rk.get(x.id)}">` + (M.step === "pair"
      ? `<div class="lmT">Pair reading ${rk.get(x.id)} (${fpsT(x.v)} fps) to hole:</div>` + (st.holes.map((z, j) => { const zx = z.sh && ED.shots.find(q => q.id === z.sh); return B2("ph", `Hole ${j + 1} · ${zx ? `${fpsT(zx.v)} fps` : z.nr ? "no reading" : "unpaired"}`, "", ` data-h="${E(z.id)}"`); }).join("") || `<div class="hint">No holes yet — tap the target first.</div>`) + B2("back", "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m15 18-6-6 6-6'/></svg> Back", "ghost")
      : (x.x ? "" : B2("pair", "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Pair to hole")) + B2("x", x.x ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 7v6h6'/><path d='M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'/></svg> Restore" : "Remove (keeps the shot, out of stats)", x.x ? "" : "danger")) + `</div>`;
    return r; }).join("");
  $("tgList").innerHTML = h || `<div class="hint">No holes or readings yet.</div>`;
}

/* pointer: tap to place, drag to adjust, loupe above the finger */
function teXY(e) { const svg = $("tgSvg"), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return { x: Math.round(p.x * 1000) / 1000, y: Math.round(-p.y * 1000) / 1000 }; }
function teLoupe(e, p) {
  const lp = $("tgLoupe"), wrap = $("tgWrap").getBoundingClientRect(), D = 112; if (!p) { lp.hidden = true; return; }
  let L = e.clientX - wrap.left - D / 2, T = e.clientY - wrap.top - D - 46; if (T < -wrap.top + 4) T = e.clientY - wrap.top + 40;
  L = Math.max(0, Math.min(wrap.width - D, L)); lp.style.left = L + "px"; lp.style.top = T + "px"; lp.hidden = false;
  const w = TE.span / (TE.zoom || 1) / 4; $("tgLoupeSvg").setAttribute("viewBox", `${(p.x - w / 2).toFixed(3)} ${(-p.y - w / 2).toFixed(3)} ${w.toFixed(3)} ${w.toFixed(3)}`); $("tgLoupeSvg").innerHTML = $("tgSvg").innerHTML;
}
function tePinchStart() {   // second finger: cancel any placement/drag in progress and start pinch-zoom / two-finger pan
  const d = TE.drag; TE.drag = null; teLoupe(null, null);
  if (d && (d.kind === "aim" || d.snapped) && TE.undo.length) { const o = JSON.parse(TE.undo.pop()); ED.tg = o.tg; ED.shots = o.shots; $("tgUndo").disabled = !TE.undo.length; if (d.kind === "aim") TE.mode = teStr().aim ? "hole" : "aim"; }
  const [a, b] = [...TE.pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  TE.pinch = { d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: TE.zoom || 1, m0: teXY({ clientX: mx, clientY: my }) };
  teRender();
}
function tePinchMove() {
  const [a, b] = [...TE.pts.values()], P = TE.pinch, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, rc = $("tgSvg").getBoundingClientRect();
  const z = Math.max(1, Math.min(8, P.z0 * Math.hypot(a.x - b.x, a.y - b.y) / P.d0)), W = TE.span / z;
  TE.zoom = z; TE.zc = { x: P.m0.x - ((mx - rc.left) / rc.width - 0.5) * W, y: P.m0.y + ((my - rc.top) / rc.height - 0.5) * W }; TE.zc = teCenter(z); if (z <= 1) TE.zc = null; teDraw();
}
function teUp(e) {
  if (!TE) return; if (TE.pts) TE.pts.delete(e.pointerId);
  if (TE.pinch) { if (!TE.pts || TE.pts.size < 2) { TE.pinch = null; if (TE.pts) TE.pts.clear(); teRender(); } return; }   // lifting after a pinch never places a hole
  if (!TE.drag) return; const st = teStr(), d = TE.drag; TE.drag = null; teLoupe(e, null);
  if (d.kind === "aim") { TE.mode = "hole"; tgAfterEditQuiet(); teRender(); return; }
  if (d.kind === "new") { teSnap(); const h = { id: uid(), x: d.p.x, y: d.p.y, sh: teNextReading(st) }; st.holes.push(h); TE.sel = null; tgAfterEditQuiet(); teRender(); return; }
  if (d.kind === "move") { if (d.moved) { tgAfterEditQuiet(); teRender(); return; }
    if (d.onC) { TE.sel = TE.sel === d.h.id ? null : d.h.id; teRender(); return; }
    teSnap(); st.holes.push({ id: uid(), x: d.p.x, y: d.p.y, sh: teNextReading(st) }); TE.sel = null; tgAfterEditQuiet(); teRender(); }
}

/* results per string */
function teResults() {
  const st = teStr(), g = teTgt(), yd = tgYd(g), ts = tsFor(st?.asFired?.rifleId || ED.rifleId, st), U = ts.u, box = $("tgRes");
  const pts = statHoles(ED, st).map(h => hoff(st, h)), gs = grpStats(pts), u = g.u;
  if (!gs) { box.innerHTML = st.holes.length ? `<div class="hint">Marked holes are all paired to removed shots, so the group stats are empty. Restore a shot to count it again.</div>` : `<div class="hint">Results show once holes are marked.</div>`; return; }
  const blocked = !(ts.v > 0);
  const a = v => blocked ? "" : `${(v / inPerU(U, yd)).toFixed(2)} ${angU(U)}`, vv = velVert(ED, st), r = P.rifles.find(x => x.id === (st?.asFired?.rifleId || ED.rifleId)), zr = r && parseFloat(r.zero);
  const atZero = zr > 0 && Math.abs(yd - zr) <= Math.max(1, zr * 0.02), same = curRifle()?.id === ED.rifleId && curLoad()?.id === ED.loadId;
  let h = `<div class="sub">Results · String ${strNo(ED.tg, st.id)} · ${fmt(g.dist, 0)} ${g.du}</div><div class="resG">`;
  h += `<div><span>Group (c-c)</span><b id="tgResES">${gs.n > 1 ? lenTxt(gs.es, u) : "—"}</b><small>${gs.n > 1 ? a(gs.es) : "needs 2+ holes"}</small></div>`;
  h += `<div><span>Mean radius</span><b id="tgResMR">${gs.n > 1 ? lenTxt(gs.mr, u) : "—"}</b><small>${gs.n > 1 ? a(gs.mr) : ""}</small></div>`;
  h += `<div class="w2"><span>Group center from aim</span><b id="tgResC">${gs.cy >= 0 ? "U" : "D"} ${lenTxt(Math.abs(gs.cy), u)} · ${gs.cx >= 0 ? "R" : "L"} ${lenTxt(Math.abs(gs.cx), u)}</b><small id="tgResCA">${gs.cy >= 0 ? "U" : "D"} ${a(Math.abs(gs.cy))} · ${gs.cx >= 0 ? "R" : "L"} ${a(Math.abs(gs.cx))}</small></div></div>`;
  if (!st.aim && st.holes.some(x => !x.m)) h += `<div class="hint bad">No aim point set — tapped offsets are from the sheet center.</div>`;
  // a warning needs 5+ paired shots with r ≥ 0.7; fewer shots (or a weaker r) give at most a muted "possible trend" note
  h += `<div class="hint" id="tgVV">${vv.r == null ? `Velocity vs vertical needs 3+ paired shots (${vv.n} now).`
    : vv.r >= 0.7 && vv.n >= 5 ? `<b class="w"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Fast shots printed high, slow shots low</b> (r = ${vv.r.toFixed(2)}, ${vv.n} shots) — vertical is tracking velocity; tighten SD before chasing the rest.`
    : vv.r >= 0.5 ? `<span class="pt">Possible velocity-vs-vertical trend (r = ${vv.r.toFixed(2)}, ${vv.n} shots) — needs 5+ paired shots with r ≥ 0.7 to call it.</span>`
    : `No velocity-vs-vertical trend (r = ${vv.r.toFixed(2)}, ${vv.n} shots).`}</div>`;
  h += `<div class="hint" id="tgHist">…</div>`;
  const scope = scopeSentence(r && r.name, ts.source, ts.v > 0 ? ts.lbl : "");
  if (blocked) h += `<div class="zc bad" id="tgZero">${escapeHtml(scope || "Enter a turret click value before calculating.")}</div>`;
  else if (atZero && gs.n) {
    const k = ts.k || 1, e1 = -gs.cy / inPerU(ts.u, yd) / k, w1 = -gs.cx / inPerU(ts.u, yd), ce = Math.round(Math.abs(e1) / ts.v), cw = Math.round(Math.abs(w1) / ts.v);   // elevation ÷ tracking factor, as the dope does
    h += `<div class="zc" id="tgZero"><b>Zero correction</b> (${fmt(zr, 0)} yd zero, ${ts.lbl} clicks${k !== 1 ? `, tracking ×${fmt(k, 3)}` : ""}${ts.source === "current" ? ", current turret" : ""}): ${ce ? `${e1 >= 0 ? "U" : "D"} ${ce}` : "elevation OK"} · ${cw ? `${w1 >= 0 ? "R" : "L"} ${cw}` : "windage OK"}<small>${scope ? escapeHtml(scope) + " " : ""}Dial these to move the group onto the aim point${gs.n < 3 ? " — 3+ shots give a steadier center" : ""}.</small></div>`;
  } else if (gs.n > 1) {
    const d = st.dial, recordedId = st.asFired && st.asFired.loadId, canTrue = !!(recordedId || same);
    const up = d ? dialComeUp(d, gs.cy, yd) : null;
    h += `<label class="tgl" for="tgAtDist"><span>Fired at ${fmt(g.dist, 0)} ${g.du} with ${d ? `${dialTxt(d, ts)} dialed` : "the app's dope dialed"}<small>${d ? `The dial is ${d.u}. Switching the display unit does not change that angle.` : "No dial saved with this string — Truing uses today's prediction, weather and angle."}</small></span><input type="checkbox" id="tgAtDist" role="switch"${TE.atDist ? " checked" : ""}></label>`;
    h += `<button type="button" id="tgTrue"${TE.atDist && canTrue ? "" : " disabled"}><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Send vertical to Truing${up ? ` (${up.mil.toFixed(2)} mil · ${up.moa.toFixed(2)} MOA)` : ""}</button>`;
    h += `<div class="hint">${d ? `Sends the saved ${d.u} dial minus the group offset. The other unit is the same angle. ` : `<b>No dial saved for this string</b> — falls back to today's prediction, weather and angle. `}${recordedId && curLoad()?.id !== recordedId ? "Save updates the recorded load, not the load on screen. " : ""}${!recordedId && !same ? "<b>This string has no recorded load, and the load on screen is a different one. Nothing is sent.</b> " : ""}Only the vertical offset is sent.</div>`;
  }
  box.innerHTML = h;
  teHistDope(st, g, ts);
}
let histTok = 0;
function formLoadBag() {
  return { bc: val("bc"), drag: val("drag"), weight: val("weight"), diameter: val("diameter"), mv: val("mv"), length: val("length"), ptSens: val("ptSens"), mvTemp: val("mvTemp"), bulletName: val("bulletName") };
}
function teHistDope(st, g, ts) {
  const box = $("tgHist"); if (!box || !st) return;
  const yd = Math.round(tgYd(g)), hl = histLoad(st.asFired && st.asFired.recipe, formLoadBag());
  const bits = [hl.warning, "Zero, twist, and weather are the current setup and are not written onto the string."].filter(Boolean);
  if (hl.source === "missing" || !(ts && ts.v > 0)) { box.textContent = bits[0] || "Enter the missing load or turret. Nothing was invented."; return; }
  if (typeof B === "undefined" || !B || !(yd >= 5 && yd <= 3000)) { box.textContent = bits.join(" "); return; }
  const tok = ++histTok;
  const label = hl.source === "as-fired" ? `Recorded ${hl.used.bulletName || "load"} · ${hl.used.drag} ${hl.used.bc} · ${hl.used.mv} fps` : `Current ${hl.used.drag} ${hl.used.bc} · ${hl.used.mv} fps for missing ${hl.fromCurrent.join(", ")}`;
  box.textContent = `${label} · …`;
  (async () => {
    try {
      const sv = await solveShot({ allowBlank: true, load: hl.used, sh: ts.sh, winds: [] }), look = num("shotAngle") || 0, cosA = Math.cos(look * Math.PI / 180);
      if (look) sv.shot.lookAngle = B.UNew.Degree(look);
      const r = await sv.calc.fire({ shot: sv.shot, trajectoryRange: B.UNew.Yard(yd * cosA), trajectoryStep: B.UNew.Yard(yd * cosA), raiseRangeError: false });
      const p = r.samples[r.samples.length - 1];
      if (tok !== histTok || !p) return;
      const a = angs(p, ts), dd = angDec(ts), shown = Math.abs(a.ec * ts.v);
      box.textContent = `${label} · ${yd} yd · ${a.ec < 0 ? "D" : "U"} ${shown.toFixed(dd)} ${ts.u === "MOA" ? "MOA" : "mil"} (${Math.abs(a.ec)} clicks)${bits.length ? " · " + bits.join(" ") : ""}`;
    } catch (e) { if (tok === histTok) box.textContent = e.message || String(e); }
  })();
}
async function tgSendTrue() {
  if (!TE || !TE.atDist) return; const st = teStr(), g = teTgt(), gs = grpStats(statHoles(ED, st).map(h => hoff(st, h))), yd = Math.round(tgYd(g)), sn = strNo(ED.tg, st.id);
  const recordedId = st?.asFired?.loadId || null, same = curRifle()?.id === ED.rifleId && curLoad()?.id === ED.loadId;
  if (!gs || gs.n < 2 || !(recordedId || same)) return;
  if (yd < 50 || yd > 3000) { toast("Truing needs 50–3000 yd"); return; }
  const d = st.dial, up = d ? dialComeUp(d, gs.cy, yd) : null;
  if (d && !up) { toast("The saved dial has no unit. Nothing was sent."); return; }
  TR.loadId = recordedId || curLoad()?.id || null;
  TR.loadRecipe = st.asFired && st.asFired.recipe || null;
  TR.loadLabel = recordedId && curLoad()?.id !== recordedId ? "recorded" : (st.asFired && st.asFired.recipe ? "recorded" : "current");
  TR.sh = tsFor(st.asFired?.rifleId || ED.rifleId, st).sh;
  await closeTgEd(); if (ED) { if (edDirty && ED.shots.length) await commitEditor(); closeEditor(true); }
  setTab("dope"); openTrue(); if (!$("trSheet").classList.contains("show")) return;
  trPaint(); setVal("trRange", yd);
  if (d) {
    const w = d.wx || {}, look = Math.max(-60, Math.min(60, w.look || 0)), obs = d.u === "MOA" ? up.moa : up.mil;
    TR.unit = d.u; TR.look = look; trPaint(); setVal("trAngle", look); setVal("trObs", obs.toFixed(2));
    TR.cond = w.temp != null || w.alt != null || w.press != null || w.hum != null ? { cond: { temp: w.temp ?? null, hum: w.hum ?? null, alt: w.alt ?? null, press: w.press ?? null }, ...(w.tp != null ? { Tp: w.tp } : {}) } : null;
    const cTxt = TR.cond ? [w.temp != null ? `${fmt(w.temp, 0)}°F` : "", w.alt != null ? `${fmt(w.alt, 0)} ft` : "", w.press != null ? `${fmt(w.press, 2)} inHg` : "", w.tp != null ? `powder ${fmt(w.tp, 0)}°F` : ""].filter(Boolean).join(" · ") : "";
    if (TR.cond) $("trFor").textContent += ` · using the string's conditions: ${cTxt}`;
    $("trOut").innerHTML = `From the target: dialed ${dialTxt(d, tsFor(st.asFired?.rifleId || ED.rifleId, st))} (${up.mil.toFixed(2)} mil · ${up.moa.toFixed(2)} MOA, the same angle), group ${gs.cy >= 0 ? "high" : "low"} ${lenTxt(Math.abs(gs.cy), "in")} at ${yd} yd → <b>${obs.toFixed(2)} ${d.u}</b> would have centered it. ${recordedId && curLoad()?.id !== recordedId ? "This trues the recorded load, not the load on screen. " : ""}${TR.cond ? `Solved with String ${sn}'s saved conditions (${cTxt}) and ${fmt(look, 0)}° angle.` : `No conditions saved with the string — today's weather is used, ${fmt(look, 0)}° angle.`} Vertical only. Tap Solve.`;
  } else {
    const U = S.ang, corr = gs.cy / inPerU(U, yd);
    TR.unit = U; TR.look = 0; trPaint(); setVal("trAngle", 0); TR.cond = null;
    const pred = await predAt(yd, {}); if (!pred) { $("trOut").innerHTML = `<span class="bad">${yd} yd is beyond this bullet's reach.</span>`; return; }
    const obs = pred[U] - corr; setVal("trObs", obs.toFixed(2));
    $("trOut").innerHTML = `From the target: group center ${gs.cy >= 0 ? "high" : "low"} ${lenTxt(Math.abs(gs.cy), "in")} at ${yd} yd → the app's ${pred[U].toFixed(2)} ${angU(U)} would have needed <b>${obs.toFixed(2)} ${angU(U)}</b>. <span class="w">No dial was saved with this string, so this uses today's prediction with today's weather and angle.</span> Vertical only. Tap Solve.`;
  }
  toast("Vertical offset sent to Truing — check it and tap Solve");
}

/* CSV detail */
function shotDetail(s) {
  const t = tgView(s), out = [];
  t.strings.forEach((st, si) => {
    const g = t.targets.find(q => q.id === st.tid), tag = `S${si + 1}/${tgtLetter(t, st.tid)}@${fmt(g.dist, 0)}${g.du}`, hn = new Map(st.holes.map((h, i) => [h.id, i + 1])), byShot = new Map(st.holes.filter(h => h.sh).map(h => [h.sh, h]));
    const off = h => { const o = hoff(st, h); return `${o.x >= 0 ? "R" : "L"}${Math.abs(o.x).toFixed(2)} ${o.y >= 0 ? "U" : "D"}${Math.abs(o.y).toFixed(2)} in ${h.m ? "measured" : "tapped"}`; };
    readings(s, st.id).forEach((x, k) => { const h = byShot.get(x.id);
      out.push([tag, `#${k + 1}`, `${x.v} fps`, h ? `hole ${hn.get(h.id)} ${off(h)}` : "", x.x ? "removed" : "", x.clean ? "Clean" : "", x.cold ? "Cold bore" : "", x.fl ? "Flier" : "", x.ie ? "Input error" : ""].filter(Boolean).join(" ")); });
    st.holes.filter(h => !h.sh).forEach(h => out.push(`${tag} hole ${hn.get(h.id)} no reading ${off(h)}`));
  });
  return out.join(" | ");
}

/* Log rows: small group thumbnail (latest target with holes, around the aim point) + group size */
function tgThumb(s) {
  const t = s && s.tg; if (!t) return null;
  const last = [...t.strings].reverse().find(q => q.holes.length); if (!last) return null;
  const g = t.targets.find(q => q.id === last.tid), strs = t.strings.map((st, i) => ({ st, i })).filter(o => o.st.tid === g.id && o.st.holes.length);
  let mx = 0; const layers = strs.map(o => ({ i: o.i, aim: { x: 0, y: 0 }, holes: o.st.holes.map((h, k) => { const p = hoff(o.st, h); mx = Math.max(mx, Math.abs(p.x), Math.abs(p.y)); return { p, n: "" }; }) }));
  const span = Math.max(2, mx * 2.4), sv = tgSvg({ span, tpl: "grid1", yd: 100, u: "in", layers, mk: 3.2 });
  const kept = statHoles(s, last), gs = grpStats(kept.map(h => hoff(last, h))), U = tsFor(s.rifleId, last).u, yd = tgYd(g);
  const size = gs && gs.n > 1 ? `${lenTxt(gs.es, g.u)} · ${(gs.es / inPerU(U, yd)).toFixed(2)} ${angU(U)}` : `${last.holes.length} hole`;
  return { svg: `<svg class="tgS th" viewBox="${sv.vb}" aria-hidden="true">${sv.html.replace(/<text[^>]*>[^<]*<\/text>/g, "")}</svg>`, size, n: gs ? gs.n : 0 };
}
function tgThumbA(s) { return tgThumb(s) ? `<div class="slRow">` : ""; }
function tgThumbB(s) {
  const th = tgThumb(s); if (!th) return "";
  return `<button type="button" class="slTh" data-id="${escapeHtml(s.id)}" aria-label="Open the targets for this session (group ${escapeHtml(th.size)})">${th.svg}<span>${th.size}</span></button></div>`;
}

export function init() {
  $("tgMeas").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !TE || !TE.m) return; const m = TE.m, st = teStr();
    if (b.closest("#tgMH")) { if (m.hd !== b.dataset.v) m.dirty = true; m.hd = b.dataset.v; } else if (b.closest("#tgMV")) { if (m.vd !== b.dataset.v) m.dirty = true; m.vd = b.dataset.v; }
    else if (b.closest("#tgMU")) { const g = teTgt(); if (g.u !== b.dataset.v) { const k = b.dataset.v === "cm" ? 2.54 : 1 / 2.54, cv2 = s => s === "" ? "" : String(+(parseFloat(s) * k).toFixed(2)); m.xs = cv2(m.xs); m.ys = cv2(m.ys); g.u = b.dataset.v; } }
    else if (b.id === "tgMX") m.f = "x"; else if (b.id === "tgMY") m.f = "y";
    else if (b.dataset.k != null) { const k = b.dataset.k, f = m.f === "x" ? "xs" : "ys"; let v = m[f];
      if (k === "back") v = v.slice(0, -1); else if (k === ".") { if (!v.includes(".")) v = (v || "0") + "."; } else if (m.fr && m.fr[f]) v = k; else if (v.length < 6) v = v === "0" ? k : v + k;
      if (k === ".") { if (m.fr && m.fr[f]) v = "0."; } if (m.fr) m.fr[f] = false; m[f] = v; m.dirty = true; }
    else if (b.id === "tgMNext") { teMeasCommit(); if (m.i < st.holes.length - 1) { teMeasEnter(m.i + 1); return; } toast(`All ${st.holes.length} holes done — tap <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M20 6 9 17l-5-5'/></svg> Done`); }
    else if (b.id === "tgMPrev") { teMeasCommit(); if (m.i > 0) { teMeasEnter(m.i - 1); return; } }
    else if (b.id === "tgMDone") { teMeasCommit(); TE.mode = "hole"; TE.m = null; teRender(); tgAfterEditQuiet(); return; }
    else return;
    teRender();
  });
  $("tgList").addEventListener("click", e => {
    if (!TE) return; const b = e.target.closest("button"); if (!b) return; const row = b.closest(".lr"), st = teStr();
    if (row) {
      const hid = row.dataset.h, sid = row.dataset.s;
      if (b.classList.contains("lrX") || (sid && b.classList.contains("lrM"))) { const k = hid ? "h" : "r", id = hid || sid; TE.menu = TE.menu && TE.menu.k === k && TE.menu.id === id ? null : { k, id }; if (hid) TE.sel = hid; teRender(); return; }
      if (hid) { TE.menu = null; TE.sel = TE.sel === hid ? null : hid;
        if (TE.mode === "meas" && TE.sel) { teMeasCommit(); teMeasEnter(st.holes.findIndex(h => h.id === TE.sel)); return; } teRender(); }
      return;
    }
    const M = TE.menu, m = b.dataset.m; if (!M || !m) return;
    if (m === "back") { M.step = null; tePair(); return; }
    if (m === "pair") { M.step = "pair"; tePair(); return; }
    if (M.k === "h") { const h = st.holes.find(q => q.id === M.id), i = st.holes.indexOf(h); if (!h) return;
      if (m === "pk") { const id = b.dataset.s; teSnap(); unpair(ED, id); h.sh = id; delete h.nr; }   // explicit: only this hole and the reading's old hole change
      else if (m === "nr") { teSnap(); h.sh = null; h.nr = true; }
      else if (m === "del") { teSnap(); st.holes.splice(i, 1); TE.sel = null; TE.m = null; TE.span = null; }
      else if (m === "meas") { TE.menu = null; if (TE.mode === "meas") teMeasCommit(); TE.mode = "meas"; teMeasEnter(i); return; }
      TE.menu = null; tgAfterEditQuiet(); teRender(); return; }
    const x = ED.shots.find(q => q.id === M.id); if (!x) return;
    if (m === "x") { teSnap(); x.x = !x.x; if (!x.x) delete x.x; else unpair(ED, x.id); TE.menu = null; tgAfterEditQuiet(); teRender(); renderEditor(); return; }
    if (m === "ph") { const h = st.holes.find(q => q.id === b.dataset.h); if (!h) return; teSnap(); unpair(ED, x.id); h.sh = x.id; delete h.nr; TE.menu = null; TE.sel = h.id; tgAfterEditQuiet(); teRender(); }
  });
  $("tgAddShot").onclick = () => {
    if (!TE) return; const st = teStr(), raw = $("tgAddV").value.trim(), v = parseFloat(raw);
    if (raw && !(v >= 50 && v <= 6000)) { toast("Velocity 50–6000 fps, or leave it blank for a hole with no reading"); return; }
    teSnap(); const a = st.aim || { x: 0, y: 0 }, h = { id: uid(), x: a.x, y: a.y, sh: null, ad: true };   // ad: never tapped (measure starts at 0)
    if (raw) { const x = { v: +v.toFixed(1), id: uid(), str: st.id }; ED.shots.push(x); h.sh = x.id; } else h.nr = true;
    st.holes.push(h); TE.sel = h.id; $("tgAddV").value = ""; TE.span = null; tgAfterEditQuiet();
    if (TE.mode === "meas") TE.m = null;
    teRender(); renderEditor(); toast(`Hole ${st.holes.length} added at the aim point${raw ? ` with ${fpsT(v)} fps` : " (no reading)"} — drag it or measure it`);
  };
  $("tgUndo").onclick = () => { if (!TE || !TE.undo.length) return; const o = JSON.parse(TE.undo.pop()); ED.tg = o.tg; ED.shots = o.shots; TE.sel = null; TE.m = null; TE.span = null; $("tgUndo").disabled = !TE.undo.length; tgAfterEditQuiet(); teRender(); renderEditor(); };
  $("tgMode").addEventListener("click", e => { const b = e.target.closest("button"); if (!b || !TE) return; if (TE.mode === "meas" && b.dataset.v !== "meas") teMeasCommit(); TE.mode = b.dataset.v; TE.m = null; if (TE.mode === "meas" && TE.sel) { const i = teStr().holes.findIndex(h => h.id === TE.sel); if (i >= 0) { teMeasEnter(i); return; } } teRender(); });
  $("tgTpl").onchange = e => { teSnap(); teTgt().tpl = e.target.value; TE.span = null; tgAfterEditQuiet(); teRender(); };
  $("tgDist").addEventListener("change", e => { const v = parseFloat(e.target.value); if (!(v >= 5 && v <= 3000)) { toast("Distance 5–3000"); setVal("tgDist", teTgt().dist); return; } teSnap(); teTgt().dist = v; TE.span = null; tgAfterEditQuiet(); teRender(); tgRedope(teTgt()); });
  $("tgDu").onchange = e => { teSnap(); teTgt().du = e.target.value; TE.span = null; tgAfterEditQuiet(); teRender(); tgRedope(teTgt()); };
  $("tgU").onchange = e => { teTgt().u = e.target.value; tgAfterEditQuiet(); teRender(); };
  $("tgStrSel").onchange = e => { if (TE.mode === "meas") teMeasCommit(); TE.str = e.target.value; TE.sel = null; TE.m = null; TE.span = null; TE.zc = null; TE.menu = null; const st = teStr(); if (TE.mode === "aim" && st.aim) TE.mode = "hole"; teRender(); };
  $("tgEdDone").onclick = () => closeTgEd();
  $("tgZin").onclick = () => { if (!TE) return; const z = TE.zoom || 1; if (z <= 1) TE.zc = null; teZoomTo(z * 2); };
  $("tgZout").onclick = () => { if (!TE) return; teZoomTo((TE.zoom || 1) / 2); };
  $("tgZfit").onclick = () => { if (!TE) return; TE.zc = null; teZoomTo(1); };
  window.addEventListener("keydown", e => { if (e.key === "Escape" && $("tgEd").classList.contains("show")) { e.stopImmediatePropagation(); e.preventDefault(); closeTgEd(); } }, true);
  $("tgSvg").addEventListener("pointerdown", e => {
    if (!TE) return; e.preventDefault(); TE.pts = TE.pts || new Map(); TE.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { $("tgSvg").setPointerCapture(e.pointerId); } catch {}
    if (TE.pts.size === 2) { tePinchStart(); return; } if (TE.pts.size > 2 || TE.pinch) return;
    const st = teStr(), p = teXY(e), pxIn = TE.span / (TE.zoom || 1) / Math.max(1, $("tgSvg").clientWidth);
    if (TE.mode === "aim" || (!st.aim && TE.mode === "hole")) { teSnap(); TE.drag = { kind: "aim" }; st.aim = p; TE.mode = "aim"; teDraw(); teLoupe(e, p); return; }
    // press on a hole + drag = move it; a tap right on its center (≤5 px) selects it; any other tap adds a hole (touching holes in a tight group stay addable)
    let best = null, bd = (TE.mode === "meas" ? 24 : 16) * pxIn; st.holes.forEach(h => { const q = hpos(st, h), d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = h; } });
    if (TE.mode === "meas") { TE.drag = null; if (best) { teMeasCommit(); teMeasEnter(st.holes.indexOf(best)); } return; }
    if (best) TE.drag = { kind: "move", h: best, x0: e.clientX, y0: e.clientY, moved: false, snapped: false, onC: bd <= 5 * pxIn, p };
    else TE.drag = { kind: "new", p };
    teLoupe(e, best ? hpos(st, best) : p);
  });
  $("tgSvg").addEventListener("pointermove", e => {
    if (!TE) return; if (TE.pts && TE.pts.has(e.pointerId)) TE.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (TE.pinch) { if (TE.pts.size >= 2) tePinchMove(); return; }
    if (!TE.drag) return; const st = teStr(), p = teXY(e), d = TE.drag;
    if (d.kind === "aim") { st.aim = p; teDraw(); teLoupe(e, p); return; }
    if (d.kind === "new") { d.p = p; teDraw(); const g = $("tgSvg"); g.insertAdjacentHTML("beforeend", `<circle class="ghost" cx="${p.x}" cy="${-p.y}" r="${(TE.span / (TE.zoom || 1) / 58).toFixed(3)}" vector-effect="non-scaling-stroke"/>`); teLoupe(e, p); return; }
    if (d.kind === "move") { if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return; if (!d.snapped) { teSnap(); d.snapped = true; } d.moved = true; d.h.x = p.x; d.h.y = p.y; delete d.h.m; delete d.h.ad; teDraw(); teLoupe(e, p); }
  });
  $("tgSvg").addEventListener("pointerup", teUp);
  $("tgSvg").addEventListener("pointercancel", e => { if (!TE) return; if (TE.pts) TE.pts.delete(e.pointerId); if (TE.pinch && (!TE.pts || TE.pts.size < 2)) { TE.pinch = null; teRender(); } if (TE.drag) { TE.drag = null; teLoupe(e, null); teRender(); } });
  $("tgRes").addEventListener("change", e => { if (e.target.id === "tgAtDist" && TE) { TE.atDist = e.target.checked; teResults(); } });
  $("tgRes").addEventListener("click", e => { if (e.target.closest("#tgTrue")) tgSendTrue(); });
  $("slList").addEventListener("click", e => {
    const b = e.target.closest(".slTh"); if (!b) return; e.stopPropagation();
    if (typeof SEL !== "undefined" && SEL) { SEL.has(b.dataset.id) ? SEL.delete(b.dataset.id) : SEL.add(b.dataset.id); paintSel(); return; }
    const s = LOG.find(q => q.id === b.dataset.id); if (!s) return; openEditor(s);
    requestAnimationFrame(() => { const v = $("slTgView"); if (v) v.scrollIntoView({ block: "start" }); });
  });
}

export { teStr, teTgt, teSnap, teNextReading, openTgEd, closeTgEd, teSpan, teDraw, teCenter, teZoomTo, teRender, teMeasPaint, teMeasEnter, teMeasCommit, tgAfterEditQuiet, tePair, teXY, teLoupe, tePinchStart, tePinchMove, teUp, teResults, tgSendTrue, shotDetail, tgThumb, tgThumbA, tgThumbB };
