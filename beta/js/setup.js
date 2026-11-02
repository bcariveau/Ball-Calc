// beta/js/setup.js — first-run setup card (new-user round): rifle + zero → scope turret unit + click → load.
// Shown only on a true first open (storage.js seeds the labelled "Sample .308" with P.setup = "pending"). Existing users
// (anything saved before: presets, settings or chrono log) never see it, and nothing of theirs is renamed.

import { schedule, setTab } from "./app.js";
import { bandStr, openDB } from "./bulletdb.js";
import { ctxPaint, toast } from "./components.js";
import { $, fmt, num, setVal, val } from "./core.js";
import { curLoad, curRifle, paintSample, renderPickers, updateDirty } from "./gear.js";
import { LOG } from "./log.js";
import { followUnits } from "./optics.js";
import { FRESH, P, savePresets } from "./storage.js";

let step = 0, picked = null, inited = false, picking = false;
const CLICKS = { mil: [["0.1mil", "0.1 mil"], ["0.05mil", "0.05 mil"]], moa: [["0.25moa", "¼ MOA"], ["0.125moa", "⅛ MOA"], ["0.5moa", "½ MOA"]] };
const STEPS = ["Rifle & zero", "Scope", "Load"];
function suShouldShow() { return P.setup === "pending" && P.rifles.length > 0 && P.rifles.every(r => r.sample); }
function suActive() { return inited && !$("suWrap").hidden; }
function suWantsBullet() { return picking && suActive(); }   // the bullet sheet was opened from the setup card, not from Gear
function suCheck() {   // called on every Gear repaint: the card goes away once a real gun exists
  if (!inited) return;
  const on = suShouldShow();
  if (on && $("suWrap").hidden) suOpen(); else if (!on && !$("suWrap").hidden) $("suWrap").hidden = true;
}
function unitOf() { return $("suUnit").querySelector("button.on")?.dataset.v || "mil"; }
function paintClicks(u, keep) {
  $("suUnit").querySelectorAll("button").forEach(b => { const on = b.dataset.v === u; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  $("suClick").innerHTML = CLICKS[u].map(([k, t]) => `<option value="${k}">${t}</option>`).join("");
  $("suClick").value = CLICKS[u].some(c => c[0] === keep) ? keep : CLICKS[u][0][0];
}
function suOpen() {
  step = 0; picked = null;
  setVal("suName", ""); setVal("suZero", val("zero") || 100); setVal("suSH", val("sightHeight") || 1.5); setVal("suTwist", val("twist"));
  const t = $("turret").value; paintClicks(/moa/.test(t) ? "moa" : "mil", t);
  ["suLoad", "suBc", "suWt", "suDia", "suMv"].forEach(id => setVal(id, "")); $("suDrag").value = "G7"; $("suBullet").textContent = "";
  document.querySelectorAll("#suCard .err").forEach(e => e.textContent = ""); document.querySelectorAll("#suCard .bad").forEach(e => e.classList.remove("bad"));
  $("suWrap").hidden = false; paintStep();
}
function paintStep() {
  document.querySelectorAll("#suCard .suPane").forEach(p => p.hidden = +p.dataset.i !== step);
  document.querySelectorAll("#suCard .suDots li").forEach((li, i) => { li.classList.toggle("on", i === step); li.classList.toggle("done", i < step); });
  $("suStepTxt").textContent = `Step ${step + 1} of 3 · ${STEPS[step]}`;
  $("suBack").hidden = step === 0; $("suNext").textContent = step === 2 ? "✓ Finish setup" : "Next ›";
}
function chk(id, lo, hi, req, msg) {
  const raw = val(id), v = parseFloat(raw); let m = "";
  if (raw === "") { if (req) m = "Required"; } else if (isNaN(v)) m = "Enter a number"; else if (v < lo || v > hi) m = msg || `Must be ${lo}–${hi}`;
  $(id).classList.toggle("bad", !!m); $("e-" + id).textContent = m; return !m;
}
function validStep() {
  let ok = true;
  if (step === 0) {
    const n = val("suName").trim(); $("suName").classList.toggle("bad", !n); $("e-suName").textContent = n ? "" : "Give your rifle a name"; ok = !!n;
    ok = chk("suZero", 10, 1000, true) && ok; ok = chk("suSH", 0, 6, true) && ok;
    ok = chk("suTwist", -50, 50, false) && ok;
    if (ok && val("suTwist") !== "" && num("suTwist") !== 0 && Math.abs(num("suTwist")) < 3) { $("suTwist").classList.add("bad"); $("e-suTwist").textContent = "Inches per turn, e.g. 8 or 10"; ok = false; }
  }
  if (step === 2) {
    ok = chk("suBc", 0.01, 2, true) && ok; ok = chk("suWt", 1, 1000, true) && ok; ok = chk("suDia", 0.1, 1, true) && ok; ok = chk("suMv", 300, 5000, true) && ok;
  }
  if (!ok) $("suCard").querySelector(".suPane:not([hidden]) .bad")?.focus();
  return ok;
}
function suOnBullet(b) {   // a database pick during setup fills step 3 (nothing is written to the sample until Finish)
  picked = b; picking = false; const g7 = b.g7 != null;
  setVal("suBc", g7 ? b.g7 : b.g1); $("suDrag").value = g7 ? "G7" : "G1"; setVal("suWt", b.weight_gr); setVal("suDia", b.diameter_in);
  if (!val("suLoad")) setVal("suLoad", `${b.weight_gr}gr ${b.line || b.brand}`.slice(0, 60));
  $("suBullet").textContent = `From database: ${b.brand} ${b.name}` + (b.length_in != null ? ` · length ${b.length_in}"` : " · no length listed (add it later under Gear › Load › More for spin drift)");
  setTimeout(() => { $("suMv").focus(); }, 60);
}
function finish() {
  const r = curRifle(), l = curLoad(); if (!r) return;
  setVal("zero", val("suZero")); setVal("sightHeight", val("suSH")); setVal("twist", val("suTwist"));
  setVal("turret", $("suClick").value);
  setVal("bc", val("suBc")); $("drag").value = $("suDrag").value; setVal("weight", val("suWt")); setVal("diameter", val("suDia")); setVal("mv", val("suMv"));
  $("mvSource").value = ""; setVal("mvTemp", ""); setVal("ptSens", ""); setVal("tipLen", ""); setVal("trued", ""); $("useBands").value = "";
  if (picked) {
    const b = picked;
    setVal("bulletId", b.id); setVal("bulletName", `${b.brand} ${b.caliber || ""} ${b.weight_gr} gr ${b.line || ""}`.replace(/\s+/g, " ").trim().slice(0, 100));
    setVal("bcBands", bandStr(b.g1_bands)); setVal("length", b.length_in ?? "");
  } else { setVal("bulletId", ""); setVal("bulletName", ""); setVal("bcBands", ""); setVal("length", ""); }   // the sample's 1.215" is not the user's bullet
  updateDirty();   // autosave writes the form into the (former) sample gun and load
  r.name = val("suName").trim().slice(0, 60); delete r.sample;
  if (l) l.name = (val("suLoad").trim() || `${val("suWt")}gr load`).slice(0, 60);
  P.setup = "done"; savePresets(); renderPickers(); followUnits(true);
  $("suWrap").hidden = true; paintSample(); schedule();
  toast(`“${r.name}” is set up — the dope now uses your rifle`);
}

export function init() {
  inited = true;
  if (FRESH && P.setup === "pending" && LOG.length) {   // no gear saved but a chrono log exists: an existing user, not a first open
    P.rifles.forEach(r => { if (r.sample) { r.name = "My .308"; delete r.sample; } }); P.setup = "done"; savePresets(); renderPickers(); ctxPaint();
  }
  $("suUnit").addEventListener("click", e => { const b = e.target.closest("button"); if (b) paintClicks(b.dataset.v, $("suClick").value); });
  $("suCard").addEventListener("submit", e => { e.preventDefault(); if (!validStep()) return; if (step < 2) { step++; paintStep(); $("suCard").querySelector(".suPane:not([hidden]) input, .suPane:not([hidden]) button")?.focus({ preventScroll: true }); } else finish(); });
  $("suBack").onclick = () => { if (step > 0) { step--; paintStep(); } };
  $("suDb").onclick = () => { picking = true; openDB(); };
  $("dbOpen").addEventListener("click", () => { picking = false; });
  $("suSample").onclick = () => { P.setup = "sample"; savePresets(); $("suWrap").hidden = true; paintSample(); toast(`Using the ${curRifle()?.name || "sample"} — set up your rifle any time from Gear`); };
  $("suResume").onclick = () => { P.setup = "pending"; savePresets(); setTab("dope"); suOpen(); paintSample(); window.scrollTo(0, 0); setTimeout(() => $("suName").focus({ preventScroll: true }), 50); };
  suCheck();
}

export { CLICKS, suShouldShow, suActive, suWantsBullet, suCheck, suOpen, suOnBullet, paintStep, validStep, finish, unitOf, fmt };
