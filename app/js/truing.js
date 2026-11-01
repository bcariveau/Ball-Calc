// app/js/truing.js — Muzzle-velocity truing sheet (true to an observed drop).
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { renderBulletInfo } from "./bulletdb.js";
import { B, chronoFrom, lastRun, powderT, solveShot, validate } from "./calc.js";
import { closeOvl, openOvl, toast } from "./components.js";
import { $, fmt, num, setVal, val } from "./core.js";
import { curLoad, updateDirty } from "./gear.js";
import { S } from "./storage.js";

var TR = { unit: "MIL", what: "mv", res: null };
function trPaint() { [["trUnit", "unit"], ["trWhat", "what"]].forEach(([id, k]) => $(id).querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === TR[k]))); }
function openTrue() {
  if (!B || !lastRun) { toast("Fix the inputs so a solution shows first"); return; }
  if (!curLoad()) { toast("Pick or save a load first (Gear tab)"); return; }
  TR.cond = null; TR.unit = S.ang; if (!val("trRange")) setVal("trRange", num("target") || 600); setVal("trAngle", 0);
  $("trFor").textContent = `${curLoad().name} · MV ${Math.round(lastRun.mvNow)} fps today · BC ${val("bc")} ${$("drag").value} · ${val("temp")}°F`;
  $("trOut").textContent = ""; $("trSave").disabled = true; TR.res = null; trPaint(); openOvl("trSheet");
}
async function predAt(d, o) {
  const sv = await solveShot({ ...(TR.cond || {}), ...o, winds: [] }), look = TR.look || 0, cosA = Math.cos(look * Math.PI / 180);
  if (look) sv.shot.lookAngle = B.UNew.Degree(look);
  const r = await sv.calc.fire({ shot: sv.shot, trajectoryRange: B.UNew.Yard(d * cosA), trajectoryStep: B.UNew.Yard(d * cosA), raiseRangeError: false });
  const p = r.samples[r.samples.length - 1]; if (!p || Math.abs(p.distance.In(B.Distance.Yard) - d * cosA) > 1) return null;
  return { MIL: -p.dropAngle.In(B.Angular.MRad), MOA: -p.dropAngle.In(B.Angular.MOA), IN: -p.slantHeight.In(B.Distance.Inch), mv: sv.mvNow };
}
async function solveTrue() {
  const d = num("trRange"), obs = num("trObs"), out = $("trOut"); TR.look = Math.max(-60, Math.min(60, num("trAngle") || 0));
  $("e-trRange").textContent = d >= 50 && d <= 3000 ? "" : "50–3000 yd"; $("e-trObs").textContent = obs > 0 ? "" : "Enter what you observed";
  if (!(d >= 50 && d <= 3000) || !(obs > 0)) return null;
  if (validate().length) { out.innerHTML = `<span class="bad">Fix the highlighted fields first.</span>`; return null; }
  out.textContent = "Solving…"; $("trGo").disabled = true;
  try {
    const before = await predAt(d, {}); if (!before) { out.innerHTML = `<span class="bad">${d} yd is beyond this bullet's reach.</span>`; return null; }
    const mv0 = before.mv, isMV = TR.what === "mv";
    const f = async x => { const r = await predAt(d, isMV ? { mv: x } : { bcScale: x }); return r ? r[TR.unit] - obs : 1e9; };   // more MV / BC → less drop
    let lo = isMV ? mv0 * 0.7 : 0.5, hi = isMV ? mv0 * 1.3 : 1.6, it = 0;
    if (!(await f(lo) > 0 && await f(hi) < 0)) { out.innerHTML = `<span class="bad">That observation needs more than a ${isMV ? "±30% MV" : "0.5–1.6× BC"} change. Check the range and unit.</span>`; return null; }
    while (it++ < 40 && hi - lo > (isMV ? 0.2 : 0.0002)) { const mid = (lo + hi) / 2; (await f(mid)) > 0 ? lo = mid : hi = mid; }
    const x = (lo + hi) / 2, after = await predAt(d, isMV ? { mv: x } : { bcScale: x }), U = TR.unit === "IN" ? '"' : " " + TR.unit;
    TR.res = { what: TR.what, x, d, obs, unit: TR.unit, before: before[TR.unit], after: after[TR.unit], it, mv0, bc0: num("bc") };
    out.innerHTML = `Predicted ${before[TR.unit].toFixed(2)}${U} at ${d} yd (${fmt(TR.look, 0)}° shot angle), observed ${obs}${U}.<br>` + (isMV
      ? `<b>MV ${Math.round(mv0)} → ${Math.round(x)} fps</b> today (${x >= mv0 ? "+" : ""}${Math.round(x - mv0)} fps)`
      : `<b>BC × ${x.toFixed(3)}</b> → ${(num("bc") * x).toFixed(3)} ${$("drag").value}`) + ` · now predicts ${after[TR.unit].toFixed(2)}${U} (${it} iterations).`;
    $("trSave").disabled = false; return TR.res;
  } finally { $("trGo").disabled = false; }
}
function scaleBands(str, k) { return String(str || "").replace(/([\d.]+)@/g, (m, b) => (parseFloat(b) * k).toFixed(3) + "@"); }
function saveTrue() {
  const r = TR.res, l = curLoad(); if (!r || !l) return; const tpS = TR.cond && TR.cond.Tp != null ? TR.cond.Tp : powderT();
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), U = r.unit === "IN" ? '" low' : " " + r.unit;
  if (r.what === "mv") { setVal("mv", Math.round(chronoFrom(r.x, tpS))); $("mvSource").value = "trued"; }
  else { setVal("bc", (r.bc0 * r.x).toFixed(3)); if (val("bcBands")) $("bcBands").value = scaleBands(val("bcBands"), r.x); }
  $("trued").value = `Trued at ${r.d} yd on ${date}: ${r.what === "mv" ? `MV ${Math.round(r.x)} fps @ ${fmt(tpS, 0)}°F` : `BC ×${r.x.toFixed(3)}`} (observed ${r.obs}${U}${TR.look ? `, ${fmt(TR.look, 0)}° angle` : ""})`;
  updateDirty(); renderBulletInfo(); closeOvl("trSheet"); schedule(); toast(`Saved to “${l.name}” · ${$("trued").value}`);
}

export function init() {
  $("trUnit").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; TR.unit = b.dataset.v; TR.res = null; $("trSave").disabled = true; trPaint(); });
  $("trWhat").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; TR.what = b.dataset.v; TR.res = null; $("trSave").disabled = true; trPaint(); });
  $("trueBtn").onclick = openTrue;
  $("trClose").onclick = () => closeOvl("trSheet");
  $("trGo").onclick = () => solveTrue();
  $("trSave").onclick = saveTrue;
}

export { TR, trPaint, openTrue, predAt, solveTrue, scaleBands, saveTrue };
