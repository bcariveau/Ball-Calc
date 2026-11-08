// beta/js/calc.js — Ballistics engine wrapper: engine loading (importFirst), solving (calculate, solveShot), turret specs, powder temp, angles, Miller stability; owns lastRun.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { bandPoints, bandsOn } from "./bulletdb.js";
import { $, fmt, importFirst, norm360, num, statusEl, val } from "./core.js";
import { noResult, renderAll } from "./dope.js";
import { ENGINE_URLS } from "./log.js";
import { curOptic, effSH } from "./optics.js";
import { LOAD_F, OPTIC_F, RIFLE_F, S, saveSettings } from "./storage.js";
import { refreshWeather } from "./weather.js";



/* ---------------- validation ---------------- */
const RULES = {
  bc: [0.01, 2, true, "BC is usually 0.1–1.0"], weight: [1, 1000, true], diameter: [0.1, 1, true, "e.g. 0.308"], mv: [300, 5000, true],
  length: [0, 3, false], barrel: [4, 40, false], refMV: [300, 5000, false], refBarrel: [4, 40, false], fpsPerInch: [0, 100, false], sightHeight: [0, 10, true], zero: [10, 3000, true], twist: [-40, 40, false],
  windSpeed: [0, 80, true], windDir: [0, 360, true], bearing: [0, 360, false], temp: [-40, 140, true], humidity: [0, 100, true],
  altitude: [-1500, 20000, true], pressure: [15, 32, false, "inHg, e.g. 29.92"], target: [10, 3000, false], maxRange: [50, 3000, true], step: [5, 1000, true],
  shotAngle: [-60, 60, false], rangeLat: [-90, 90, false], rangeLon: [-180, 180, false],
  ptSens: [-100, 100, false, "fps per 10°F, e.g. 15"], mvTemp: [-40, 160, false], powderTemp: [-40, 160, false], tipLen: [0, 1, false],
  zTemp: [-40, 140, false], zHum: [0, 100, false], zAlt: [-1500, 20000, false], zPress: [15, 32, false, "inHg, e.g. 29.92"], turretV: [0.001, 5, false],
  opTurretV: [0.001, 5, false], opMag: [1, 60, false], opTurn: [1, 60, false], opTravel: [1, 200, false], opCant: [0, 60, false], opUp: [0.1, 200, false], opSH: [0, 10, false], opWTravel: [1, 200, false], opTrack: [0.8, 1.2, false, "e.g. 1.02"]
};
function validate() {
  const bad = [];
  for (const [id, [lo, hi, req, tip]] of Object.entries(RULES)) {
    const raw = val(id), v = parseFloat(raw); let msg = "";
    if (raw === "") { if (req) msg = "Required"; }
    else if (isNaN(v)) msg = "Enter a number";
    else if (v < lo || v > hi) msg = `Must be ${lo}–${hi}` + (tip ? ` (${tip})` : "");
    if (id === "twist" && !msg && raw !== "" && v !== 0 && Math.abs(v) < 3) msg = "Twist is inches per turn, e.g. 8 or 10";
    if (id === "step" && !msg && num("maxRange") && num("maxRange") / v > 300) msg = "Too many rows — use a bigger step";
    $(id).classList.toggle("bad", !!msg); const e = $("e-" + id); if (e) e.textContent = msg;
    if (msg) bad.push(id);
  }
  if (!curOptic() && $("turret").value === "custom" && !(num("turretV") > 0) && !bad.includes("turretV")) { $("turretV").classList.add("bad"); $("e-turretV").textContent = "Required for a custom turret"; bad.push("turretV"); }
  if (curOptic() && $("opTurret").value === "custom" && !(num("opTurretV") > 0) && !bad.includes("opTurretV")) { $("opTurretV").classList.add("bad"); $("e-opTurretV").textContent = "Required for a custom turret"; bad.push("opTurretV"); }
  return bad;
}

/* ---------------- ballistics ---------------- */
let B = null;
let calcSeq = 0;
function entryRequired() {
  const o = curOptic();
  if (o) { const t = $("opTurret").value; if (t === "custom") return !(num("opTurretV") > 0); return !TURRETS[t]; }
  const t = $("turret").value;
  if (!t) return true;
  if (t === "custom") return !(num("turretV") > 0);
  return !TURRETS[t];
}
async function calculate() {
  if (!B) return;
  if (entryRequired()) {
    statusEl.textContent = "Enter a turret click value before calculating. Nothing was invented."; statusEl.classList.add("bad");
    if ($("rifleDetails")) $("rifleDetails").open = true;
    noResult();
    return;
  }
  const bad = validate();
  if (bad.length) {
    statusEl.textContent = `Fix ${bad.length} highlighted field${bad.length > 1 ? "s" : ""} to calculate.`; statusEl.classList.add("bad");
    noResult(bad);
    if (bad.some(f => RIFLE_F.includes(f))) $("rifleDetails").open = true;
    if (bad.some(f => OPTIC_F.includes(f) && f !== "opTurretV")) $("opMore").open = true;
    if (bad.some(f => /^z[A-Z]/.test(f))) $("zeroDetails").open = true;
    if (bad.some(f => LOAD_F.includes(f) && $("loadDetails").contains($(f)))) $("loadDetails").open = true;   // only a field under More ▾ opens it
    if (bad.some(f => f.startsWith("range"))) $("rangeDetails").open = true;
    return;
  }
  const seq = ++calcSeq;
  statusEl.classList.remove("bad"); statusEl.textContent = "Calculating…";
  const { UNew } = B;
  try {
    const twist = num("twist") || 0, length = num("length") || 0;
    // zero solved under the gun's zero conditions (if set), then fired with today's conditions + powder temp MV
    const sv = await solveShot(), { calc, shot } = sv;
    // Zero is found on the flat (look angle 0); then apply the up/down-hill angle for this shot.
    // With a look angle the library steps in horizontal distance, so scale by cos() to land on round line-of-sight ranges.
    const look = num("shotAngle") || 0, cosA = Math.cos(look * Math.PI / 180);
    if (look) shot.lookAngle = UNew.Degree(look);
    const runTo = (sh, to, st) => calc.fire({ shot: sh, trajectoryRange: UNew.Yard(to * cosA), trajectoryStep: UNew.Yard(st * cosA), raiseRangeError: false });
    const result = await runTo(shot, num("maxRange"), num("step"));
    const at = async (sh, d) => {   // one sample exactly at line-of-sight distance d
      const r2 = await calc.fire({ shot: sh, trajectoryRange: UNew.Yard(d * cosA), trajectoryStep: UNew.Yard(d * cosA), raiseRangeError: false });
      const last = r2.samples[r2.samples.length - 1];
      return last && Math.abs(last.distance.In(B.Distance.Yard) - d * cosA) < 1 ? last : null;
    };
    const withWind = w => sv.withWind(w, look);
    const WF = windAt(10, 90);   // 10 mph full value (from 3 o'clock)
    const sN = (await runTo(withWind([]), num("maxRange"), num("step"))).samples, sF = (await runTo(withWind(WF), num("maxRange"), num("step"))).samples;
    let tgt = null, tgtN = null, tgtW = null, tgtF = null; const td = num("target"), ws = num("windSpeed") || 0, wd = num("windDir") || 0;
    if (td) {
      tgt = await at(shot, td);
      if (tgt) { tgtN = await at(withWind([]), td); tgtW = await at(withWind(windAt(10, wd)), td); tgtF = await at(withWind(WF), td); }   // no wind / 10 mph same direction / 10 mph full value
    }
    // transonic: first range where velocity drops below Mach 1.2 of the local speed of sound
    const vT = 1.2 * shot.atmo.mach.In(B.Velocity.FPS), tEnd = Math.min(3000, Math.max(num("maxRange"), td || 0));
    const fine = (await runTo(withWind([]), tEnd, Math.max(5, Math.min(10, tEnd / 200)))).samples;
    let trans = null;
    for (let i = 0; i < fine.length; i++) { const v1 = fine[i].velocity.In(B.Velocity.FPS); if (v1 < vT) {
      const r1 = fine[i].distance.In(B.Distance.Yard) / cosA; if (!i) { trans = { range: 0, vel: v1 }; break; }
      const v0 = fine[i - 1].velocity.In(B.Velocity.FPS), r0 = fine[i - 1].distance.In(B.Distance.Yard) / cosA;
      trans = { range: Math.round(r0 + (r1 - r0) * (v0 - vT) / (v0 - v1)), vel: vT }; break; } }
    if (seq !== calcSeq) return;
    lastRun = { samples: result.samples, sN, sF, tgt, tgtN, tgtW, tgtF, td, look, ws, wd, vT, trans, mvNow: sv.mvNow, mvZero: sv.mvZero, Tp: sv.Tp, zc: sv.zc,
      sg: millerSG(sv.mvNow, { temp: num("temp"), press: num("pressure"), alt: num("altitude") }), aT: num("temp"), ctx: { calc, shot, at, withWind, windAt, cosA } };
    renderAll();
    statusEl.textContent = `Done — ${result.samples.length} points` + (result.error ? ` · bullet stopped early (${result.error.message || "out of range"})` : "") +
      (twist && !length ? " · add bullet length for spin drift + stability" : "");
    saveSettings();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error: " + (err.message || err); statusEl.classList.add("bad"); noResult();
  }
}
let lastRun = null;

function pointVals(p) {
  const { Distance, Velocity, Angular } = B; const A = S.ang === "MIL" ? Angular.MRad : Angular.MOA;
  return {
    range: Math.round(p.distance.In(Distance.Yard) / Math.cos((lastRun?.look || 0) * Math.PI / 180)) || 0, drop: p.slantHeight.In(Distance.Inch), drift: p.windage.In(Distance.Inch),
    elev: -p.dropAngle.In(A), wind: -p.windageAngle.In(A), vel: p.velocity.In(Velocity.FPS), energy: p.energy.footPound, tof: p.time
  };
}
function windHoldAt(spd) {   // windage (angle, display unit) at the target for a given wind speed, same direction
  const R = lastRun; if (!R?.tgtN || !R?.tgtW) return null;
  const n = pointVals(R.tgtN).wind, w10 = pointVals(R.tgtW).wind; return n + (w10 - n) * spd / 10;
}

/* ---------------- Phase B: powder temp, zero conditions, turret clicks, stability, truing, dope card ---------------- */
function powderT() { const p = num("powderTemp"); return p != null ? p : num("temp"); }
function mvAdjust(mv, sens, t0, Tp) { return isFinite(mv) && isFinite(sens) && sens && isFinite(t0) && isFinite(Tp) ? mv + sens / 10 * (Tp - t0) : (isFinite(mv) ? mv : null); }
function mvAdjOn() { return !!num("ptSens") && num("mvTemp") != null && powderT() != null; }
function mvAt(Tp, base) { return mvAdjust(base, num("ptSens"), num("mvTemp"), Tp); }
function chronoFrom(mvToday, Tp) { return mvAdjOn() ? mvToday - num("ptSens") / 10 * (Tp - num("mvTemp")) : mvToday; }
function curCond() { return { temp: num("temp"), hum: num("humidity"), alt: num("altitude"), press: num("pressure") }; }
function zeroCond(c0) {   // null = zero in today's conditions (or the given ones)
  const c = c0 || curCond(), zt = num("zTemp"), zp = num("zPress"), za = num("zAlt"), zh = num("zHum");
  if (zt == null && zp == null && za == null && zh == null) return null;
  return { temp: zt ?? c.temp, hum: zh ?? c.hum, alt: za ?? c.alt, press: zp != null ? zp : za != null ? null : c.press };
}
function mkAtmo(c) {
  const { UNew } = B, o = { altitude: UNew.Foot(c.alt ?? 0), temperature: UNew.Fahrenheit(c.temp ?? 59), humidity: (c.hum ?? 0) / 100 };
  if (c.press != null) o.pressure = UNew.InHg(c.press);
  return new B.Atmo(o);
}
// UI: 0° = wind from the target (headwind), 90° = from shooter's right.
// js-ballistics: 0° = wind from behind (tailwind), 90° = from shooter's left. So add 180°.
function windAt(ws, dir) { return ws > 0 ? [new B.Wind({ velocity: B.UNew.MPH(ws), directionFrom: B.UNew.Degree(norm360(dir + 180)) })] : []; }
// zeroed shot: o.mv = MV at today's powder temp (truing), o.bcScale, o.winds
function loadNum(L, key) {
  if (!L || L[key] == null || String(L[key]).trim() === "") return null;
  const n = parseFloat(L[key]);
  return isFinite(n) ? n : null;
}
async function solveShot(o = {}) {
  if (!o.allowBlank && entryRequired()) throw new Error("Enter a turret click value before calculating. Nothing was invented.");
  const { Calculator, Shot, Weapon, Ammo, DragModel, DragTables, UNew } = B;
  const L = o.load && typeof o.load === "object" ? o.load : null;
  const twist = o.twist != null ? o.twist : (num("twist") || 0), length = loadNum(L, "length") != null ? loadNum(L, "length") : (num("length") || 0), k = o.bcScale || 1;
  const bc = loadNum(L, "bc") != null ? loadNum(L, "bc") : num("bc");
  const weight = loadNum(L, "weight") != null ? loadNum(L, "weight") : num("weight");
  const diameter = loadNum(L, "diameter") != null ? loadNum(L, "diameter") : num("diameter");
  const drag = L && L.drag ? (/g1/i.test(L.drag) ? "G1" : "G7") : $("drag").value;
  const pts = L ? null : (bandsOn() ? bandPoints() : null);
  const dm = pts ? B.DragModelMultiBC({ bcPoints: pts.map(p => new B.BCPoint({ BC: p.bc * k, V: UNew.FPS(p.v) })), dragTable: DragTables.G1,
      weight: UNew.Grain(weight), diameter: UNew.Inch(diameter), length: UNew.Inch(length) })
    : new DragModel({ bc: bc * k, dragTable: drag === "G1" ? DragTables.G1 : DragTables.G7,
      weight: UNew.Grain(weight), diameter: UNew.Inch(diameter), length: UNew.Inch(length) });
  const Tp = o.Tp != null ? o.Tp : powderT(), zc = zeroCond(o.cond);
  const sens = L ? loadNum(L, "ptSens") : num("ptSens"), t0 = L ? loadNum(L, "mvTemp") : num("mvTemp");
  const recordedMv = loadNum(L, "mv");
  const base = o.mv != null ? (sens && t0 != null && Tp != null ? o.mv - sens / 10 * (Tp - t0) : o.mv) : (recordedMv != null ? recordedMv : num("mv"));
  const mvNow = mvAdjust(base, sens, t0, Tp), mvZero = zc ? mvAdjust(base, sens, t0, num("zTemp") ?? Tp) : mvNow;
  const sh = o.sh != null && o.sh > 0 ? o.sh : effSH();
  const weapon = new Weapon({ sightHeight: UNew.Inch(sh), ...(twist ? { twist: UNew.Inch(twist) } : {}) });
  const atmo = mkAtmo(o.cond || curCond()), calc = new Calculator();
  const zShot = new Shot({ weapon, ammo: new Ammo({ dm, mv: UNew.FPS(mvZero) }), atmo: zc ? mkAtmo(zc) : atmo });
  await calc.setWeaponZero(zShot, UNew.Yard(o.zero != null ? o.zero : num("zero")));
  const ammo = new Ammo({ dm, mv: UNew.FPS(mvNow) });
  const shot = new Shot({ weapon, ammo, atmo, winds: o.winds ?? windAt(num("windSpeed"), num("windDir")) });
  const withWind = (w, look) => { const s2 = new Shot({ weapon, ammo, atmo, winds: w }); if (look) s2.lookAngle = UNew.Degree(look); return s2; };
  return { calc, shot, mvNow, mvZero, zc, Tp, withWind };
}
// turret: click value + unit, independent of the display unit
const TURRETS = { "0.1mil": ["MIL", 0.1, "0.1 mil"], "0.05mil": ["MIL", 0.05, "0.05 mil"], "0.25moa": ["MOA", 0.25, "¼ MOA"], "0.125moa": ["MOA", 0.125, "⅛ MOA"], "0.5moa": ["MOA", 0.5, "½ MOA"] };
function turretSpec() {   // the attached optic wins; otherwise the gun's own turret (always set; no display-unit fallback)
  const o = curOptic(); let s = null;
  if (o) {
    const t = $("opTurret").value, ret = $("opReticle").value === "moa" ? "MOA" : "MIL";
    if (t === "custom") { const v = num("opTurretV"), u = $("opTurretU").value === "moa" ? "MOA" : "MIL"; if (v > 0) s = { u, v, lbl: `${fmt(v, 3)} ${u === "MIL" ? "mil" : "MOA"}` }; }
    else if (TURRETS[t]) { const [u, v, lbl] = TURRETS[t]; s = { u, v, lbl }; }
    if (!s) return { u: ret, v: null, lbl: "no click value", k: 1, optic: o, perTurn: null, cpt: 0, up: null, upSet: false, sfp: null, missing: true };
    const tk = num("opTrack"); s.k = tk >= 0.8 && tk <= 1.2 ? tk : 1; s.optic = o;
    s.perTurn = num("opTurn") > 0 ? num("opTurn") : null; s.cpt = s.perTurn ? Math.round(s.perTurn / s.v) : 0;
    const tr = num("opTravel"), cant = num("opCant") || 0, cantT = s.u === "MIL" ? cant / 3.437747 : cant;
    const upF = num("opUp"); s.upSet = upF > 0;   // measured "up travel from zero" overrides the estimate
    s.up = s.upSet ? upF : tr > 0 ? Math.min(tr, tr / 2 + cantT) : null;   // ASSUMPTION: zero near the optical center on a flat base → half the travel is up; a canted base adds its MOA
    s.sfp = $("opFP").value === "SFP" && num("opMag") > 0 ? num("opMag") : null;
    return s;
  }
  const t = $("turret").value;
  if (t === "custom") { const v = num("turretV"), u = $("turretU").value === "moa" ? "MOA" : "MIL"; if (v > 0) s = { u, v, lbl: `${fmt(v, 3)} ${u === "MIL" ? "mil" : "MOA"}` }; }
  if (!s && TURRETS[t]) { const [u, v, lbl] = TURRETS[t]; s = { u, v, lbl }; }
  if (!s) return { u: "", v: null, lbl: "no click value", k: 1, up: null, sfp: null, cpt: 0, perTurn: null, optic: null, missing: true };
  return Object.assign(s, { k: 1, up: null, sfp: null, cpt: 0, perTurn: null, optic: null });
}
const MOA_PER_MIL = 3.437747;
function angs(p, ts) {   // dial angles in the display unit. A passed turret is the recorded or chosen one; live dope omits it and reads the form.
  const A = B.Angular;
  ts = ts || turretSpec();
  if (!(ts.v > 0)) throw new Error("Enter a turret click value before calculating. Nothing was invented.");
  const TU = ts.u === "MIL" ? A.MRad : A.MOA, DU = S.ang === "MIL" ? A.MRad : A.MOA, k = ts.k || 1;
  const eT = -p.dropAngle.In(TU) / k, ec = Math.round(eT / ts.v), wc = Math.round(-p.windageAngle.In(TU) / ts.v);
  let e = -p.dropAngle.In(DU) / k, w = -p.windageAngle.In(DU);
  if (S.round) { const c = ts.u === S.ang ? 1 : S.ang === "MOA" ? MOA_PER_MIL : 1 / MOA_PER_MIL; e = ec * ts.v * c; w = wc * ts.v * c; }
  return { e, w, ec, wc, eT };
}
function angDec(ts) { if (!S.round) return 1; const k = ts.u === S.ang ? 1 : 0; return k && Math.abs(ts.v * 10 - Math.round(ts.v * 10)) < 1e-9 ? 1 : 2; }
function clkTxt(n, pos, neg) { return n === 0 ? "0 clicks" : `${n > 0 ? pos : neg} ${Math.abs(n)} click${Math.abs(n) === 1 ? "" : "s"}`; }
function clkShort(n, pos, neg) { return n === 0 ? "0" : `${n > 0 ? pos : neg}${Math.abs(n)}`; }
function perMph(n, f) {   // full-value wind per 1 mph in the display unit (from the 10 mph run)
  if (!n || !f) return null; const A = S.ang === "MIL" ? B.Angular.MRad : B.Angular.MOA;
  return Math.abs(f.windageAngle.In(A) - n.windageAngle.In(A)) / 10;
}
// Miller twist rule with velocity + temperature/pressure corrections; Courtney–Miller plastic-tip form when tipped
const TIPPED = /\b(eld(-?[mxv]t?)?|v-?max|a-?tip|sst|ballistic tip|nbt|ttsx|tipped|tmk|accubond|ftx|polymer tip)\b/i;
function millerSG(mv, c) {
  const m = num("weight"), d = num("diameter"), L = num("length"), tw = Math.abs(num("twist") || 0);
  if (!tw) return { none: "twist" }; if (!L) return { none: "length" }; if (!m || !d || !mv) return { none: "bullet" };
  let tip = num("tipLen"), assumed = false;
  if (tip == null && TIPPED.test(val("bulletName"))) { tip = +(0.45 * d).toFixed(3); assumed = true; }
  tip = Math.max(0, Math.min(tip || 0, L * 0.4));
  const t = tw / d, l = L / d, lm = (L - tip) / d;
  const T = c.temp ?? 59, P = c.press ?? 29.92 * Math.pow(1 - 6.8753e-6 * (c.alt || 0), 5.2559);
  const sg = 30 * m / (t * t * d * d * d * l * (1 + lm * lm)) * Math.cbrt(mv / 2800) * ((T + 460) / 519) * (29.92 / P);
  return { sg, tip, assumed };
}

// cross-module writers (imports are read-only)
function set_lastRun(v) { return lastRun = v; }

export async function init() {
  refreshWeather();
  try {
    B = await importFirst(ENGINE_URLS);
    statusEl.textContent = "Ready";
    calculate();
  } catch (e) {
    console.error(e);
    statusEl.textContent = navigator.onLine === false ? "Offline and the ballistics engine isn't saved on this device yet. Open the app once while online, then it works offline." : "Couldn't load the ballistics engine. Check your connection and reload."; statusEl.classList.add("bad");
  }
}

export { RULES, validate, B, calcSeq, calculate, entryRequired, lastRun, pointVals, windHoldAt, powderT, mvAdjust, mvAdjOn, mvAt, chronoFrom, curCond, zeroCond, mkAtmo, windAt, solveShot, TURRETS, turretSpec, MOA_PER_MIL, angs, angDec, clkTxt, clkShort, perMph, TIPPED, millerSG, set_lastRun };
