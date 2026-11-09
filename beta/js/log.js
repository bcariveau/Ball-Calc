// beta/js/log.js — Log tab: chronograph session list/editor and the LOG store.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { idbGet, idbPut } from "./bulletdb.js";
import { powderT } from "./calc.js";
import { setIconText, shBtnPaint, toast } from "./components.js";
import { $, escapeHtml, fmt, n1, n3, num, setVal } from "./core.js";
import { cleanRecipe, curLoad, curRifle, recipeSnapshot, recipeText, updateDirty } from "./gear.js";
import { closeImport } from "./log-import.js";
import { SEL, lpFired, paintSel, set_lpFired } from "./reassign.js";
import { SH, shHide, shNeedGear, shPaint, shRollIfEnded } from "./shooting.js";
import { banHide, banPaint, banShow } from "./shot-banner.js";
import { asFiredFrom, cleanAsFired, assignShots, calcFallback, opticOn, placeOnString, scopeSentence, staleMv } from "./link-v3.js";
import { P, load, savePresets, store, uid } from "./storage.js";
import { paintStrBar, paintTgView } from "./strings.js";
import { mkGlyph } from "./target-draw.js";
import { shotDetail, tgThumbA, tgThumbB } from "./target-editor.js";
import { BAN, LIVE, TE, cleanTg, fpsT, set_LIVE, set_TE, strNo, strOf, tgEnsure, tgRestore, tgSaveSidecar, tgView, tgtLetter, unpair } from "./targets.js";
import { cv } from "./themes.js";
import { wx } from "./weather.js";


/* ---------------- chronograph shot log ---------------- */
// Sessions live in IndexedDB (key "shotlog"; localStorage fallback) and are included in Export/Import.
// session: { id, rifleId, loadId, date (ISO), source: "manual"|"athlon"|"bluetooth", shots: [{ v (fps), t?, note?, cold?, clean? }],
//            notes, wx: { temp °F, humidity %, pressure inHg, altitude ft }, barrel (in), importKey?, title?, device?: { avg, sd, es, unit } }
const SHEETJS_URLS = ["./vendor/xlsx-0.20.3.mjs", "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"];   // pinned; loaded only when importing a spreadsheet (vendored copy is precached for offline)
const ENGINE_URLS = ["./vendor/js-ballistics-3.1.0.js", "https://cdn.jsdelivr.net/npm/js-ballistics@3.1.0/dist/index.js"];   // vendored copy first so the app runs offline
const K_LOG = "bcalc.shotlog.v1";
const MPS = 3.28084;
let LOG = [];
let slKey = null;
let ED = null;
let edDirty = false;
let IMP = [];
let SHOTSEL = null;
let shotUndo = [];
async function loadLog() {
  let d = null;
  try { d = await idbGet("shotlog"); } catch {}
  if (!Array.isArray(d)) d = load(K_LOG, []);
  LOG = (Array.isArray(d) ? d : []).map(cleanSession).filter(Boolean);
  try { if (await tgRestore()) await saveLog(); } catch {}   // re-attach targets/tags if the stable page re-saved without them
}
async function saveLog() {
  try { await idbPut("shotlog", LOG); localStorage.removeItem(K_LOG); }
  catch { store(K_LOG, LOG); }
  try { await tgSaveSidecar(); } catch {}
}
const nOrNull = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const sstr = (v, n) => v == null ? "" : String(v).slice(0, n);
function cleanSession(x) {
  if (!x || typeof x !== "object" || !Array.isArray(x.shots)) return null;
  const seenId = new Set();
  const shots = x.shots.map(sh => ({ v: nOrNull(sh && sh.v), t: sstr(sh && sh.t, 20), note: sstr(sh && sh.note, 200), cold: !!(sh && sh.cold), clean: !!(sh && sh.clean),
      id: sstr(sh && sh.id, 20), str: sstr(sh && sh.str, 20), x: !!(sh && sh.x), fl: !!(sh && sh.fl), ie: !!(sh && sh.ie) }))
    .filter(sh => sh.v != null && sh.v >= 50 && sh.v <= 6000).map(sh => { ["t", "note", "id", "str"].forEach(k => { if (!sh[k]) delete sh[k]; }); ["cold", "clean", "x", "fl", "ie"].forEach(k => { if (!sh[k]) delete sh[k]; });
      if (sh.id) { if (seenId.has(sh.id)) sh.id = uid(); seenId.add(sh.id); } return sh; });
  const d = new Date(x.date); const wx = x.wx || {};
  const out = { id: sstr(x.id, 40) || uid(), rifleId: sstr(x.rifleId, 40), loadId: sstr(x.loadId, 40), date: isNaN(d) ? new Date().toISOString() : d.toISOString(),
    source: ["manual", "athlon", "bluetooth"].includes(x.source) ? x.source : "manual", shots, notes: sstr(x.notes, 300),
    wx: { temp: nOrNull(wx.temp), humidity: nOrNull(wx.humidity), pressure: nOrNull(wx.pressure), altitude: nOrNull(wx.altitude), powder: nOrNull(wx.powder) }, barrel: nOrNull(x.barrel) };
  { const af = cleanAsFired(x.asFired); if (af) out.asFired = af; }
  if (x.importKey) out.importKey = sstr(x.importKey, 2000);
  if (x.title) out.title = sstr(x.title, 120);
  { const rc = cleanRecipe(x.recipe); if (rc) out.recipe = rc; }
  if (x.device && typeof x.device === "object") out.device = { avg: nOrNull(x.device.avg), sd: nOrNull(x.device.sd), es: nOrNull(x.device.es), unit: sstr(x.device.unit, 8) };
  { const tg = cleanTg(x.tg, seenId); if (tg) { out.tg = tg; shots.forEach(sh => { if (sh.str && !tg.strings.some(q => q.id === sh.str)) delete sh.str; }); } else shots.forEach(sh => { delete sh.str; }); }   // targets (additive)
  out.stats = shotStats(shots);
  return out;
}
function shotStats(shots) {
  const v = shots.filter(s => !s.x).map(s => s.v).filter(x => x != null), n = v.length;   // removed shots (x) stay in the log but out of every stat. Tags never exclude.
  if (!n) return { n: 0 };
  const avg = v.reduce((a, b) => a + b, 0) / n, min = Math.min(...v), max = Math.max(...v);
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;   // sample SD (n−1)
  return { n, avg: +avg.toFixed(1), sd: +sd.toFixed(1), es: +(max - min).toFixed(1), min, max };
}
function stringWho(st) {
  const af = st && st.asFired; if (!af) return "";
  const gun = P.rifles.find(r => r.id === af.rifleId);
  const load = gun && (gun.loads || []).find(l => l.id === af.loadId);
  return [gun && gun.name, load && load.name].filter(Boolean).join(" · ");
}
function sessionGearLabel(session) {
  const seen = [], add = (w) => { if (w && !seen.includes(w)) seen.push(w); };
  tgView(session).strings.forEach(st => add(stringWho(st)));
  if (!seen.length) {
    const r = P.rifles.find(x => x.id === session.rifleId), l = r?.loads.find(x => x.id === session.loadId);
    add([r?.name, l?.name].filter(Boolean).join(" · "));
  }
  return seen.join(", ");
}
function stringStatRows(session) {
  const t = tgView(session);
  return t.strings.map((st, i) => {
    const stats = shotStats((session.shots || []).filter(sh => strOf(session, sh) === st.id));
    const af = st.asFired || {}, gun = P.rifles.find(r => r.id === af.rifleId), load = gun && (gun.loads || []).find(l => l.id === af.loadId);
    return { index: i + 1, id: st.id, gun: gun ? gun.name : "", load: load ? load.name : "", n: stats.n || 0, avg: stats.n ? stats.avg : null, sd: stats.n > 1 ? stats.sd : null, es: stats.n > 1 ? stats.es : null, min: stats.n ? stats.min : null, max: stats.n ? stats.max : null };
  });
}
function stringStatText(session) {
  return stringStatRows(session).map(r => `S${r.index} ${[r.gun, r.load].filter(Boolean).join(" · ")} n=${r.n} avg=${r.avg ?? ""} sd=${r.sd ?? ""} es=${r.es ?? ""}`).join(" | ");
}
function keptOnLoad(session, loadId) {
  if (!session || !loadId) return [];
  return (session.shots || []).filter(s => {
    if (!s || s.x) return false;
    const sid = strOf(session, s);
    const st = session.tg && session.tg.strings && session.tg.strings.find(q => q.id === sid);
    const lid = (st && st.asFired && st.asFired.loadId) || session.loadId;
    return lid === loadId;
  });
}
function exportSessions() {
  return LOG.map(s => { const copy = JSON.parse(JSON.stringify(s)); delete copy.stats; copy.stringStats = stringStatRows(s); return copy; });
}
const curKeyIds = () => ({ rifleId: curRifle()?.id || "", loadId: curLoad()?.id || "" });
const sessFor = (rifleId, loadId) => LOG.filter(s => s.rifleId === rifleId && s.loadId === loadId).sort((a, b) => a.date.localeCompare(b.date));
const fmtDate = iso => { const d = new Date(iso); return d.toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
const SRC_LBL = { manual: "manual", athlon: "Athlon import", bluetooth: "Bluetooth" };
function maybeRenderLog() { const k = JSON.stringify(curKeyIds()); if (k !== slKey) { slKey = k; renderLog(); if (window.__radarFlush) window.__radarFlush(); } }
function renderLog() {
  const { rifleId, loadId } = curKeyIds(), l = curLoad(), list = sessFor(rifleId, loadId);
  $("slNewBtn").disabled = false; $("slNewBtn").title = l ? "Type velocities by hand (no radar)" : "Pick a gun and load first"; shBtnPaint();
  const orph = orphanSessions(), emp = !l ? !LOG.length : !list.length;
  $("slSum").hidden = emp; $("slEmpty").hidden = !emp;   // one short muted line in the empty card
  if (!l) { $("slSum").textContent = "Pick or save a load to log chronograph sessions for it."; $("slList").innerHTML = (emp ? slEmptyHTML(false) : "") + orphanHTML(orph); $("slChartBox").style.display = "none"; $("slCmp").hidden = true; paintSel(); return; }
  const blurb = s => { const n = tgView(s).strings.length; return `${n} string${n === 1 ? "" : "s"}${sessionGearLabel(s) ? " · " + sessionGearLabel(s) : ""}`; };
  setIconText($("slSum"), list.length ? `${list.length} session${list.length > 1 ? "s" : ""} for “${l.name}”`
    : `No sessions yet for “${l.name}”. Tap <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> Session to type velocities, or import an Athlon file.`);
  $("slList").innerHTML = list.slice().reverse().map(s => `${tgThumbA(s)}<button type="button" class="slItem" data-id="${escapeHtml(s.id)}">
    <span>${escapeHtml(fmtDate(s.date))}</span>
    <span class="d">${escapeHtml(SRC_LBL[s.source] || s.source)}${s.barrel ? ` · ${s.barrel}" bbl` : ""}${s.notes ? " · " + escapeHtml(s.notes.slice(0, 40)) : ""}</span>
    <span class="d">${escapeHtml(blurb(s))}</span>${recipeText(s.recipe) ? `<span class="r">${escapeHtml(recipeText(s.recipe))}</span>` : ""}</button>${tgThumbB(s)}`).join("") + (emp ? slEmptyHTML(true) : "") + orphanHTML(orph);
  paintSel();
  $("slChartBox").style.display = "none";
  renderCompare();
}
function slEmptyHTML(hasLoad) {
  return "";   // the static #slEmpty line ("No sessions yet.") covers the empty state;  Start shooting sits right above
}
/* compare sessions (ladder / charge tests) */
let cmpScope = "load";
function renderCompare() {
  const { rifleId, loadId } = curKeyIds(), r = curRifle();
  const list = (cmpScope === "gun" ? LOG.filter(s => s.rifleId === rifleId) : sessFor(rifleId, loadId)).filter(s => (s.shots || []).some(sh => !sh.x));
  $("slCmp").hidden = !LOG.some(s => s.rifleId === rifleId && (s.shots || []).some(sh => !sh.x));
  $("slCmpScope").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === cmpScope));
  if (!list.length) { $("slCmpTbl").innerHTML = `<div class="hint">No sessions with shots for this ${cmpScope === "gun" ? "gun" : "load"} yet.</div>`; return; }
  const ch = s => { const v = parseFloat(s.recipe?.ldCharge); return isFinite(v) ? v : null; };
  const rows = list.slice().sort((a, b) => (ch(a) ?? 1e9) - (ch(b) ?? 1e9) || a.date.localeCompare(b.date));
  const lname = s => r?.loads.find(l => l.id === s.loadId)?.name || s.recipe?.loadName || "?";
  $("slCmpTbl").innerHTML = `<table><thead><tr>${cmpScope === "gun" ? "<th>Load</th>" : ""}<th>Charge</th><th>Powder</th><th>COAL</th><th>Strings</th><th title="Powder temp (air temp if not set)">°F</th><th>Date</th></tr></thead><tbody>` +
    rows.map(s => { const c = ch(s), rc = s.recipe || {};
      return `<tr data-id="${escapeHtml(s.id)}">${cmpScope === "gun" ? `<td class="l">${escapeHtml(lname(s))}</td>` : ""}
        <td>${c != null ? n1(c) : rc.ldKind === "factory" ? "fact." : "—"}</td><td class="l">${escapeHtml((rc.ldKind === "factory" ? rc.ldProduct || rc.ldMaker : rc.ldPowder) || "—")}</td>
        <td>${n3(rc.ldCOAL) || "—"}</td><td>${tgView(s).strings.length}</td>
        <td>${(s.wx.powder ?? s.wx.temp) != null ? fmt(s.wx.powder ?? s.wx.temp, 0) : "—"}</td><td>${escapeHtml(new Date(s.date).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }))}</td></tr>`; }).join("") + "</tbody></table>" +
    `<div class="hint">Sorted by charge (from each session's saved recipe). Velocity stats stay on each string. Tap a row to open it.</div>`;
}
/* CSV export of every session, one row per session, with the recipe snapshot */
// sessions whose gun or load no longer exists
function sessHome(s) { const r = P.rifles.find(x => x.id === s.rifleId), l = r?.loads.find(x => x.id === s.loadId); return { r, l, why: !r ? "deleted gun" : !l ? "deleted load" : "" }; }
function orphanSessions() { return LOG.filter(s => sessHome(s).why).sort((a, b) => b.date.localeCompare(a.date)); }
function orphanHTML(list) {
  if (!list.length) return "";
  return `<div class="slGrp"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Unassigned sessions (${list.length}) — their gun or load was deleted. Tap one and use <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move to give it a home.</div>` + list.map(s => {
    const h = sessHome(s), was = [s.recipe?.gunName, s.recipe?.loadName].filter(Boolean).join(" · ");
    return `<button type="button" class="slItem orphan" data-id="${escapeHtml(s.id)}"><span>${escapeHtml(fmtDate(s.date))}</span>
    <span class="o">Unassigned (${h.why})${was ? " · was " + escapeHtml(was) : ""}</span><span class="d">${escapeHtml(SRC_LBL[s.source] || s.source)} · ${tgView(s).strings.length} string${tgView(s).strings.length === 1 ? "" : "s"}</span>${recipeText(s.recipe) ? `<span class="r">${escapeHtml(recipeText(s.recipe))}</span>` : ""}</button>`;
  }).join("");
}
function sessionsCSV() {
  const q = v => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = ["date", "gun", "gun_type", "load", "source", "string_stats", "bullet", "weight_gr", "bc", "drag", "muzzle_velocity_preset",
    "ammo", "powder", "charge_gr", "primer", "case", "times_fired", "trim_in", "coal_in", "cbto_in", "jump_in", "case_prep", "factory_brand", "factory_product", "lot", "load_notes",
    "session_notes", "temp_f", "humidity", "pressure_inhg", "altitude_ft", "barrel_in", "powder_temp_f", "temp_sens_fps_per_10f", "chrono_temp_f", "mv_at_powder_temp", "strings", "targets", "discarded_shots", "shot_detail"];
  const rows = LOG.slice().sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const r = P.rifles.find(x => x.id === s.rifleId), l = r?.loads.find(x => x.id === s.loadId), rc = s.recipe || {};
    return [s.date, r?.name || rc.gunName, r?.gunKind || rc.gunKind, l?.name || (rc.loadName ? rc.loadName + (r ? " (deleted load)" : " (deleted gun)") : "(unassigned)"), s.source, stringStatText(s),
      rc.bulletName || (rc.weight ? rc.weight + " gr" : ""), rc.weight, rc.bc, rc.drag, rc.mv,
      rc.ldKind === "factory" ? "factory" : rc.ldKind ? "handload" : "", rc.ldPowder, rc.ldCharge, rc.ldPrimer, rc.ldCase, rc.ldFired, rc.ldTrim, rc.ldCOAL, rc.ldCBTO, rc.ldJump, rc.ldPrep,
      rc.ldMaker, rc.ldProduct, rc.ldLot, rc.ldNotes, s.notes, s.wx.temp, s.wx.humidity, s.wx.pressure, s.wx.altitude, s.barrel, s.wx.powder, rc.ptSens, rc.mvTemp, rc.mvAdj,
      tgView(s).strings.length, tgView(s).targets.length, s.shots.filter(x => x.x).length, shotDetail(s)].map(q).join(",");
  });
  return cols.join(",") + "\n" + rows.join("\n") + "\n";
}
function drawLogChart(list) {
  const cnv = $("slChart"), c = cnv.getContext("2d"), dpr = window.devicePixelRatio || 1, w = cnv.offsetWidth, h = cnv.offsetHeight;
  if (!w) return;
  cnv.width = w * dpr; cnv.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const pts = list.filter(s => s.stats.n).map(s => ({ a: s.stats.avg, sd: s.stats.sd || 0, d: s.date }));
  if (!pts.length) return;
  let lo = Math.min(...pts.map(p => p.a - p.sd)), hi = Math.max(...pts.map(p => p.a + p.sd));
  const pad = Math.max(5, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const L = 44, R = 10, T = 10, Bm = 22, X = i => pts.length === 1 ? (L + w - R) / 2 : L + i * (w - L - R) / (pts.length - 1), Y = v => T + (hi - v) / (hi - lo) * (h - T - Bm);
  c.font = "10px system-ui, sans-serif"; c.fillStyle = cv("hint"); c.strokeStyle = cv("border"); c.lineWidth = 1;
  for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, y = Y(v); c.beginPath(); c.moveTo(L, y); c.lineTo(w - R, y); c.stroke(); c.fillText(v.toFixed(0), 4, y + 3); }
  c.fillStyle = cv("accent"); c.globalAlpha = 0.22; c.beginPath();
  pts.forEach((p, i) => i ? c.lineTo(X(i), Y(p.a + p.sd)) : c.moveTo(X(i) - (pts.length === 1 ? 14 : 0), Y(p.a + p.sd)));
  if (pts.length === 1) c.lineTo(X(0) + 14, Y(pts[0].a + pts[0].sd));
  for (let i = pts.length - 1; i >= 0; i--) c.lineTo(X(i) + (pts.length === 1 ? (i ? 0 : 14) : 0), Y(pts[i].a - pts[i].sd));
  if (pts.length === 1) c.lineTo(X(0) - 14, Y(pts[0].a - pts[0].sd));
  c.closePath(); c.fill(); c.globalAlpha = 1;
  c.strokeStyle = cv("accent"); c.lineWidth = 2; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(X(i), Y(p.a)) : c.moveTo(X(i), Y(p.a))); c.stroke();
  c.fillStyle = cv("text"); pts.forEach((p, i) => { c.beginPath(); c.arc(X(i), Y(p.a), 3.5, 0, 7); c.fill(); });
  c.fillStyle = cv("hint"); const dl = iso => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  c.textAlign = "left"; c.fillText(dl(pts[0].d), L, h - 6);
  if (pts.length > 1) { c.textAlign = "right"; c.fillText(dl(pts[pts.length - 1].d), w - R, h - 6); }
  c.textAlign = "center"; c.fillText("avg fps ± 1 SD", (L + w - R) / 2, h - 6); c.textAlign = "left";
}

/* editor */
const toLocalInput = iso => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
function newSession(source = "manual") {
  const { rifleId, loadId } = curKeyIds();
  return { id: uid(), rifleId, loadId, date: new Date().toISOString(), source, shots: [], notes: "", recipe: recipeSnapshot(rifleId, loadId),
    wx: { temp: num("temp"), humidity: num("humidity"), pressure: num("pressure"), altitude: num("altitude"), powder: powderT() }, barrel: num("barrel"), _new: true };
}
function openEditor(sess) {
  if (!sess && !curLoad()) { toast("Pick a load first"); return; }
  ED = sess ? JSON.parse(JSON.stringify(sess)) : newSession(); edDirty = !sess;
  const r = P.rifles.find(x => x.id === ED.rifleId), l = r?.loads.find(x => x.id === ED.loadId);
  $("slEdTitle").textContent = ED._new ? "New session" : "Session";
  paintEdFor();
  $("slDate").value = toLocalInput(ED.date); $("slNotes").value = ED.notes || "";
  setVal("slTemp", ED.wx.temp); setVal("slPowder", ED.wx.powder); setVal("slHum", ED.wx.humidity); setVal("slPress", ED.wx.pressure); setVal("slAlt", ED.wx.altitude); setVal("slBarrel", ED.barrel);
  $("slSource").value = SRC_LBL[ED.source] || ED.source; $("slDel").style.display = ED._new ? "none" : ""; paintEdRecipe();
  $("slDevStats").textContent = ED.device && ED.device.avg != null ? `Device-reported: avg ${ED.device.avg}, SD ${ED.device.sd}, ES ${ED.device.es} ${ED.device.unit} (the app recomputes stats from the shots, SD uses n−1).` : "";
  if (BAN.sid && BAN.sid !== ED.id) banHide();
  $("slEditor").classList.add("show"); document.body.style.overflow = "hidden"; renderEditor();
  if (ED._new && !SH.on) setTimeout(() => $("slVel").focus(), 50);
}
function paintEdFor() {
  const h = sessHome(ED), was = [ED.recipe?.gunName, ED.recipe?.loadName].filter(Boolean).join(" · ");
  $("slEdFor").textContent = h.why ? `Unassigned (${h.why})${was ? " · was " + was : ""}` : `${h.r.name} · ${h.l.name}${ED.title ? " · " + ED.title : ""}`;
  $("slEdFor").style.color = h.why ? "var(--warn)" : "";
  $("slMoveBtn").classList.toggle("hot", !!h.why);
  $("slMoveBtn").innerHTML = h.why ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Assign to a saved gun + load" : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move / reassign (gun, load)";
}
function paintEdRecipe() {
  const t = recipeText(ED.recipe, true);
  $("slEdRecipe").innerHTML = t ? (ED.recipe.ldKind === "factory" ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'/><path d='M12 22V12'/><path d='m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7'/></svg> " : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2'/><path d='M8.5 2h7'/><path d='M7 16h10'/></svg> ") + escapeHtml(t) : "No load data saved with this session.";
  $("slEdRecipeBtn").innerHTML = t ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/><path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/><path d='M8 16H3v5'/></svg> Replace with the load's current data" : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48'/></svg> Attach the load's current data";
}
function renderEditor() {
  const tv = tgView(ED), multi = tv.strings.length > 1;
  const gear = sessionGearLabel(ED);
  $("slStats").className = "sessSum";
  $("slStats").textContent = `${tv.strings.length} string${tv.strings.length === 1 ? "" : "s"}${gear ? " · " + gear : ""}`;
  const row = ({ s, i }, sst, si) => `<div class="shot${s.x ? " dis" : ""}" data-i="${i}" data-id="${escapeHtml(s.id || "")}">
    ${SHOTSEL ? `<input type="checkbox" class="shotCk" data-sel="${escapeHtml(s.id || "")}" ${s.id && SHOTSEL.has(s.id) ? "checked" : ""} aria-label="Select shot ${i + 1}">` : ""}
    <span class="n">#${i + 1}</span><span class="mid"><span class="v">${fpsT(s.v)}</span> <span class="dv">${s.x ? "removed" : sst.n > 1 ? (Math.round(s.v - sst.avg) >= 0 ? "+" : "−") + Math.abs(Math.round(s.v - sst.avg)) : ""}${s.t ? " · " + escapeHtml(s.t) : ""}</span></span>
    ${SHOTSEL ? "" : `<button type="button" class="tg noteBtn${s.note ? " on" : ""}" data-f="noteT" aria-pressed="${!!s.note}">Note</button><button type="button" class="x xd${s.x ? " on" : ""}" data-f="x" aria-pressed="${!!s.x}" aria-label="${s.x ? "Restore" : "Remove"} shot" title="${s.x ? "Restore this shot to the stats" : "Remove from every stat. The shot stays in the log."}">${s.x ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 7v6h6'/><path d='M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'/></svg>" : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='m4.9 4.9 14.2 14.2'/></svg>"}</button><button type="button" class="x del" data-f="del" aria-label="Delete shot"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg></button>
    <div class="tgs"><button type="button" class="tg${s.clean ? " on" : ""}" data-f="clean" aria-pressed="${!!s.clean}">Clean</button><button type="button" class="tg${s.cold ? " on" : ""}" data-f="cold" aria-pressed="${!!s.cold}">Cold bore</button><button type="button" class="tg${s.fl ? " on" : ""}" data-f="fl" aria-pressed="${!!s.fl}">Flier</button><button type="button" class="tg${s.ie ? " on" : ""}" data-f="ie" aria-pressed="${!!s.ie}">Input error</button>${multi ? `<span class="sl">${mkGlyph(si)}S${si + 1}</span>` : ""}</div>`}
    ${!SHOTSEL && (s.note || s._showNote) ? `<input class="note" type="text" maxlength="200" placeholder="shot note" value="${escapeHtml(s.note || "")}">` : ""}</div>`;
  const all = ED.shots.map((s, i) => ({ s, i }));
  $("slShots").innerHTML = (tv.strings.map((q, si) => ({ q, si })).reverse().map(({ q, si }) => { const mine = all.filter(o => strOf(ED, o.s) === q.id), sst = shotStats(mine.map(o => o.s));
      const who = stringWho(q), removed = mine.filter(o => o.s.x).length, n = sst.n || 0;
      const on = q.id === tv.cur;
      return `<div class="sgh${on ? " active" : ""}" data-str="${escapeHtml(q.id)}" aria-current="${on ? "true" : "false"}"><div class="sghTop"><span class="sghId">${mkGlyph(si)}String ${si + 1} · Target ${tgtLetter(tv, q.tid)}</span>${who ? `<span class="sghWho">${escapeHtml(who)}</span>` : ""}</div><small>${on ? `<span class="sghLive"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Recording</span> · ` : ""}${n} shot${n === 1 ? "" : "s"}${n ? ` · avg ${fpsT(sst.avg)}` : ""}${n > 1 ? ` · SD ${sst.sd.toFixed(1)} · ES ${fpsT(sst.es)}` : ""}${removed ? ` · ${removed} removed` : ""}</small></div>` + mine.reverse().map(o => row(o, sst, si)).join(""); }).join("")) ||
    `<div class="hint" style="padding:8px 0">No shots yet.</div>`;
  paintStrBar(); paintTgView(); paintStrRec(); if (BAN.sid === ED.id && !$("shotBan").hidden) banPaint();
  paintUseMV(); paintShotSel();
}
function stringGear(st) {
  const af = st && st.asFired;
  const gun = af && P.rifles.find(r => r.id === af.rifleId);
  const load = gun && (gun.loads || []).find(l => l.id === af.loadId);
  const named = af && af.opticId && (P.optics || []).find(o => o.id === af.opticId);
  const opticName = named && named.name ? named.name : (af && af.optic ? "saved optic" : "no optic saved");
  const fb = calcFallback(af, gun || null, opticOn(P, gun || null), null);
  return { gun: gun ? gun.name : "", load: load ? load.name : "", opticName, warning: scopeSentence(gun && gun.name, fb && fb.source, fb && fb.spec && fb.spec.lbl) };
}
function recText(st, t) {
  const g = stringGear(st);
  const who = [g.gun, g.load].filter(Boolean).join(" · ") || "this string";
  return { line: `Recording to: String ${strNo(t, st.id)} · ${who}`, optic: g.opticName, warning: g.warning };
}
function paintStrRec() {
  if (!ED) return;
  const t = ED.tg || tgView(ED), st = t.strings.find(s => s.id === t.cur) || t.strings[t.strings.length - 1];
  if (!st) return;
  const rec = recText(st, t);
  document.querySelectorAll(".strRec").forEach(b => {
    const line = b.querySelector(".strRecTo"), opt = b.querySelector(".strRecOpt");
    if (line) line.textContent = rec.line;
    if (opt) opt.textContent = rec.optic;
    b.setAttribute("aria-label", `${rec.line}. Optic: ${rec.optic}. Change the string new shots record to.`);
  });
  if ($("strPickSheet") && !$("strPickSheet").hidden) paintStrPick();
}
function paintStrPick() {
  if (!ED) return;
  const t = ED.tg || tgView(ED), cur = t.strings.find(s => s.id === t.cur) || t.strings[t.strings.length - 1];
  $("strPickList").innerHTML = t.strings.map((st, i) => {
    const g = stringGear(st), on = st.id === t.cur;
    const who = [g.gun, g.load].filter(Boolean).join(" · ") || "No saved firearm";
    return `<button type="button" class="strOpt${on ? " on" : ""}" data-str="${escapeHtml(st.id)}" aria-current="${on ? "true" : "false"}"><span class="strOptTop"><b>String ${i + 1} · ${escapeHtml(who)}</b>${on ? `<span class="recBadge"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Recording</span>` : ""}</span><small>${escapeHtml(g.opticName)}</small></button>`;
  }).join("");
  const g = stringGear(cur);
  $("strPickNote").textContent = g.warning || "New shots record to the string you pick, using that string's saved firearm, optic, and load. The snapshot is not changed.";
}
async function setActiveString(id) {
  if (!ED) return;
  const had = !!ED.tg;
  const t = tgEnsure(ED);
  let use = id;
  if (!t.strings.some(s => s.id === use)) {
    if (!had && t.strings.length === 1) use = t.strings[0].id;
    else { $("strPickSheet").hidden = true; return; }
  }
  if (t.cur !== use) {
    t.cur = use;
    if (SH.ended && SH.ended !== use) SH.ended = null;
    SH.hold = true;
    edDirty = true;
    if (!ED._new || ED.shots.length) await commitEditor();
  }
  $("strPickSheet").hidden = true;
  renderEditor();
  if (SH.on) { SH.calcKey = ""; shPaint(); }
}
function paintShotSel() {
  const bar = $("shotSelBar"), btn = $("shotSelBtn"); if (!bar || !btn) return;
  const on = !!SHOTSEL; bar.hidden = !on; btn.hidden = on;
  if ($("shotSelDone")) $("shotSelDone").hidden = !on;
  $("slEditor")?.classList.toggle("selecting", on);
  if (!on || !ED) return;
  const keepG = $("shotDestGun").value, keepL = $("shotDestLoad").value, keepS = $("shotDestStr").value;
  const existing = $("shotDestKind").value === "existing";
  $("shotDestList").hidden = !existing; $("shotDestGun").hidden = existing; $("shotDestLoad").hidden = existing;
  const choices = stringChoices();
  $("shotDestStr").innerHTML = choices.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
  if (keepS && [...$("shotDestStr").options].some(o => o.value === keepS)) $("shotDestStr").value = keepS;
  $("shotDestList").innerHTML = choices.map(o => `<button type="button" class="destPick${o.value === $("shotDestStr").value ? " on" : ""}" data-dest="${escapeHtml(o.value)}">${escapeHtml(o.label)}</button>`).join("");
  $("shotDestGun").innerHTML = P.rifles.filter(r => !r.archived).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join("");
  $("shotDestGun").value = P.rifles.some(r => r.id === keepG) ? keepG : (curRifle()?.id || P.rifles[0]?.id || "");
  const gun = P.rifles.find(r => r.id === $("shotDestGun").value);
  $("shotDestLoad").innerHTML = (gun?.loads || []).filter(l => !l.archived).map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join("");
  if (keepL && (gun?.loads || []).some(l => l.id === keepL)) $("shotDestLoad").value = keepL;
  const n = SHOTSEL.size;
  $("shotSelN").textContent = `${n} selected`;
  const moveLabel = n === 1 ? "Move 1 shot" : `Move ${n} shots`;
  $("shotMoveOpen").textContent = moveLabel; $("shotMoveOpen").disabled = !n;
  $("shotMoveGo").disabled = existing ? !(n && $("shotDestStr").value) : !(n && gun && (gun.loads || []).some(l => l.id === $("shotDestLoad").value));
  $("shotMoveGo").innerHTML = `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> ${moveLabel}`;
  const only = n === 1 ? ED.shots.find(s => SHOTSEL.has(s.id)) : null;
  const num = only ? ED.shots.indexOf(only) + 1 : 0;
  $("shotSplit").hidden = existing;
  $("shotSplit").disabled = !only || !$("shotDestGun").value || !$("shotDestLoad").value;
  $("shotSplit").textContent = only ? `Split from #${num}` : "Split";
  $("shotDestNote").textContent = existing ? destNote($("shotDestStr").value) : "Move creates or reuses a string for the firearm and load you pick.";
}
function shortWhen(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function stringChoices() {
  const out = [];
  LOG.forEach(sess => {
    const tg = sess.tg; if (!tg || !tg.strings) return;
    tg.strings.forEach((st, i) => {
      const af = st.asFired, gun = af && P.rifles.find(r => r.id === af.rifleId), load = gun && (gun.loads || []).find(l => l.id === af.loadId);
      const label = sess.id === ED.id
        ? `This session · String ${i + 1}`
        : `${gun ? gun.name : "Saved firearm"} · ${load ? load.name : "saved load"} — String ${i + 1} · ${shortWhen(sess.date)}`;
      out.push({ value: `${sess.id}::${st.id}`, label });
    });
  });
  return out;
}
function destContext(value) {
  const [sid, strId] = String(value || "").split("::");
  const sess = LOG.find(s => s.id === sid);
  const st = sess && sess.tg && sess.tg.strings.find(s => s.id === strId);
  const af = st && st.asFired;
  const rifle = af && P.rifles.find(r => r.id === af.rifleId);
  return { sess, st, af, rifle, optic: opticOn(P, rifle) };
}
function scopeNote(c) {
  if (!c.af) return "This string has no saved firearm or load. Nothing will be invented, and its snapshot will not be changed.";
  if (c.af.optic) return "";
  const gun = c.rifle ? c.rifle.name : "This firearm";
  const fb = calcFallback(c.af, c.rifle, c.optic);
  return scopeSentence(gun, fb && fb.source, fb && fb.spec && fb.spec.lbl);
}
function destNote(value) {
  const c = destContext(value); if (!c.sess || !c.st) return "Pick a string. Nothing has been moved.";
  const load = c.rifle && (c.rifle.loads || []).find(l => l.id === c.af.loadId);
  const who = c.af ? `${c.rifle ? c.rifle.name : "the saved firearm"} · ${load ? load.name : "the saved load"}` : "a string with no saved firearm or load";
  const base = c.af ? `These shots will count under ${who}. That string's saved setup is not changed.` : "";
  return [base, scopeNote(c)].filter(Boolean).join(" ");
}
function chosenAsFired() {
  const r = P.rifles.find(x => x.id === $("shotDestGun").value);
  const l = r?.loads.find(x => x.id === $("shotDestLoad").value);
  if (!r || !l) return null;
  const oid = r.lastOpticId && (P.optics || []).some(o => o.id === r.lastOpticId) ? r.lastOpticId : (r.opticId || null);
  const o = oid ? (P.optics || []).find(x => x.id === oid) : null;
  return asFiredFrom(r, o, l, recipeSnapshot(r.id, l.id));
}
function sourceLoadOf(session, movedIds) {
  const ids = new Set(movedIds);
  const shot = (session.shots || []).find(s => ids.has(s.id));
  const st = shot && session.tg && session.tg.strings.find(x => x.id === shot.str);
  const lid = st?.asFired?.loadId || session.loadId;
  const rid = st?.asFired?.rifleId || session.rifleId;
  const r = P.rifles.find(x => x.id === rid);
  return r?.loads.find(l => l.id === lid) || null;
}
async function undoShotEdit() {
  const prev = shotUndo.pop(); if (!prev) return;
  if (prev.cross) {
    const put = (sess) => { const c = cleanSession(sess); const i = LOG.findIndex(s => s.id === c.id); if (i >= 0) LOG[i] = c; if (ED && ED.id === c.id) { ED.shots = c.shots; ED.tg = c.tg; edDirty = false; } };
    put(prev.source); put(prev.dest); await saveLog(); if (ED) renderEditor(); toast("Shot move undone. Both sessions are saved.");
    return;
  }
  if (!ED) return;
  ED.shots = prev.shots; ED.tg = prev.tg; edDirty = true; renderEditor(); toast("Shot move undone");
}
function sessionLoad() {
  const r = ED && P.rifles.find(x => x.id === ED.rifleId);
  return r?.loads.find(l => l.id === ED.loadId) || null;
}
function redoSourceMv(load, shots) {
  let t = num("slPowder") ?? num("slTemp");
  if (t == null && ED) t = ED.wx?.powder ?? ED.wx?.temp ?? null;
  if (t == null) {
    const pre = wx && wx.tempF != null ? String(Math.round(wx.tempF)) : "";
    const a = prompt(`Temperature for the redone MV (°F)?\nRemoved shots stay out. Tags stay in.${pre ? " Prefilled from current weather." : ""}`, pre);
    if (a == null) return null;
    t = parseFloat(a);
    if (!isFinite(t) || t < -40 || t > 140) { toast("Enter a temperature between −40 and 140 °F"); return null; }
    setVal("slTemp", Math.round(t * 10) / 10); edDirty = true;
  }
  const st = shotStats((shots || []).filter(s => !s.x));
  if (!st.n) { toast("No kept shots left on that load to redo the MV"); return null; }
  load.mv = String(Math.round(st.avg)); load.mvSource = "measured"; load.mvTemp = String(t); savePresets();
  if (curLoad() === load) { setVal("mv", load.mv); $("mvSource").value = "measured"; setVal("mvTemp", t); }
  updateDirty(); schedule();
  return `MV redone to ${load.mv} fps at ${fmt(t, 0)}°F from ${st.n} kept shot${st.n === 1 ? "" : "s"}`;
}
function applyShotResult(result) {
  const load = sourceLoadOf(result.undo, result.movedIds);
  const stale = staleMv(load, result.undo.shots, result.movedIds, result.undo);
  shotUndo.push(result.undo);
  ED.shots = result.session.shots; ED.tg = result.session.tg; edDirty = true; renderEditor();
  const remain = (result.undo.shots || []).filter(s => !result.movedIds.includes(s.id) && (sourceLoadOf(result.undo, [s.id])?.id === load?.id));
  return { stale, load, remain };
}
// "Use … as MV": the average of every shot that was not Removed. Tags (Clean, Cold bore, Flier, Input error) stay in the average.
// Behavior change: Cold bore and Flier used to be left out automatically. They no longer are. Only the removed flag (x) excludes.
function mvPick() {
  const r = ED && P.rifles.find(x => x.id === ED.rifleId), l = r?.loads.find(x => x.id === ED.loadId);
  const use = keptOnLoad(ED, l && l.id);
  const st = shotStats(use);
  const removed = ED ? (ED.shots || []).filter(s => s.x && (() => { const sid = strOf(ED, s); const stg = ED.tg && ED.tg.strings && ED.tg.strings.find(q => q.id === sid); return ((stg && stg.asFired && stg.asFired.loadId) || ED.loadId) === (l && l.id); })()).length : 0;
  const t = num("slPowder") ?? num("slTemp");
  return { st, n: use.length, out: { x: removed }, l, t, mv: st.n ? Math.round(st.avg) : null };
}
function paintUseMV() {
  if (!ED) return;
  const m = mvPick(), b = $("slUseMV"), note = $("slMvNote");
  b.disabled = !m.st.n || !m.l;
  b.textContent = !m.st.n ? "Use avg as MV (no kept shots yet)" : `Use ${m.mv} fps${m.t != null ? ` at ${fmt(m.t, 0)}°F` : ""} for ${m.l ? m.l.name : "this load"}`;
  const left = [m.out.x && `${m.out.x} removed`].filter(Boolean);
  note.classList.toggle("warn", !!m.st.n && m.n < 5);
  setIconText(note, !m.l ? "Assign this session to a saved load to use its average as the MV." : !m.st.n ? "" :
    `Average of ${m.n} shot${m.n === 1 ? "" : "s"}${left.length ? ` (left out: ${left.join(", ")})` : ""}${m.st.n > 1 ? ` · SD ${m.st.sd.toFixed(1)}` : ""}.` +
    (m.t == null ? " No session temperature yet: you'll be asked for it." : "") + (m.n < 5 ? ` <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Only ${m.n} shot${m.n === 1 ? "" : "s"}; 5 or more give a steadier MV.` : ""));
}
function addVelocities(text) {
  const vals = String(text).split(/[\s,;]+/).map(parseFloat).filter(v => isFinite(v) && v >= 50 && v <= 6000);
  if (vals.length) { const cur = tgEnsure(ED).cur; vals.forEach(v => ED.shots.push({ v: +v.toFixed(1), id: uid(), str: cur })); edDirty = true; }
  return vals.length;
}
function addFromInput() {
  const t = $("slVel").value; if (!t.trim()) return;
  if (!addVelocities(t)) { toast("Enter a velocity in fps (50–6000)"); return; }
  $("slVel").value = ""; renderEditor(); banShow(ED.id, ED.shots[ED.shots.length - 1].id); $("slVel").focus();
}
function readEditor() {
  const d = new Date($("slDate").value); if (!isNaN(d)) ED.date = d.toISOString();
  ED.notes = $("slNotes").value.trim(); ED.wx = { temp: num("slTemp"), humidity: num("slHum"), pressure: num("slPress"), altitude: num("slAlt"), powder: num("slPowder") }; ED.barrel = num("slBarrel");
}
async function commitEditor() {
  readEditor(); const c = cleanSession(ED); if (!c) return null;
  const i = LOG.findIndex(s => s.id === c.id); i >= 0 ? LOG[i] = c : LOG.push(c);
  ED._new = false; edDirty = false; await saveLog(); slKey = null; maybeRenderLog(); return c;
}
function closeEditor(force) {
  if (!force && edDirty && ED && ED.shots.length && !confirm("Discard unsaved changes to this session?")) return;
  $("slEditor").classList.remove("show"); document.body.style.overflow = ""; ED = null; edDirty = false;
  if ($("tgEd").classList.contains("show")) { $("tgEd").classList.remove("show"); set_TE(null); }
  if ($("shotBan").classList.contains("dock")) banHide();
  if (SH.on && !SH.closing) shHide();
}

/* Live-session hook used by the Bluetooth radar (and usable by other sources): call with velocities as they arrive.
   shots: number (fps) | array of numbers | array of { v, mps?: true, t? }. Opens/extends a live session for the current load and autosaves. */
async function addShotsToLiveSession(shots, opts = {}) {
  const source = opts.source || "bluetooth", open = opts.open !== false;
  const mk = () => (Array.isArray(shots) ? shots : [shots]).map(x => typeof x === "number" ? { v: x } : x)
    .map(x => ({ v: +((+x.v) * (x.mps ? MPS : 1)).toFixed(1), id: uid(), ...(x.t ? { t: String(x.t) } : {}) })).filter(x => x.v >= 50 && x.v <= 6000);
  if (SH.on && ED && ED.id === SH.sid) {   // the shooting view is open: its session takes the shot
    const arr = mk(); if (!arr.length) return ED.id;
    if (!ED.shots.length && ED._new) { ED.source = source; $("slSource").value = SRC_LBL[source] || source; }
    shRollIfEnded(); const cur = tgEnsure(ED).cur; arr.forEach(x => { x.str = cur; }); ED.shots.push(...arr); SH.lastId = arr[arr.length - 1].id;
    renderEditor(); await commitEditor(); $("slDel").style.display = ""; set_LIVE({ id: ED.id, source }); shPaint();
    return ED.id;
  }
  if (!open && !(ED && ED.source === source)) {   // background live session: no editor, the banner shows the shot
    const k = curKeyIds(); if (!k.loadId) return null;
    let L = LIVE && LIVE.source === source && LOG.find(s => s.id === LIVE.id && s.rifleId === k.rifleId && s.loadId === k.loadId);
    if (!L) { L = cleanSession(newSession(source)); LOG.push(L); set_LIVE({ id: L.id, source }); }
    const arr = mk(); const cur = tgEnsure(L).cur; arr.forEach(x => { x.str = cur; }); L.shots.push(...arr);
    const i = LOG.indexOf(L); LOG[i] = cleanSession(L); await saveLog(); slKey = null; maybeRenderLog();
    if (arr.length && opts.banner !== false) banShow(L.id, arr[arr.length - 1].id);
    return L.id;
  }
  if (!ED || ED.source !== source) {
    if (ED) { if (ED.shots.length) await commitEditor(); closeEditor(true); }   // keep whatever was open, then start the live session
    openEditor(null); if (!ED) return null; ED.source = source; $("slSource").value = SRC_LBL[source] || source;
    if (source === "bluetooth") setTimeout(() => { if (document.activeElement === $("slVel")) $("slVel").blur(); }, 80);   // no keyboard pop-up for radar shots
  }
  const arr = mk(); const cur = tgEnsure(ED).cur; arr.forEach(x => { x.str = cur; });
  ED.shots.push(...arr); renderEditor(); await commitEditor(); $("slDel").style.display = ""; set_LIVE({ id: ED.id, source });
  if (arr.length && opts.banner !== false) banShow(ED.id, arr[arr.length - 1].id);
  return ED.id;
}

// cross-module writers (imports are read-only)
function set_IMP(v) { return IMP = v; }
function set_LOG(v) { return LOG = v; }
function set_edDirty(v) { return edDirty = v; }
function set_slKey(v) { return slKey = v; }

export function init() {
  $("slCmpScope").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; cmpScope = b.dataset.v; renderCompare(); });
  $("slCmpTbl").addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) openEditor(LOG.find(s => s.id === tr.dataset.id)); });
  $("slCsvBtn").onclick = () => {
    if (!LOG.length) { toast("No sessions to export yet"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + sessionsCSV()], { type: "text/csv" }));
    a.download = `ball-calc-shot-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(`Exported ${LOG.length} session(s) as CSV`);
  };
  $("slList").addEventListener("click", e => { const b = e.target.closest(".slItem"); if (!b) return;
    if (lpFired) { set_lpFired(false); return; }
    if (SEL) { SEL.has(b.dataset.id) ? SEL.delete(b.dataset.id) : SEL.add(b.dataset.id); paintSel(); return; }
    openEditor(LOG.find(s => s.id === b.dataset.id)); });
  window.addEventListener("resize", () => { slKey = null; maybeRenderLog(); });
  $("slEdRecipeBtn").onclick = () => {
    if (!ED) return;
    if (ED.recipe && recipeText(ED.recipe) && !confirm("Replace this session's saved load data with the load's current data?")) return;
    const s = recipeSnapshot(ED.rifleId, ED.loadId); if (!s) { toast("This session's load no longer exists"); return; }
    ED.recipe = s; edDirty = true; paintEdRecipe(); toast("Load data attached: tap <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'/><path d='M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7'/><path d='M7 3v4a1 1 0 0 0 1 1h7'/></svg> Save session");
  };
  document.querySelectorAll(".strRec").forEach(b => { b.onclick = () => { if (!ED) return; $("strPickSheet").hidden = false; paintStrPick(); }; });
  $("strPickClose").onclick = () => { $("strPickSheet").hidden = true; };
  $("strPickList").addEventListener("click", e => { const b = e.target.closest("[data-str]"); if (!b) return; setActiveString(b.dataset.str); });
  $("slAdd").onclick = addFromInput;
  $("slVel").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addFromInput(); } });
  $("slVel").addEventListener("paste", e => { const t = (e.clipboardData || window.clipboardData)?.getData("text") || ""; if (/[\s,;]/.test(t.trim())) { e.preventDefault(); if (addVelocities(t)) { renderEditor(); banShow(ED.id, ED.shots[ED.shots.length - 1].id); } } });
  $("shotSelBtn").onclick = () => { SHOTSEL = new Set(); shotUndo = []; renderEditor(); };
  $("shotSelDone").onclick = () => { SHOTSEL = null; $("shotDestSheet").hidden = true; renderEditor(); };
  $("shotDestGun").onchange = () => paintShotSel();
  $("shotDestKind").onchange = () => paintShotSel();
  $("shotDestStr").onchange = () => paintShotSel();
  $("shotDestList").addEventListener("click", e => {
    const b = e.target.closest("[data-dest]"); if (!b) return;
    $("shotDestStr").value = b.dataset.dest; paintShotSel();
  });
  $("shotMoveOpen").onclick = () => { if (!ED || !SHOTSEL?.size) return; $("shotDestSheet").hidden = false; paintShotSel(); };
  $("shotDestClose").onclick = () => { $("shotDestSheet").hidden = true; };
  $("slAddHelp").onclick = () => {
    const more = $("slAddHint").querySelector(".more"), open = more.hidden;
    more.hidden = !open; $("slAddHelp").setAttribute("aria-expanded", String(open)); $("slAddHint").classList.toggle("open", open);
  };
  let pendingDel = null;
  $("shotDelCancel").onclick = () => { pendingDel = null; $("shotDelDlg").hidden = true; };
  $("shotDelGo").onclick = () => {
    const i = pendingDel; pendingDel = null; $("shotDelDlg").hidden = true;
    if (!ED || i == null || !ED.shots[i]) return;
    const s = ED.shots[i]; if (s.id) unpair(ED, s.id); ED.shots.splice(i, 1); edDirty = true; renderEditor();
  };
  const mvClause = (items) => {
    const named = (items || []).filter(i => i && i.name);
    if (!named.length) return "MV unchanged.";
    const stale = named.filter(i => i.stale), redone = named.filter(i => i.redone);
    const bits = [];
    if (stale.length === 1) bits.push(`${stale[0].name} MV stale.`);
    else if (stale.length > 1) bits.push(`${stale.map(i => i.name).join(" and ")} MV stale.`);
    if (redone.length === 1) bits.push(`${redone[0].name} MV redone.`);
    else if (redone.length > 1) bits.push(`${redone.map(i => i.name).join(" and ")} MV redone.`);
    if (!bits.length) return named.length === 1 ? `${named[0].name} MV unchanged.` : "MV unchanged.";
    return bits.join(" ");
  };
  const movedLine = (n, gunName, stringNo, clause) => `Moved ${n} shot${n === 1 ? "" : "s"} to ${gunName} · String ${stringNo}. ${clause}`;
  const shotToast = (done, msg) => {
    const line = `${msg} ${mvClause([{ name: done.load && done.load.name, stale: !!done.stale }])}`.replace(/\s+/g, " ").trim();
    const show = () => toast(line, [
      { label: "Undo", fn: undoShotEdit },
      ...(done.stale && done.load ? [{ label: "Redo MV", fn: () => { const m = redoSourceMv(done.load, done.remain); if (m) toast(`${done.load.name} MV ${done.load.mv}.`, [{ label: "Undo", fn: undoShotEdit }]); else show(); } }] : []),
    ]);
    show();
  };
  $("shotMoveGo").onclick = async () => { if (!ED || !SHOTSEL?.size) return;
    if ($("shotDestKind").value === "existing") { await moveToExisting(); return; }
    const af = chosenAsFired(); if (!af) return;
    const result = assignShots(ED, [...SHOTSEL], af);
    const done = applyShotResult(result);
    const gun = P.rifles.find(r => r.id === af.rifleId);
    const strNo = result.session.tg.strings.findIndex(st => st.id === result.destId) + 1;
    $("shotDestSheet").hidden = true;
    shotToast(done, `Moved ${result.movedIds.length} shot${result.movedIds.length === 1 ? "" : "s"} to ${gun ? gun.name : "the saved firearm"} · String ${strNo}.`);
  };
  async function moveToExisting() {
    const ctx = destContext($("shotDestStr").value); if (!ctx.sess || !ctx.st) return;
    const beforeSrc = JSON.stringify(ED), beforeDst = ctx.sess.id === ED.id ? null : JSON.stringify(ctx.sess);
    const result = placeOnString(ED, ctx.sess, [...SHOTSEL], ctx.st.id, { rifle: ctx.rifle, optic: ctx.optic });
    if (result.error) { toast(result.error); return; }
    if (JSON.stringify(ED) !== beforeSrc || (beforeDst && JSON.stringify(ctx.sess) !== beforeDst)) { toast("The move touched a session it should have copied. Nothing was saved."); return; }
    const srcLoad = sourceLoadOf(result.undoSource, result.movedIds);
    const srcStale = staleMv(srcLoad, result.undoSource.shots, result.movedIds, result.undoSource);
    const destBefore = result.undoDest || result.undoSource;
    const destLoad = loadOfAsFired(result.destAsFired, destBefore);
    const movedShots = result.undoSource.shots.filter(s => result.movedIds.includes(s.id));
    const dstStale = staleIncoming(destLoad, destBefore, result.destStringId, movedShots);
    const destAfter = result.dest || result.source;
    const remainSrc = result.source.shots.filter(s => !result.movedIds.includes(s.id) && sourceLoadOf(result.undoSource, [s.id])?.id === srcLoad?.id);
    const remainDst = destAfter.shots.filter(s => !s.x && (result.destAsFired ? (destAfter.tg.strings.find(st => st.id === s.str)?.asFired?.loadId === result.destAsFired.loadId) : s.str === result.destStringId));
    $("shotDestSheet").hidden = true;
    if (result.same) { shotUndo.push(result.undoSource); ED.shots = result.source.shots; ED.tg = result.source.tg; edDirty = true; renderEditor(); }
    else {
      const cs = cleanSession(result.source), cd = cleanSession(result.dest);
      const si = LOG.findIndex(s => s.id === cs.id), di = LOG.findIndex(s => s.id === cd.id);
      if (!cs || !cd || si < 0 || di < 0) { toast("Both sessions have to be here before a move is saved. Nothing was saved."); return; }
      LOG[si] = cs; LOG[di] = cd; ED.shots = cs.shots; ED.tg = cs.tg; edDirty = false;
      shotUndo.push({ cross: true, source: result.undoSource, dest: result.undoDest });
      await saveLog(); renderEditor();
    }
    const gunName = (ctx.rifle && ctx.rifle.name) || "the saved firearm";
    const strNo = ctx.sess.tg.strings.findIndex(st => st.id === result.destStringId) + 1;
    const nMoved = result.movedIds.length;
    let srcDone = false, dstDone = false;
    const showMove = () => {
      const clause = mvClause([
        srcLoad && { name: srcLoad.name, stale: !!(srcStale && !srcDone), redone: !!srcDone },
        destLoad && (!srcLoad || destLoad.id !== srcLoad.id) && { name: destLoad.name, stale: !!(dstStale && !dstDone), redone: !!dstDone },
      ]);
      const both = !!(srcStale && !srcDone && dstStale && !dstDone);
      const acts = [{ label: "Undo", fn: undoShotEdit }];
      if (!srcDone && srcStale && srcLoad) acts.push({ label: both ? "Redo A" : "Redo MV", fn: () => { const m = redoSourceMv(srcLoad, remainSrc); if (m) { srcDone = true; showMove(); } else showMove(); } });
      if (!dstDone && dstStale && destLoad) acts.push({ label: (srcStale && !srcDone) ? "Redo B" : "Redo MV", fn: () => { const m = redoSourceMv(destLoad, remainDst); if (m) { dstDone = true; showMove(); } else showMove(); } });
      toast(movedLine(nMoved, gunName, strNo, clause), acts);
    };
    showMove();
  }
  function loadOfAsFired(af, session) {
    const rid = af?.rifleId || session.rifleId, lid = af?.loadId || session.loadId;
    const r = P.rifles.find(x => x.id === rid);
    return r?.loads.find(l => l.id === lid) || null;
  }
  function staleIncoming(load, destBefore, destStringId, movedShots) {
    if (!load || load.mvSource !== "measured" || !(parseFloat(load.mv) > 0)) return null;
    const before = (destBefore.shots || []).filter(s => !s.x && ((destBefore.tg && destBefore.tg.strings.find(st => st.id === s.str)?.asFired?.loadId) || destBefore.loadId) === load.id);
    const adding = (movedShots || []).filter(s => !s.x);
    if (!before.length || !adding.length) return null;
    const avg = shotStats(before).avg;
    if (avg == null || Math.round(avg) !== Math.round(parseFloat(load.mv))) return null;
    return { message: "The destination load's MV matched its kept shots before this move. It was not changed. Redo dest MV uses the shots now on that load and drops removed shots." };
  }
  $("shotSplit").onclick = () => { if (!ED || !SHOTSEL?.size) return; const af = chosenAsFired(); if (!af) return; const id = [...SHOTSEL][0]; const result = assignShots(ED, [id], af, { splitFromId: id }); const done = applyShotResult(result); const gun = P.rifles.find(r => r.id === af.rifleId); const strNo = result.session.tg.strings.findIndex(st => st.id === result.destId) + 1; shotToast(done, `Moved ${result.movedIds.length} shot${result.movedIds.length === 1 ? "" : "s"} to ${gun ? gun.name : "the saved firearm"} · String ${strNo}.`); };
  $("slShots").addEventListener("change", e => { const box = e.target.closest(".shotCk"); if (!box || !SHOTSEL) return; box.checked ? SHOTSEL.add(box.dataset.sel) : SHOTSEL.delete(box.dataset.sel); paintShotSel(); });
  let shotLp;
  $("slShots").addEventListener("pointerdown", e => { const row = e.target.closest(".shot"); if (!row || SHOTSEL || e.target.closest("button, input")) return; clearTimeout(shotLp);
    shotLp = setTimeout(() => { SHOTSEL = new Set([row.dataset.id]); renderEditor(); navigator.vibrate?.(15); }, 550); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => $("slShots").addEventListener(ev, () => clearTimeout(shotLp)));
  $("slShots").addEventListener("click", e => {
    const row = e.target.closest(".shot"); if (!row || !ED) return;
    if (SHOTSEL && !e.target.closest("button, input")) {
      const id = row.dataset.id;
      SHOTSEL.has(id) ? SHOTSEL.delete(id) : SHOTSEL.add(id);
      const box = row.querySelector(".shotCk"); if (box) box.checked = SHOTSEL.has(id);
      paintShotSel(); return;
    }
    const b = e.target.closest("button"); if (!b) return;
    const i = +row.dataset.i, s = ED.shots[i], f = b.dataset.f; if (!s || !f) return;
    if (f === "del") { pendingDel = i; $("shotDelMsg").textContent = `Delete shot #${i + 1}? This can't be undone.`; $("shotDelDlg").hidden = false; return; }
    if (f === "noteT") s._showNote = !s._showNote; else { s[f] = !s[f]; if (!s[f]) delete s[f]; else if (f === "x" && s.id) unpair(ED, s.id); }
    edDirty = true; renderEditor();
  });
  $("slShots").addEventListener("change", e => { if (e.target.classList.contains("note")) { const i = +e.target.closest(".shot").dataset.i; ED.shots[i].note = e.target.value.trim(); edDirty = true; } });
  ["slDate", "slNotes", "slTemp", "slPowder", "slHum", "slPress", "slAlt", "slBarrel"].forEach(id => $(id).addEventListener("input", () => edDirty = true));
  $("slEdClose").onclick = () => closeEditor();
  $("slSave").onclick = async () => { if (!ED.shots.length) { toast("Add at least one shot"); return; } const c = await commitEditor(); closeEditor(true); const ns = tgView(c).strings.length; toast(`Session saved · ${ns} string${ns === 1 ? "" : "s"}`); };
  $("slDel").onclick = async () => { if (!confirm("Delete this session?")) return; LOG = LOG.filter(s => s.id !== ED.id); await saveLog(); slKey = null; closeEditor(true); maybeRenderLog(); toast("Session deleted"); };
  $("slUseMV").onclick = async () => {
    const m0 = mvPick(); if (!m0.st.n || !m0.l) return;
    if (m0.t == null) {   // never fall back to the load's old chrono temperature: ask, prefilled with today's weather if we have it
      const pre = wx && wx.tempF != null ? String(Math.round(wx.tempF)) : "";
      const a = prompt(`Temperature during this session (°F)?\nIt is saved as the chrono temperature with the MV${pre ? " (prefilled from current weather)" : ""}.`, pre);
      if (a == null) return;
      const t = parseFloat(a); if (!isFinite(t) || t < -40 || t > 140) { toast("Enter a temperature between −40 and 140 °F"); return; }
      setVal("slTemp", Math.round(t * 10) / 10); edDirty = true;
    }
    const m = mvPick(); const c = await commitEditor(); if (!c) return;
    const l = m.l, mv = m.mv, pt = m.t;
    l.mv = String(mv); l.mvSource = "measured"; l.mvTemp = String(pt); savePresets();
    if (curLoad() === l) { setVal("mv", mv); $("mvSource").value = "measured"; setVal("mvTemp", pt); }
    closeEditor(true); updateDirty(); schedule();
    toast(`MV set to ${mv} fps at ${fmt(pt, 0)}°F for ${l.name} (${m.n} shot${m.n === 1 ? "" : "s"}${m.st.n > 1 ? `, SD ${m.st.sd.toFixed(1)}` : ""})${m.n < 5 ? " · only " + m.n + " shots" : ""}`);
  };
  ["slTemp", "slPowder"].forEach(id => $(id).addEventListener("input", paintUseMV));
  $("slNewBtn").onclick = () => curLoad() ? openEditor(null) : shNeedGear("session");
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if ($("slEditor").classList.contains("show")) closeEditor(); else if ($("slImport").classList.contains("show")) closeImport(); });
}

export { mvPick, paintUseMV, SHEETJS_URLS, ENGINE_URLS, K_LOG, MPS, LOG, slKey, ED, edDirty, IMP, loadLog, saveLog, nOrNull, sstr, cleanSession, shotStats, stringWho, stringStatRows, stringStatText, exportSessions, curKeyIds, sessFor, fmtDate, SRC_LBL, maybeRenderLog, renderLog, slEmptyHTML, cmpScope, renderCompare, sessHome, orphanSessions, orphanHTML, sessionsCSV, drawLogChart, toLocalInput, newSession, openEditor, paintEdFor, paintEdRecipe, renderEditor, paintStrRec, addVelocities, addFromInput, readEditor, commitEditor, closeEditor, addShotsToLiveSession, set_LOG, set_slKey, set_edDirty, set_IMP };
