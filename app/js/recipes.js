// app/js/recipes.js — Saved load recipes and copy-load sheets.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { closeOvl, openOvl, toast } from "./components.js";
import { $, escapeHtml, n3, num, setVal } from "./core.js";
import { applyLoad, applyRifle, curLoad, curRifle, isDirty, paintLdKind, pick, pkRefresh, recipeText, renderPickers, same, updateDirty } from "./gear.js";
import { LOG, saveLog } from "./log.js";
import { F_DEF, LOAD_F, P, REC_F, savePresets, uid } from "./storage.js";


/* ---------------- saved recipes by projectile · copy load ---------------- */
var RC = [];
var cpAll = false;
var cpMv = "est";
function fnum(v) { const x = parseFloat(v); return isFinite(x) ? x : null; }
function normName(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim(); }
function sameDia(a, b) { const x = fnum(a.diameter), y = fnum(b.diameter); return x != null && y != null && Math.abs(x - y) < 0.0015; }
function dia3(d) { const x = fnum(d); return x == null ? "" : x.toFixed(3).replace(/^0/, "") + '"'; }
// how two loads' projectiles match: "db" (same database bullet) | "name" | "spec" (diameter + weight + BC) | ""
function projMatch(a, b) {
  if (!sameDia(a, b)) return "";                       // caliber compatibility first
  if (a.bulletId && b.bulletId) return a.bulletId === b.bulletId ? "db" : "";
  if (normName(a.bulletName) && normName(a.bulletName) === normName(b.bulletName)) return "name";
  const wa = fnum(a.weight), wb = fnum(b.weight), ba = fnum(a.bc), bb = fnum(b.bc);
  if (wa == null || wb == null || Math.abs(wa - wb) > 0.5) return "";
  if (ba == null || bb == null || (a.drag || "G7") !== (b.drag || "G7") || Math.abs(ba - bb) > 0.02 * Math.max(ba, bb)) return "";
  return "spec";
}
function projLabel(o) {
  return o.bulletName ? `${o.bulletName}` : `${o.weight || "?"} gr ${dia3(o.diameter) || "?"} bullet` + (o.bc ? ` · BC ${o.bc} ${o.drag || ""}` : "");
}
// best chrono session for a saved load: lowest SD with 3+ shots, preferring sessions shot with the load's current recipe
function bestSession(rid, l) {
  const ss = LOG.filter(x => x.rifleId === rid && x.loadId === l.id && x.stats && x.stats.n);
  if (!ss.length) return null;
  const sameRc = ss.filter(x => x.recipe && same(x.recipe.ldCharge, l.ldCharge) && String(x.recipe.ldPowder || "").trim() === String(l.ldPowder || "").trim());
  const pool = sameRc.length ? sameRc : ss, g3 = pool.filter(x => x.stats.n >= 3);
  const best = (g3.length ? g3.sort((a, b) => a.stats.sd - b.stats.sd) : pool.sort((a, b) => b.stats.n - a.stats.n))[0];
  return { s: best, n: ss.length, thisRecipe: !!sameRc.length };
}
function recipeMatches(cur = pick(LOAD_F), withStats) {
  const me = curLoad(), r0 = curRifle(), out = [];
  P.rifles.forEach(r => r.loads.forEach(l => {
    if (l === me || !recipeText(l)) return;
    const m = projMatch(cur, l); if (m) out.push({ r, l, m, best: withStats ? bestSession(r.id, l) : null });
  }));
  return out.sort((a, b) => (b.r === r0) - (a.r === r0) || (a.best?.s.stats.n >= 3 ? a.best.s.stats.sd : 99) - (b.best?.s.stats.n >= 3 ? b.best.s.stats.sd : 99) || a.l.name.localeCompare(b.l.name));
}
function paintRecipeBtns() {
  const n = recipeMatches().length, t = `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M12 7v14'/><path d='M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'/></svg> Use a saved recipe for this bullet (${n})`;
  ["rcFind", "rcBulletBtn"].forEach(id => { $(id).hidden = !n; $(id).textContent = t; });
}
function openRecipes() {
  const cur = pick(LOAD_F), r0 = curRifle(), myBar = num("barrel");
  RC = recipeMatches(cur, true);
  $("rcFor").textContent = `For ${projLabel(cur)} · ${RC.length} saved recipe${RC.length === 1 ? "" : "s"}`;
  $("rcList").innerHTML = RC.length ? RC.map((x, i) => {
    const bar = fnum(x.r.barrel), st = x.best?.s.stats, other = x.r !== r0;
    const where = `${x.r.name} · ${x.l.name} · ${x.r.gunKind === "handgun" ? "Handgun" : "Rifle"}${bar ? ` · ${bar}" barrel` : ""}`;
    const extra = x.l.ldKind !== "factory" ? [x.l.ldCase ? x.l.ldCase + (x.l.ldFired ? ` ×${x.l.ldFired}` : "") : "", n3(x.l.ldCBTO) ? `CBTO ${n3(x.l.ldCBTO)}"` : "", n3(x.l.ldJump) ? `jump ${n3(x.l.ldJump)}"` : ""].filter(Boolean).join(" · ") : "";
    let warn = "";
    if (other) warn = bar && myBar && Math.abs(bar - myBar) >= 0.5 ? `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> ${bar}" barrel vs your ${myBar}" — velocity will differ (≈${myBar > bar ? "+" : "−"}${Math.round(Math.abs(myBar - bar) * 25)} fps). Work up again.`
      : `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Another gun${bar ? "" : " (barrel length not set)"} — chamber and velocity may differ. Work up again.`;
    const stats = st ? `${Math.round(st.avg)} fps<small>SD ${st.n > 1 ? st.sd.toFixed(1) : "—"} · ${st.n} shot${st.n === 1 ? "" : "s"}${x.best.n > 1 ? ` · best of ${x.best.n}` : ""}${x.best.thisRecipe ? "" : " · older recipe"}</small>`
      : x.l.mv ? `${x.l.mv} fps<small class="none">saved MV${({ measured: " (chrono)", factory: " (box)", estimate: " (est.)" })[x.l.mvSource] || ""}</small>` : `<small class="none">no chrono data</small>`;
    return `<button type="button" class="rcItem" data-i="${i}"><span>${escapeHtml(recipeText(x.l))}${x.m === "spec" ? '<span class="tag">same weight + BC</span>' : ""}</span><span class="s">${stats}</span>` +
      `<span class="d">${escapeHtml(where)}${extra ? "<br>" + escapeHtml(extra) : ""}</span>${warn ? `<span class="w">${escapeHtml(warn)}</span>` : ""}</button>`;
  }).join("") : `<div class="hint">No saved recipes for this bullet yet. Save load data on a load that uses this bullet and it shows up here for every gun of the same bullet diameter.</div>`;
  openOvl("rcSheet");
}
function applySavedRecipe(x) {
  const curRt = recipeText(pick(LOAD_F)), rt = recipeText(x.l);
  if (curRt && curRt !== rt && !confirm(`Replace this load's data (${curRt}) with ${rt} from “${x.r.name} · ${x.l.name}”?`)) return;
  REC_F.forEach(f => setVal(f, (x.l[f] ?? "") === "" && F_DEF[f] ? F_DEF[f] : x.l[f]));
  paintLdKind(); closeOvl("rcSheet"); $("recipeDetails").open = true; updateDirty();
  toast(curLoad() ? `Recipe from ${x.r.name} applied and saved` : `Recipe from ${x.r.name} applied`);
  setTimeout(() => $("recipeDetails").scrollIntoView({ block: "start", behavior: "smooth" }), 50);
}

// copy load: MV handling for another gun (uses the barrel-length estimate: ref MV + Δbarrel × fps/in)
function copyMV(src, sg, tg, mode) {
  const o = { mv: src.mv, mvSource: src.mvSource, refMV: src.refMV, refBarrel: src.refBarrel, note: "" }, mv = fnum(src.mv);
  if (mv == null) return o;
  const sb = fnum(sg.barrel), tb = fnum(tg.barrel), k = fnum(src.fpsPerInch) ?? 25;
  const fromRef = src.mvSource === "estimate" && fnum(src.refMV) && fnum(src.refBarrel);
  const base = fromRef ? fnum(src.refMV) : mv, bb = fromRef ? fnum(src.refBarrel) : sb;
  if (src.mvSource === "factory") { o.note = `box MV ${mv} fps kept`; return o; }
  if (mode === "est" && bb && tb && Math.abs(tb - bb) >= 0.25) {
    const est = Math.round(base + (tb - bb) * k);
    Object.assign(o, { mv: String(est), mvSource: "estimate", refMV: String(base), refBarrel: String(bb), note: `MV ${est} fps est. for ${tb}" (${base} @ ${bb}")` });
    return o;
  }
  if (src.mvSource === "measured") Object.assign(o, { mvSource: "estimate", refMV: String(mv), refBarrel: sb ? String(sb) : (src.refBarrel || "") });
  o.note = `MV ${mv} fps kept${src.mvSource === "measured" ? ", marked estimated" : ""}` + (mode === "est" && !(bb && tb) ? " (set both barrel lengths to estimate)" : mode === "est" && bb && tb ? " (same barrel length)" : "");
  return o;
}
function gunDias(g) { return [...new Set(g.loads.map(l => fnum(l.diameter)).filter(x => x != null).map(x => x.toFixed(3)))]; }
var cpMode = "copy";
function openCopy(mode) {
  const l = curLoad(); if (!l) { toast("Pick a load first"); return; }
  cpMode = mode === "move" ? "move" : "copy";
  const cur = pick(LOAD_F), rt = recipeText(cur);
  $("cpTitle").innerHTML = cpMode === "move" ? `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move “${escapeHtml(l.name)}” to another gun` : `<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg> Copy “${escapeHtml(l.name)}”`;
  $("cpDup").hidden = cpMode === "move";
  $("cpFor").textContent = `${projLabel(cur)} · ${cur.mv || "?"} fps${rt ? " · " + rt : ""}`;
  cpAll = false; renderCopy(); openOvl("cpSheet");
}
function renderCopy() {
  const src = pick(LOAD_F), r0 = curRifle(), others = P.rifles.filter(g => g !== r0);
  const fits = g => { const d = gunDias(g); return !d.length || d.some(x => Math.abs(+x - (fnum(src.diameter) ?? -1)) < 0.0015); };
  const nFit = others.filter(fits).length, show = cpAll ? others : others.filter(fits);
  $("cpMv").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === cpMv));
  $("cpMvRow").hidden = !show.length || src.mvSource === "factory" || !fnum(src.mv);
  $("cpList").innerHTML = show.length ? show.map(g => {
    const d = gunDias(g), bar = fnum(g.barrel), m = copyMV(src, r0, g, cpMv), ok = fits(g);
    const info = [g.gunKind === "handgun" ? "Handgun" : "Rifle", bar ? `${bar}" barrel` : "barrel not set", g.loads.length ? `${g.loads.length} load${g.loads.length === 1 ? "" : "s"}` + (d.length ? ", bullets " + d.map(dia3).join(", ") : "") : "no loads yet"].join(" · ");
    return `<button type="button" class="rcItem" data-id="${escapeHtml(g.id)}"><span>${escapeHtml(g.name)}</span><span class="s">${cpMode === "move" ? "Move →" : "Copy →"}</span><span class="d">${escapeHtml(info)}${m.note ? "<br>" + escapeHtml(m.note) : ""}</span>` +
      (ok ? "" : `<span class="w"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Different bullet diameter (${escapeHtml(d.map(dia3).join(", "))}) — make sure this is the right gun</span>`) + "</button>";
  }).join("") : `<div class="hint">${others.length ? `No other guns with ${dia3(src.diameter) || "this"} bullets.` : "No other guns saved yet — add one with <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New under Gun."}</div>`;
  const hid = others.length - nFit;
  $("cpAllBtn").hidden = !hid; $("cpAllBtn").textContent = cpAll ? "Show only guns with the same bullet diameter" : `Show all guns (${hid} with other bullet diameters)`;
}
function copyName(g, base) { let n = `${base} (copy)`.slice(0, 60), i = 2; while (g.loads.some(x => x.name === n)) n = `${base} (copy ${i++})`.slice(0, 60); return n; }
function copyLoadTo(tg) {
  const r0 = curRifle(), l = curLoad(); if (!l || !tg) return;
  if (isDirty(l, LOAD_F) && confirm(`“${l.name}” has unsaved changes. Save them to “${l.name}” as well?\n(Cancel = the changes go only into the copy.)`)) Object.assign(l, pick(LOAD_F));
  const src = pick(LOAD_F), c = { ...src, id: uid(), name: copyName(tg, l.name) };
  let note = "";
  if (tg !== r0) { const m = copyMV(src, r0, tg, cpMv); ["mv", "mvSource", "refMV", "refBarrel"].forEach(k => c[k] = m[k] ?? ""); note = m.note; }
  tg.loads.push(c); tg.lastLoadId = c.id;
  if (tg !== r0) { P.lastRifleId = tg.id; applyRifle(); }
  savePresets(); renderPickers(); applyLoad(); closeOvl("cpSheet"); updateDirty(); schedule();
  $("recipeDetails").open = true;
  toast(tg === r0 ? `Duplicated as “${c.name}” — change the charge (saves automatically)` : `Copied to ${tg.name} as “${c.name}”${note ? " · " + note : ""}`);
  setTimeout(() => { $("loadSel").scrollIntoView({ block: "center", behavior: "smooth" }); if (tg === r0) { $("ldKind").value !== "factory" && $("ldCharge").focus({ preventScroll: true }); } }, 60);
  return c;
}
// move a load (and its chrono sessions) to another gun; MV follows the same barrel-length rule as copy
function moveLoadTo(tg) {
  const r0 = curRifle(), l = curLoad(); if (!l || !tg || tg === r0) return;
  const m = copyMV(pick(LOAD_F), r0, tg, cpMv); ["mv", "mvSource", "refMV", "refBarrel"].forEach(k => l[k] = m[k] ?? "");
  r0.loads = r0.loads.filter(x => x !== l); r0.lastLoadId = r0.loads[0]?.id || null;
  tg.loads.push(l); tg.lastLoadId = l.id; P.lastRifleId = tg.id;
  let n = 0; LOG.forEach(x => { if (x.rifleId === r0.id && x.loadId === l.id) { x.rifleId = tg.id; n++; } }); if (n) saveLog();
  closeOvl("cpSheet"); pkRefresh();
  toast(`Moved “${l.name}” to ${tg.name}${n ? ` with ${n} session${n === 1 ? "" : "s"}` : ""}${m.note ? " · " + m.note : ""}`);
  return l;
}

export function init() {
  $("rcFind").onclick = $("rcBulletBtn").onclick = () => openRecipes();
  $("rcClose").onclick = () => closeOvl("rcSheet");
  $("rcList").addEventListener("click", e => { const b = e.target.closest(".rcItem"); if (b) applySavedRecipe(RC[+b.dataset.i]); });
  $("loadCopy").onclick = () => openCopy("copy");
  $("cpClose").onclick = () => closeOvl("cpSheet");
  $("cpDup").onclick = () => copyLoadTo(curRifle());
  $("cpAllBtn").onclick = () => { cpAll = !cpAll; renderCopy(); };
  $("cpMv").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; cpMv = b.dataset.v; renderCopy(); });
  $("cpList").addEventListener("click", e => { const b = e.target.closest(".rcItem"); if (!b) return; const g = P.rifles.find(x => x.id === b.dataset.id); cpMode === "move" ? moveLoadTo(g) : copyLoadTo(g); });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; ["rcSheet", "cpSheet"].forEach(id => $(id).classList.contains("show") && closeOvl(id)); });
}

export { RC, cpAll, cpMv, fnum, normName, sameDia, dia3, projMatch, projLabel, bestSession, recipeMatches, paintRecipeBtns, openRecipes, applySavedRecipe, copyMV, gunDias, cpMode, openCopy, renderCopy, copyName, copyLoadTo, moveLoadTo };
