// beta/js/dope-card.js — Printable dope card view.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { B, lastRun, mvAdjOn, solveShot, turretSpec, validate, windAt } from "./calc.js";
import { closeOvl, openOvl, toast } from "./components.js";
import { $, escapeHtml, fmt, num, setVal, val } from "./core.js";
import { curLoad, curRifle } from "./gear.js";
import { effSH } from "./optics.js";
import { S } from "./storage.js";

/* printable dope card */
var DCV = { step: "50", size: "wrist", angle: "flat" };
function dcvPaint() { [["dcvStep", "step"], ["dcvSize", "size"], ["dcvAng", "angle"]].forEach(([id, k]) => $(id).querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === DCV[k]))); $("dcPrint").className = DCV.size; }
function openDopeCard() {
  if (!B || !lastRun) { toast("Fix the inputs so a solution shows first"); return; }
  if (!val("dcvMax")) setVal("dcvMax", Math.max(num("maxRange") || 1000, num("target") || 0));
  const lk = num("shotAngle") || 0; DCV.angle = "flat"; $("dcvKeep").textContent = `Keep ${fmt(lk, 0)}°`; $("dcvKeep").disabled = !lk;
  dcvPaint(); openOvl("dcView"); return renderDopeCard();
}
async function renderDopeCard() {
  const el = $("dcPrint"), st = +DCV.step, max = Math.min(3000, Math.max(st, num("dcvMax") || 1000));
  if (!B || validate().length) { el.textContent = "Fix the highlighted fields first."; return; }
  const lkNow = num("shotAngle") || 0, look = DCV.angle === "keep" ? lkNow : 0;   // prints flat (0°) unless "Keep" is chosen
  const sv = await solveShot({ winds: [] }), cosA = Math.cos(look * Math.PI / 180), { UNew } = B;
  if (look) sv.shot.lookAngle = UNew.Degree(look);
  const run = sh => sv.calc.fire({ shot: sh, trajectoryRange: UNew.Yard(max * cosA), trajectoryStep: UNew.Yard(st * cosA), raiseRangeError: false }).then(r => r.samples);
  const sN = await run(sv.shot), sF = await run(sv.withWind(windAt(10, 90), look));
  const ts = turretSpec(), u = S.ang, A = B.Angular, DU = u === "MIL" ? A.MRad : A.MOA, TU = ts.u === "MIL" ? A.MRad : A.MOA, vT = 1.2 * sv.shot.atmo.mach.In(B.Velocity.FPS), k = ts.k || 1, sd = u === "MIL" ? 2 : 1;
  const r = curRifle(), l = curLoad(), zc = sv.zc, p = num("pressure");
  const cond = `${val("temp")}°F · ${p != null ? p.toFixed(2) + " inHg" : (val("altitude") || 0) + " ft std"} · ${val("humidity")}% RH · ${look ? `${fmt(look, 0)}° angle` : "flat (0°)"}`;
  const ck = n => !ts.cpt || !n ? String(n) : `${Math.floor(Math.abs(n) / ts.cpt)}+${Math.abs(n) % ts.cpt}`;
  let rows = "", anyOver = false;
  sN.forEach((q, i) => {
    const range = Math.round(q.distance.In(B.Distance.Yard) / cosA); if (range < st / 2) return;
    const e = -q.dropAngle.In(DU) / k, eT = -q.dropAngle.In(TU) / k, ec = Math.round(eT / ts.v), f = sF[i], ov = ts.up != null && eT > ts.up + 1e-9; anyOver = anyOver || ov;
    const w = f ? Math.abs(f.windageAngle.In(DU) - q.windageAngle.In(DU)) : null, wc = f ? Math.round(Math.abs(f.windageAngle.In(TU) - q.windageAngle.In(TU)) / ts.v) : null;
    const s = -q.windageAngle.In(DU), vel = q.velocity.In(B.Velocity.FPS);
    rows += `<tr class="${vel < vT ? "trans" : ""}"><td class="r">${range}</td><td${ov ? ' class="ovr"' : ""}>${(Math.abs(e) < 0.05 ? 0 : e).toFixed(1)}</td><td>${ck(ec)}</td><td>${w != null ? w.toFixed(1) : "—"}</td><td>${wc ?? "—"}</td><td>${Math.abs(s) < 0.005 ? "0" : (s > 0 ? "R " : "L ") + Math.abs(s).toFixed(sd)}</td><td>${Math.round(vel)}</td></tr>`;
  });
  const o = ts.optic;
  el.innerHTML = `${look ? `<div class="ang">${look > 0 ? "▲ UPHILL" : "▼ DOWNHILL"} ${fmt(Math.abs(look), 0)}°</div>` : ""}<div class="hd"><b>${escapeHtml(r?.name || "Gun")} · ${escapeHtml(l?.name || "Load")}</b><br>${escapeHtml(val("bulletName") || `${val("weight")} gr`)} · BC ${escapeHtml(val("bc"))} ${$("drag").value} · MV ${Math.round(sv.mvNow)} fps${mvAdjOn() ? ` @ ${fmt(sv.Tp, 0)}°F` : ""}<br>
    Zero ${val("zero")} yd${zc ? ` @ ${fmt(zc.temp, 0)}°F` : ""} · SH ${fmt(effSH(), 2)}" · turret ${escapeHtml(ts.lbl)}${o ? ` · ${escapeHtml(o.name)}` : ""}${ts.sfp ? ` · SFP holds true at ${fmt(ts.sfp, 1)}×` : ""}${k !== 1 ? ` · tracking ×${fmt(k, 3)}` : ""}<br>${escapeHtml(cond)} · ${escapeHtml(new Date().toLocaleDateString())}</div>
    <table><thead><tr><th>Yd</th><th>Elev ${u}</th><th>Clk</th><th>10 mph ${u}</th><th>Clk</th><th>Spin ${u}</th><th>fps</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="ft">Elev = dial up${ts.cpt ? ` (Clk 1+23 = 1 turn + 23)` : ""}. 10 mph = full-value crosswind hold (no spin drift). Spin = spin-drift correction to add. Clk = ${escapeHtml(ts.lbl)} clicks. Shaded = transonic (&lt;${Math.round(vT)} fps).${anyOver ? ` Underlined = beyond ${ts.upSet ? "" : "~"}${fmt(ts.up, 1)} up travel.` : ""}</div>`;
}

export function init() {
  $("dcvStep").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; DCV.step = b.dataset.v; dcvPaint(); renderDopeCard(); });
  $("dcvSize").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; DCV.size = b.dataset.v; dcvPaint(); });
  $("dcvAng").addEventListener("click", e => { const b = e.target.closest("button"); if (!b || b.disabled) return; DCV.angle = b.dataset.v; dcvPaint(); renderDopeCard(); });
  $("dcvMax").addEventListener("change", () => renderDopeCard());
  $("dcBtn").onclick = () => openDopeCard();
  $("dcvClose").onclick = () => closeOvl("dcView");
  $("dcvPrint").onclick = () => window.print();
}

export { DCV, dcvPaint, openDopeCard, renderDopeCard };
