// beta/js/optics.js — Optics: attach-an-optic sheet, units following the optic, zero prompt, hints.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { TURRETS, lastRun, turretSpec } from "./calc.js";
import { closeOvl, ctxPaint, openOvl, toast } from "./components.js";
import { $, escapeHtml, fmt, num, setVal, val } from "./core.js";
import { renderAll, renderCard } from "./dope.js";
import { applyRifle, askName, autosave, curRifle, flashSaved, formFor, pick, renderPickers, same, updateDirty } from "./gear.js";
import { F_DEF, OPTIC_F, P, S, savePresets, saveSettings, uid } from "./storage.js";
import { auto, manual, wx } from "./weather.js";



/* ---------------- round 2: optics, spin drift, gusts, table fit ---------------- */
function curOptic() { const r = curRifle(); return r && r.opticId ? (P.optics || []).find(o => o.id === r.opticId) || null : null; }
function effSH() { return curOptic() && num("opSH") != null ? num("opSH") : num("sightHeight"); }   // optic/mount first, gun field = fallback
var unitFollowed = null;
function paintSeg(id, key) { $(id).querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === S[key])); }
function followUnits(force) {   // the Dope MOA/MIL toggle only changes how numbers read; it defaults to the turret's unit whenever the gun,
  // optic or turret on screen changes (the toggle still works for the session). Clicks always use the turret unit.
  const r = curRifle(); if (!r) { unitFollowed = null; return; }
  const o = curOptic(), u = turretSpec().u, key = `${r.id}|${o ? o.id : ""}|${u}`;
  if (!force && unitFollowed === key) return; unitFollowed = key;
  if (S.ang !== u) { S.ang = u; paintSeg("angSeg", "ang"); saveSettings(); if (lastRun) renderAll(); }
}
// turret pickers (gun with no optic + optic): a MOA | MIL unit switch, then the click value for that unit
const TU_DEF = { mil: "0.1mil", moa: "0.25moa" };
const tuUnit = (sel, uSel) => { const v = $(sel).value; return v === "custom" ? ($(uSel).value === "moa" ? "moa" : "mil") : /moa/.test(v) ? "moa" : "mil"; };
function paintTurretPick(sel, uSel, seg) {
  const u = tuUnit(sel, uSel);
  [...$(sel).options].forEach(op => { const off = op.value !== "custom" && (/moa/.test(op.value) ? "moa" : "mil") !== u; op.hidden = off; op.disabled = off;
    if (op.value === "custom") op.textContent = `Custom ${u === "moa" ? "MOA" : "mil"} value…`; });
  $(seg).querySelectorAll("button").forEach(b => { const on = b.dataset.v === u; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}
function setTurretUnit(sel, uSel, seg, u) {
  if (tuUnit(sel, uSel) === u) return;
  if ($(sel).value === "custom") $(uSel).value = u; else $(sel).value = TU_DEF[u];
  paintTurretPick(sel, uSel, seg);
  const el = $(sel).value === "custom" ? $(uSel) : $(sel);
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
}
function paintTurrets() { paintTurretPick("turret", "turretU", "turretUSeg"); paintTurretPick("opTurret", "opTurretU", "opTurretUSeg"); }
function applyOptic() {
  const o = curOptic();
  OPTIC_F.forEach(f => setVal(f, o ? ((o[f] ?? "") === "" && F_DEF[f] ? F_DEF[f] : o[f]) : (F_DEF[f] || "")));
  formFor.o = o?.id || null;
  renderOpticSel(); paintOptic(); followUnits();
}
function renderOpticSel() {
  const r = curRifle(), sel = $("opticSel"), o = curOptic(); sel.innerHTML = "";
  sel.add(new Option(r ? "No optic" : "Add a gun first", ""));
  (P.optics || []).forEach(x => { const on = P.rifles.find(g => g.opticId === x.id); sel.add(new Option(x.name + (on && on !== r ? ` (on ${on.name})` : ""), x.id)); });
  sel.value = o ? o.id : ""; sel.disabled = !r;
}
function paintOptic() {
  const r = curRifle(), o = curOptic(), ts = turretSpec(), tu = ts.u === "MIL" ? "mil" : "MOA";
  $("opticPk").hidden = !r; $("opticBody").hidden = !o;
  const c = $("opTurret").value === "custom"; $("opTurretCustom").hidden = !o || !c; $("opTurretCustomU").hidden = true;   // the unit comes from the MOA | MIL switch
  paintTurrets();
  $("opMagRow").hidden = $("opFP").value !== "SFP";
  document.querySelectorAll("#opticBody .u2").forEach(e => e.textContent = `(${tu})`);
  $("opticSum").textContent = o ? [`${ts.lbl} turret`, `${$("opReticle").value === "moa" ? "MOA" : "MIL"} reticle`, ts.sfp ? `SFP (true at ${fmt(ts.sfp, 1)}×)` : $("opFP").value,
      ts.perTurn ? `${fmt(ts.perTurn, 2)} ${tu}/turn` : "", ts.up != null ? `${ts.upSet ? "" : "~"}${fmt(ts.up, 1)} ${tu} up travel` : "", num("opSH") != null ? `SH ${val("opSH")}"` : "", ts.k !== 1 ? `tracking ×${fmt(ts.k, 3)}` : ""].filter(Boolean).join(" · ")
    : r ? "No optic attached — the dope uses the gun's turret and sight height (Gun details)." : "";
  $("opMoreSum").textContent = o ? [$("opFP").value, ts.perTurn ? `${fmt(ts.perTurn, 2)}/turn` : "", num("opTravel") ? `${val("opTravel")} travel` : "", num("opCant") ? `${val("opCant")} MOA base` : "", num("opUp") > 0 ? `${val("opUp")} up` : ""].filter(Boolean).join(" · ") : "";
  $("gunOptNote").hidden = !o; $("gunOptNote").textContent = o ? `Sight height and turret come from the optic “${o.name}”${num("opSH") == null ? ` (no sight height there, so the gun's ${val("sightHeight") || "?"}" is used)` : ""}.` : "";
  const z = r?.zeroUnconf; $("zeroFlag").hidden = !z; $("zeroFlagTxt").textContent = z ? `⚠ Zero not confirmed — ${z.why || "optic changed"}` : "";
  $("opNew").disabled = !r; $("opAttach").disabled = !r || !(P.optics || []).length;
  ["opDup", "opRename", "opDetach", "opDel"].forEach(id => $(id).disabled = !o);
  paintRO();
}
function flagZero(r, why) { if (r) r.zeroUnconf = { why, at: new Date().toISOString() }; setTimeout(ctxPaint, 0); }
function attachOptic(oid, fresh) {   // fresh = optic just created for this gun (no zero flag unless it replaces another optic)
  const r = curRifle(), o = (P.optics || []).find(x => x.id === oid); if (!r || !o || r.opticId === oid) { renderOpticSel(); return false; }
  const other = P.rifles.find(x => x !== r && x.opticId === oid);
  if (other && !confirm(`“${o.name}” is on “${other.name}”. Move it to “${r.name}”?\nBoth guns' zeros will be marked “not confirmed”.`)) { renderOpticSel(); return false; }
  autosave();
  const prev = r.opticId ? P.optics.find(x => x.id === r.opticId) : null;
  const snap = { rO: r.opticId || null, rZ: r.zeroUnconf, oZ: other?.zeroUnconf, up: o.opUp, re: o.opUpRe, sh: o.opSH, pUp: prev?.opUp, pRe: prev?.opUpRe };
  if (other) { other.opticId = null; flagZero(other, `optic “${o.name}” moved to “${r.name}”`); }
  r.opticId = oid;
  if (!String(o.opSH ?? "").trim() && r.sightHeight) o.opSH = r.sightHeight;
  const upGone = !fresh && clearUp(o, true); if (prev) clearUp(prev);
  const ask = !prev && !other;   // first optic on a gun that had none → ask once instead of flagging
  if (!ask) flagZero(r, other ? `optic “${o.name}” moved here from “${other.name}”` : `optic changed from “${prev.name}” to “${o.name}”`);
  savePresets(); applyOptic(); updateDirty(); schedule();
  if (ask) { askZero(r, o); return "ask"; }
  if (other) {
    toast(`“${o.name}” moved from “${other.name}” — confirm both zeros${upGone ? "; up travel cleared, re-measure on this rifle" : ""}`, { label: "Undo", fn: () => {
      if (!P.optics.includes(o) || !P.rifles.includes(r) || !P.rifles.includes(other)) return;
      autosave(); other.opticId = o.id; if (snap.oZ) other.zeroUnconf = snap.oZ; else delete other.zeroUnconf;
      r.opticId = snap.rO; if (snap.rZ) r.zeroUnconf = snap.rZ; else delete r.zeroUnconf;
      o.opUp = snap.up; o.opSH = snap.sh; if (snap.re) o.opUpRe = snap.re; else delete o.opUpRe;
      if (prev) { prev.opUp = snap.pUp; if (snap.pRe) prev.opUpRe = snap.pRe; else delete prev.opUpRe; }
      P.lastRifleId = r.id; savePresets(); renderPickers(); applyRifle(); updateDirty(); schedule(); toast(`Move undone — “${o.name}” is back on “${other.name}”`); } });
    return "moved";
  }
  if (upGone) toast(`“${o.name}” attached to “${r.name}” — confirm the zero; up travel cleared, re-measure on this rifle`);
  return upGone ? "noted" : true;
}
function clearUp(o, note) {   // up travel from zero belongs to the gun it was measured on
  if (!o || !String(o.opUp ?? "").trim()) return false;
  o.opUp = ""; if (note) o.opUpRe = 1; else delete o.opUpRe; return true;
}
function detachOptic() {
  const r = curRifle(), o = curOptic(); if (!r || !o) return;
  autosave(); r.opticId = null; flagZero(r, `optic “${o.name}” removed`); const upGone = clearUp(o); savePresets(); applyOptic(); updateDirty(); schedule();
  toast(`“${o.name}” detached from “${r.name}” — zero marked not confirmed${upGone ? "; its up travel was cleared" : ""}`);
}

/* ---------------- round 3 ---------------- */
var ZP = null;   // pending "already zeroed?" question { r, o }
function askZero(r, o) {
  ZP = { r, o }; $("zpFor").textContent = `“${o.name}” is now on “${r.name}”. Yes keeps the zero confirmed; No marks it “Zero not confirmed” until you confirm it on Gear.`;
  $("zpDlg").classList.add("show"); setTimeout(() => $("zpYes").focus({ preventScroll: true }), 30);
}
function answerZero(yes) {
  const z = ZP; ZP = null; $("zpDlg").classList.remove("show"); if (!z) return;
  if (yes) delete z.r.zeroUnconf; else flagZero(z.r, `optic “${z.o.name}” attached — not zeroed with it yet`);
  savePresets(); paintOptic(); updateDirty(); if (lastRun) renderCard();
  toast(yes ? `“${z.o.name}” attached — zero kept as confirmed` : `“${z.o.name}” attached — zero marked not confirmed`);
}
function paintShHint() {   // weather fills the call with the 10 m wind; shooter height in open ground ≈ ⅔ of it (hint only)
  const a = auto.windSpeed, el = $("wxShHint"); if (!el) return;
  const on = !!(wx && a && a.src !== "range" && (!manual.has("windSpeed") || same(a.v, $("windSpeed").value)) && num("windSpeed") > 0);
  el.hidden = !on; el.textContent = on ? `At shooter height ≈ ⅔ → ~${fmt(num("windSpeed") * 2 / 3, 0)} mph` : "";
  el.title = on ? "Weather wind is measured at 10 m. In open ground the wind at shooter height usually runs about 2/3 of that. The value is not changed for you." : "";
}
function paintUpNote() {
  const o = curOptic(); if (o && o.opUpRe && val("opUp")) delete o.opUpRe;
  $("opUpNote").hidden = !(o && o.opUpRe);
}
function paintRO() {
  paintUpNote();   // with an optic attached the gun's sight height / turret rows become read-only "set by optic"
  const o = curOptic(), ts = turretSpec(), shO = o && num("opSH") != null;
  const ro = (row, on, txt) => { $(row + "Ro").hidden = !on; $(row + "RoL").hidden = !on; if (on) $(row + "Ro").innerHTML = txt; };
  ro("gunSH", shO, shO ? `<span>${escapeHtml(val("opSH"))}"</span><small title="From the optic “${escapeHtml(o.name)}”; the gun's own value is kept as the fallback">gun's ${escapeHtml(val("sightHeight") || "—")}"</small>` : "");
  ro("gunTurret", !!o, o ? `<span>${escapeHtml(ts.lbl)}</span><small>from “${escapeHtml(o.name)}”</small>` : "");
  $("sightHeight").hidden = shO; $("turret").hidden = !!o; $("turretUSeg").hidden = !!o;
  if (o) { $("turretCustom").hidden = true; $("turretCustomU").hidden = true; }
}

export function init1() {
  $("turretUSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setTurretUnit("turret", "turretU", "turretUSeg", b.dataset.v); });
  $("opTurretUSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setTurretUnit("opTurret", "opTurretU", "opTurretUSeg", b.dataset.v); });
  $("opticSel").onchange = e => { const v = e.target.value; if (!v) detachOptic(); else if (attachOptic(v) === true) toast(`“${curOptic().name}” attached to “${curRifle().name}” — confirm the zero`); };
  $("opNew").onclick = () => {
    const r = curRifle(); if (!r) return; const n = askName("Name for the new optic (e.g. Razor 4.5-27):", `${r.name} scope`); if (!n) return;
    const cur = curOptic(), gt = $("turret").value, base = cur ? pick(OPTIC_F) : {
      opTurret: gt || (turretSpec().u === "MIL" ? "0.1mil" : "0.25moa"), opTurretV: val("turretV"), opTurretU: $("turretU").value || "mil",
      opReticle: (gt === "custom" ? $("turretU").value === "moa" : gt ? /moa/.test(gt) : turretSpec().u === "MOA") ? "moa" : "mil", opFP: "FFP", opSH: val("sightHeight") };
    const o = { id: uid(), name: n, ...Object.fromEntries(OPTIC_F.map(f => [f, base[f] ?? ""])), opUp: "" };
    P.optics.push(o); const at = attachOptic(o.id, true); followUnits(true); if (at !== "ask") toast(`Optic “${n}” added to “${r.name}”`);
  };
  $("opRename").onclick = () => { const o = curOptic(); if (!o) return; const n = askName("Rename optic:", o.name); if (!n) return; o.name = n; savePresets(); renderOpticSel(); paintOptic(); flashSaved("optic"); };
  $("opDup").onclick = () => { const o = curOptic(); if (!o) return; autosave(); const c = { ...o, id: uid(), name: `${o.name} (copy)`.slice(0, 60), opUp: "" }; delete c.opUpRe; P.optics.push(c); savePresets(); renderOpticSel(); paintOptic(); toast(`Duplicated as “${c.name}” (not attached — use ⋯ › Attach)`); };
  $("opDetach").onclick = () => detachOptic();
  $("opDel").onclick = () => {
    const o = curOptic(), r = curRifle(); if (!o || !confirm(`Delete optic “${o.name}”?\nThe gun falls back to its own turret settings and its zero is marked not confirmed.`)) return;
    const i = P.optics.indexOf(o), z = r.zeroUnconf; P.optics.splice(i, 1); r.opticId = null; flagZero(r, `optic “${o.name}” deleted`);
    savePresets(); applyOptic(); updateDirty(); schedule();
    toast(`Optic “${o.name}” deleted`, { label: "Undo", fn: () => { P.optics.splice(Math.min(i, P.optics.length), 0, o); if (P.rifles.includes(r)) { r.opticId = o.id; if (z) r.zeroUnconf = z; else delete r.zeroUnconf; P.lastRifleId = r.id; }
      savePresets(); renderPickers(); applyRifle(); updateDirty(); schedule(); toast(`Optic “${o.name}” restored`); } });
  };
  $("opAttach").onclick = () => {
    const r = curRifle(); if (!r) return;
    $("opSheetFor").textContent = `Pick the optic now mounted on “${r.name}”. Moving an optic marks the zero of both guns “not confirmed”.`;
    $("opList").innerHTML = (P.optics || []).map(o => { const on = P.rifles.find(g => g.opticId === o.id), ts = TURRETS[o.opTurret];
      return `<button type="button" class="opItem${on === r ? " on" : ""}" data-id="${escapeHtml(o.id)}">${escapeHtml(o.name)}<small>${ts ? ts[2] : escapeHtml(o.opTurretV ? `${o.opTurretV} ${o.opTurretU}` : "custom")} turret · ${o.opReticle === "moa" ? "MOA" : "MIL"} reticle · ${on ? (on === r ? "on this gun" : `on “${escapeHtml(on.name)}”`) : "not attached"}</small></button>`; }).join("") || `<div class="summary">No optics saved yet — use ⋯ › New optic.</div>`;
    openOvl("opSheet");
  };
  $("opList").addEventListener("click", e => { const b = e.target.closest(".opItem"); if (!b) return; closeOvl("opSheet"); if (attachOptic(b.dataset.id) === true) toast(`“${curOptic().name}” attached to “${curRifle().name}” — confirm the zero`); });
  $("opSheetClose").onclick = () => closeOvl("opSheet");
}

export function init2() {
  $("zpYes").onclick = () => answerZero(true);
  $("zpNo").onclick = () => answerZero(false);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("zpDlg").classList.contains("show")) { e.stopImmediatePropagation(); answerZero(false); } }, true);
}

export { TU_DEF, tuUnit, paintTurretPick, setTurretUnit, paintTurrets, curOptic, effSH, unitFollowed, paintSeg, followUnits, applyOptic, renderOpticSel, paintOptic, flagZero, attachOptic, clearUp, detachOptic, ZP, askZero, answerZero, paintShHint, paintUpNote, paintRO };
