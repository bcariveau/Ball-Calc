// beta/js/targets.js — Target model: shots, groups, measurements (pure data).
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { idbGet, idbPut } from "./bulletdb.js";
import { TURRETS, turretSpec } from "./calc.js";
import { num } from "./core.js";
import { curLoad, curRifle, recipeSnapshot } from "./gear.js";
import { curOptic } from "./optics.js";
import { asFiredFrom, cleanAsFired } from "./link-v3.js";
import { LOG, cleanSession, nOrNull, sstr } from "./log.js";
import { P, S, load, store, uid } from "./storage.js";


/* ---------------- targets: live shot banner, strings + targets, hole marking, measured offsets, pairing, results, overlays ---------------- */
// Data (all additive; old code ignores it): shot += { id, str (string id), x (discarded), fl (flier) };
// session.tg = { targets: [{ id, tpl, dist, du "yd"|"m", u "in"|"cm" }], strings: [{ id, tid, aim {x,y} in, holes: [{ id, x, y (sheet in), m? {x,y} measured offset from aim in (R+, U+), sh shot id | null, nr? }] }], cur, mark }.
// A sidecar copy (IndexedDB "shotlog.tg") restores it if the stable page re-saves the log without these fields.
var TG_TPL = { grid1: "1\u2033 grid", moa: "MOA grid", mil: "MIL grid", bull: "Bullseye", steel: "Steel plate" };
var TG_SHAPES = ["circle", "square", "triangle", "diamond", "pentagon", "cross", "star", "hex"];
var TGX_KEY = "shotlog.tg";
var TGX_LS = "bcalc.shotlog.tg.v1";
var TE = null;
var TV = { sid: null, hide: new Set() };
var BAN = { sid: null, shid: null, t: 0 };
var LIVE = null;
var WL = null;
var WLbusy = false;

function tgFin(v) { return typeof v === "number" && isFinite(v) && Math.abs(v) < 1e5 ? Math.round(v * 1000) / 1000 : null; }
function tgPt(p) { if (!p || typeof p !== "object") return null; const x = tgFin(p.x), y = tgFin(p.y); return x == null || y == null ? null : { x, y }; }
function cleanTg(t, ids) {
  if (!t || typeof t !== "object" || !Array.isArray(t.targets) || !Array.isArray(t.strings)) return null;
  const targets = t.targets.filter(g => g && typeof g === "object").slice(0, 60).map(g => ({ id: sstr(g.id, 20) || uid(), tpl: TG_TPL[g.tpl] ? g.tpl : "grid1",
    dist: nOrNull(g.dist), du: g.du === "m" ? "m" : "yd", u: g.u === "cm" ? "cm" : "in" }));
  if (!targets.length) return null;
  const tids = new Set(targets.map(g => g.id)), used = new Set();
  const strings = t.strings.filter(s => s && typeof s === "object").slice(0, 300).map(s => {
    const st = { id: sstr(s.id, 20) || uid(), tid: tids.has(s.tid) ? s.tid : targets[0].id, aim: tgPt(s.aim),
      holes: (Array.isArray(s.holes) ? s.holes : []).filter(h => h && typeof h === "object").slice(0, 200).map(h => {
        const p = tgPt(h) || { x: 0, y: 0 }, m = tgPt(h.m); let sh = h.sh != null && ids.has(String(h.sh)) ? String(h.sh) : null;
        if (sh && used.has(sh)) sh = null; if (sh) used.add(sh);
        const o = { id: sstr(h.id, 20) || uid(), x: p.x, y: p.y, sh }; if (m) o.m = m; if (!sh && h.nr) o.nr = true; if (h.ad && !m) o.ad = true; return o; }) };
    const af = cleanAsFired(s.asFired); if (af) st.asFired = af;
    return st;
  }).map((st, i) => { const d = cleanDial(t.strings.filter(q => q && typeof q === "object")[i].dial); if (d) st.dial = d; return st; });
  if (!strings.length) return null;
  return { targets, strings, cur: strings.some(s => s.id === t.cur) ? t.cur : strings[strings.length - 1].id, mark: !!t.mark };
}
function cleanDial(d) {   // elevation dialed for a string: e in unit u (turret reading, display unit at the time), c clicks, k tracking factor, wx conditions + angle then
  if (!d || typeof d !== "object") return null; const e = tgFin(d.e); if (e == null) return null;
  const o = { e, u: d.u === "MOA" ? "MOA" : "MIL", src: d.src === "app" ? "app" : "user" }, c = tgFin(d.c), k = tgFin(d.k);
  if (c != null) o.c = Math.round(c); if (typeof d.cl === "string" && d.cl) o.cl = sstr(d.cl, 24); if (k != null && k >= 0.8 && k <= 1.2) o.k = k;
  if (d.wx && typeof d.wx === "object") { const w = {}; ["temp", "hum", "alt", "press", "tp", "look", "yd"].forEach(q => { const v = tgFin(d.wx[q]); if (v != null) w[q] = v; }); o.wx = w; }
  if (typeof d.at === "number" && isFinite(d.at) && d.at > 0) o.at = Math.round(d.at);
  return o;
}
function angConv(v, from, to) { return from === to ? v : from === "MIL" ? v * 3.437747 : v / 3.437747; }
function fpsT(v) { return String(Math.round(v)); }   // speeds shown to the whole fps (stored precision kept)
function tgDefDist() { const d = num("target"); return d > 0 ? d : 100; }
function tgView(s) { return s.tg || { targets: [{ id: "_t", tpl: "grid1", dist: tgDefDist(), du: "yd", u: "in" }], strings: [{ id: "_s", tid: "_t", aim: null, holes: [] }], cur: "_s", mark: false, virt: true }; }
function tgEnsure(s) {
  s.shots.forEach(x => { if (!x.id) x.id = uid(); });
  if (!s.tg) { const tid = uid(), sid = uid(); const r = curRifle(), l = curLoad();
    s.tg = { targets: [{ id: tid, tpl: "grid1", dist: tgDefDist(), du: "yd", u: "in" }], strings: [{ id: sid, tid, aim: null, holes: [], asFired: asFiredFrom(r, curOptic(), l, r && l ? recipeSnapshot(r.id, l.id) : null) }], cur: sid, mark: false }; }
  return s.tg;
}
function strOf(s, x) { const t = tgView(s); return x.str && t.strings.some(q => q.id === x.str) ? x.str : t.strings[0].id; }
function readings(s, sid) { return s.shots.filter(x => strOf(s, x) === sid); }
function strNo(t, sid) { return t.strings.findIndex(q => q.id === sid) + 1; }
function tgtLetter(t, tid) { const i = t.targets.findIndex(q => q.id === tid); return i < 26 ? String.fromCharCode(65 + Math.max(0, i)) : "T" + (i + 1); }
function tgYd(g) { const d = +g.dist || 0; return g.du === "m" ? d * 1.0936133 : d; }
function inPerU(u, yd) { return (u === "MIL" ? 3.6 : 1.0471976) * yd / 100; }   // inches per 1 mil / 1 MOA at that distance
// Saved bullet diameter, inches. Only a number actually stored on the session's recipe counts — a missing or blank
// legacy field stays unknown (do not borrow the load's current diameter; that may have been edited later).
function bulletDiaIn(sess) {
  const d = parseFloat(sess && sess.recipe && sess.recipe.diameter);
  return d > 0.05 && d <= 1 ? d : null;
}
function shotRemoved(sh) { return !!(sh && sh.x); }
// A hole stays in group / POI stats unless it is paired to a removed shot. Unpaired marks stay. Tags never exclude.
function statHoles(sess, st) {
  return (st && st.holes || []).filter(h => {
    if (!h.sh || !sess) return true;
    const sh = (sess.shots || []).find(q => q.id === h.sh);
    return !shotRemoved(sh);
  });
}
function hoff(st, h) { return h.m ? { x: h.m.x, y: h.m.y } : st.aim ? { x: h.x - st.aim.x, y: h.y - st.aim.y } : { x: h.x, y: h.y }; }   // measured wins
function hpos(st, h) { const a = st.aim || { x: 0, y: 0 }; return h.m ? { x: a.x + h.m.x, y: a.y + h.m.y } : { x: h.x, y: h.y }; }
function unpair(s, shid) { if (s.tg) s.tg.strings.forEach(st => st.holes.forEach(h => { if (h.sh === shid) h.sh = null; })); }
function grpStats(pts) {
  const n = pts.length; if (!n) return null;
  const cx = pts.reduce((a, p) => a + p.x, 0) / n, cy = pts.reduce((a, p) => a + p.y, 0) / n; let es = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) es = Math.max(es, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  return { n, cx, cy, es, mr: pts.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / n };
}
function pearson(a, b) {
  const n = a.length; if (n < 2) return 0; const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n; let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}
function velVert(s, st) {   // fast high / slow low? needs ≥3 paired, kept shots
  const pr = st.holes.map(h => ({ h, x: h.sh && s.shots.find(q => q.id === h.sh) })).filter(o => o.x && !o.x.x).map(o => ({ v: o.x.v, y: hoff(st, o.h).y }));
  if (pr.length < 3) return { n: pr.length, r: null };
  return { n: pr.length, r: pearson(pr.map(p => p.v), pr.map(p => p.y)) };
}
function lenTxt(inch, u) { return u === "cm" ? `${(inch * 2.54).toFixed(1)} cm` : `${inch.toFixed(2)}\u2033`; }
function angU(u) { return u === "MIL" ? "mil" : "MOA"; }
function tsFor(rid) {   // the turret of the session's gun (its optic, else the gun's own setting, else the display unit)
  const r = P.rifles.find(x => x.id === rid);
  if (r && curRifle() === r) return turretSpec();
  const o = r && r.opticId && (P.optics || []).find(x => x.id === r.opticId), key = o ? o.opTurret : r && r.turret;
  const tk = o ? parseFloat(o.opTrack) : NaN, k = tk >= 0.8 && tk <= 1.2 ? tk : 1;
  if (key && TURRETS[key]) { const [u, v, lbl] = TURRETS[key]; return { u, v, lbl, k }; }
  if (key === "custom") { const v = parseFloat(o ? o.opTurretV : r.turretV), u = (o ? o.opTurretU : r.turretU) === "moa" ? "MOA" : "MIL"; if (v > 0) return { u, v, lbl: `${v} ${angU(u)}`, k }; }
  return S.ang === "MOA" ? { u: "MOA", v: 0.25, lbl: "\u00bc MOA", k } : { u: "MIL", v: 0.1, lbl: "0.1 mil", k };
}
function tgNice(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

/* sidecar: survives a re-save by the stable page (which drops unknown fields) */
function tgSidecar() {
  const m = {};
  LOG.forEach(s => { if (s.tg || s.shots.some(x => x.id || x.x || x.fl || x.ie)) m[s.id] = { sh: s.shots.map(x => ({ v: x.v, id: x.id, str: x.str, x: x.x, fl: x.fl, ie: x.ie, cold: x.cold, clean: x.clean })), tg: s.tg || null }; });
  return m;
}
async function tgSaveSidecar() { const m = tgSidecar(); try { await idbPut(TGX_KEY, m); localStorage.removeItem(TGX_LS); } catch { store(TGX_LS, m); } }
async function tgRestore() {
  let sc = null; try { sc = await idbGet(TGX_KEY); } catch {} if (!sc || typeof sc !== "object") sc = load(TGX_LS, null);
  if (!sc || typeof sc !== "object") return 0; let n = 0;
  LOG.forEach((s, k) => {
    const e = sc[s.id]; if (!e || s.tg || s.shots.some(x => x.id)) return;   // intact (saved by this page)
    const sh = Array.isArray(e.sh) ? e.sh : []; let j = 0;
    s.shots.forEach(x => { for (let q = j; q < sh.length; q++) if (sh[q] && sh[q].v === x.v) { const o = sh[q]; if (o.id) x.id = o.id; if (o.str) x.str = o.str; if (o.x) x.x = true; if (o.fl) x.fl = true; if (o.ie) x.ie = true; if (o.cold) x.cold = true; if (o.clean) x.clean = true; j = q + 1; break; } });
    if (e.tg) s.tg = e.tg; LOG[k] = cleanSession(s); n++;
  });
  return n;
}

// cross-module writers (imports are read-only)
function set_LIVE(v) { return LIVE = v; }
function set_TE(v) { return TE = v; }
function set_WL(v) { return WL = v; }
function set_WLbusy(v) { return WLbusy = v; }

export { TG_TPL, TG_SHAPES, TGX_KEY, TGX_LS, TE, TV, BAN, LIVE, WL, WLbusy, tgFin, tgPt, cleanTg, cleanDial, angConv, fpsT, tgDefDist, tgView, tgEnsure, strOf, readings, strNo, tgtLetter, tgYd, inPerU, bulletDiaIn, shotRemoved, statHoles, hoff, hpos, unpair, grpStats, pearson, velVert, lenTxt, angU, tsFor, tgNice, tgSidecar, tgSaveSidecar, tgRestore, set_TE, set_LIVE, set_WL, set_WLbusy };
