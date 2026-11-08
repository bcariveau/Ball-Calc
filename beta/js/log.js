// beta/js/log.js — Log tab: chronograph session list/editor and the LOG store.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { idbGet, idbPut } from "./bulletdb.js";
import { powderT } from "./calc.js";
import { shBtnPaint, toast } from "./components.js";
import { $, escapeHtml, fmt, n1, n3, num, setVal } from "./core.js";
import { cleanRecipe, curLoad, curRifle, recipeSnapshot, recipeText, updateDirty } from "./gear.js";
import { closeImport } from "./log-import.js";
import { SEL, lpFired, paintSel, set_lpFired } from "./reassign.js";
import { SH, shHide, shNeedGear, shPaint, shRollIfEnded } from "./shooting.js";
import { banHide, banPaint, banShow } from "./shot-banner.js";
import { P, load, savePresets, store, uid } from "./storage.js";
import { paintStrBar, paintTgView } from "./strings.js";
import { mkGlyph } from "./target-draw.js";
import { shotDetail, tgThumbA, tgThumbB } from "./target-editor.js";
import { BAN, LIVE, TE, cleanTg, fpsT, set_LIVE, set_TE, strOf, tgEnsure, tgRestore, tgSaveSidecar, tgView, tgtLetter, unpair } from "./targets.js";
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
  const all = list.flatMap(s => s.shots), st = shotStats(all);
  $("slSum").textContent = list.length ? `${list.length} session${list.length > 1 ? "s" : ""} · ${st.n} shots for “${l.name}” · all-shot avg ${st.avg.toFixed(0)} fps, SD ${st.sd.toFixed(1)}`
    : `No sessions yet for “${l.name}”. Tap ＋ Session to type velocities, or import an Athlon file.`;
  $("slList").innerHTML = list.slice().reverse().map(s => `${tgThumbA(s)}<button type="button" class="slItem" data-id="${escapeHtml(s.id)}">
    <span>${escapeHtml(fmtDate(s.date))}</span><span class="s"><b>${s.stats.n ? s.stats.avg.toFixed(0) : "—"}</b> fps</span>
    <span class="d">${escapeHtml(SRC_LBL[s.source] || s.source)} · ${s.stats.n} shot${s.stats.n === 1 ? "" : "s"}${s.barrel ? ` · ${s.barrel}" bbl` : ""}${s.notes ? " · " + escapeHtml(s.notes.slice(0, 40)) : ""}</span>
    <span class="d s">SD ${s.stats.sd ?? "—"} · ES ${s.stats.es != null ? fpsT(s.stats.es) : "—"}</span>${recipeText(s.recipe) ? `<span class="r">${escapeHtml(recipeText(s.recipe))}</span>` : ""}</button>${tgThumbB(s)}`).join("") + (emp ? slEmptyHTML(true) : "") + orphanHTML(orph);
  paintSel();
  $("slChartBox").style.display = list.length ? "block" : "none";
  if (list.length) drawLogChart(list);
  renderCompare();
}
function slEmptyHTML(hasLoad) {
  return "";   // the static #slEmpty line ("No sessions yet.") covers the empty state; ▶ Start shooting sits right above
}
/* compare sessions (ladder / charge tests) */
let cmpScope = "load";
function renderCompare() {
  const { rifleId, loadId } = curKeyIds(), r = curRifle();
  const list = (cmpScope === "gun" ? LOG.filter(s => s.rifleId === rifleId) : sessFor(rifleId, loadId)).filter(s => s.stats.n);
  $("slCmp").hidden = !LOG.some(s => s.rifleId === rifleId && s.stats.n);
  $("slCmpScope").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === cmpScope));
  if (!list.length) { $("slCmpTbl").innerHTML = `<div class="hint">No sessions with shots for this ${cmpScope === "gun" ? "gun" : "load"} yet.</div>`; return; }
  const ch = s => { const v = parseFloat(s.recipe?.ldCharge); return isFinite(v) ? v : null; };
  const rows = list.slice().sort((a, b) => (ch(a) ?? 1e9) - (ch(b) ?? 1e9) || a.date.localeCompare(b.date));
  const sds = rows.filter(s => s.stats.n > 2).map(s => s.stats.sd), best = sds.length ? Math.min(...sds) : null;
  const lname = s => r?.loads.find(l => l.id === s.loadId)?.name || s.recipe?.loadName || "?";
  let prev = null;
  $("slCmpTbl").innerHTML = `<table><thead><tr>${cmpScope === "gun" ? "<th>Load</th>" : ""}<th>Charge</th><th>Powder</th><th>COAL</th><th>n</th><th>Avg</th><th>SD</th><th>ES</th><th>fps/gr</th><th title="Powder temp (air temp if not set)">°F</th><th>Date</th></tr></thead><tbody>` +
    rows.map(s => { const c = ch(s), rc = s.recipe || {};
      const fpg = c != null && prev && prev.c != null && c !== prev.c ? ((s.stats.avg - prev.avg) / (c - prev.c)).toFixed(0) : "";
      if (c != null) prev = { c, avg: s.stats.avg };
      return `<tr data-id="${escapeHtml(s.id)}"${best != null && s.stats.n > 2 && s.stats.sd === best ? ' class="best" title="Lowest SD (3+ shots)"' : ""}>${cmpScope === "gun" ? `<td class="l">${escapeHtml(lname(s))}</td>` : ""}
        <td>${c != null ? n1(c) : rc.ldKind === "factory" ? "fact." : "—"}</td><td class="l">${escapeHtml((rc.ldKind === "factory" ? rc.ldProduct || rc.ldMaker : rc.ldPowder) || "—")}</td>
        <td>${n3(rc.ldCOAL) || "—"}</td><td>${s.stats.n}</td><td>${s.stats.avg.toFixed(0)}</td><td>${s.stats.n > 1 ? s.stats.sd.toFixed(1) : "—"}</td><td>${s.stats.n > 1 ? fpsT(s.stats.es) : "—"}</td>
        <td>${fpg}</td><td>${(s.wx.powder ?? s.wx.temp) != null ? fmt(s.wx.powder ?? s.wx.temp, 0) : "—"}</td><td>${escapeHtml(new Date(s.date).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }))}</td></tr>`; }).join("") + "</tbody></table>" +
    `<div class="hint">Sorted by charge (from each session's saved recipe). Highlighted = lowest SD with 3+ shots. fps/gr = velocity gain per grain from the previous charge. Tap a row to open it.</div>`;
}
/* CSV export of every session, one row per session, with the recipe snapshot */
// sessions whose gun or load no longer exists
function sessHome(s) { const r = P.rifles.find(x => x.id === s.rifleId), l = r?.loads.find(x => x.id === s.loadId); return { r, l, why: !r ? "deleted gun" : !l ? "deleted load" : "" }; }
function orphanSessions() { return LOG.filter(s => sessHome(s).why).sort((a, b) => b.date.localeCompare(a.date)); }
function orphanHTML(list) {
  if (!list.length) return "";
  return `<div class="slGrp">⚠ Unassigned sessions (${list.length}) — their gun or load was deleted. Tap one and use ↔ Move to give it a home.</div>` + list.map(s => {
    const h = sessHome(s), was = [s.recipe?.gunName, s.recipe?.loadName].filter(Boolean).join(" · ");
    return `<button type="button" class="slItem orphan" data-id="${escapeHtml(s.id)}"><span>${escapeHtml(fmtDate(s.date))}</span><span class="s"><b>${s.stats.n ? s.stats.avg.toFixed(0) : "—"}</b> fps</span>
    <span class="o">Unassigned (${h.why})${was ? " · was " + escapeHtml(was) : ""}</span><span class="d">${escapeHtml(SRC_LBL[s.source] || s.source)} · ${s.stats.n} shot${s.stats.n === 1 ? "" : "s"}</span><span class="d s">SD ${s.stats.sd ?? "—"} · ES ${s.stats.es != null ? fpsT(s.stats.es) : "—"}</span>${recipeText(s.recipe) ? `<span class="r">${escapeHtml(recipeText(s.recipe))}</span>` : ""}</button>`;
  }).join("");
}
function sessionsCSV() {
  const q = v => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = ["date", "gun", "gun_type", "load", "source", "shots", "avg_fps", "sd", "es", "min", "max", "velocities_fps", "bullet", "weight_gr", "bc", "drag", "muzzle_velocity_preset",
    "ammo", "powder", "charge_gr", "primer", "case", "times_fired", "trim_in", "coal_in", "cbto_in", "jump_in", "case_prep", "factory_brand", "factory_product", "lot", "load_notes",
    "session_notes", "temp_f", "humidity", "pressure_inhg", "altitude_ft", "barrel_in", "powder_temp_f", "temp_sens_fps_per_10f", "chrono_temp_f", "mv_at_powder_temp", "strings", "targets", "discarded_shots", "shot_detail"];
  const rows = LOG.slice().sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const r = P.rifles.find(x => x.id === s.rifleId), l = r?.loads.find(x => x.id === s.loadId), rc = s.recipe || {};
    return [s.date, r?.name || rc.gunName, r?.gunKind || rc.gunKind, l?.name || (rc.loadName ? rc.loadName + (r ? " (deleted load)" : " (deleted gun)") : "(unassigned)"), s.source, s.stats.n, s.stats.avg, s.stats.sd, s.stats.es, s.stats.min, s.stats.max,
      s.shots.map(x => x.v).join(" "), rc.bulletName || (rc.weight ? rc.weight + " gr" : ""), rc.weight, rc.bc, rc.drag, rc.mv,
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
  $("slMoveBtn").textContent = h.why ? "↔ Assign to a saved gun + load" : "↔ Move / reassign (gun, load)";
}
function paintEdRecipe() {
  const t = recipeText(ED.recipe, true);
  $("slEdRecipe").textContent = t ? (ED.recipe.ldKind === "factory" ? "📦 " : "🧪 ") + t : "No load data saved with this session.";
  $("slEdRecipeBtn").textContent = t ? "↻ Replace with the load's current data" : "📎 Attach the load's current data";
}
function renderEditor() {
  const st = shotStats(ED.shots), f = v => v == null ? "—" : (+v).toFixed(1);
  $("slStats").innerHTML = [["Avg fps", st.n ? fpsT(st.avg) : "—"], ["SD", st.n > 1 ? f(st.sd) : "—"], ["ES", st.n > 1 ? fpsT(st.es) : "—"],
    ["Shots", st.n], ["Min", st.n ? fpsT(st.min) : "—"], ["Max", st.n ? fpsT(st.max) : "—"]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join("");
  const tv = tgView(ED), multi = tv.strings.length > 1;
  const row = ({ s, i }, sst, si) => `<div class="shot${s.x ? " dis" : ""}" data-i="${i}">
    <span class="n">#${i + 1}</span><span><span class="v">${fpsT(s.v)}</span> <span class="dv">${s.x ? "removed" : sst.n > 1 ? (Math.round(s.v - sst.avg) >= 0 ? "+" : "−") + Math.abs(Math.round(s.v - sst.avg)) : ""}${s.t ? " · " + escapeHtml(s.t) : ""}</span></span>
    <button type="button" class="x xd${s.x ? " on" : ""}" data-f="x" aria-pressed="${!!s.x}" aria-label="${s.x ? "Restore" : "Remove"} shot" title="${s.x ? "Restore this shot to the stats" : "Remove from every stat. The shot stays in the log."}">${s.x ? "↺" : "⊘"}</button><button type="button" class="x" data-f="del" aria-label="Delete shot">✕</button>
    <div class="tgs"><button type="button" class="tg${s.clean ? " on" : ""}" data-f="clean" aria-pressed="${!!s.clean}">Clean</button><button type="button" class="tg${s.cold ? " on" : ""}" data-f="cold" aria-pressed="${!!s.cold}">Cold bore</button><button type="button" class="tg${s.fl ? " on" : ""}" data-f="fl" aria-pressed="${!!s.fl}">Flier</button><button type="button" class="tg${s.ie ? " on" : ""}" data-f="ie" aria-pressed="${!!s.ie}">Input error</button>
    <button type="button" class="tg${s.note ? " on" : ""}" data-f="noteT" aria-label="Note">✎</button>${multi ? `<span class="sl">${mkGlyph(si)}S${si + 1}</span>` : ""}</div>
    ${s.note || s._showNote ? `<input class="note" type="text" maxlength="200" placeholder="shot note" value="${escapeHtml(s.note || "")}">` : ""}</div>`;
  const all = ED.shots.map((s, i) => ({ s, i }));
  $("slShots").innerHTML = (multi ? tv.strings.map((q, si) => ({ q, si })).reverse().map(({ q, si }) => { const mine = all.filter(o => strOf(ED, o.s) === q.id), sst = shotStats(mine.map(o => o.s));
      return `<div class="sgh">${mkGlyph(si)}String ${si + 1} · Target ${tgtLetter(tv, q.tid)}<small>${mine.length} shot${mine.length === 1 ? "" : "s"}${sst.n ? ` · avg ${fpsT(sst.avg)}` : ""}${sst.n > 1 ? ` · SD ${sst.sd.toFixed(1)} · ES ${fpsT(sst.es)}` : ""}</small></div>` + mine.reverse().map(o => row(o, sst, si)).join(""); }).join("")
    : all.reverse().map(o => row(o, st, 0)).join("")) ||
    `<div class="hint" style="padding:8px 0">No shots yet.</div>`;
  paintStrBar(); paintTgView(); if (BAN.sid === ED.id && !$("shotBan").hidden) banPaint();
  paintUseMV();
}
// "Use … as MV": the average of every shot that was not Removed. Tags (Clean, Cold bore, Flier, Input error) stay in the average.
// Behavior change: Cold bore and Flier used to be left out automatically. They no longer are. Only the removed flag (x) excludes.
function mvPick() {
  const all = ED ? ED.shots : [], use = all.filter(s => !s.x), st = shotStats(use);
  const out = { x: all.filter(s => s.x).length };
  const r = ED && P.rifles.find(x => x.id === ED.rifleId), l = r?.loads.find(x => x.id === ED.loadId);
  const t = num("slPowder") ?? num("slTemp");
  return { st, n: use.length, out, l, t, mv: st.n ? Math.round(st.avg) : null };
}
function paintUseMV() {
  if (!ED) return;
  const m = mvPick(), b = $("slUseMV"), note = $("slMvNote");
  b.disabled = !m.st.n || !m.l;
  b.textContent = !m.st.n ? "Use avg as MV (no kept shots yet)" : `Use ${m.mv} fps${m.t != null ? ` at ${fmt(m.t, 0)}°F` : ""} for ${m.l ? m.l.name : "this load"}`;
  const left = [m.out.x && `${m.out.x} removed`].filter(Boolean);
  note.classList.toggle("warn", !!m.st.n && m.n < 5);
  note.textContent = !m.l ? "Assign this session to a saved load to use its average as the MV." : !m.st.n ? "" :
    `Average of ${m.n} shot${m.n === 1 ? "" : "s"}${left.length ? ` (left out: ${left.join(", ")})` : ""}${m.st.n > 1 ? ` · SD ${m.st.sd.toFixed(1)}` : ""}.` +
    (m.t == null ? " No session temperature yet: you'll be asked for it." : "") + (m.n < 5 ? ` ⚠ Only ${m.n} shot${m.n === 1 ? "" : "s"}; 5 or more give a steadier MV.` : "");
}
function addVelocities(text) {
  const vals = String(text).split(/[\s,;]+/).map(parseFloat).filter(v => isFinite(v) && v >= 50 && v <= 6000);
  vals.forEach(v => ED.shots.push({ v: +v.toFixed(1), id: uid(), ...(ED.tg ? { str: ED.tg.cur } : {}) })); if (vals.length) edDirty = true; return vals.length;
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
    shRollIfEnded(); arr.forEach(x => { x.str = tgEnsure(ED).cur; }); ED.shots.push(...arr); SH.lastId = arr[arr.length - 1].id;
    renderEditor(); await commitEditor(); $("slDel").style.display = ""; set_LIVE({ id: ED.id, source }); shPaint();
    return ED.id;
  }
  if (!open && !(ED && ED.source === source)) {   // background live session: no editor, the banner shows the shot
    const k = curKeyIds(); if (!k.loadId) return null;
    let L = LIVE && LIVE.source === source && LOG.find(s => s.id === LIVE.id && s.rifleId === k.rifleId && s.loadId === k.loadId);
    if (!L) { L = cleanSession(newSession(source)); LOG.push(L); set_LIVE({ id: L.id, source }); }
    const arr = mk(); arr.forEach(x => { if (L.tg) x.str = L.tg.cur; }); L.shots.push(...arr);
    const i = LOG.indexOf(L); LOG[i] = cleanSession(L); await saveLog(); slKey = null; maybeRenderLog();
    if (arr.length && opts.banner !== false) banShow(L.id, arr[arr.length - 1].id);
    return L.id;
  }
  if (!ED || ED.source !== source) {
    if (ED) { if (ED.shots.length) await commitEditor(); closeEditor(true); }   // keep whatever was open, then start the live session
    openEditor(null); if (!ED) return null; ED.source = source; $("slSource").value = SRC_LBL[source] || source;
    if (source === "bluetooth") setTimeout(() => { if (document.activeElement === $("slVel")) $("slVel").blur(); }, 80);   // no keyboard pop-up for radar shots
  }
  const arr = mk(); arr.forEach(x => { if (ED.tg) x.str = ED.tg.cur; });
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
    ED.recipe = s; edDirty = true; paintEdRecipe(); toast("Load data attached: tap 💾 Save session");
  };
  $("slAdd").onclick = addFromInput;
  $("slVel").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addFromInput(); } });
  $("slVel").addEventListener("paste", e => { const t = (e.clipboardData || window.clipboardData)?.getData("text") || ""; if (/[\s,;]/.test(t.trim())) { e.preventDefault(); if (addVelocities(t)) { renderEditor(); banShow(ED.id, ED.shots[ED.shots.length - 1].id); } } });
  $("slShots").addEventListener("click", e => {
    const b = e.target.closest("button"), row = e.target.closest(".shot"); if (!b || !row) return;
    const i = +row.dataset.i, s = ED.shots[i], f = b.dataset.f;
    if (f === "del") { if (s.id) unpair(ED, s.id); ED.shots.splice(i, 1); } else if (f === "noteT") s._showNote = !s._showNote;
    else { s[f] = !s[f]; if (!s[f]) delete s[f]; else if (f === "x" && s.id) unpair(ED, s.id); }
    edDirty = true; renderEditor();
  });
  $("slShots").addEventListener("change", e => { if (e.target.classList.contains("note")) { const i = +e.target.closest(".shot").dataset.i; ED.shots[i].note = e.target.value.trim(); edDirty = true; } });
  ["slDate", "slNotes", "slTemp", "slPowder", "slHum", "slPress", "slAlt", "slBarrel"].forEach(id => $(id).addEventListener("input", () => edDirty = true));
  $("slEdClose").onclick = () => closeEditor();
  $("slSave").onclick = async () => { if (!ED.shots.length) { toast("Add at least one shot"); return; } const c = await commitEditor(); closeEditor(true); toast(`Session saved · ${c.stats.n} shots, avg ${c.stats.avg.toFixed(0)} fps`); };
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

export { mvPick, paintUseMV, SHEETJS_URLS, ENGINE_URLS, K_LOG, MPS, LOG, slKey, ED, edDirty, IMP, loadLog, saveLog, nOrNull, sstr, cleanSession, shotStats, curKeyIds, sessFor, fmtDate, SRC_LBL, maybeRenderLog, renderLog, slEmptyHTML, cmpScope, renderCompare, sessHome, orphanSessions, orphanHTML, sessionsCSV, drawLogChart, toLocalInput, newSession, openEditor, paintEdFor, paintEdRecipe, renderEditor, addVelocities, addFromInput, readEditor, commitEditor, closeEditor, addShotsToLiveSession, set_LOG, set_slKey, set_edDirty, set_IMP };
