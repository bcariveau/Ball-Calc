// app/js/bulletdb.js — Bullet database sheet (bullets.json) search and picking.
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { toast } from "./components.js";
import { $, escapeHtml, num, setVal, val } from "./core.js";
import { pick, recipeText, updateDirty } from "./gear.js";
import { openRecipes, recipeMatches } from "./recipes.js";
import { LOAD_F, store } from "./storage.js";


/* ---------------- bullet database ---------------- */
const DB_URL = "bullets.json";
const IDB_NAME = "bcalc-db";
const K_DBMETA = "bcalc.bulletsMeta.v1";
let DB = null;
let dbLoading = null;
function idb(mode, fn) {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("no IndexedDB"));
    const o = indexedDB.open(IDB_NAME, 1);
    o.onupgradeneeded = () => o.result.createObjectStore("kv");
    o.onerror = () => rej(o.error);
    o.onsuccess = () => { const tx = o.result.transaction("kv", mode), st = tx.objectStore("kv"); const r = fn(st);
      tx.oncomplete = () => { res(r && r.result); o.result.close(); }; tx.onerror = () => rej(tx.error); };
  });
}
const idbGet = k => idb("readonly", st => st.get(k));
const idbPut = (k, v) => idb("readwrite", st => st.put(v, k));
function prepDB(d) {
  if (!d || !Array.isArray(d.bullets)) throw new Error("bad bullets file");
  d.bullets.forEach(b => b._h = [b.brand, b.line, b.name, b.caliber, b.sku, b.type, b.weight_gr + "gr", b.weight_gr + " gr"].filter(Boolean).join(" ").toLowerCase()
    .replace(/[®™]/g, "").replace(/-/g, " "));
  d.byId = new Map(d.bullets.map(b => [b.id, b])); return d;
}
async function loadDB() {
  if (DB) return DB;
  if (dbLoading) return dbLoading;
  dbLoading = (async () => {
    let cached = null;
    try { cached = await idbGet("bullets"); } catch {}
    if (!cached) { try { cached = JSON.parse(localStorage.getItem("bcalc.bullets.v1")); } catch {} }
    const fetchFresh = async () => {
      const r = await fetch(DB_URL, { cache: "no-cache" }); if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json(); if (!Array.isArray(d.bullets)) throw new Error("bad bullets file");
      try { await idbPut("bullets", d); } catch { try { localStorage.setItem("bcalc.bullets.v1", JSON.stringify(d)); } catch {} }
      store(K_DBMETA, d.meta || {}); return d;
    };
    if (cached && cached.bullets) {
      DB = prepDB(cached);
      fetchFresh().then(d => { if ((d.meta || {}).generated !== (cached.meta || {}).generated || d.bullets.length !== cached.bullets.length) { DB = prepDB(d); if ($("dbSheet").classList.contains("show")) renderDB(); } }).catch(() => {});
      return DB;
    }
    DB = prepDB(await fetchFresh()); return DB;
  })();
  try { return await dbLoading; } finally { dbLoading = null; }
}
const f3 = v => v == null ? "" : String(+v).replace(/^0\./, ".");
let dbKind = "";
const kindOk = b => !dbKind || (dbKind === "handgun" ? b.type === "handgun" : b.type !== "handgun");
function fillCalOptions(keep) {
  const dias = new Map(); DB.bullets.filter(kindOk).forEach(b => { if (!dias.has(b.diameter_in)) dias.set(b.diameter_in, { label: b.caliber || f3(b.diameter_in), n: 0 }); dias.get(b.diameter_in).n++; });
  const cs = $("dbCal"); cs.innerHTML = ""; cs.add(new Option(dbKind ? `All ${dbKind} calibers` : "All calibers", ""));
  [...dias.entries()].sort((a, b) => a[0] - b[0]).forEach(([d, x]) => cs.add(new Option(`${x.label} · ${x.n}`, d)));
  cs.value = dias.has(+keep) ? String(+keep) : "";
  return dias;
}
function fillDBFilters() {
  const dias = fillCalOptions("");
  const cs = $("dbCal");
  const cur = num("diameter"); let best = "";
  if (cur) { let bd = 0.0025; for (const d of dias.keys()) if (Math.abs(d - cur) < bd) { bd = Math.abs(d - cur); best = String(d); } }
  cs.value = best;
  const brands = [...new Set(DB.bullets.map(b => b.brand))].sort();
  const bs = $("dbBrand"), keep = bs.value; bs.innerHTML = ""; bs.add(new Option("All brands", "")); brands.forEach(b => bs.add(new Option(b, b))); bs.value = brands.includes(keep) ? keep : "";
}
function renderDB() {
  if (!DB) return;
  const q = $("dbQ").value.toLowerCase().replace(/[®™]/g, "").replace(/-/g, " ").trim(), toks = q.split(/\s+/).filter(Boolean);
  const cal = $("dbCal").value, brand = $("dbBrand").value;
  let res = DB.bullets.filter(b => kindOk(b) && (!cal || String(b.diameter_in) === cal) && (!brand || b.brand === brand) &&
    toks.every(t => /^\d{2,4}$/.test(t) && +t >= 15 ? (b.weight_gr === +t || b._h.includes(t + "gr") || (b.caliber || "").includes(t) || (b.sku || "").toLowerCase() === t) : b._h.includes(t)));
  res.sort((a, b) => (!!a.status - !!b.status) || a.diameter_in - b.diameter_in || a.weight_gr - b.weight_gr || a.brand.localeCompare(b.brand));
  const total = res.length; res = res.slice(0, 150);
  $("dbStatus").textContent = `${total} match${total === 1 ? "" : "es"}${total > 150 ? " (showing 150; refine the search)" : ""} · ${DB.bullets.length} bullets, data ${DB.meta?.generated || "?"}`;
  $("dbList").innerHTML = res.map(b => `<button type="button" class="dbItem" data-id="${escapeHtml(b.id)}"><span class="t">${escapeHtml(b.brand)} ${escapeHtml(b.name.toLowerCase().startsWith(b.brand.toLowerCase()) ? b.name.slice(b.brand.length).trim() : b.name)}</span>` +
    `<span class="m">${escapeHtml(b.caliber || "")} · ${b.weight_gr} gr · ${b.g7 ? "G7 " + f3(b.g7) + " · " : ""}${b.g1 ? "G1 " + f3(b.g1) : ""}${b.g1_bands ? " (banded)" : ""}${b.length_in ? ` · L ${b.length_in}"` : ""}${b.type ? " · " + escapeHtml(b.type) : ""}${b.status ? ' · <span class="old">older/discontinued</span>' : ""}</span></button>`).join("") ||
    `<div class="hint" style="padding:12px 0">No bullets match. Try fewer words or "All calibers".</div>`;
}
async function openDB() {
  $("dbSheet").classList.add("show"); document.body.style.overflow = "hidden";
  $("dbStatus").textContent = "Loading bullet database…"; $("dbList").innerHTML = "";
  try { await loadDB(); fillDBFilters(); renderDB(); setTimeout(() => $("dbQ").focus(), 50); }
  catch (e) { $("dbStatus").textContent = "Couldn't load the bullet database (" + e.message + "). Connect once to download it; it is then kept for offline use."; }
}
function closeDB() { $("dbSheet").classList.remove("show"); document.body.style.overflow = ""; }
const bandStr = bands => (bands || []).map(x => `${x.bc}@${x.v_min_fps}`).join(",");
function parseBands() { return val("bcBands").split(",").map(x => x.split("@").map(Number)).filter(([bc, v]) => bc > 0 && v >= 0).map(([bc, v]) => ({ bc, v })).sort((a, b) => b.v - a.v); }
const bandsOn = () => $("useBands").value === "1" && $("drag").value === "G1" && parseBands().length > 1;
function bandPoints() {
  // each Sierra band applies above its lower velocity limit; anchor each BC at the middle of its band
  const b = parseBands(); return b.map((x, i) => {
    const hi = i === 0 ? x.v + 400 : b[i - 1].v, lo = x.v || Math.max(0, hi - 400);
    return { bc: x.bc, v: Math.round((lo + hi) / 2) };
  });
}
function pickBullet(id) {
  const b = DB && DB.byId.get(id); if (!b) return;
  const g7 = b.g7 != null, model = g7 ? "G7" : "G1";
  setVal("bc", g7 ? b.g7 : b.g1); $("drag").value = model;
  setVal("weight", b.weight_gr); setVal("diameter", b.diameter_in); setVal("length", b.length_in ?? "");
  setVal("bulletId", b.id); setVal("bulletName", `${b.brand} ${b.caliber || ""} ${b.weight_gr} gr ${b.line || ""}`.replace(/\s+/g, " ").trim().slice(0, 100));
  setVal("bcBands", bandStr(b.g1_bands)); $("useBands").value = "";
  closeDB(); $("loadDetails").open = true; renderBulletInfo(); updateDirty(); schedule();
  const nRc = recipeMatches().length;
  if (nRc && !recipeText(pick(LOAD_F))) { toast(`Filled from ${b.brand} ${b.weight_gr} gr — ${nRc} saved recipe${nRc === 1 ? "" : "s"} for this bullet`); setTimeout(openRecipes, 60); return; }
  toast(`Filled from ${b.brand} ${b.weight_gr} gr — now enter your MV`);
  setTimeout(() => { $("mv").focus(); $("mv").select?.(); }, 60);
}
function markEdited() { $("bulletInfo").dataset.edited = "1"; renderBulletInfo(); }
function renderBulletInfo() {
  const el = $("bulletInfo"), id = val("bulletId"), bands = parseBands();
  $("bandsRow").style.display = bands.length > 1 ? "" : "none";
  $("bandsTxt").textContent = bands.length > 1 ? "Sierra G1 bands: " + bands.map(x => `${f3(x.bc)} ${x.v ? "≥ " + x.v + " fps" : "below that"}`).join(" · ") + ($("drag").value !== "G1" ? " — switch drag model to G1 to use them." : "") : "";
  if (!id) { el.textContent = ""; return; }
  const b = DB && DB.byId.get(id);
  let t = "From database: " + (val("bulletName") || id);
  if (b) t += ` · ${b.g7 ? "G7 " + f3(b.g7) + " / " : ""}${b.g1 ? "G1 " + f3(b.g1) : ""}${b.bc_note ? " · " + b.bc_note : ""}${b.status ? " · " + b.status : ""}`;
  el.innerHTML = escapeHtml(t) + (b?.source ? ` · <a href="${escapeHtml(b.source)}" target="_blank" rel="noopener" style="color:inherit">source</a>` : "") + " · factory BC, may be optimistic";
}
function swapModel() {
  // a database bullet: switching G1/G7 swaps in that model's published BC
  const b = DB && DB.byId.get(val("bulletId")); if (!b) { renderBulletInfo(); return; }
  const v = $("drag").value === "G7" ? b.g7 : b.g1;
  if (v != null) { setVal("bc", v); toast(`${$("drag").value} BC ${f3(v)} from database`); }
  else toast(`No published ${$("drag").value} BC for this bullet`);
  renderBulletInfo();
}

export function init() {
  $("dbOpen").onclick = () => { if ($("gunKind").value === "handgun" && !dbKind) { dbKind = "handgun"; $("dbKind").querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.v === "handgun")); } openDB(); };

  $("dbClose").onclick = closeDB;
  $("dbQ").addEventListener("input", () => renderDB());
  $("dbCal").addEventListener("change", () => renderDB());
  $("dbKind").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; dbKind = b.dataset.v;
    $("dbKind").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); if (DB) { fillCalOptions($("dbCal").value); renderDB(); } });

  $("dbBrand").addEventListener("change", () => renderDB());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("dbSheet").classList.contains("show")) closeDB(); });
  $("dbList").addEventListener("click", e => { const it = e.target.closest(".dbItem"); if (it) pickBullet(it.dataset.id); });
  $("mvEstBtn").onclick = () => {
    const out = $("mvEstOut"), ref = num("refMV"), bar = num("barrel"), rb = num("refBarrel") ?? 24, k = num("fpsPerInch") ?? 25;
    if (!ref) { out.textContent = "Enter the reference MV (from the box or load data) first."; return; }
    if (!bar) { out.textContent = "Enter this gun's barrel length under Gun details first."; $("rifleDetails").open = true; return; }
    const est = Math.round(ref + (bar - rb) * k);
    out.innerHTML = `ESTIMATE (not measured): <b>${est} fps</b> = ${ref} + (${bar}" − ${rb}") × ${k} fps/in. ` +
      `<button class="sm" type="button" id="mvEstUse">Use as MV</button>` + (num("mv") && $("mvSource").value === "measured" ? ` <span class="hint">You have a chronographed MV (${num("mv")}); it is more reliable.</span>` : "");
    $("mvEstUse").onclick = () => { setVal("mv", est); $("mvSource").value = "estimate"; out.innerHTML = `MV set to the estimate <b>${est} fps</b> (marked “Estimated”). Replace it with a chronograph reading when you have one.`; updateDirty(); schedule(); };
  };
}

export { DB_URL, IDB_NAME, K_DBMETA, DB, dbLoading, idb, idbGet, idbPut, prepDB, loadDB, f3, dbKind, kindOk, fillCalOptions, fillDBFilters, renderDB, openDB, closeDB, bandStr, parseBands, bandsOn, bandPoints, pickBullet, markEdited, renderBulletInfo, swapModel };
