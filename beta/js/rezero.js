// beta/js/rezero.js — re-zero suggestions. Pure: no DOM, no storage writes.
// Angular conversion uses the same formulas as targets.js inPerU / hoff / tgYd.

import { clicksFor } from "./link-v3.js";
import { hoff, inPerU, tgYd } from "./targets.js";

const MOA_PER_MIL = 3.437747;
const MIN_MIL = 0.15;
const MIN_MOA = 0.5;
const REMIND_MS = 30 * 24 * 60 * 60 * 1000;
const T95 = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
  26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
  40: 2.021, 60: 2.000, 120: 1.980,
};

function tCrit(df) {
  if (!(df >= 1)) return null;
  if (T95[df]) return T95[df];
  if (df > 120) return 1.960;
  const keys = Object.keys(T95).map(Number).sort((a, b) => a - b);
  let lo = keys[0], hi = keys[keys.length - 1];
  for (const k of keys) {
    if (k <= df) lo = k;
    if (k >= df) { hi = k; break; }
  }
  if (lo === hi) return T95[lo];
  return T95[lo] + (T95[hi] - T95[lo]) * ((df - lo) / (hi - lo));
}

function axisStats(values) {
  const xs = (values || []).filter(v => typeof v === "number" && isFinite(v));
  const n = xs.length;
  if (!n) return { n: 0, mean: null, sd: null, ci: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean, sd: null, ci: null };
  const sd = Math.sqrt(xs.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  const ci = tCrit(n - 1) * sd / Math.sqrt(n);
  return { n, mean, sd, ci };
}

function toUnit(v, from, to) {
  if (!isFinite(v)) return 0;
  if (from === to) return v;
  if (from === "MIL" && to === "MOA") return v * MOA_PER_MIL;
  if (from === "MOA" && to === "MIL") return v / MOA_PER_MIL;
  return v;
}

function minAbs(unit) { return unit === "MOA" ? MIN_MOA : MIN_MIL; }

function axisFires(stats, spec) {
  if (!stats || stats.n < 2 || stats.ci == null || !isFinite(stats.mean)) return false;
  if (!(Math.abs(stats.mean) > stats.ci)) return false;
  if (!(spec && spec.v > 0) || spec.u !== "MIL" && spec.u !== "MOA") return false;
  const mean = toUnit(stats.mean, spec.u, spec.u);
  if (Math.abs(mean) + 1e-9 < minAbs(spec.u)) return false;
  if (Math.abs(mean) + 1e-9 < spec.v) return false;
  return true;
}

function snapAxis(impact, spec) {
  if (!spec || !(spec.v > 0) || !isFinite(impact)) return { correction: 0, clicks: 0, residual: 0 };
  const hit = clicksFor(-impact, spec);
  if (!hit) return { correction: 0, clicks: 0, residual: -impact };
  return { correction: hit.e, clicks: hit.c, residual: -impact - hit.e };
}

function cv(values) {
  const xs = values.filter(v => isFinite(v));
  if (xs.length < 2) return Infinity;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (Math.abs(mean) < 1e-9) return Infinity;
  const sd = Math.sqrt(xs.reduce((a, v) => a + (v - mean) ** 2, 0) / (xs.length - 1));
  return sd / Math.abs(mean);
}

function closeEnough(a, b, cia, cib, unit) {
  const tol = Math.max(cia || 0, cib || 0, minAbs(unit));
  return Math.abs(a - b) <= tol + 1e-9;
}

function bucketsOf(points) {
  const map = new Map();
  for (const p of points) {
    const yd = Math.round(p.yd);
    if (!map.has(yd)) map.set(yd, []);
    map.get(yd).push(p);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([yd, pts]) => ({
    yd, pts,
    vs: axisStats(pts.map(p => p.v)),
    hs: axisStats(pts.map(p => p.h)),
    strings: [...new Set(pts.map(p => p.stringId))],
  }));
}

function wmean(stats) {
  const n = stats.reduce((a, s) => a + s.n, 0);
  if (!n) return { mean: 0, n: 0, ci: 0 };
  const mean = stats.reduce((a, s) => a + s.mean * s.n, 0) / n;
  const ci = Math.max(...stats.map(s => s.ci || 0));
  return { mean, n, ci };
}

function dial(v, up, down) {
  if (!isFinite(v) || Math.abs(v) < 1e-9) return "";
  return `${v > 0 ? up : down} ${Math.abs(v).toFixed(2)}`;
}

function analyze(points, opts) {
  const spec = opts && opts.spec;
  const unit = spec && spec.u === "MOA" ? "MOA" : "MIL";
  const zeroYd = opts && isFinite(+opts.zeroYd) ? +opts.zeroYd : 100;
  const kept = (points || []).filter(p => p && !p.cold);
  const cold = (points || []).filter(p => p && p.cold);
  if (kept.length < 5 || !spec || !(spec.v > 0)) return null;
  const buckets = bucketsOf(kept);
  const vFire = buckets.filter(b => axisFires(b.vs, spec));
  const hFire = buckets.filter(b => axisFires(b.hs, spec));
  const nearZero = b => Math.abs(b.yd - zeroYd) <= 15;

  const byString = new Map();
  for (const p of kept) {
    if (!byString.has(p.stringId)) byString.set(p.stringId, []);
    byString.get(p.stringId).push(p);
  }
  const strings = [...byString.entries()].map(([id, pts]) => ({
    id, pts, date: pts[0].date || "", yd: Math.round(pts[0].yd),
    vs: axisStats(pts.map(p => p.v)), hs: axisStats(pts.map(p => p.h)),
  })).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));
  let mounts = false;
  if (strings.length >= 2) {
    const last = strings[strings.length - 1];
    const earlier = strings.slice(0, -1).filter(s => Math.abs(s.yd - last.yd) <= 15 && s.vs.n >= 5);
    if (last.vs.n >= 5 && earlier.length && (axisFires(last.vs, spec) || axisFires(last.hs, spec))
      && earlier.every(s => Math.abs(s.vs.mean) < minAbs(unit) && Math.abs(s.hs.mean) < minAbs(unit))) mounts = true;
  }

  const vMeans = vFire.map(b => b.vs.mean);
  const tallRatios = buckets.filter(b => b.vs.n >= 5).map(b => Math.abs(b.vs.mean) / Math.max(b.yd - zeroYd, 1));
  const tall = buckets.filter(b => b.vs.n >= 5).length >= 3 && cv(tallRatios) < 0.2 && cv(vMeans.length ? buckets.filter(b => b.vs.n >= 5).map(b => Math.abs(b.vs.mean)) : []) > 0.25;

  const vConstant = vFire.length >= 2 && vFire.every(b => closeEnough(b.vs.mean, vFire[0].vs.mean, b.vs.ci, vFire[0].vs.ci, unit));
  const vGrows = vFire.length >= 2 && !vConstant && vFire.every((b, i) => i === 0 || Math.abs(b.vs.mean) + 1e-9 >= Math.abs(vFire[i - 1].vs.mean));
  const hScales = hFire.length >= 2 && hFire.every(b => Math.sign(b.hs.mean) === Math.sign(hFire[0].hs.mean))
    && hFire.every((b, i) => i === 0 || Math.abs(b.hs.mean) > Math.abs(hFire[i - 1].hs.mean) + 0.05);

  let cls = null;
  if (mounts) cls = "mounts";
  else if (tall) cls = "tall";
  else if (vConstant || (vFire.length === 1 && !hScales)) cls = "zero";
  else if (vGrows) cls = "truing";
  else if (hScales) cls = "level";
  else if (hFire.length) cls = "report";
  else if (vFire.length) cls = "zero";
  if (!cls) return null;

  const used = cls === "mounts" ? strings[strings.length - 1].pts
    : cls === "level" || cls === "report" ? hFire.flatMap(b => b.pts)
    : (vFire.length ? vFire : buckets.filter(b => b.vs.n >= 5)).flatMap(b => b.pts);
  const shotN = used.length;
  const stringIds = [...new Set(used.map(p => p.stringId))];
  let mode = null;
  if (cls === "truing") mode = shotN >= 5 ? "truing" : null;
  else if (cls === "zero") mode = shotN >= 10 && stringIds.length >= 2 ? "apply" : shotN >= 5 ? "possible" : null;
  else mode = shotN >= 5 ? "report" : null;
  if (!mode) return null;

  const poolV = axisStats(used.map(p => p.v));
  const zeroBuckets = buckets.filter(nearZero);
  const poolH = axisStats((cls === "zero" ? zeroBuckets : hFire).flatMap(b => b.pts).map(p => p.h));
  const vOn = cls === "zero" || cls === "truing" || cls === "mounts" || cls === "tall" ? axisFires(poolV, spec) || vFire.length > 0 : false;
  const hOn = cls === "zero" ? axisFires(poolH, spec) : (cls === "level" || cls === "report" || cls === "mounts") && hFire.length > 0;
  const snapV = vOn ? snapAxis(poolV.mean, spec) : { correction: 0, clicks: 0, residual: 0 };
  const snapH = hOn ? snapAxis(poolH.mean || 0, spec) : { correction: 0, clicks: 0, residual: 0 };
  const ciV = poolV.ci || 0, ciH = poolH.ci || 0;
  const showV = Math.abs(snapV.residual) > ciV + 1e-6;
  const showH = Math.abs(snapH.residual) > ciH + 1e-6;
  const unitWord = unit === "MOA" ? "MOA" : "mil";
  const where = cls === "zero" ? "Zero" : cls === "truing" ? "True load" : cls === "level" ? "Check level" : cls === "mounts" ? "Check mounts" : cls === "tall" ? "Tall-target test" : "Windage at distance";
  const bits = [dial(snapV.correction, "U", "D"), dial(snapH.correction, "R", "L")].filter(Boolean).join(" ");
  const extra = [];
  if (showV || showH) extra.push(`residual ${[showV ? dial(snapV.residual, "U", "D") : "", showH ? dial(snapH.residual, "R", "L") : ""].filter(Boolean).join(" ")} ${unitWord} still outside the CI`);
  if (cls === "zero" && hScales) extra.push("horizontal grows with distance — check level, not applied");
  if (cold.length) extra.push(`${cold.length} cold-bore shot${cold.length === 1 ? "" : "s"} kept out`);
  const offer = mode === "apply" ? "Apply as dial change is available" : mode === "possible" ? "Save offset only" : mode === "truing" ? (opts.nearTransonic ? "Open truing, BC scale" : "Open truing, MV first") : "Report only";
  const text = [where, bits && `${bits} ${unitWord}`, `${shotN} shots`, stringIds.length > 1 ? `${stringIds.length} strings` : "", offer, ...extra].filter(Boolean).join(" · ");
  return {
    class: cls, mode, unit,
    v: snapV.correction, h: snapH.correction,
    clicks: { v: snapV.clicks, h: snapH.clicks },
    residual: { v: snapV.residual, h: snapH.residual },
    showResidual: showV || showH, followUp: false,
    ci: { v: ciV, h: ciH },
    shots: shotN, strings: stringIds.length, sourceStringIds: stringIds,
    distYd: cls === "zero" ? zeroYd : Math.max(...used.map(p => p.yd)),
    nearTransonic: !!(opts && opts.nearTransonic),
    what: cls === "truing" && opts && opts.nearTransonic ? "bc" : "mv",
    text,
  };
}

function dismissedStringIds(dismissed, rifleId, loadId) {
  const ids = new Set();
  for (const d of dismissed || []) {
    if (!d || d.reason === "reminder") continue;
    if (d.rifleId && rifleId && d.rifleId !== rifleId) continue;
    if (d.loadId && loadId && d.loadId !== loadId) continue;
    for (const id of d.sourceStringIds || []) ids.add(id);
  }
  return ids;
}

function collectPoints(sessions, rifleId, loadId, unit, skip) {
  const out = [];
  for (const sess of sessions || []) {
    if (!sess || sess.rifleId !== rifleId) continue;
    if (loadId && sess.loadId && sess.loadId !== loadId) continue;
    const tg = sess.tg;
    if (!tg) continue;
    for (const st of tg.strings || []) {
      if (!st || st.consumedByCorrection || skip.has(st.id)) continue;
      const tgt = (tg.targets || []).find(t => t.id === st.tid) || { dist: 0, du: "yd" };
      const yd = tgYd(tgt);
      const ipu = inPerU(unit, yd);
      if (!(yd > 0) || !(ipu > 0)) continue;
      for (const h of st.holes || []) {
        if (!h || !h.sh) continue;
        const sh = (sess.shots || []).find(s => s && s.id === h.sh);
        if (!sh || sh.x || sh.fl || sh.ie) continue;
        const p = hoff(st, h);
        out.push({ v: p.y / ipu, h: p.x / ipu, yd, stringId: st.id, date: sess.date || "", cold: !!sh.cold });
      }
    }
  }
  return out;
}

function evaluate(input) {
  const rifle = input && input.rifle;
  const spec = input && input.spec;
  if (!rifle || !spec) return null;
  const unit = spec.u === "MOA" ? "MOA" : "MIL";
  const loadId = input.load && input.load.id || "";
  const skip = dismissedStringIds(input.dismissed || rifle.dismissedSuggestions, rifle.id, loadId);
  const points = collectPoints(input.sessions, rifle.id, loadId, unit, skip);
  const hit = analyze(points, { spec: { ...spec, u: unit }, zeroYd: input.zeroYd, nearTransonic: input.nearTransonic });
  if (!hit) return null;
  const gone = (input.dismissed || rifle.dismissedSuggestions || []).some(d => d && d.reason === hit.class && d.rifleId === rifle.id
    && (!d.loadId || d.loadId === loadId) && hit.sourceStringIds.every(id => (d.sourceStringIds || []).includes(id)));
  return gone ? null : hit;
}

function zeroReminder(rifle, now) {
  if (!rifle) return null;
  const t = typeof now === "number" ? now : Date.now();
  if (rifle.zeroUnconf) return { kind: "unconf" };
  const at = rifle.lastZeroConfirm && Date.parse(rifle.lastZeroConfirm.at);
  if (!at || t - at < REMIND_MS) return null;
  const snooze = (rifle.dismissedSuggestions || []).filter(d => d && d.reason === "reminder").map(d => Date.parse(d.at)).filter(x => isFinite(x) && x <= t).sort((a, b) => b - a)[0];
  if (snooze && t - snooze < REMIND_MS) return null;
  return { kind: "stale" };
}

function activeStack(rifle, load, opts) {
  const displayUnit = opts && opts.displayUnit === "MOA" ? "MOA" : "MIL";
  const configOn = !!(opts && opts.configOn);
  const take = (list, type) => (list || []).filter(o => o && o.type === type && o.status === "active");
  const layers = [
    ...take(rifle && rifle.offsets, "zero"),
    ...(configOn ? take(rifle && rifle.offsets, "config") : []),
    ...take(load && load.offsets, "load"),
    ...take(rifle && rifle.offsets, "truing"),
    ...take(load && load.offsets, "truing"),
  ];
  let v = 0, h = 0;
  const parts = [];
  const name = { zero: "Zero", config: "Config", load: "Load", truing: "Truing" };
  for (const o of layers) {
    const vv = toUnit(+o.v || 0, o.unit === "MOA" ? "MOA" : "MIL", displayUnit);
    const hh = toUnit(+o.h || 0, o.unit === "MOA" ? "MOA" : "MIL", displayUnit);
    v += vv; h += hh;
    const bit = [name[o.type] || o.type, dial(vv, "U", "D"), dial(hh, "R", "L")].filter(Boolean).join(" ");
    if (bit) parts.push(bit);
  }
  const line = parts.length ? `${parts.join(" · ")} ${displayUnit === "MOA" ? "MOA" : "mil"}` : "";
  return { layers, sum: { v, h, unit: displayUnit }, line };
}

function rebaseOffsets(list, deltaV, deltaH, unit) {
  return (list || []).map(o => {
    if (!o || o.status !== "active" || o.type === "zero") return o;
    const from = unit === "MOA" ? "MOA" : "MIL";
    const to = o.unit === "MOA" ? "MOA" : "MIL";
    return { ...o, v: (+o.v || 0) - toUnit(deltaV, from, to), h: (+o.h || 0) - toUnit(deltaH, from, to) };
  });
}

function cleanOffsetList(list, allowed) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const o of list) {
    if (!o || typeof o !== "object" || !allowed.includes(o.type)) continue;
    if (o.status !== "active" && o.status !== "cleared") continue;
    const v = Number(o.v), h = Number(o.h);
    if (!isFinite(v) || !isFinite(h)) continue;
    const item = {
      id: String(o.id || "").slice(0, 40), type: o.type, v, h, unit: o.unit === "MOA" ? "MOA" : "MIL",
      date: String(o.date || "").slice(0, 40), distYd: Number(o.distYd) || 0, shots: Number(o.shots) || 0, status: o.status,
    };
    if (!item.id) continue;
    if (o.ci && isFinite(+o.ci.v) && isFinite(+o.ci.h)) item.ci = { v: +o.ci.v, h: +o.ci.h };
    if (Array.isArray(o.sourceStringIds)) item.sourceStringIds = o.sourceStringIds.slice(0, 40).map(x => String(x).slice(0, 40));
    if (o.notes) item.notes = String(o.notes).slice(0, 200);
    if (o.config && typeof o.config === "object") item.config = { name: String(o.config.name || "").slice(0, 40) };
    out.push(item);
  }
  return out.length ? out : null;
}

function cleanZeroConfirm(z) {
  if (!z || typeof z !== "object" || !z.at) return null;
  const out = { at: String(z.at).slice(0, 40), distYd: Number(z.distYd) || 0 };
  if (z.source) out.source = String(z.source).slice(0, 40);
  return out;
}

function cleanDismissed(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const d of list) {
    if (!d || typeof d !== "object" || !d.at || !d.reason) continue;
    const item = {
      id: String(d.id || "").slice(0, 40), at: String(d.at).slice(0, 40),
      sourceStringIds: Array.isArray(d.sourceStringIds) ? d.sourceStringIds.slice(0, 40).map(x => String(x).slice(0, 40)) : [],
      rifleId: String(d.rifleId || "").slice(0, 40), loadId: String(d.loadId || "").slice(0, 40),
      reason: String(d.reason).slice(0, 40),
    };
    if (item.id) out.push(item);
  }
  return out.length ? out : null;
}

let configOn = false;
function configActive() { return configOn; }
function setConfigActive(on) { configOn = !!on; }

export {
  MIN_MIL, MIN_MOA, REMIND_MS, T95, tCrit, axisStats, toUnit, snapAxis, analyze, evaluate, zeroReminder,
  activeStack, rebaseOffsets, cleanOffsetList, cleanZeroConfirm, cleanDismissed, configActive, setConfigActive,
  collectPoints,
};
