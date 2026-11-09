// beta/js/gear.js — Gear tab: rifle/optic/load profiles, dirty tracking, load-data summary, zero-use helpers.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { bandsOn, renderBulletInfo } from "./bulletdb.js";
import { mvAdjOn, mvAdjust, powderT, zeroCond } from "./calc.js";
import { ctxPaint, toast } from "./components.js";
import { $, compass, escapeHtml, fmt, n1, n3, num, setVal, val } from "./core.js";
import { LOG, cleanSession, exportSessions, maybeRenderLog, saveLog, set_LOG, set_slKey, slKey } from "./log.js";
import { applyOptic, curOptic, effSH, paintOptic } from "./optics.js";
import { openCopy, paintRecipeBtns } from "./recipes.js";
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
let gearSec = "gun", gearArchOn = false, gearEditing = false, gearDlgJob = null;
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
  const rec = currentGearRecord();
  $("gearArchive").hidden = !gearEditing || !rec;
  if (rec) $("gearArchive").textContent = rec.archived ? "Unarchive" : "Archive";
}
function currentGearRecord() {
  if (gearSec === "gun") return curRifle();
  if (gearSec === "optic") return curOptic();
  return curLoad();
}
function paintGearList() {
  const box = $("gearList"); if (!box) return;
  paintGearMode();
  const hist = gearHistory();
  const wantArch = gearArchOn;
  const rows = [];
  if (gearSec === "gun") {
    for (const r of P.rifles) {
      if (!!r.archived !== wantArch) continue;
      const optic = r.opticId && (P.optics || []).find(o => o.id === r.opticId);
      const load = (r.loads || []).find(l => l.id === r.lastLoadId) || (r.loads || []).find(l => !l.archived);
      const bits = [r.name, r.barrel ? `${r.barrel}"` : "", twistBit(r), optic && optic.name, load && load.name].filter(Boolean);
      const last = hist.guns[r.id] && hist.guns[r.id].last;
      const link = [optic ? optic.name : "No optic", load ? load.name : "No load", last ? `Last used ${shortDate(last)}` : "No sessions yet"].join(" · ");
      rows.push({ kind: "gun", id: r.id, line: bits.join(" · "), link, archived: !!r.archived });
    }
  } else if (gearSec === "optic") {
    for (const o of P.optics || []) {
      if (!!o.archived !== wantArch) continue;
      const guns = P.rifles.filter(r => r.opticId === o.id).map(r => r.name);
      const ts = o.opTurret || "";
      rows.push({ kind: "optic", id: o.id, line: [o.name, ts].filter(Boolean).join(" · "), link: guns.length ? `On ${guns.join(", ")}` : "Not on a firearm", archived: !!o.archived });
    }
  } else {
    for (const r of P.rifles) for (const l of r.loads || []) {
      if (!!l.archived !== wantArch) continue;
      const n = hist.loads[l.id] ? hist.loads[l.id].strings : 0;
      rows.push({ kind: "load", id: l.id, line: [l.name, l.mv ? `${l.mv} fps` : "", r.name].filter(Boolean).join(" · "), link: `On ${r.name} · ${n} string${n === 1 ? "" : "s"}`, archived: !!l.archived });
    }
  }
  box.innerHTML = rows.length ? rows.map(row => `<button type="button" class="gearItem" data-kind="${row.kind}" data-id="${escapeHtml(row.id)}"><b>${escapeHtml(row.line)}</b><small>${escapeHtml(row.link)}</small>${row.archived ? `<span class="unarch" data-unarch="1">Unarchive</span>` : ""}</button>`).join("")
    : `<div class="hint">${wantArch ? "Nothing archived." : "Nothing saved in this section yet."}</div>`;
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
function applyRifle() { const r = curRifle(); if (r) RIFLE_F.forEach(f => setVal(f, r[f] || F_DEF[f] || r[f])); formFor.r = r?.id || null; applyGunKind(); applyOptic(); }
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
  if (r && formFor.r === r.id && isDirty(r, RIFLE_F)) { Object.assign(r, pick(RIFLE_F)); done.push("rifle"); }
  if (l && formFor.l === l.id && isDirty(l, LOAD_F)) { Object.assign(l, pick(LOAD_F)); done.push("load"); }
  { const o = curOptic(); if (o && formFor.o === o.id && isDirty(o, OPTIC_F)) { Object.assign(o, pick(OPTIC_F)); done.push("optic"); } }
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
    bandsOn() ? "banded G1" : "", mvAdjOn() ? `${val("ptSens")} fps/10°F` : "", ls || ""];
  $("loadMoreSum").textContent = parts.filter(Boolean).join(" · ");
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
  ["recipeDetails", "mvEstBox"].forEach(id => $(id).addEventListener("toggle", () => { if ($(id).open) $("loadDetails").open = true; }));
  $("ldKindSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("ldKind").value = b.dataset.v; paintLdKind(); updateDirty(); });

  $("rifleSel").onchange = e => { if (e.target.value === ADD_V) { e.target.value = curRifle()?.id || ""; const n0 = P.rifles.length; $("rifleNew").click(); if (P.rifles.length > n0) $("rifleDetails").open = true; return; }
    P.lastRifleId = e.target.value; const r = curRifle();
    if (r?.lastOpticId && (P.optics || []).some(o => o.id === r.lastOpticId)) r.opticId = r.lastOpticId;
    applyRifle(); renderPickers(); applyLoad(); savePresets(); updateDirty(); schedule(); };
  $("loadSel").onchange = e => { if (e.target.value === ADD_V) { e.target.value = curLoad()?.id || ""; $("loadNew").click(); return; }
    const r = curRifle(); if (r) r.lastLoadId = e.target.value; applyLoad(); savePresets(); updateDirty(); schedule(); };
  $("rangeSel").onchange = e => { P.lastRangeId = e.target.value || null; applyRange(); savePresets(); updateDirty(); refreshWeather(); schedule(); };
  $("rifleNew").onclick = () => { const n = askName("Name for the new gun (starts from the gun details on screen):", ""); if (!n) return;
    const r = { id: uid(), name: n, ...pick(RIFLE_F), loads: [] };
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
  $("gearSwitch").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; gearSec = b.dataset.sec; gearEditing = false; paintGearList(); });
  $("gearArch").onclick = () => { gearArchOn = !gearArchOn; paintGearList(); };
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
        loads: (Array.isArray(r.loads) ? r.loads : []).filter(l => l && l.name).map(l => ({ id: str(l.id) || uid(), name: String(l.name).slice(0, 60),
          ...keepArch(l),
          ...Object.fromEntries(LOAD_F.map(k => [k, str(l[k], LONG_F[k])])) })) }));
      const ranges = (Array.isArray(d.ranges) ? d.ranges : []).filter(g => g && g.name).map(g => ({ id: str(g.id) || uid(), name: String(g.name).slice(0, 60),
        ...Object.fromEntries(RANGE_F.map(k => [k, str(g[k])])) }));
      const sess = (Array.isArray(d.shotSessions) ? d.shotSessions : []).map(cleanSession).filter(Boolean);
      const optics = (Array.isArray(d.optics) ? d.optics : []).filter(o => o && o.name).map(o => ({ id: str(o.id) || uid(), name: String(o.name).slice(0, 60), ...keepArch(o), ...Object.fromEntries(OPTIC_F.map(k => [k, str(o[k])])) }));
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

function openGearDlg(msg, label, job, danger) {
  $("gearDlgMsg").textContent = msg;
  $("gearDlgGo").textContent = label;
  $("gearDlgGo").classList.toggle("danger", !!danger);
  gearDlgJob = job;
  $("gearDlg").hidden = false;
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
function showGear(kind, id) {
  gearSec = kind;
  gearEditing = true;
  if (kind === "gun") {
    const r = P.rifles.find(x => x.id === id); if (!r) return;
    P.lastRifleId = r.id;
    if (r.lastOpticId && (P.optics || []).some(o => o.id === r.lastOpticId && !o.archived)) r.opticId = r.lastOpticId;
    applyRifle(); applyLoad(); savePresets(); renderPickers();
  } else if (kind === "load") {
    const host = gearHost("load", id); if (!host) return;
    P.lastRifleId = host.rifle.id;
    if (host.rifle.lastOpticId && (P.optics || []).some(o => o.id === host.rifle.lastOpticId && !o.archived)) host.rifle.opticId = host.rifle.lastOpticId;
    applyRifle();
    host.rifle.lastLoadId = id;
    applyLoad(); savePresets(); renderPickers();
  } else {
    const o = gearHost("optic", id); if (!o) return;
    const gun = P.rifles.find(r => r.opticId === id && !r.archived) || P.rifles.find(r => r.opticId === id);
    if (gun) { P.lastRifleId = gun.id; applyRifle(); applyLoad(); savePresets(); renderPickers(); }
    else {
      OPTIC_F.forEach(f => setVal(f, (o[f] ?? "") === "" && F_DEF[f] ? F_DEF[f] : (o[f] ?? "")));
      formFor.o = o.id;
      $("opticBody").hidden = false;
    }
  }
  ["rifleDetails", "loadDetails", "opMore"].forEach(elId => { const el = $(elId); if (el) el.open = false; });
  paintGearList();
  updateDirty();
}
export function init2() {
  $("zUseCur").onclick = () => {
    setVal("zTemp", val("temp")); setVal("zHum", val("humidity")); setVal("zAlt", val("altitude")); setVal("zPress", val("pressure"));
    updateDirty(); schedule(); toast(`Zero conditions set to today's: ${val("temp")}°F · ${val("altitude") || 0} ft${val("pressure") ? " · " + val("pressure") + " inHg" : ""}`);
  };
  $("roundClk").checked = !!S.round;
}

export { ADD_V, paintLoadMore, moreNeeded, paintSample, curRifle, curLoad, curRange, fillOptions, renderPickers, applyRifle, applyGunKind, applyLoad, applyRange, same, isDirty, formFor, savedT, autosave, flashSaved, updateDirty, ldShort, recipeText, SNAP_F, recipeSnapshot, cleanRecipe, paintLdKind, askName, pick, pkRefresh, openPk, closePk, paintGearExtra, askRemove, activeOf };
