// beta/js/strings.js — Strings (shot strings) model and menus for the shooting view.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { B, angs, curCond, entryRequired, powderT, solveShot, turretSpec } from "./calc.js";
import { toast } from "./components.js";
import { $, escapeHtml, fmt, num, setVal } from "./core.js";
import { curLoad, curRifle, recipeSnapshot } from "./gear.js";
import { asFiredFrom, calcFallback, opticOn, recordedDial } from "./link-v3.js";
import { curOptic } from "./optics.js";
import { ED, commitEditor, edDirty, renderEditor, set_edDirty, stringWho } from "./log.js";
import { banPaint } from "./shot-banner.js";
import { P, uid } from "./storage.js";
import { mkGlyph, tgSvg } from "./target-draw.js";
import { openTgEd, teRender, teSnap, teStr, teTgt, tgAfterEditQuiet } from "./target-editor.js";
import { BAN, TE, TV, angConv, angU, bulletDiaIn, cleanDial, grpStats, hoff, inPerU, lenTxt, readings, statHoles, strNo, tgDefDist, tgEnsure, tgView, tgYd, tgtLetter, tsFor } from "./targets.js";


/* ---- session editor: string bar + overlays ---- */
function paintStrBar() {
  if (!ED) return; const t = tgView(ED), cur = t.strings.find(q => q.id === t.cur), n = strNo(t, cur.id), rd = readings(ED, cur.id);
  $("tgHdrT").textContent = `String ${n} · Target ${tgtLetter(t, cur.tid)}`;
  const af = cur.asFired, gun = (af && P.rifles.find(x => x.id === af.rifleId)) || null;
  const live = gun && curRifle() === gun ? turretSpec() : null;
  const fb = af ? calcFallback(af, gun, opticOn(P, gun), live && live.v > 0 ? live : null) : null;
  const kept = rd.filter(s => !s.x), who = stringWho(cur);
  $("tgHdrS").textContent = [who, `${kept.length} shot${kept.length === 1 ? "" : "s"}`, `${cur.holes.length} hole${cur.holes.length === 1 ? "" : "s"}`, t.strings.length > 1 ? `${t.strings.length} strings` : "", fb && fb.warning].filter(Boolean).join(" · ");
  $("tgMarkEach").checked = !!t.mark;
  $("tgMarkBtn").innerHTML = `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Mark holes · String ${n}`;
}
function paintTgView() {
  if (!ED) return; const box = $("slTgView"), t = tgView(ED);
  if (TV.sid !== ED.id) { TV.sid = ED.id; TV.hide = new Set(); }
  const any = t.strings.some(st => st.holes.length);
  if (!any) { box.innerHTML = `<div class="hint">No holes marked yet. Tap <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Mark holes after a string (or turn on Mark each shot).</div>`; return; }
  const vis = t.strings.map((st, i) => ({ st, i, g: t.targets.find(q => q.id === st.tid) })).filter(o => o.st.holes.length);
  const shown = vis.filter(o => !TV.hide.has(o.st.id));
  const yds = [...new Set(shown.map(o => Math.round(tgYd(o.g))))], ts = tsFor(ED.rifleId, t.strings.find(q => q.id === t.cur)), ang = yds.length > 1 ? ts.u : null, lu = shown[0]?.g.u || "in";
  const conv = (p, g) => ang ? { x: p.x / inPerU(ang, tgYd(g)), y: p.y / inPerU(ang, tgYd(g)) } : p;
  let mx = 0; const layers = shown.map(o => ({ i: o.i, sid: o.st.id, aim: { x: 0, y: 0 }, holes: o.st.holes.map((h, k) => { const p = conv(hoff(o.st, h), o.g); mx = Math.max(mx, Math.abs(p.x), Math.abs(p.y)); return { p, n: k + 1, meas: !!h.m, rm: !statHoles(ED, { holes: [h] }).length, id: h.id }; }) }));
  const span = Math.max(ang ? 2 : 3, mx * 2.5), sv = tgSvg({ span, tpl: "grid1", yd: 100, u: ang || "in", layers, dia: bulletDiaIn(ED), px: span / Math.max(200, box.clientWidth || 380) });
  const chips = vis.map(o => { const on = !TV.hide.has(o.st.id), gs = grpStats(statHoles(ED, o.st).map(h => hoff(o.st, h)));
    return `<button type="button" class="sc${on ? " on" : ""}" data-s="${escapeHtml(o.st.id)}" aria-pressed="${on}">${mkGlyph(o.i)}S${o.i + 1} · ${tgtLetter(t, o.st.tid)} · ${fmt(o.g.dist, 0)} ${o.g.du}${gs && gs.n > 1 ? ` · ${lenTxt(gs.es, o.g.u)}` : ""}</button>`; }).join("");
  box.innerHTML = `<div class="scRow" role="group" aria-label="Show or hide strings">${chips}</div>` +
    (shown.length ? `<svg id="slTgSvg" class="tgS" viewBox="${sv.vb}" role="img" aria-label="Overlay of ${shown.length} string${shown.length > 1 ? "s" : ""}, aligned on their aim points">${sv.html}</svg>` : `<div class="hint">All strings hidden — tap a chip to show it.</div>`) +
    `<div class="hint" id="slTgNote">${shown.length ? `Aligned on each string's aim point · grid ${fmt(sv.grid.step, 2)} ${ang ? angU(ang) : "in"}${ang ? ` · <b>different distances (${yds.join(", ")} yd) — plotted in ${angU(ang)}</b> so groups compare by angle` : ""}` : ""}</div>`;
}
function tgAfterEdit() { set_edDirty(true); if (ED.source === "bluetooth" && !ED._new) commitEditor(); renderEditor(); }
function newString(tid) {
  const r = curRifle(), l = curLoad();
  return { id: uid(), tid, aim: null, holes: [], asFired: asFiredFrom(r, curOptic(), l, r && l ? recipeSnapshot(r.id, l.id) : null) };
}
function tgNewString(newTarget) {
  if (!ED) return; const t = tgEnsure(ED), cur = t.strings.find(s => s.id === t.cur), rdN = readings(ED, cur.id).length, empty = !cur.holes.length && !rdN;
  const needMark = !empty && !cur.holes.length && rdN > 0, curNo = strNo(t, cur.id);
  if (newTarget) {
    const g0 = t.targets.find(g => g.id === cur.tid), g = { ...g0, id: uid() }; t.targets.push(g);
    if (empty) { const old = cur.tid; cur.tid = g.id; cur.aim = null; if (!t.strings.some(s => s.tid === old)) t.targets = t.targets.filter(q => q.id !== old); }
    else { const s = newString(g.id); t.strings.push(s); t.cur = s.id; }
  } else {
    if (empty) { toast(`String ${curNo} has no shots yet`); return; }
    const s = newString(cur.tid); t.strings.push(s); t.cur = s.id;
  }
  tgAfterEdit();
  const nc = t.strings.find(s => s.id === t.cur), msg = `String ${strNo(t, nc.id)} · Target ${tgtLetter(t, nc.tid)}${newTarget ? " (fresh sheet)" : " (same sheet, new aim point)"}`;
  if (needMark) toast(`${msg} — String ${curNo} has no holes marked`, { label: "Mark holes", fn: () => openTgEd(cur.id) }); else toast(msg);
  tgAutoDial(ED, nc);
}

/* ---- elevation dialed per string (defaults to the app's dope at that moment) ---- */
function tgSame() { return !!(ED && curRifle()?.id === ED.rifleId && curLoad()?.id === ED.loadId); }
async function tgDope(yd) {   // the dope the app shows now (conditions + shot angle on the Dope tab) at yd, as the turret reading (÷ tracking) + clicks
  if (entryRequired() || typeof B === "undefined" || !B || !tgSame() || !(yd >= 5 && yd <= 3000)) return null;
  try {
    const sv = await solveShot({ winds: [] }), look = num("shotAngle") || 0, cosA = Math.cos(look * Math.PI / 180);
    if (look) sv.shot.lookAngle = B.UNew.Degree(look);
    const r = await sv.calc.fire({ shot: sv.shot, trajectoryRange: B.UNew.Yard(yd * cosA), trajectoryStep: B.UNew.Yard(yd * cosA), raiseRangeError: false });
    const p = r.samples[r.samples.length - 1]; if (!p || Math.abs(p.distance.In(B.Distance.Yard) - yd * cosA) > 1) return null;
    const a = angs(p), ts = turretSpec(), c = curCond(), e = Math.round(a.ec * ts.v * 1e6) / 1e6;   // whole clicks × click size, in the turret's unit
    return cleanDial({ e, u: ts.u, c: a.ec, cl: ts.lbl, k: ts.k || 1, src: "app", wx: { temp: c.temp, hum: c.hum, alt: c.alt, press: c.press, tp: powderT(), look, yd }, at: Date.now() });
  } catch { return null; }
}
function tgWxSnap(yd) { const c = curCond(); return { temp: c.temp, hum: c.hum, alt: c.alt, press: c.press, tp: powderT(), look: num("shotAngle") || 0, yd }; }
function tgRecent(s) { const t = new Date(s && s.date).getTime(); return !isFinite(t) || Date.now() - t < 864e5; }
async function tgAutoDial(sess, st) {   // when a string is started or first marked
  if (!sess || !st || st.dial || !tgSame() || ED !== sess) return;
  const g = sess.tg.targets.find(q => q.id === st.tid), d = await tgDope(tgYd(g) || tgDefDist());
  if (!d || st.dial || ED !== sess) return;
  st.dial = d; set_edDirty(true); if (!sess._new && sess.source === "bluetooth") commitEditor();
  if (TE && teStr() === st) teRender();
}
async function tgRedope(g) {   // distance changed: an unedited app-dope dial follows it (an edited one is the shooter's and stays)
  if (!ED || !g || !tgSame()) return; const sess = ED, d = await tgDope(tgYd(g)); if (!d || ED !== sess) return;
  let n = 0; sess.tg.strings.forEach(st => { if (st.tid === g.id && st.dial && st.dial.src === "app") { st.dial = { ...d }; n++; } });
  if (n) { tgAfterEditQuiet(); if (TE) teRender(); }
}
function dialDec(v) { return Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2; }   // 0.1 mil / ½ MOA → 1 decimal; ¼ MOA, 0.05 mil, ⅛ MOA → 2 (never thousandths)
function dialView(d, ts) {   // the dial as read on the turret that was recorded, or the labeled current turret when history has none
  if (!d) return null;
  ts = ts || (ED ? tsFor(ED.rifleId) : turretSpec());
  const kept = recordedDial(d);
  if (kept && (!(ts && ts.v > 0) || ts.source === "current")) {
    const s = Math.abs(kept.e).toFixed(2);
    return { v: kept.e, s, c: kept.c, dir: kept.dir, u: kept.u, txt: `${kept.dir} ${s} ${angU(kept.u)}` };
  }
  if (!(ts && ts.v > 0)) return null;
  const u = ts.u, raw = angConv(d.e, d.u, u);
  let v, s, c;
  if (d.src === "app") { c = Math.round(raw / ts.v); v = c * ts.v; s = Math.abs(v).toFixed(dialDec(ts.v)); }
  else { v = raw; s = String(+Math.abs(v).toFixed(2)); c = d.u === u && d.c != null ? d.c : Math.round(raw / ts.v); }
  const dir = v < 0 || (v === 0 && raw < 0) ? "D" : "U";
  return { v, s, c, dir, u, txt: `${dir} ${s} ${angU(u)}` };
}
function dialTxt(d, ts) { const v = dialView(d, ts); return v ? v.txt : ""; }   // "U 11.00 MOA" / "U 2.8 mil"
function teDialPaint() {
  const st = teStr(), d = st.dial, ts = tsFor(ED.rifleId, st), U = ts.u, dv = d && dialView(d, ts);
  $("tgDialU").textContent = angU(U); if (ts.v > 0) $("tgDialV").step = String(ts.v);
  if (document.activeElement !== $("tgDialV")) setVal("tgDialV", dv ? dv.s : "");
  $("tgDialD").value = dv ? dv.dir : "U";
  const w = d && d.wx, wx = w ? [w.temp != null ? `${fmt(w.temp, 0)}°F` : "", w.alt != null ? `${fmt(w.alt, 0)} ft` : "", w.press != null ? `${fmt(w.press, 2)} inHg` : "", `${fmt(w.look || 0, 0)}° angle`].filter(Boolean).join(" · ") : "";
  const dialLbl = dv && d.cl && (ts.source === "current" || !(ts.v > 0)) ? d.cl : ts.lbl;
  $("tgDialH").innerHTML = d ? `= ${dv.dir} ${Math.abs(dv.c)} clicks (${escapeHtml(dialLbl)})${d.k && d.k !== 1 ? ` · tracking ×${fmt(d.k, 3)}` : ""} · ${d.src === "app" ? "app dope, whole clicks" : "edited"}${wx ? ` · saved with ${wx}` : ""}`
    : `Not saved — enter what you dialed${tgSame() ? " or tap App dope" : ""}. Truing then falls back to today's prediction.`;
}
async function teDialSet(raw, dir) {
  const st = teStr(); if (!st) return; const v = parseFloat(raw);
  if (raw === "" || raw == null) { if (st.dial) { teSnap(); delete st.dial; tgAfterEditQuiet(); } teRender(); return; }
  if (!(v >= 0 && v <= 300)) { toast("Elevation 0–300"); teDialPaint(); return; }
  const ts = tsFor(ED.rifleId, st);
  if (!(ts.v > 0)) { toast(ts.warning || "Enter a turret click value before calculating. Nothing was invented."); teDialPaint(); return; }
  const U = ts.u, e = dir === "D" ? -v : v, old = st.dial, ov = old && dialView(old, ts);
  if (ov && +ov.s === v && ov.dir === dir) { teDialPaint(); return; }   // unchanged (an app dial shown at clicks keeps its stored value)
  teSnap(); st.dial = cleanDial({ e, u: U, c: Math.round(e / ts.v), cl: ts.lbl, k: old && old.k || ts.k || 1, src: "user",
    wx: old && old.wx || tgWxSnap(tgYd(teTgt())), at: old && old.at || Date.now() });
  tgAfterEditQuiet(); teRender();
}

function teSumPaint() {   // one tappable line for String/Template/Distance/Measure in/Elevation dialed
  const st = teStr(), g = teTgt(), d = st.dial, o = $("tgTpl").querySelector(`option[value="${g.tpl}"]`), dv = d && dialView(d, tsFor(ED.rifleId, st));
  const parts = [o ? o.textContent : g.tpl, g.dist > 0 ? `${fmt(g.dist, 0)} ${g.du}` : "distance?"]; if (g.u === "cm") parts.push("cm");
  parts.push(dv ? `${dv.dir} ${dv.s} ${angU(dv.u)} (${Math.abs(dv.c)})` : "dial?");
  const open = !!TE.setOpen, b = $("tgSum");
  b.innerHTML = `<span class="t">${escapeHtml(parts.join(" · "))}</span><span class="i" aria-hidden="true">${open ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 15-6-6-6 6'/></svg>" : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg>"}</span>`;
  b.setAttribute("aria-expanded", String(open)); b.setAttribute("aria-label", `Setup: ${parts.join(", ")}. ${open ? "Tap to collapse" : "Tap to edit"}`);
  $("tgEd").classList.toggle("setc", !open);
}

export function init() {
  $("slTgView").addEventListener("click", e => { const b = e.target.closest(".sc"); if (!b) return; const id = b.dataset.s; TV.hide.has(id) ? TV.hide.delete(id) : TV.hide.add(id); paintTgView(); });
  $("tgNewStr").onclick = () => tgNewString(false);
  $("tgNewTgt").onclick = () => tgNewString(true);
  $("tgMarkBtn").onclick = () => { if (!ED) return; const t = tgEnsure(ED); openTgEd(t.cur); };
  $("tgMarkEach").onchange = e => { if (!ED) return; tgEnsure(ED).mark = e.target.checked; tgAfterEdit(); if (BAN.sid === ED.id) banPaint(); };
  $("tgDialV").addEventListener("change", e => teDialSet(e.target.value.trim(), $("tgDialD").value));
  $("tgDialD").onchange = () => teDialSet($("tgDialV").value.trim(), $("tgDialD").value);
  $("tgDialApp").onclick = async () => {
    if (!TE) return; const st = teStr(), d = await tgDope(tgYd(teTgt()));
    if (!d) { toast(tgSame() ? "No dope at that distance — check the inputs on the Dope tab" : "Pick this session's gun + load on Gear to use its dope"); return; }
    teSnap(); st.dial = d; tgAfterEditQuiet(); teRender(); toast(`Dial set to the app's dope: ${dialTxt(d)} (${Math.abs(d.c)} clicks)`);
  };
  $("tgSum").onclick = () => { if (!TE) return; TE.setOpen = !TE.setOpen; teSumPaint(); if (TE.setOpen) $("tgStrSel").focus({ preventScroll: true }); };
}

export { paintStrBar, paintTgView, tgAfterEdit, tgNewString, tgSame, tgDope, tgWxSnap, tgRecent, tgAutoDial, tgRedope, dialDec, dialView, dialTxt, teDialPaint, teDialSet, teSumPaint };
