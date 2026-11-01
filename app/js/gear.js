// app/js/gear.js — Gear tab: rifle/optic/load profiles, dirty tracking, load-data summary, zero-use helpers.
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { bandsOn, renderBulletInfo } from "./bulletdb.js";
import { mvAdjust, powderT, zeroCond } from "./calc.js";
import { ctxPaint, toast } from "./components.js";
import { $, compass, fmt, n1, n3, num, setVal, val } from "./core.js";
import { LOG, cleanSession, maybeRenderLog, saveLog, set_LOG, set_slKey, slKey } from "./log.js";
import { applyOptic, curOptic, effSH, paintOptic } from "./optics.js";
import { openCopy, paintRecipeBtns } from "./recipes.js";
import { SH, shPendCheck } from "./shooting.js";
import { F_DEF, LOAD_F, LONG_F, OPTIC_F, P, RANGE_F, REC_F, RIFLE_F, S, migrateGunOptic, migratePresets, savePresets, uid } from "./storage.js";
import { applyAuto, fetchJSON, getPosition, manual, refreshWeather } from "./weather.js";


/* ---------------- presets: gun (rifle | handgun) / load / range ---------------- */
const curRifle = () => P.rifles.find(r => r.id === P.lastRifleId) || null;
const curLoad = () => { const r = curRifle(); return r ? (r.loads.find(l => l.id === r.lastLoadId) || null) : null; };
const curRange = () => P.ranges.find(r => r.id === P.lastRangeId) || null;

function fillOptions(sel, items, cur, emptyText) {
  sel.innerHTML = "";
  if (emptyText !== undefined) { const o = new Option(emptyText, ""); sel.add(o); }
  items.forEach(it => sel.add(new Option(it.name, it.id)));
  sel.value = cur ? cur.id : "";
}
function renderPickers() {
  if (!curRifle() && P.rifles.length) P.lastRifleId = P.rifles[0].id;
  const r = curRifle();
  if (r && !r.loads.find(l => l.id === r.lastLoadId) && r.loads.length) r.lastLoadId = r.loads[0].id;
  fillOptions($("rifleSel"), P.rifles, r, P.rifles.length ? undefined : "No guns yet (⋯ › New)");
  fillOptions($("loadSel"), r ? r.loads : [], curLoad(), (r && r.loads.length) ? undefined : (r ? "No loads yet (⋯ › New)" : "Add a gun first"));
  fillOptions($("rangeSel"), P.ranges, curRange(), "Current location");
  updateDirty();
}
function applyRifle() { const r = curRifle(); if (r) RIFLE_F.forEach(f => setVal(f, r[f] || F_DEF[f] || r[f])); formFor.r = r?.id || null; applyGunKind(); applyOptic(); }
function applyGunKind() { const hg = $("gunKind").value === "handgun"; $("barrel").placeholder = hg ? "optional, e.g. 4.25" : "optional, e.g. 20"; }
function applyLoad() { if (SH.pend) setTimeout(shPendCheck, 0); const l = curLoad(); if (l) LOAD_F.forEach(f => setVal(f, (l[f] ?? "") === "" && F_DEF[f] ? F_DEF[f] : l[f])); formFor.l = l?.id || null; paintLdKind(); renderBulletInfo(); }
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
function flashSaved(k) { const el = $(k + "Saved"); if (!el) return; el.textContent = "✓ Saved"; el.classList.add("show"); clearTimeout(savedT[k]); savedT[k] = setTimeout(() => el.classList.remove("show"), 1500); }
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
  $("loadRecipe").textContent = rt ? (val("ldKind") === "factory" ? "📦 " : "🧪 ") + rt : "";
  const ls = ldShort(pick(LOAD_F)); $("recipeSum").textContent = ls; $("recipeSum").hidden = !ls;
  const b = num("bearing");
  $("rangeSum").textContent = (g ? "" : "Weather uses your phone's location. ") +
    (b != null ? `Facing ${fmt(b, 0)}° ${compass(b)}` : "No shooting direction set") +
    (val("altitude") ? ` · ${val("altitude")} ft` : "") + (val("target") ? ` · target ${val("target")} yd` : "") +
    (g && val("rangeLat") && val("rangeLon") ? ` · ${(+val("rangeLat")).toFixed(3)}, ${(+val("rangeLon")).toFixed(3)}` : "");
  paintGearExtra();
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
  const oN = !!curOptic(), t = $("turret").value === "custom" && !oN; $("turretCustom").hidden = !t; $("turretCustomU").hidden = !t;
  paintOptic();
  const zc = zeroCond();
  $("zeroSum").textContent = zc ? [num("zTemp") != null ? `${val("zTemp")}°F` : "", num("zHum") != null ? `${val("zHum")}%` : "", num("zAlt") != null ? `${val("zAlt")} ft` : "", num("zPress") != null ? `${val("zPress")} inHg` : ""].filter(Boolean).join(" · ") : "same as today";
  const tn = val("trued"); $("truedNote").hidden = !tn; $("truedNote").textContent = tn ? "🎯 " + tn : "";
}

export function init1() {
  SNAP_F = ["loadName", "gunName", "gunKind", "bulletName", "weight", "bc", "drag", "mv", "diameter", "ptSens", "mvTemp", "mvAdj", ...REC_F];
  $("ldKindSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; $("ldKind").value = b.dataset.v; paintLdKind(); updateDirty(); });

  $("rifleSel").onchange = e => { P.lastRifleId = e.target.value; applyRifle(); renderPickers(); applyLoad(); savePresets(); updateDirty(); schedule(); };
  $("loadSel").onchange = e => { const r = curRifle(); if (r) r.lastLoadId = e.target.value; applyLoad(); savePresets(); updateDirty(); schedule(); };
  $("rangeSel").onchange = e => { P.lastRangeId = e.target.value || null; applyRange(); savePresets(); updateDirty(); refreshWeather(); schedule(); };
  $("rifleNew").onclick = () => { const n = askName("Name for the new gun (starts from the gun details on screen):", ""); if (!n) return;
    const r = { id: uid(), name: n, ...pick(RIFLE_F), loads: [] };
    const l = curLoad(); if (l) { const c = { ...pick(LOAD_F), id: uid(), name: l.name }; r.loads.push(c); r.lastLoadId = c.id; }
    P.rifles.push(r); P.lastRifleId = r.id; pkRefresh(); toast(`Gun “${n}” added${r.loads.length ? " (current load copied)" : ""}`); };
  $("rifleDup").onclick = () => { const r = curRifle(); if (!r) return;
    const c = JSON.parse(JSON.stringify(r)); c.id = uid(); let n = `${r.name} (copy)`.slice(0, 60), k = 2; while (P.rifles.some(x => x.name === n)) n = `${r.name} (copy ${k++})`.slice(0, 60); c.name = n;
    c.loads.forEach(l => { const nid = uid(); if (l.id === r.lastLoadId) c.lastLoadId = nid; l.id = nid; });
    c.opticId = null; delete c.zeroUnconf;
    P.rifles.push(c); P.lastRifleId = c.id; pkRefresh(); toast(`Duplicated as “${n}” (${c.loads.length} load${c.loads.length === 1 ? "" : "s"}; chrono sessions stay with the original)`); };
  $("rifleRename").onclick = () => { const r = curRifle(); if (!r) return; const n = askName("Rename gun:", r.name); if (!n) return; r.name = n; savePresets(); renderPickers(); flashSaved("rifle"); };
  $("rifleDel").onclick = () => { const r = curRifle(); if (!r || !confirm(`Delete gun “${r.name}” and its ${r.loads.length} load(s)?\nChrono sessions are kept as unassigned.`)) return;
    const i = P.rifles.indexOf(r); P.rifles.splice(i, 1); P.lastRifleId = P.rifles[0]?.id || null; pkRefresh();
    toast(`Gun “${r.name}” deleted`, { label: "Undo", fn: () => { P.rifles.splice(Math.min(i, P.rifles.length), 0, r); P.lastRifleId = r.id; pkRefresh(); toast(`Gun “${r.name}” restored`); } }); };

  $("loadNew").onclick = () => { const r = curRifle(); if (!r) return; const n = askName(`Name for the new load on “${r.name}” (starts from the load details on screen):`, ""); if (!n) return;
    const l = { id: uid(), name: n, ...pick(LOAD_F) }; r.loads.push(l); r.lastLoadId = l.id; pkRefresh(); toast(`Load “${n}” added`); };
  $("loadRename").onclick = () => { const l = curLoad(); if (!l) return; const n = askName("Rename load:", l.name); if (!n) return; l.name = n; savePresets(); renderPickers(); flashSaved("load"); };
  $("loadDel").onclick = () => { const r = curRifle(), l = curLoad(); if (!l || !confirm(`Delete load “${l.name}”?\nChrono sessions are kept as unassigned.`)) return;
    const i = r.loads.indexOf(l); r.loads.splice(i, 1); r.lastLoadId = r.loads[0]?.id || null; pkRefresh();
    toast(`Load “${l.name}” deleted`, { label: "Undo", fn: () => { if (!P.rifles.includes(r)) return; r.loads.splice(Math.min(i, r.loads.length), 0, l); r.lastLoadId = l.id; P.lastRifleId = r.id; pkRefresh(); toast(`Load “${l.name}” restored`); } }); };
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
  // capture: close the menu first, then the item's own handler runs (prompts/confirms appear over the page)
  $("pkMenu").addEventListener("click", e => { if (e.target === $("pkMenu") || e.target.closest(".grp button, #pkCancel")) closePk(); }, true);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("pkMenu").classList.contains("show")) closePk(); });
  $("rangeHere").onclick = async () => {
    try {
      const c = await getPosition();
      setVal("rangeLat", c.lat.toFixed(5)); setVal("rangeLon", c.lon.toFixed(5));
      if (navigator.onLine !== false) try { const e = await fetchJSON(`https://api.open-meteo.com/v1/elevation?latitude=${c.lat}&longitude=${c.lon}`);
        if (e.elevation?.[0] != null) { setVal("altitude", Math.round(e.elevation[0] * 3.28084)); manual.add("altitude"); } } catch {}
      updateDirty(); toast((curRange() ? `Location saved to “${curRange().name}”` : "Location filled — use ⋯ › New range to save it as a range") + (navigator.onLine === false ? " (offline: enter elevation by hand)" : ""));
    } catch (e) { toast("Couldn't get location: " + e.message); }
  };

  /* export / import */
  $("exportBtn").onclick = () => {
    const data = JSON.stringify({ app: "ballistic-calculator", exported: new Date().toISOString(), ...P, shotSessions: LOG }, null, 2);
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
      const rifles = d.rifles.filter(r => r && r.name).map(r => ({ id: str(r.id) || uid(), name: String(r.name).slice(0, 60),
        ...Object.fromEntries(RIFLE_F.map(k => [k, str(r[k])])), lastLoadId: str(r.lastLoadId) || null, opticId: str(r.opticId) || null,
        ...(r.zeroUnconf && typeof r.zeroUnconf === "object" ? { zeroUnconf: { why: str(r.zeroUnconf.why, 120), at: str(r.zeroUnconf.at) } } : {}),
        loads: (Array.isArray(r.loads) ? r.loads : []).filter(l => l && l.name).map(l => ({ id: str(l.id) || uid(), name: String(l.name).slice(0, 60),
          ...Object.fromEntries(LOAD_F.map(k => [k, str(l[k], LONG_F[k])])) })) }));
      const ranges = (Array.isArray(d.ranges) ? d.ranges : []).filter(g => g && g.name).map(g => ({ id: str(g.id) || uid(), name: String(g.name).slice(0, 60),
        ...Object.fromEntries(RANGE_F.map(k => [k, str(g[k])])) }));
      const sess = (Array.isArray(d.shotSessions) ? d.shotSessions : []).map(cleanSession).filter(Boolean);
      const optics = (Array.isArray(d.optics) ? d.optics : []).filter(o => o && o.name).map(o => ({ id: str(o.id) || uid(), name: String(o.name).slice(0, 60), ...Object.fromEntries(OPTIC_F.map(k => [k, str(o[k])])) }));
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

export function init2() {
  $("zUseCur").onclick = () => {
    setVal("zTemp", val("temp")); setVal("zHum", val("humidity")); setVal("zAlt", val("altitude")); setVal("zPress", val("pressure"));
    updateDirty(); schedule(); toast(`Zero conditions set to today's: ${val("temp")}°F · ${val("altitude") || 0} ft${val("pressure") ? " · " + val("pressure") + " inHg" : ""}`);
  };
  $("roundClk").checked = !!S.round;
}

export { curRifle, curLoad, curRange, fillOptions, renderPickers, applyRifle, applyGunKind, applyLoad, applyRange, same, isDirty, formFor, savedT, autosave, flashSaved, updateDirty, ldShort, recipeText, SNAP_F, recipeSnapshot, cleanRecipe, paintLdKind, askName, pick, pkRefresh, openPk, closePk, paintGearExtra };
