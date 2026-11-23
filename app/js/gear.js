// app/js/gear.js — Gear tab: rifle/optic/load profiles, dirty tracking, load-data summary, zero-use helpers.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { bandsOn, renderBulletInfo } from "./bulletdb.js";
import { lastRun, mvAdjOn, mvAdjust, powderT, zeroCond } from "./calc.js";
import { ctxPaint, toast } from "./components.js";
import { $, compass, escapeHtml, fmt, n1, n3, num, setVal, val } from "./core.js";
import { LOG, cleanSession, exportSessions, maybeRenderLog, saveLog, set_LOG, set_slKey, slKey } from "./log.js";
import { CARTRIDGES, cleanCartridge } from "./cartridges.js";
import { dia3, loadFit, sizeRef, sizeWarn } from "./holdover.js";
import { cleanDismissed, cleanOffsetList, cleanZeroConfirm, evaluate, rebaseOffsets, zeroReminder } from "./rezero.js";
import { applyOptic, attachOptic, commitOpticExtras, curOptic, effSH, paintOptic } from "./optics.js";
import { openCopy, paintRecipeBtns } from "./recipes.js";
import { paintLoadStrings } from "./strings.js";
import { suActive, suCheck } from "./setup.js";
import { SH, shPendCheck } from "./shooting.js";
import { F_DEF, LOAD_F, LONG_F, OPTIC_F, P, RANGE_F, REC_F, RIFLE_F, S, migrateGunOptic, migratePresets, savePresets, uid } from "./storage.js";
import { applyAuto, fetchJSON, getPosition, manual, refreshWeather } from "./weather.js";


/* ---------------- presets: gun (rifle | handgun) / load / range ---------------- */
const curRifle = () => P.rifles.find(r => r.id === P.lastRifleId) || null;
const curLoad = () => { const r = curRifle(); return r ? (r.loads.find(l => l.id === r.lastLoadId) || null) : null; };
const curRange = () => P.ranges.find(r => r.id === P.lastRangeId) || null;

const ADD_V = "__add";   // the " Add …" row at the bottom of the gun / load pickers
function fillOptions(sel, items, cur, emptyText, addText) {
  sel.innerHTML = "";
  if (emptyText !== undefined) { const o = new Option(emptyText, ""); sel.add(o); }
  items.forEach(it => sel.add(new Option(it.name, it.id)));
  if (addText) sel.add(new Option(addText, ADD_V));
  sel.value = cur ? cur.id : "";
}
const activeOf = list => (list || []).filter(x => x && !x.archived);
let gearSec = "gun", gearArchOn = false, gearEditing = false, gearDlgJob = null, showAllLoads = false;
function gearHost(kind, id) {
  if (kind === "gun") return P.rifles.find(r => r.id === id) || null;
  if (kind === "optic") return (P.optics || []).find(o => o.id === id) || null;
  for (const r of P.rifles) { const l = (r.loads || []).find(x => x.id === id); if (l) return { rifle: r, load: l }; }
  return null;
}
function gearHistory() {
  const guns = {}, loads = {}, optics = {};
  const bump = (map, id, date, asString) => {
    if (!id) return;
    const e = map[id] || (map[id] = { strings: 0, last: "" });
    if (asString) e.strings++;
    if (date && date > e.last) e.last = date;
  };
  for (const s of LOG || []) {
    const sts = (s.tg && s.tg.strings) || [];
    if (!sts.length) { bump(guns, s.rifleId, s.date, false); bump(loads, s.loadId, s.date, false); continue; }
    for (const st of sts) {
      const af = st.asFired || {};
      bump(guns, af.rifleId || s.rifleId, s.date, true);
      bump(loads, af.loadId || s.loadId, s.date, true);
      bump(optics, af.opticId, s.date, true);
    }
  }
  return { guns, loads, optics };
}
function gearUsed(kind, id) {
  const h = gearHistory();
  const e = (kind === "gun" ? h.guns : kind === "load" ? h.loads : h.optics)[id];
  return !!(e && (e.strings || e.last));
}
function shortDate(iso) {
  const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function twistBit(r) {
  const t = parseFloat(r.twist); if (!isFinite(t) || !t) return "";
  return `1:${Math.abs(t)} ${t < 0 ? "LH" : "RH"}`;
}
function paintGearMode() {
  const tab = $("tabGear"); if (!tab) return;
  tab.dataset.gearview = gearEditing ? "edit" : "list";
  tab.dataset.gearsect = gearSec;
  $("gearSwitch").querySelectorAll("button").forEach(b => { const on = b.dataset.sec === gearSec; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
  $("gearBack").hidden = !gearEditing;
  $("gearAdd").hidden = gearEditing;
  $("gearArch").hidden = gearEditing;
  $("gearArch").setAttribute("aria-pressed", String(gearArchOn));
  $("gearArch").textContent = gearArchOn ? "Active" : "Archived";
  const gun = curRifle(), optic = curOptic(), load = curLoad();
  const fullGun = gun ? (gun.cartridge && gun.cartridge.name ? `${gun.name} · ${gun.cartridge.name}` : gun.name) : "None";
  const fullOpt = optic ? optic.name : "No optic";
  const fullLoad = load ? load.name : "No load";
  const setSub = (id, text, label) => {
    const el = $(id); if (!el) return;
    el.textContent = text;
    const btn = el.closest("button");
    if (btn) { btn.title = label; btn.setAttribute("aria-label", label); }
  };
  setSub("gearSubGun", fullGun, `Firearms, ${fullGun}`);
  setSub("gearSubOptic", fullOpt, `Optics, ${fullOpt}`);
  setSub("gearSubLoad", fullLoad, `Loads, ${fullLoad}`);
  if ($("gearNowNames")) {
    const line = [gun ? fullGun : "No firearm", fullOpt, fullLoad].join(" · ");
    $("gearNowNames").textContent = line;
    $("gearNowNames").title = line;
  }
  if ($("gearBackLbl")) $("gearBackLbl").textContent = gearSec === "optic" ? "Back to Optics" : gearSec === "load" ? "Back to Loads" : "Back to Firearms";
  const rec = currentGearRecord();
  $("gearArchive").hidden = !gearEditing || !rec;
  if (rec) $("gearArchive").textContent = rec.archived ? "Unarchive" : "Archive";
}
function currentGearRecord() {
  if (gearSec === "gun") return curRifle();
  if (gearSec === "optic") return curOptic();
  return curLoad();
}
const CLICK_LBL = { "0.1mil": "0.1 mil/click", "0.05mil": "0.05 mil/click", "0.25moa": "0.25 MOA/click", "0.125moa": "0.125 MOA/click", "0.5moa": "0.5 MOA/click" };
const CHEV = `<svg class="ic chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
function angUnitOf(r, optic) {
  const t = (optic && optic.opTurret) || (r && r.turret) || "";
  if (/moa/i.test(t)) return "MOA";
  if (/mil/i.test(t)) return "MIL";
  return S.ang === "MOA" ? "MOA" : "MIL";
}
function specOf(r, optic) {
  const t = (optic && optic.opTurret) || (r && r.turret) || "";
  const table = { "0.1mil": ["MIL", 0.1], "0.05mil": ["MIL", 0.05], "0.25moa": ["MOA", 0.25], "0.125moa": ["MOA", 0.125], "0.5moa": ["MOA", 0.5] };
  if (table[t]) { const [u, v] = table[t]; const k = optic && parseFloat(optic.opTrack); return { u, v, k: k >= 0.8 && k <= 1.2 ? k : 1, lbl: CLICK_LBL[t] }; }
  return { u: angUnitOf(r, optic), v: null, k: 1, lbl: "" };
}
function suggestionFor(r, load) {
  if (!r) return null;
  const optic = r.opticId && (P.optics || []).find(o => o.id === r.opticId);
  const spec = specOf(r, optic);
  const trans = lastRun && lastRun.trans && lastRun.td && lastRun.trans.range <= lastRun.td;
  return evaluate({ sessions: LOG, rifle: r, load: load || null, spec, zeroYd: parseFloat(r.zero) || 100, dismissed: r.dismissedSuggestions || [], nearTransonic: !!trans });
}
function chipHtml(list) { return list.filter(Boolean).map(c => `<span class="chip ${c.cls}">${escapeHtml(c.t)}</span>`).join(""); }
function gearCard(row) {
  return `<button type="button" class="gearItem${row.dim ? " dim" : ""}" data-kind="${row.kind}" data-id="${escapeHtml(row.id)}" title="${escapeHtml(row.title || row.name)}"><span class="gMain"><span class="gL1"><b class="gName">${escapeHtml(row.name)}</b>${row.weight ? `<span class="gWt">${escapeHtml(row.weight)}</span>` : ""}${chipHtml(row.chips)}</span>${row.l2 ? `<small class="gL2${row.l2warn ? " warn" : ""}">${escapeHtml(row.l2)}</small>` : ""}${row.l3 ? `<small class="gL3">${escapeHtml(row.l3)}</small>` : ""}${row.archived ? `<span class="unarch" data-unarch="1">Unarchive</span>` : ""}</span>${CHEV}</button>`;
}
function lowerActive(r, load) {
  const rows = [...(r && r.offsets || []), ...(load && load.offsets || [])].filter(o => o && o.status === "active" && o.type !== "zero");
  return rows.length > 0;
}
function writeZeroOffset(mode, rebase) {
  const r = curRifle(), load = curLoad(), hit = suggestionFor(r, load);
  if (!r || !hit || hit.class !== "zero") return;
  if (mode === "apply" && hit.mode !== "apply") return;
  const offset = {
    id: uid(), type: "zero", v: hit.v, h: hit.h, unit: hit.unit, date: new Date().toISOString(), distYd: hit.distYd,
    shots: hit.shots, ci: hit.ci, sourceStringIds: hit.sourceStringIds, status: "active",
  };
  const prev = Array.isArray(r.offsets) ? r.offsets.map(o => o && o.type === "zero" && o.status === "active" ? { ...o, status: "cleared" } : o) : [];
  r.offsets = [...prev, offset];
  if (rebase) {
    r.offsets = rebaseOffsets(r.offsets, hit.v, hit.h, hit.unit);
    if (load && Array.isArray(load.offsets)) load.offsets = rebaseOffsets(load.offsets, hit.v, hit.h, hit.unit);
  }
  if (mode === "apply") {
    r.lastZeroConfirm = { at: offset.date, distYd: hit.distYd, source: "apply" };
    for (const sess of LOG) for (const st of (sess.tg && sess.tg.strings) || []) {
      if (hit.sourceStringIds.includes(st.id)) st.consumedByCorrection = { correctionId: offset.id, at: offset.date };
    }
    saveLog();
  }
  savePresets();
  paintGearList();
  paintZeroNotice();
}
function saveOrApply(mode) {
  const r = curRifle(), hit = suggestionFor(r, curLoad());
  if (!hit || hit.class !== "zero") return;
  if (lowerActive(r, curLoad())) {
    openGearDlg("Re-base load and truing offsets by this zero change?", "Re-base", () => writeZeroOffset(mode, true), false);
    return;
  }
  writeZeroOffset(mode, false);
}
function dismissSuggestion() {
  const r = curRifle(); if (!r) return;
  const hit = suggestionFor(r, curLoad());
  const load = curLoad();
  const row = hit
    ? { id: uid(), at: new Date().toISOString(), sourceStringIds: hit.sourceStringIds, rifleId: r.id, loadId: load ? load.id : "", reason: hit.class }
    : { id: uid(), at: new Date().toISOString(), sourceStringIds: [], rifleId: r.id, loadId: load ? load.id : "", reason: "reminder" };
  r.dismissedSuggestions = [...(r.dismissedSuggestions || []), row];
  savePresets();
  paintGearList();
  paintZeroNotice();
}
function confirmZeroNow() {
  const r = curRifle(); if (!r) return;
  delete r.zeroUnconf;
  r.lastZeroConfirm = { at: new Date().toISOString(), distYd: parseFloat(r.zero) || 0, source: "confirm" };
  savePresets();
  updateDirty();
  paintGearList();
  paintZeroNotice();
}
function paintZeroNotice() {
  const box = $("rzNotice"); if (!box) return;
  const r = curRifle(), load = curLoad();
  const hit = suggestionFor(r, load);
  const remind = zeroReminder(r, Date.now());
  const show = hit || (remind && remind.kind === "stale") || (remind && remind.kind === "unconf");
  box.hidden = !show;
  if (!show) return;
  const text = hit ? hit.text : remind.kind === "unconf" ? "Zero not confirmed" : "Check zero — last confirmed over 30 days ago";
  $("rzText").textContent = text;
  $("rzSave").hidden = !(hit && hit.class === "zero");
  $("rzApply").hidden = !(hit && hit.mode === "apply");
  $("rzTrue").hidden = !(hit && hit.mode === "truing");
  $("rzConfirm").hidden = !(remind && remind.kind === "unconf" && !hit);
  $("rzDismiss").hidden = !!(remind && remind.kind === "unconf" && !hit);
}
function paintGearList() {
  const box = $("gearList"); if (!box) return;
  paintGearMode();
  const wantArch = gearArchOn;
  const rows = [];
  if (gearSec === "gun") {
    for (const r of P.rifles) {
      if (!!r.archived !== wantArch) continue;
      const optic = r.opticId && (P.optics || []).find(o => o.id === r.opticId);
      const load = (r.loads || []).find(l => l.id === r.lastLoadId && !l.archived) || null;
      const hit = suggestionFor(r, load);
      const remind = zeroReminder(r, Date.now());
      const mismatch = !!(load && loadFit(load, sizeRef(r)) === "wrong");
      const chips = [];
      if (curRifle() && curRifle().id === r.id) chips.push({ cls: "inuse", t: "In use" });
      if (r.zeroUnconf) chips.push({ cls: "zero", t: "Unconfirmed" });
      if (hit || (remind && remind.kind === "stale")) chips.push({ cls: "zero", t: "Check zero" });
      if (mismatch) chips.push({ cls: "mis", t: "Size mismatch" });
      const l2 = [r.cartridge && r.cartridge.name, r.zero ? `${r.zero} yd zero` : "", angUnitOf(r, optic)].filter(Boolean).join(" · ");
      rows.push({ kind: "gun", id: r.id, name: r.name, title: r.name, chips, l2, l2warn: !!(r.zeroUnconf || (remind && remind.kind === "stale")), l3: load ? load.name : "", archived: !!r.archived });
    }
  } else if (gearSec === "optic") {
    for (const o of P.optics || []) {
      if (!!o.archived !== wantArch) continue;
      const guns = P.rifles.filter(r => r.opticId === o.id).map(r => r.name);
      const mag = o.opFixed ? (o.opMag ? `${o.opMag}× fixed` : "Fixed power") : (o.opMag ? `${o.opMag}×` : "");
      const click = CLICK_LBL[o.opTurret] || (o.opTurretV ? `${o.opTurretV} ${/moa/i.test(o.opTurretU || "") ? "MOA" : "mil"}/click` : "");
      const fp = o.opFP === "SFP" ? "SFP" : o.opFP === "FFP" ? "FFP" : "";
      const l2 = [mag, click, fp, guns.length ? `on ${guns.join(", ")}` : ""].filter(Boolean).join(" · ");
      const chips = curOptic() && curOptic().id === o.id ? [{ cls: "inuse", t: "In use" }] : [];
      rows.push({ kind: "optic", id: o.id, name: o.name, title: o.name, chips, l2, archived: !!o.archived });
    }
  } else {
    const bore = sizeRef(curRifle());
    let hiddenWrong = 0;
    for (const r of P.rifles) for (const l of r.loads || []) {
      if (!!l.archived !== wantArch) continue;
      const fit = loadFit(l, bore);
      const own = loadFit(l, sizeRef(r));
      if (fit === "wrong" && !showAllLoads) { hiddenWrong++; continue; }
      const mismatch = fit === "wrong" || own === "wrong";
      const chips = [];
      if (curRifle() && curRifle().id === r.id && curRifle().lastLoadId === l.id) chips.push({ cls: "inuse", t: "In use" });
      if (mismatch) chips.push({ cls: "mis", t: "Size mismatch" });
      const l2fixed = [l.mv ? `${l.mv} fps${l.mvTemp ? ` @ ${l.mvTemp}°F` : ""}` : "", l.mvSource || ""].filter(Boolean).join(" · ");
      const l3 = l.drag && l.bc ? `${l.drag} ${l.bc}` : "";
      rows.push({ kind: "load", id: l.id, name: l.name, title: l.name, weight: l.weight ? `${l.weight} gr` : "", chips, l2: l2fixed, l2warn: !!(l.mv && (!l.mvTemp || !l.mvSource)), l3, archived: !!l.archived, dim: fit === "wrong" });
    }
    const allBtn = $("gearAllLoads");
    if (allBtn) {
      allBtn.hidden = gearEditing || gearSec !== "load" || bore.kind !== "known" || (!hiddenWrong && !showAllLoads);
      allBtn.textContent = showAllLoads ? "Fitting loads" : `Show all loads${hiddenWrong ? ` (${hiddenWrong})` : ""}`;
      allBtn.setAttribute("aria-pressed", String(showAllLoads));
    }
  }
  if (gearSec !== "load" && $("gearAllLoads")) $("gearAllLoads").hidden = true;
  box.innerHTML = rows.length ? rows.map(gearCard).join("")
    : `<div class="hint">${wantArch ? "Nothing archived." : "Nothing saved in this section yet."}</div>`;
  paintZeroNotice();
}
function renderPickers() {
  if (!curRifle() && P.rifles.length) { const n = activeOf(P.rifles)[0]; if (n) P.lastRifleId = n.id; }
  const r = curRifle();
  if (r && !r.loads.find(l => l.id === r.lastLoadId) && activeOf(r.loads).length) r.lastLoadId = activeOf(r.loads)[0].id;
  const guns = activeOf(P.rifles), loads = activeOf(r ? r.loads : []);
  fillOptions($("rifleSel"), guns, r && !r.archived ? r : null, guns.length ? undefined : "No guns yet", "+ Add rifle…");
  fillOptions($("loadSel"), loads, curLoad() && !curLoad().archived ? curLoad() : null, loads.length ? undefined : (r ? "No loads yet" : "Add a gun first"), r ? "+ Add load…" : "");
  fillOptions($("rangeSel"), P.ranges, curRange(), "Current location");
  updateDirty();
}
function paintCartridge() {
  const sel = $("cartPick"); if (!sel) return;
  const q = ($("cartSearch") && $("cartSearch").value || "").trim().toLowerCase();
  const cur = sel.value;
  const rows = CARTRIDGES.filter(c => !q || `${c.name} ${c.short}`.toLowerCase().includes(q));
  sel.innerHTML = `<option value="">Not set</option>` + rows.map(c => `<option value="${c.id}">${c.name} · ${c.diameter.toFixed(3)}"</option>`).join("") + `<option value="custom">Custom…</option>`;
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  const custom = sel.value === "custom";
  if ($("cartCustom")) $("cartCustom").hidden = !custom;
  const hit = CARTRIDGES.find(c => c.id === sel.value);
  if ($("cartHint")) $("cartHint").textContent = hit ? `${hit.name} uses a ${hit.diameter.toFixed(3)} in bullet.` : custom ? "Enter the cartridge name and its bullet diameter." : "Optional. When set, this diameter decides which loads fit. Not set keeps the current behavior.";
}
function fillCartridge(cart) {
  if (!$("cartPick")) return;
  if ($("cartSearch")) $("cartSearch").value = "";
  paintCartridge();
  if (cart && cart.id && CARTRIDGES.some(c => c.id === cart.id)) $("cartPick").value = cart.id;
  else if (cart && cart.diameter) { $("cartPick").value = "custom"; if ($("cartName")) $("cartName").value = cart.name || ""; if ($("cartDia")) $("cartDia").value = cart.diameter; }
  else $("cartPick").value = "";
  paintCartridge();
}
function readCartridge() {
  if (!$("cartPick")) return null;
  const v = $("cartPick").value;
  if (!v) return null;
  if (v === "custom") return cleanCartridge({ name: $("cartName") && $("cartName").value, diameter: $("cartDia") && $("cartDia").value });
  const c = CARTRIDGES.find(x => x.id === v);
  return c ? { id: c.id, name: c.name, short: c.short, diameter: c.diameter } : null;
}
function commitCartridge(r) {
  if (!$("cartPick") || !r || formFor.r !== r.id) return false;
  const next = readCartridge();
  const same = JSON.stringify(next || null) === JSON.stringify(r.cartridge || null);
  if (same) return false;
  if (next) r.cartridge = next; else delete r.cartridge;
  return true;
}
function applyRifle() { const r = curRifle(); if (r) RIFLE_F.forEach(f => setVal(f, r[f] || F_DEF[f] || r[f])); formFor.r = r?.id || null; fillCartridge(r && r.cartridge); applyGunKind(); applyOptic(); }
function applyGunKind() { const hg = $("gunKind").value === "handgun"; $("barrel").placeholder = hg ? "optional, e.g. 4.25" : "optional, e.g. 20"; }
function applyLoad() { if (SH.pend) setTimeout(shPendCheck, 0); const l = curLoad(); if (l) LOAD_F.forEach(f => setVal(f, (l[f] ?? "") === "" && F_DEF[f] ? F_DEF[f] : l[f])); formFor.l = l?.id || null; paintLdKind(); renderBulletInfo(); if (moreNeeded() && !gearEditing) $("loadDetails").open = true; }
function applyRange() {
  const g = curRange();
  if (g) {
    ["bearing", "target", "rangeLat", "rangeLon"].forEach(f => setVal(f, g[f]));
    manual.delete("altitude"); manual.delete("windDir");
  }
  formFor.g = g?.id || null;
  applyAuto();
}
const same = (a, b) => String(a ?? "").trim() === String(b ?? "").trim() || (parseFloat(a) === parseFloat(b));
function isDirty(obj, fields) { return !!obj && fields.some(f => !same((obj[f] ?? "") === "" && F_DEF[f] ? F_DEF[f] : obj[f], $(f).value)); }
// autosave: the form always belongs to the preset ids in formFor (set when a preset is put on screen),
// so switching or deleting a preset never writes the old form into another one.
var formFor = { r: null, l: null, g: null, o: null };
var savedT = {};
function autosave() {
  const r = curRifle(), l = curLoad(), g = curRange(), done = [];
  if (r && formFor.r === r.id) { const dirty = isDirty(r, RIFLE_F), extra = commitCartridge(r); if (dirty) Object.assign(r, pick(RIFLE_F)); if (dirty || extra) done.push("rifle"); }
  if (l && formFor.l === l.id && isDirty(l, LOAD_F)) { Object.assign(l, pick(LOAD_F)); done.push("load"); }
  { const o = curOptic(); if (o && formFor.o === o.id) { const extra = commitOpticExtras(); const dirty = isDirty(o, OPTIC_F); if (dirty) Object.assign(o, pick(OPTIC_F)); if (extra || dirty) done.push("optic"); } }
  if (g && formFor.g === g.id) {
    let ch = false;
    ["bearing", "target", "rangeLat", "rangeLon"].forEach(f => { if (!same(g[f], $(f).value)) { g[f] = $(f).value; ch = true; } });
    if (manual.has("altitude") && !same(g.altitude, $("altitude").value)) { g.altitude = $("altitude").value; ch = true; }   // blank = use weather
    if (ch) done.push("range");
  }
  if (!done.length) return false;
  savePresets(); done.forEach(flashSaved); return true;
}
function flashSaved(k) { const el = $(k + "Saved"); if (!el) return; el.innerHTML = "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M20 6 9 17l-5-5'/></svg> Saved"; el.classList.add("show"); clearTimeout(savedT[k]); savedT[k] = setTimeout(() => el.classList.remove("show"), 1500); }
function updateDirty() {
  const r = curRifle(), l = curLoad(), g = curRange();
  autosave();
  ctxPaint();
  maybeRenderLog();
  ["rifleDup", "rifleRename", "rifleDel"].forEach(id => $(id).disabled = !r);
  ["loadRename", "loadDel", "loadCopy"].forEach(id => $(id).disabled = !l);
  $("loadMove").disabled = !l || P.rifles.length < 2;
  paintRecipeBtns();
  $("loadNew").disabled = !r;
  ["rangeDup", "rangeRename", "rangeDel"].forEach(id => $(id).disabled = !g);
  const tw = num("twist");
  $("rifleSum").textContent = `${fmt(effSH(), 2) || "?"}" sight height${curOptic() && num("opSH") != null ? " (optic)" : ""} · ${val("zero") || "?"} yd zero` + (tw ? ` · 1:${Math.abs(tw)}" ${tw < 0 ? "LH" : "RH"} twist` : "");
  const mvs = { measured: " (chrono)", factory: " (box)", estimate: " (est.)", trued: " (trued)" }[$("mvSource").value] || "";
  $("loadSum").textContent = (val("bulletName") ? val("bulletName") + " · " : `${val("weight") || "?"} gr · `) + `${val("bc") || "?"} ${$("drag").value}${bandsOn() ? " banded" : ""} · ${val("mv") || "?"} fps${mvs}`;
  if (val("barrel")) $("rifleSum").textContent += ` · ${val("barrel")}" barrel`;
  $("rifleSum").textContent = ($("gunKind").value === "handgun" ? "Handgun · " : "Rifle · ") + $("rifleSum").textContent;
  const rt = recipeText(pick(LOAD_F));
  $("loadRecipe").innerHTML = rt ? (val("ldKind") === "factory" ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'/><path d='M12 22V12'/><path d='m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7'/></svg> " : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2'/><path d='M8.5 2h7'/><path d='M7 16h10'/></svg> ") + escapeHtml(rt) : "";
  const ls = ldShort(pick(LOAD_F)); $("recipeSum").textContent = ls; $("recipeSum").hidden = !ls;
  paintLoadMore(ls); paintSample();
  const b = num("bearing");
  $("rangeSum").textContent = (g ? "" : "Weather uses your phone's location. ") +
    (b != null ? `Facing ${fmt(b, 0)}° ${compass(b)}` : "No shooting direction set") +
    (val("altitude") ? ` · ${val("altitude")} ft` : "") + (val("target") ? ` · target ${val("target")} yd` : "") +
    (g && val("rangeLat") && val("rangeLon") ? ` · ${(+val("rangeLat")).toFixed(3)}, ${(+val("rangeLon")).toFixed(3)}` : "");
  paintGearExtra();
  paintGearList();
}
// basics-first load form: bullet, BC + drag model and MV stay on screen; the rest lives under More , whose summary lists what is set
function paintLoadMore(ls) {
  const tw = num("twist"), parts = [val("weight") ? `${val("weight")} gr` : "", val("diameter") ? `${val("diameter")}"` : "",
    val("length") ? `L ${val("length")}"` : (tw ? "no length (spin drift off)" : ""), val("tipLen") ? `tip ${val("tipLen")}"` : "",
    { measured: "chrono MV", factory: "box MV", estimate: "est. MV", trued: "trued MV" }[$("mvSource").value] || "",
    bandsOn() ? "banded G1" : "", mvAdjOn() ? `${val("ptSens")} fps/10°F` : ""];
  $("loadMoreSum").textContent = parts.filter(Boolean).join(" · ");
  paintLoadStrings();
}
function moreNeeded() {   // More opens by itself when something in it is part of the current solution
  return bandsOn() || mvAdjOn() || [...$("loadDetails").querySelectorAll("input.bad, select.bad")].length > 0;
}
function paintSample() {
  suCheck(); const r = curRifle(); $("sampleNote").hidden = !(r && r.sample) || suActive();
}
function ldShort(o) {   // Gear row subline: "Varget · 44.5 gr" / "Federal Gold Medal Match"
  if (!o) return "";
  if (o.ldKind === "factory") return [o.ldMaker, o.ldProduct].map(x => (x || "").trim()).filter(Boolean).join(" ") || recipeText(o);
  const c = n1(o.ldCharge), pw = (o.ldPowder || "").trim();
  return [pw, c ? c + " gr" : ""].filter(Boolean).join(" · ") || recipeText(o);
}
function recipeText(o, long) {   // o: load preset, form pick, or session snapshot (same ld* keys)
  if (!o) return "";
  if (o.ldKind === "factory") {
    const a = [[o.ldMaker, o.ldProduct].filter(Boolean).join(" "), o.ldLot ? "lot " + o.ldLot : ""].filter(Boolean);
    return a.length ? "Factory · " + a.join(" · ") : "";
  }
  const c = n1(o.ldCharge), pw = (o.ldPowder || "").trim();
  const a = [c && pw ? `${c} gr ${pw}` : c ? `${c} gr` : pw, (o.ldPrimer || "").replace(/\s*\(.*\)$/, ""), n3(o.ldCOAL) ? `COAL ${n3(o.ldCOAL)}"` : ""];
  if (long) a.push(n3(o.ldCBTO) ? `CBTO ${n3(o.ldCBTO)}"` : "", n3(o.ldJump) ? `jump ${n3(o.ldJump)}"` : "",
    o.ldCase ? o.ldCase + (o.ldFired ? ` ×${o.ldFired}` : "") : (o.ldFired ? `fired ×${o.ldFired}` : ""), n3(o.ldTrim) ? `trim ${n3(o.ldTrim)}"` : "", o.ldPrep || "");
  return a.filter(Boolean).join(" · ");
}
let SNAP_F;   // set in init (was const)
// copy of the load as it is right now (form values if it's the load on screen, else the saved preset)
function recipeSnapshot(rifleId, loadId) {
  const r = P.rifles.find(x => x.id === rifleId), l = r?.loads.find(x => x.id === loadId); if (!l) return null;
  const onScreen = curLoad() === l, src = onScreen ? pick(LOAD_F) : l, g = onScreen ? $("gunKind").value : (r.gunKind || "rifle");
  const s = { loadName: l.name, gunName: r.name, gunKind: g, at: new Date().toISOString() };
  ["bulletName", "weight", "bc", "drag", "mv", "diameter", "ptSens", "mvTemp", ...REC_F].forEach(k => { const v = String(src[k] ?? "").trim(); if (v) s[k] = v; });
  if (!s.ldKind) s.ldKind = "hand";
  { const a = mvAdjust(parseFloat(s.mv), parseFloat(s.ptSens), parseFloat(s.mvTemp), powderT()); if (a != null && Math.round(a) !== Math.round(parseFloat(s.mv))) s.mvAdj = String(Math.round(a)); }   // MV at today's powder temp
  return s;
}
function cleanRecipe(x) {
  if (!x || typeof x !== "object") return null;
  const o = {}; SNAP_F.forEach(k => { if (x[k] != null && String(x[k]).trim() !== "") o[k] = String(x[k]).slice(0, LONG_F[k] || 100); });
  if (x.at && !isNaN(new Date(x.at))) o.at = new Date(x.at).toISOString();
  return Object.keys(o).length ? o : null;
}
function paintLdKind() {
  const k = val("ldKind") || "hand";
  $("ldKindSeg").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === k));
  $("ldHand").hidden = k === "factory"; $("ldFactory").hidden = k !== "factory";
}
const askName = (msg, def) => { const n = prompt(msg, def || ""); return n && n.trim() ? n.trim().slice(0, 60) : null; };
const pick = (fields) => Object.fromEntries(fields.map(f => [f, $(f).value]));

function pkRefresh() { savePresets(); renderPickers(); applyRifle(); applyLoad(); updateDirty(); set_slKey(null); maybeRenderLog(); schedule(); }
// ⋯ menus
function openPk(k) {
  const o = k === "rifle" ? curRifle() : k === "load" ? curLoad() : k === "optic" ? curOptic() : curRange(), t = { rifle: "Gun", load: "Load", range: "Range", optic: "Optic" }[k];
  $("pkTitle").textContent = o ? `${t}: ${o.name}` : t;
  document.querySelectorAll("#pkMenu .grp").forEach(g => g.hidden = g.dataset.k !== k);
  $("pkMenu").classList.add("show"); setTimeout(() => $("pkMenu").querySelector(`.grp[data-k="${k}"] button:not(:disabled)`)?.focus({ preventScroll: true }), 30);
}
function closePk() { $("pkMenu").classList.remove("show"); }
function paintGearExtra() {
  const oN = !!curOptic(), t = $("turret").value === "custom" && !oN; $("turretCustom").hidden = !t; $("turretCustomU").hidden = true;   // unit = the MOA | MIL switch
  paintOptic();
  const zc = zeroCond();
  $("zeroSum").textContent = zc ? [num("zTemp") != null ? `${val("zTemp")}°F` : "", num("zHum") != null ? `${val("zHum")}%` : "", num("zAlt") != null ? `${val("zAlt")} ft` : "", num("zPress") != null ? `${val("zPress")} inHg` : ""].filter(Boolean).join(" · ") : "same as today";
  const tn = val("trued"); $("truedNote").hidden = !tn; $("truedNote").innerHTML = tn ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> " + escapeHtml(tn) : "";
}

export function init1() {
  SNAP_F = ["loadName", "gunName", "gunKind", "bulletName", "weight", "bc", "drag", "mv", "diameter", "ptSens", "mvTemp", "mvAdj", ...REC_F];
  // a nested panel under More (Load data, MV estimate) opening from code or a link opens More too
  ["recipeDetails", "mvEstBox"].forEach(id => $(id).addEventListener("toggle", () => { if ($(id).open) $("loadDetails").open = true; if (id === "recipeDetails") paintRecipeBtns(); }));
  $("ldKindSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("ldKind").value = b.dataset.v; paintLdKind(); updateDirty(); });

  $("rifleSel").onchange = e => { if (e.target.value === ADD_V) { e.target.value = curRifle()?.id || ""; const n0 = P.rifles.length; $("rifleNew").click(); if (P.rifles.length > n0) $("rifleDetails").open = true; return; }
    P.lastRifleId = e.target.value; const r = curRifle();
    if (r?.lastOpticId && (P.optics || []).some(o => o.id === r.lastOpticId)) r.opticId = r.lastOpticId;
    applyRifle(); renderPickers(); applyLoad(); savePresets(); updateDirty(); schedule(); };
  $("loadSel").onchange = e => { if (e.target.value === ADD_V) { e.target.value = curLoad()?.id || ""; $("loadNew").click(); return; }
    const r = curRifle(); if (!r) return;
    const id = e.target.value;
    const next = r.loads.find(l => l.id === id);
    const prev = r.lastLoadId;
    if (!next) { e.target.value = prev || ""; return; }
    const apply = () => { r.lastLoadId = id; applyLoad(); savePresets(); renderPickers(); updateDirty(); schedule(); };
    if (next.id !== prev && sizeWarn(sizeRef(r), next)) { e.target.value = prev || ""; confirmSize(r, next, apply); return; }
    apply(); };
  $("rangeSel").onchange = e => { P.lastRangeId = e.target.value || null; applyRange(); savePresets(); updateDirty(); refreshWeather(); schedule(); };
  $("rifleNew").onclick = () => { const n = askName("Name for the new gun (starts from the gun details on screen):", ""); if (!n) return;
    const r = { id: uid(), name: n, ...pick(RIFLE_F), loads: [] };
    const cart = readCartridge(); if (cart) r.cartridge = cart;
    const l = curLoad(); if (l) { const c = { ...pick(LOAD_F), id: uid(), name: l.name }; r.loads.push(c); r.lastLoadId = c.id; }
    P.rifles.push(r); P.lastRifleId = r.id; pkRefresh(); toast(`Gun “${n}” added${r.loads.length ? " (current load copied)" : ""}`); };
  $("rifleDup").onclick = () => { const r = curRifle(); if (!r) return;
    const c = JSON.parse(JSON.stringify(r)); c.id = uid(); let n = `${r.name} (copy)`.slice(0, 60), k = 2; while (P.rifles.some(x => x.name === n)) n = `${r.name} (copy ${k++})`.slice(0, 60); c.name = n;
    c.loads.forEach(l => { const nid = uid(); if (l.id === r.lastLoadId) c.lastLoadId = nid; l.id = nid; });
    c.opticId = null; delete c.zeroUnconf; delete c.sample; delete c.archived; c.loads.forEach(l => delete l.archived);
    P.rifles.push(c); P.lastRifleId = c.id; pkRefresh(); toast(`Duplicated as “${n}” (${c.loads.length} load${c.loads.length === 1 ? "" : "s"}; chrono sessions stay with the original)`); };
  $("rifleRename").onclick = () => { const r = curRifle(); if (!r) return; const n = askName("Rename gun:", r.name); if (!n) return; r.name = n; if (r.sample) { delete r.sample; if (P.setup !== "done") P.setup = "done"; paintSample(); } savePresets(); renderPickers(); flashSaved("rifle"); };
  $("rifleDel").onclick = () => { const r = curRifle(); if (r) askRemove("gun", r.id); };

  $("loadNew").onclick = () => { const r = curRifle(); if (!r) return; const n = askName(`Name for the new load on “${r.name}” (starts from the load details on screen):`, ""); if (!n) return;
    const l = { id: uid(), name: n, ...pick(LOAD_F) }; r.loads.push(l); r.lastLoadId = l.id; pkRefresh(); toast(`Load “${n}” added`); };
  $("loadRename").onclick = () => { const l = curLoad(); if (!l) return; const n = askName("Rename load:", l.name); if (!n) return; l.name = n; savePresets(); renderPickers(); flashSaved("load"); };
  $("loadDel").onclick = () => { const l = curLoad(); if (l) askRemove("load", l.id); };
  $("loadMove").onclick = () => openCopy("move");

  $("rangeNew").onclick = () => { const n = askName("Name for the new range (saves shooting direction, altitude, target distance and location):", ""); if (!n) return;
    const g = { id: uid(), name: n, ...pick(RANGE_F) }; P.ranges.push(g); P.lastRangeId = g.id; formFor.g = g.id; savePresets(); renderPickers();
    toast(`Range “${n}” added`); if (!g.rangeLat) $("rangeDetails").open = true; };
  $("rangeDup").onclick = () => { const g = curRange(); if (!g) return; const c = { ...g, id: uid(), name: `${g.name} (copy)`.slice(0, 60) }; P.ranges.push(c); P.lastRangeId = c.id; formFor.g = c.id; savePresets(); renderPickers(); toast(`Duplicated as “${c.name}”`); };
  $("rangeRename").onclick = () => { const g = curRange(); if (!g) return; const n = askName("Rename range:", g.name); if (!n) return; g.name = n; savePresets(); renderPickers(); flashSaved("range"); };
  $("rangeDel").onclick = () => { const g = curRange(); if (!g || !confirm(`Delete range “${g.name}”?`)) return;
    const i = P.ranges.indexOf(g); P.ranges.splice(i, 1); P.lastRangeId = null; formFor.g = null; savePresets(); renderPickers(); refreshWeather();
    toast(`Range “${g.name}” deleted`, { label: "Undo", fn: () => { P.ranges.splice(Math.min(i, P.ranges.length), 0, g); P.lastRangeId = g.id; savePresets(); renderPickers(); applyRange(); refreshWeather(); schedule(); toast(`Range “${g.name}” restored`); } }); };
  ["rifle", "load", "range", "optic"].forEach(k => $(k + "Menu").onclick = () => openPk(k));
  if ($("cartPick")) $("cartPick").addEventListener("change", () => { paintCartridge(); updateDirty(); });
  if ($("cartSearch")) $("cartSearch").addEventListener("input", () => paintCartridge());
  $("gearSwitch").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; gearSec = b.dataset.sec; gearEditing = false; paintGearList(); });
  $("gearArch").onclick = () => { gearArchOn = !gearArchOn; paintGearList(); };
  if ($("gearAllLoads")) $("gearAllLoads").onclick = () => { showAllLoads = !showAllLoads; paintGearList(); };
  $("gearBack").onclick = () => { gearEditing = false; paintGearList(); };
  $("gearAdd").onclick = () => {
    const before = gearSec === "gun" ? P.rifles.length : gearSec === "optic" ? (P.optics || []).length : ((curRifle() && curRifle().loads.length) || 0);
    if (gearSec === "gun") $("rifleNew").click();
    else if (gearSec === "optic") $("opNew").click();
    else $("loadNew").click();
    const after = gearSec === "gun" ? P.rifles.length : gearSec === "optic" ? (P.optics || []).length : ((curRifle() && curRifle().loads.length) || 0);
    if (after > before) { gearEditing = true; ["rifleDetails", "loadDetails", "opMore"].forEach(id => { const el = $(id); if (el) el.open = false; }); paintGearList(); }
  };
  $("gearArchive").onclick = () => {
    const rec = currentGearRecord(); if (!rec) return;
    if (rec.archived) { setArchived(gearSec, rec.id, false); return; }
    openGearDlg(`Archive “${rec.name}”? It leaves the pickers. Logs and stats still show its name.`, "Archive", () => setArchived(gearSec, rec.id, true), false);
  };
  $("gearList").addEventListener("click", e => {
    const un = e.target.closest("[data-unarch]");
    const row = e.target.closest(".gearItem"); if (!row) return;
    if (un) { setArchived(row.dataset.kind, row.dataset.id, false); return; }
    showGear(row.dataset.kind, row.dataset.id);
  });
  $("gearDlgCancel").onclick = () => { gearDlgJob = null; $("gearDlg").hidden = true; };
  $("gearDlgGo").onclick = () => { const job = gearDlgJob; gearDlgJob = null; $("gearDlg").hidden = true; if (job) job(); };
  paintGearList();
  // capture: close the menu first, then the item's own handler runs (prompts/confirms appear over the page)
  $("pkMenu").addEventListener("click", e => { if (e.target === $("pkMenu") || e.target.closest(".grp button, #pkCancel")) closePk(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("pkMenu").classList.contains("show")) closePk(); });
  $("rangeHere").onclick = async () => {
    try {
      const c = await getPosition();
      setVal("rangeLat", c.lat.toFixed(5)); setVal("rangeLon", c.lon.toFixed(5));
      if (navigator.onLine !== false) try { const e = await fetchJSON(`https://api.open-meteo.com/v1/elevation?latitude=${c.lat}&longitude=${c.lon}`);
        if (e.elevation?.[0] != null) { setVal("altitude", Math.round(e.elevation[0] * 3.28084)); manual.add("altitude"); } } catch {}
      updateDirty(); toast((curRange() ? `Location saved to “${curRange().name}”` : "Location filled — use ⋯ <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg> New range to save it as a range") + (navigator.onLine === false ? " (offline: enter elevation by hand)" : ""));
    } catch (e) { toast("Couldn't get location: " + e.message); }
  };

  /* export / import */
  $("exportBtn").onclick = () => {
    const data = JSON.stringify({ app: "ballistic-calculator", exported: new Date().toISOString(), ...P, shotSessions: exportSessions() }, null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = `ballistic-presets-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(`Exported ${P.rifles.length} gun(s), ${(P.optics || []).length} optic(s), ${P.ranges.length} range(s), ${LOG.length} chrono session(s)`);
  };
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.rifles)) throw new Error("not a presets file");
      const str = (v, n = 40) => v == null ? "" : String(v).slice(0, n);
      const keepArch = x => x && x.archived === true ? { archived: true } : {};
      const rifles = d.rifles.filter(r => r && r.name).map(r => ({ id: str(r.id) || uid(), name: String(r.name).slice(0, 60),
        ...Object.fromEntries(RIFLE_F.map(k => [k, str(r[k])])), lastLoadId: str(r.lastLoadId) || null, lastOpticId: str(r.lastOpticId) || null, opticId: str(r.opticId) || null,
        ...keepArch(r),
        ...(r.zeroUnconf && typeof r.zeroUnconf === "object" ? { zeroUnconf: { why: str(r.zeroUnconf.why, 120), at: str(r.zeroUnconf.at) } } : {}),
        ...(cleanCartridge(r.cartridge) ? { cartridge: cleanCartridge(r.cartridge) } : {}),
        ...(cleanOffsetList(r.offsets, ["zero", "config", "truing"]) ? { offsets: cleanOffsetList(r.offsets, ["zero", "config", "truing"]) } : {}),
        ...(cleanZeroConfirm(r.lastZeroConfirm) ? { lastZeroConfirm: cleanZeroConfirm(r.lastZeroConfirm) } : {}),
        ...(cleanDismissed(r.dismissedSuggestions) ? { dismissedSuggestions: cleanDismissed(r.dismissedSuggestions) } : {}),
        loads: (Array.isArray(r.loads) ? r.loads : []).filter(l => l && l.name).map(l => ({ id: str(l.id) || uid(), name: String(l.name).slice(0, 60),
          ...keepArch(l),
          ...(cleanOffsetList(l.offsets, ["load", "truing"]) ? { offsets: cleanOffsetList(l.offsets, ["load", "truing"]) } : {}),
          ...Object.fromEntries(LOAD_F.map(k => [k, str(l[k], LONG_F[k])])) })) }));
      const ranges = (Array.isArray(d.ranges) ? d.ranges : []).filter(g => g && g.name).map(g => ({ id: str(g.id) || uid(), name: String(g.name).slice(0, 60),
        ...Object.fromEntries(RANGE_F.map(k => [k, str(g[k])])) }));
      const sess = (Array.isArray(d.shotSessions) ? d.shotSessions : []).map(cleanSession).filter(Boolean);
      const optics = (Array.isArray(d.optics) ? d.optics : []).filter(o => o && o.name).map(o => ({ id: str(o.id) || uid(), name: String(o.name).slice(0, 60), ...keepArch(o), ...Object.fromEntries(OPTIC_F.map(k => [k, str(o[k])])), ...(o.opFixed === true ? { opFixed: true } : {}), ...(o.holdover && typeof o.holdover === "object" ? { holdover: o.holdover } : {}) }));
      if (!Array.isArray(d.optics)) rifles.forEach(r => migrateGunOptic(r, optics));   // file from before optics existed
      const replace = confirm(`Import ${rifles.length} gun(s), ${ranges.length} range(s) and ${sess.length} chrono session(s).\n\nOK = replace all current presets\nCancel = merge with current presets`);
      const merge = (dst, src) => src.forEach(x => { const i = dst.findIndex(y => y.id === x.id); i >= 0 ? dst[i] = x : dst.push(x); });
      if (replace) { P.rifles = rifles; P.ranges = ranges; P.optics = optics; P.lastRifleId = d.lastRifleId; P.lastRangeId = d.lastRangeId; set_LOG(sess); }
      else { merge(P.rifles, rifles); merge(P.ranges, ranges); merge(P.optics = P.optics || [], optics); merge(LOG, sess); }
      migratePresets();
      await saveLog(); set_slKey(null);
      savePresets(); renderPickers(); applyRifle(); applyLoad(); applyRange(); updateDirty(); schedule();
      toast("Presets imported");
    } catch (err) { alert("Import failed: " + err.message); }
  };
}

function openGearDlg(msg, label, job, danger, focusCancel) {
  $("gearDlgMsg").textContent = msg;
  $("gearDlgGo").textContent = label;
  $("gearDlgGo").classList.toggle("danger", !!danger);
  gearDlgJob = job;
  $("gearDlg").hidden = false;
  (focusCancel ? $("gearDlgCancel") : $("gearDlgGo")).focus({ preventScroll: true });
}
function setArchived(kind, id, on) {
  const host = gearHost(kind, id);
  const obj = kind === "load" ? host && host.load : host;
  if (!obj) return;
  if (on) obj.archived = true; else delete obj.archived;
  if (on && kind === "gun" && P.lastRifleId === id) { const n = activeOf(P.rifles)[0]; if (n) P.lastRifleId = n.id; }
  if (on && kind === "load" && host && host.rifle.lastLoadId === id) { const n = activeOf(host.rifle.loads)[0]; host.rifle.lastLoadId = n ? n.id : null; }
  if (on && kind === "optic") P.rifles.forEach(r => { if (r.opticId === id) r.opticId = null; });
  savePresets();
  gearEditing = false;
  renderPickers(); applyRifle(); applyLoad(); updateDirty();
}
function hardDelete(kind, id) {
  if (kind === "gun") {
    const r = P.rifles.find(x => x.id === id); if (!r) return;
    P.rifles = P.rifles.filter(x => x.id !== id);
    if (P.lastRifleId === id) P.lastRifleId = activeOf(P.rifles)[0]?.id || null;
  } else if (kind === "load") {
    const host = gearHost("load", id); if (!host) return;
    host.rifle.loads = host.rifle.loads.filter(l => l.id !== id);
    if (host.rifle.lastLoadId === id) host.rifle.lastLoadId = activeOf(host.rifle.loads)[0]?.id || null;
  } else {
    const o = (P.optics || []).find(x => x.id === id); if (!o) return;
    P.optics = P.optics.filter(x => x.id !== id);
    P.rifles.forEach(r => { if (r.opticId === id) r.opticId = null; });
  }
  savePresets();
  gearEditing = false;
  renderPickers(); applyRifle(); applyLoad(); updateDirty();
}
function askRemove(kind, id) {
  const host = gearHost(kind, id);
  const obj = kind === "load" ? host && host.load : host;
  if (!obj) return;
  const noun = kind === "gun" ? "firearm" : kind;
  if (gearUsed(kind, id)) {
    openGearDlg(`“${obj.name}” has saved sessions or strings, so it can’t be deleted. Archive hides it from pickers. History still shows its name.`, "Archive", () => setArchived(kind, id, true), false);
    return;
  }
  openGearDlg(`Delete unused ${noun} “${obj.name}”? This can’t be undone.`, "Delete", () => hardDelete(kind, id), true);
}
function finishGear(kind) {
  gearSec = kind;
  gearEditing = true;
  ["rifleDetails", "loadDetails", "opMore"].forEach(elId => { const el = $(elId); if (el) el.open = false; });
  paintGearList();
  updateDirty();
}
function confirmSize(gun, load, proceed) {
  const ref = sizeRef(gun);
  if (!load || !sizeWarn(ref, load)) { proceed(); return; }
  openGearDlg(`This bullet is ${dia3(load.diameter)} and this firearm's bore is ${dia3(ref.dia)}.`, "Use anyway", proceed, false, true);
}
function openLoadGear(host) {
  P.lastRifleId = host.rifle.id;
  if (host.rifle.lastOpticId && (P.optics || []).some(o => o.id === host.rifle.lastOpticId && !o.archived)) host.rifle.opticId = host.rifle.lastOpticId;
  applyRifle();
  host.rifle.lastLoadId = host.load.id;
  applyLoad(); savePresets(); renderPickers();
  finishGear("load");
}
function showGear(kind, id) {
  if (kind === "optic") {
    const o = gearHost("optic", id); if (!o) return;
    const r = curRifle();
    if (r && r.opticId === id) { finishGear("optic"); return; }
    if (!r) { toast("Pick a firearm first"); return; }
    const cur = (P.optics || []).find(x => x.id === r.opticId);
    openGearDlg(`Switch optic on ${r.name}? Current: ${cur ? cur.name : "none"} -> New: ${o.name}`, "Switch", () => { attachOptic(id, false, true); finishGear("optic"); }, false, true);
    return;
  }
  if (kind === "load") {
    const host = gearHost("load", id); if (!host) return;
    const r = curRifle();
    const same = r && host.rifle.id === r.id && host.load.id === r.lastLoadId;
    if (!same) { confirmSize(r, host.load, () => openLoadGear(host)); return; }
    openLoadGear(host);
    return;
  }
  const r = P.rifles.find(x => x.id === id); if (!r) return;
  P.lastRifleId = r.id;
  if (r.lastOpticId && (P.optics || []).some(o => o.id === r.lastOpticId && !o.archived)) r.opticId = r.lastOpticId;
  applyRifle(); applyLoad(); savePresets(); renderPickers();
  finishGear("gun");
}
export function init2() {
  $("zUseCur").onclick = () => {
    setVal("zTemp", val("temp")); setVal("zHum", val("humidity")); setVal("zAlt", val("altitude")); setVal("zPress", val("pressure"));
    updateDirty(); schedule(); toast(`Zero conditions set to today's: ${val("temp")}°F · ${val("altitude") || 0} ft${val("pressure") ? " · " + val("pressure") + " inHg" : ""}`);
  };
  $("roundClk").checked = !!S.round;
}

export { ADD_V, paintLoadMore, moreNeeded, paintSample, curRifle, curLoad, curRange, fillOptions, renderPickers, applyRifle, applyGunKind, applyLoad, applyRange, same, isDirty, formFor, savedT, autosave, flashSaved, updateDirty, ldShort, recipeText, SNAP_F, recipeSnapshot, cleanRecipe, paintLdKind, askName, pick, pkRefresh, openPk, closePk, paintGearExtra, askRemove, activeOf, confirmSize, suggestionFor, paintZeroNotice, saveOrApply, dismissSuggestion, confirmZeroNow };
