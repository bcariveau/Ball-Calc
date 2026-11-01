// app/js/reassign.js — Move / reassign sessions between loads.
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { closeOvl, openOvl, toast } from "./components.js";
import { $, escapeHtml, setVal } from "./core.js";
import { cleanRecipe, curRifle, recipeText } from "./gear.js";
import { ED, LOG, SRC_LBL, fmtDate, maybeRenderLog, paintEdFor, paintEdRecipe, saveLog, sessHome, set_slKey, shotStats, slKey } from "./log.js";
import { dia3, fnum } from "./recipes.js";
import { P, REC_F } from "./storage.js";


/* ---------------- move / reassign sessions (single, live, bulk) ---------------- */
var SEL = null;
var MV = null;
var lpFired = false;
var lpT = 0;
// snapshot of a load's SAVED preset data (never the unsaved form)
function presetSnapshot(r, l) {
  const s = { loadName: l.name, gunName: r.name, gunKind: r.gunKind || "rifle", at: new Date().toISOString() };
  ["bulletName", "weight", "bc", "drag", "mv", "diameter", ...REC_F].forEach(k => { const v = String(l[k] ?? "").trim(); if (v) s[k] = v; });
  if (!s.ldKind) s.ldKind = "hand";
  return s;
}
function bulletText(o) { if (!o) return ""; return o.bulletName || [o.weight ? o.weight + " gr" : "", o.diameter ? dia3(o.diameter) : "", o.bc ? `BC ${o.bc} ${o.drag || ""}`.trim() : ""].filter(Boolean).join(" · "); }
function movePatch(s, r, l, upd) {
  const p = { rifleId: r.id, loadId: l.id, barrel: s.barrel };
  if (s.rifleId !== r.id) { const old = P.rifles.find(x => x.id === s.rifleId), ob = fnum(old?.barrel); if (s.barrel == null || (ob != null && s.barrel === ob)) p.barrel = fnum(r.barrel); }
  p.recipe = upd ? presetSnapshot(r, l) : s.recipe ? { ...s.recipe, gunName: r.name, gunKind: r.gunKind || "rifle", loadName: l.name } : null;
  return p;
}
const applyPatch = (s, p) => { s.rifleId = p.rifleId; s.loadId = p.loadId; s.barrel = p.barrel; if (p.recipe) s.recipe = JSON.parse(JSON.stringify(p.recipe)); else delete s.recipe; };
const sessGet = id => (ED && ED.id === id) ? ED : LOG.find(s => s.id === id);
function openMove(ids) {
  const ss = ids.map(sessGet).filter(Boolean); if (!ss.length) return;
  if (!P.rifles.some(r => r.loads.length)) { toast("Save a gun with a load first"); return; }
  const h = sessHome(ss[0]);
  MV = { ids: ss.map(s => s.id), gunId: (h.r || curRifle() || P.rifles.find(r => r.loads.length)).id, loadId: h.l ? h.l.id : "" };
  if (ss.some(s => s.rifleId !== ss[0].rifleId || s.loadId !== ss[0].loadId)) MV.loadId = "";
  $("mvTitle").textContent = ss.length > 1 ? `↔ Move ${ss.length} sessions` : "↔ Move session";
  const n = ss.reduce((a, s) => a + shotStats(s.shots).n, 0);
  $("mvFrom").textContent = ss.length > 1 ? `${ss.length} sessions · ${n} shots` : `${fmtDate(ss[0].date)} · ${shotStats(ss[0].shots).n} shots · ${SRC_LBL[ss[0].source] || ss[0].source}`;
  $("mvGun").innerHTML = P.rifles.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} — ${r.gunKind === "handgun" ? "Handgun" : "Rifle"}${r.barrel ? ` · ${r.barrel}"` : ""} (${r.loads.length} load${r.loads.length === 1 ? "" : "s"})</option>`).join("");
  $("mvGun").value = MV.gunId; $("mvUpd").checked = true;
  renderMove(); openOvl("mvSheet");
}
function distinct(arr, max = 3) { const u = [...new Set(arr.map(x => x || "—"))]; return u.length > max ? u.slice(0, max).join(" / ") + ` +${u.length - max}` : u.join(" / "); }
function renderMove() {
  const r = P.rifles.find(x => x.id === MV.gunId), ss = MV.ids.map(sessGet).filter(Boolean);
  const curIds = new Set(ss.map(s => s.rifleId + "|" + s.loadId));
  $("mvLoads").innerHTML = r && r.loads.length ? r.loads.map(l => {
    const rt = recipeText(l), cur = curIds.has(r.id + "|" + l.id), n = LOG.filter(s => s.rifleId === r.id && s.loadId === l.id).length;
    return `<button type="button" class="rcItem${l.id === MV.loadId ? " on" : ""}${cur ? " cur" : ""}" data-id="${escapeHtml(l.id)}"><span>${escapeHtml(l.name)}${cur ? '<span class="tag">current</span>' : ""}</span><span class="s"><small>${n} session${n === 1 ? "" : "s"}</small></span>` +
      `<span class="d">${escapeHtml(bulletText(l) || "no bullet data")}${l.mv ? ` · ${escapeHtml(l.mv)} fps` : ""}</span><span class="r">${rt ? (l.ldKind === "factory" ? "📦 " : "🧪 ") + escapeHtml(rt) : '<span style="color:var(--hint)">No load data saved</span>'}</span></button>`;
  }).join("") : `<div class="hint">No saved loads on this gun — add one under Load first.</div>`;
  const l = r?.loads.find(x => x.id === MV.loadId), upd = $("mvUpd").checked;
  if (!l) { $("mvDiff").innerHTML = `<div class="hint" style="padding:10px">Pick a load to see what changes.</div>`; $("mvGo").disabled = true; $("mvNote").textContent = ""; return; }
  const after = ss.map(s => ({ s, p: movePatch(s, r, l, upd) }));
  const gunOf = s => sessHome(s).r?.name || (s.recipe?.gunName ? s.recipe.gunName + " (deleted)" : "?");
  const loadOf = s => sessHome(s).l?.name || (s.recipe?.loadName ? s.recipe.loadName + " (deleted)" : "?");
  const ldOf = rc => recipeText(rc) || "none";
  const rows = [["Gun", distinct(ss.map(gunOf)), distinct(after.map(() => r.name))], ["Load", distinct(ss.map(loadOf)), l.name],
    ["Bullet", distinct(ss.map(s => bulletText(s.recipe))), distinct(after.map(x => bulletText(x.p.recipe)))],
    ["Load data", distinct(ss.map(s => ldOf(s.recipe)), 2), distinct(after.map(x => ldOf(x.p.recipe)), 2)],
    ["Barrel", distinct(ss.map(s => s.barrel != null ? s.barrel + '"' : "")), distinct(after.map(x => x.p.barrel != null ? x.p.barrel + '"' : ""))]];
  $("mvDiff").innerHTML = `<div class="t">Before → after</div><table><colgroup><col style="width:64px"><col><col style="width:16px"><col></colgroup>${rows.map(([k, a, b]) => `<tr class="${a === b ? "same" : "ch"}"><td>${k}</td><td class="a">${escapeHtml(a)}</td><td class="ar">→</td><td class="b">${escapeHtml(a === b ? "no change" : b)}</td></tr>`).join("")}</table>`;
  const changed = after.some(({ s, p }) => s.rifleId !== p.rifleId || s.loadId !== p.loadId || JSON.stringify(cleanRecipe(s.recipe) && { ...cleanRecipe(s.recipe), at: 0 }) !== JSON.stringify(p.recipe && { ...cleanRecipe(p.recipe), at: 0 }) || s.barrel !== p.barrel);
  $("mvGo").disabled = !changed;
  $("mvGo").textContent = ss.length > 1 ? `Move ${ss.length} sessions` : "Move session";
  const live = ED && ss.some(s => s.id === ED.id) && ED.source === "bluetooth";
  $("mvNote").textContent = (live ? "Radar shots keep going into this session after the move. " : "") + "Shots, dates, notes and weather stay as they are. You can undo right after.";
}
async function doMove() {
  const r = P.rifles.find(x => x.id === MV.gunId), l = r?.loads.find(x => x.id === MV.loadId); if (!l) return;
  const upd = $("mvUpd").checked, undo = [];
  for (const id of MV.ids) {
    const targets = [LOG.find(s => s.id === id), ED && ED.id === id ? ED : null].filter(Boolean);
    if (!targets.length) continue;
    const base = targets[targets.length - 1], p = movePatch(base, r, l, upd);
    undo.push({ id, rifleId: base.rifleId, loadId: base.loadId, barrel: base.barrel, recipe: base.recipe ? JSON.parse(JSON.stringify(base.recipe)) : null });
    targets.forEach(t => applyPatch(t, p));
  }
  await afterMove();
  if (ED && MV.ids.includes(ED.id)) { setVal("slBarrel", ED.barrel); }
  closeOvl("mvSheet"); if (SEL) { SEL = null; paintSel(); }
  const n = undo.length;
  toast(`Moved ${n > 1 ? n + " sessions" : "session"} to ${r.name} · ${l.name}`, { label: "Undo", fn: () => undoMove(undo) });
  return n;
}
async function afterMove() {
  await saveLog(); set_slKey(null); maybeRenderLog();
  if (ED && $("slEditor").classList.contains("show")) { paintEdFor(); paintEdRecipe(); }
}
async function undoMove(undo) {
  for (const u of undo) [LOG.find(s => s.id === u.id), ED && ED.id === u.id ? ED : null].filter(Boolean).forEach(t => applyPatch(t, u));
  if (ED && undo.some(u => u.id === ED.id)) setVal("slBarrel", ED.barrel);
  await afterMove(); toast(`Move undone (${undo.length} session${undo.length === 1 ? "" : "s"})`);
}
// select mode (tap "☑ Select" or long-press a session)
function paintSel() {
  const on = !!SEL, list = $("slList");
  list.classList.toggle("selecting", on); $("slSelBar").hidden = !on; $("slSelBtn").hidden = on || !list.querySelector(".slItem");
  $("slCsvBtn").hidden = !LOG.length; document.querySelector(".slTools").hidden = $("slSelBtn").hidden && $("slCsvBtn").hidden;
  if (!on) { list.querySelectorAll(".slItem.sel").forEach(b => b.classList.remove("sel")); return; }
  const vis = [...list.querySelectorAll(".slItem")].map(b => b.dataset.id);
  [...SEL].forEach(id => { if (!vis.includes(id)) SEL.delete(id); });
  list.querySelectorAll(".slItem").forEach(b => b.classList.toggle("sel", SEL.has(b.dataset.id)));
  $("slSelN").textContent = `${SEL.size} selected`; $("slSelMove").disabled = !SEL.size;
  $("slSelAll").textContent = SEL.size === vis.length && vis.length ? "None" : "All";
}

// cross-module writers (imports are read-only)
function set_lpFired(v) { return lpFired = v; }

export function init() {
  $("mvGun").onchange = e => { MV.gunId = e.target.value; const r = P.rifles.find(x => x.id === MV.gunId); MV.loadId = r && r.loads.length === 1 ? r.loads[0].id : ""; renderMove(); };
  $("mvLoads").addEventListener("click", e => { const b = e.target.closest(".rcItem"); if (!b) return; MV.loadId = b.dataset.id; renderMove(); });
  $("mvUpd").onchange = () => renderMove();
  $("mvClose").onclick = $("mvCancel").onclick = () => closeOvl("mvSheet");
  $("mvGo").onclick = () => doMove();
  $("slMoveBtn").onclick = () => { if (ED) openMove([ED.id]); };
  $("slSelBtn").onclick = () => { SEL = new Set(); paintSel(); toast("Tap sessions to select them, then ↔ Move"); };
  $("slSelDone").onclick = () => { SEL = null; paintSel(); };
  $("slSelAll").onclick = () => { const vis = [...$("slList").querySelectorAll(".slItem")].map(b => b.dataset.id); SEL = new Set(SEL.size === vis.length ? [] : vis); paintSel(); };
  $("slSelMove").onclick = () => { if (SEL && SEL.size) openMove([...SEL]); };
  $("slList").addEventListener("pointerdown", e => { const b = e.target.closest(".slItem"); if (!b || SEL) return; clearTimeout(lpT);
    lpT = setTimeout(() => { lpFired = true; SEL = new Set([b.dataset.id]); paintSel(); navigator.vibrate?.(20); setTimeout(() => lpFired = false, 800); }, 550); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => $("slList").addEventListener(ev, () => clearTimeout(lpT)));
  $("slList").addEventListener("contextmenu", e => { if (e.target.closest(".slItem")) e.preventDefault(); });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if ($("mvSheet").classList.contains("show")) { e.stopImmediatePropagation(); closeOvl("mvSheet"); } }, true);
}

export { SEL, MV, lpFired, lpT, presetSnapshot, bulletText, movePatch, applyPatch, sessGet, openMove, distinct, renderMove, doMove, afterMove, undoMove, paintSel, set_lpFired };
