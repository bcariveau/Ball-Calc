// beta/js/holdover.js — bore fit and reticle holdover. Pure data: no DOM, no storage.
// Bore matching uses the same rule as recipes.js: |d1 − d2| < 0.0015 in.

const MOA_PER_MIL = 3.437747;

function fnum(v) { const x = parseFloat(v); return Number.isFinite(x) ? x : null; }
function dia3(d) { const x = fnum(d); return x == null ? "" : x.toFixed(3).replace(/^0/, "") + '"'; }

function validDia(load) {
  const x = fnum(load && load.diameter);
  return x != null && x > 0 ? x : null;
}
function gunDias(loads) {
  return [...new Set((loads || []).map(validDia).filter(x => x != null).map(x => x.toFixed(3)))];
}

// Reference is the current load's diameter when that is valid. Otherwise the most
// common valid diameter on the gun. A tie, or no valid diameter, is no reference.
function sizeRef(gun) {
  if (!gun) return { kind: "unknown", dia: null };
  const loads = gun.loads || [];
  const cur = loads.find(l => l.id === gun.lastLoadId);
  const curD = validDia(cur);
  if (curD != null) return { kind: "known", dia: curD, from: "current" };
  const counts = [];
  for (const l of loads) {
    const x = validDia(l);
    if (x == null) continue;
    const hit = counts.find(c => Math.abs(c.dia - x) < 0.0015);
    if (hit) hit.n++;
    else counts.push({ dia: x, n: 1 });
  }
  if (!counts.length) return { kind: "unknown", dia: null };
  counts.sort((a, b) => b.n - a.n);
  if (counts.length > 1 && counts[0].n === counts[1].n) return { kind: "unknown", dia: null, tie: true };
  return { kind: "known", dia: counts[0].dia, from: "common" };
}
function sizeWarn(ref, load) {
  const x = validDia(load);
  if (!ref || ref.kind !== "known" || x == null) return false;
  return Math.abs(x - ref.dia) >= 0.0015;
}
function loadFit(load, ref) {
  const x = validDia(load);
  if (!ref || ref.kind !== "known") return x == null ? "unknown" : "neutral";
  if (x == null) return "unknown";
  return Math.abs(x - ref.dia) >= 0.0015 ? "wrong" : "fit";
}

const CALIBERS = [
  [0.172, ".17"], [0.204, ".204"], [0.224, ".223"], [0.243, "6mm"], [0.264, "6.5mm"],
  [0.277, ".270"], [0.284, "7mm"], [0.308, ".308"], [0.311, "7.62"], [0.323, "8mm"], [0.338, ".338"], [0.375, ".375"],
];
function caliberName(dia) {
  const x = fnum(dia); if (x == null) return "";
  const hit = CALIBERS.find(([d]) => Math.abs(d - x) < 0.0015);
  return hit ? hit[1] : "";
}

function ordinal(i) {
  const v = i % 100;
  const suf = v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][i % 10] || "th";
  return i + suf;
}
function hashMarks(spacing, count) {
  const s = fnum(spacing), n = Math.max(0, Math.floor(fnum(count) || 0));
  if (!(s > 0) || !n) return [];
  const out = [];
  for (let i = 1; i <= n && i <= 40; i++) out.push({ label: ordinal(i) + " hash", subtension: +(s * i).toFixed(4) });
  return out;
}

function toUnit(value, from, to) {
  const v = fnum(value); if (v == null) return null;
  const a = from === "MIL" ? "MIL" : "MOA", b = to === "MIL" ? "MIL" : "MOA";
  if (a === b) return v;
  return a === "MOA" ? v / MOA_PER_MIL : v * MOA_PER_MIL;
}

function scaleFactor(opts) {
  if (!opts || opts.fixed) return 1;
  if (opts.fp !== "SFP") return 1;
  const c = fnum(opts.calibratedMag), m = fnum(opts.currentMag);
  if (!(c > 0) || !(m > 0)) return 1;
  return c / m;
}

function textToMarks(text) {
  return String(text || "").split(/\n/).map(line => line.trim()).filter(Boolean).slice(0, 24).map(line => {
    const [label, sub, dist] = line.split("|").map(s => (s || "").trim());
    const o = { label: (label || "").slice(0, 40) };
    const s = fnum(sub); if (s != null) o.subtension = s;
    const d = fnum(dist); if (d != null) o.distYd = d;
    return o;
  }).filter(m => m.label || m.subtension != null || m.distYd != null);
}
function marksToText(marks) {
  return (marks || []).map(m => [m.label || "", m.subtension ?? "", m.distYd ?? ""].join(" | ")).join("\n");
}

// Sig Tango-MSR owner's manual, Hellfire FL-6, MOA at maximum magnification. No yardages are published with these values.
const FL6_MARKS = [
  { label: "1st hash", subtension: 3.13 },
  { label: "2nd hash", subtension: 5.95 },
  { label: "3rd hash", subtension: 9.37 },
  { label: "4th hash", subtension: 13.48 },
];

function formToHoldover(f) {
  if (!f || !f.mode || f.mode === "none") return null;
  const mode = f.mode;
  const unit = f.unit === "MIL" ? "MIL" : "MOA";
  const typed = textToMarks(f.marksText);
  const ho = { mode, unit };
  if (mode === "hash") {
    const spacing = fnum(f.spacing), count = fnum(f.count);
    if (spacing != null) ho.spacing = spacing;
    if (count != null) ho.count = count;
    if (typed.length) ho.marks = typed;
  } else if (typed.length) ho.marks = typed;
  const cal = fnum(f.calMag);
  if (cal != null) ho.calibratedMag = cal;
  if (mode === "acss" || mode === "cds" || mode === "bdc") {
    const ref = {};
    if (f.loadId) ref.loadId = String(f.loadId).slice(0, 40);
    if (f.cartridge) ref.cartridge = String(f.cartridge).slice(0, 60);
    if (f.bullet) ref.bullet = String(f.bullet).slice(0, 80);
    const mv = fnum(f.mv); if (mv != null) ref.mv = mv;
    const zero = fnum(f.zeroYd); if (zero != null) ref.zeroYd = zero;
    if (mode === "cds") { const sh = fnum(f.sightHeight); if (sh != null) ref.sightHeight = sh; }
    if (f.notes) ref.notes = String(f.notes).slice(0, 200);
    if (Object.keys(ref).length) ho.bdcRef = ref;
  }
  if (mode === "acss") {
    if (f.stadia) ho.rangeStadia = String(f.stadia).slice(0, 120);
    if (f.wind) ho.windDots = String(f.wind).slice(0, 120);
  }
  return ho;
}

function holdMarks(hold, opts) {
  const scale = scaleFactor({ fp: opts && opts.fp, fixed: opts && opts.fixed, calibratedMag: hold.calibratedMag, currentMag: opts && opts.currentMag });
  const raw = hold.marks && hold.marks.length ? hold.marks : (hold.mode === "hash" ? hashMarks(hold.spacing, hold.count) : []);
  return raw.map(mk => {
    const cat = fnum(mk.subtension);
    return { label: mk.label || "", distYd: fnum(mk.distYd), catalog: cat, subtension: cat == null ? null : cat * scale };
  });
}

function fmtN(n) { return (Math.round(n * 100) / 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, ""); }

function holdText(hold, opts) {
  if (!hold || !hold.mode || hold.mode === "none") return null;
  const unit = hold.unit === "MIL" ? "MIL" : "MOA";
  const required = toUnit(opts && opts.required, (opts && opts.requiredUnit) || unit, unit);
  if (hold.mode === "cds") {
    const yd = fnum(opts && opts.distance);
    const marks = hold.marks || [];
    let best = null;
    marks.forEach(mk => {
      const d = fnum(mk.distYd); if (d == null || yd == null) return;
      const ad = Math.abs(d - yd);
      if (!best || ad < best.ad) best = { mark: mk, ad };
    });
    const yard = best ? fnum(best.mark.distYd) : yd;
    if (yard == null) return null;
    let text = `Dial to ${yard} yd, aim center`;
    let residual = null;
    const built = best && fnum(best.mark.subtension);
    if (built != null && required != null) {
      residual = required - built;
      if (Math.abs(residual) >= 0.005) text += `, ${fmtN(Math.abs(residual))} ${unit} ${residual > 0 ? "low" : "high"}`;
    }
    return { text, residual, mark: best && best.mark, unit };
  }
  const marks = holdMarks(hold, opts).filter(m => m.subtension != null);
  if (!marks.length || required == null) return null;
  let best = null;
  marks.forEach(mk => {
    const residual = mk.subtension - required;
    const ad = Math.abs(residual);
    if (!best || ad < best.ad) best = { mark: mk, residual, ad };
  });
  const side = Math.abs(best.residual) < 0.005 ? "on" : best.residual > 0 ? "high" : "low";
  const shown = fmtN(best.mark.subtension);
  const text = side === "on"
    ? `Hold ${best.mark.label} (${shown} ${unit})`
    : `Hold ${best.mark.label} (${shown} ${unit}), ${fmtN(Math.abs(best.residual))} ${unit} ${side}`;
  return { text, residual: best.residual, mark: best.mark, unit, scale: scaleFactor(opts) };
}

function sameHold(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }

export {
  MOA_PER_MIL, fnum, dia3, gunDias, validDia, sizeRef, sizeWarn, loadFit, caliberName, hashMarks, toUnit, scaleFactor,
  textToMarks, marksToText, FL6_MARKS, formToHoldover, holdMarks, holdText, sameHold,
};
