// app/js/app.js — App wiring: tab switching, global listeners, start-up sequence.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { loadDB, markEdited, renderBulletInfo, swapModel } from "./bulletdb.js";
import { B, calculate, lastRun } from "./calc.js";
import { ctxPaint, seg, shortenHints } from "./components.js";
import { $, num, val } from "./core.js";
import { paintScroll, renderAll, renderChart, setStale } from "./dope.js";
import { applyGunKind, applyLoad, applyRange, applyRifle, curRange, renderPickers, updateDirty } from "./gear.js";
import { loadLog, maybeRenderLog, set_slKey, slKey } from "./log.js";
import { followUnits, paintTurrets, paintUpNote } from "./optics.js";
import { K_SETTINGS, P, S, WX_F, saveSettings, store } from "./storage.js";
import { applyAuto, manual, refreshWeather, renderChips } from "./weather.js";
import { drawDial } from "./wind-dial.js";


/* ---------------- wiring ---------------- */
let calcT;
function schedule() { clearTimeout(calcT); if (B) setStale(true); paintAdv(); calcT = setTimeout(calculate, 300); }
function paintAdv() {
  const p = num("pressure");
  $("advSum").textContent = `${val("temp") || "?"}°F · ${val("humidity") || "?"}% · ${val("altitude") || "0"} ft · ${p != null ? p.toFixed(2) + " inHg" : "std pressure"}` + (val("powderTemp") ? ` · powder ${val("powderTemp")}°F` : "");
}
// tabs (the app always opens on Dope)
const TABS = ["dope", "gear", "log"];
function setTab(t, persist = true) {
  if (!TABS.includes(t)) t = "dope";
  document.querySelectorAll("main > .tab").forEach(x => x.classList.toggle("on", x.dataset.tab === t));
  document.querySelectorAll("#tabBar button").forEach(b => { const on = b.dataset.tab === t; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  document.body.dataset.tab = t;
  if (persist && S.tab !== t) { S.tab = t; store(K_SETTINGS, S); }
  if (t === "dope" && lastRun) { renderChart(lastRun.samples); paintScroll(); }
  if (t === "dope") drawDial();
  if (t === "log") { set_slKey(null); maybeRenderLog(); }
  ctxPaint();
}

export function init1() {
  $("tabBar").addEventListener("click", e => { const b = e.target.closest("button[data-tab]"); if (!b) return; if (b.dataset.tab !== S.tab) window.scrollTo(0, 0); setTab(b.dataset.tab); });
  $("tabBar").addEventListener("keydown", e => { if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return; const i = TABS.indexOf(S.tab), n = TABS[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3]; setTab(n); $("tabBtn" + n[0].toUpperCase() + n.slice(1)).focus(); });
}

export async function init2() {
  document.addEventListener("input", e => {
    const id = e.target.id; if (!id || id === "placeQ" || id.startsWith("db") || id.startsWith("sl") || id.startsWith("su") || /^(tr[A-Z]|dcv)/.test(id)) return;
    if (id.startsWith("ld")) { updateDirty(); return; }   // load data: no effect on the trajectory
    if (id === "gunKind") applyGunKind();
    if (id === "roundClk") { S.round = e.target.checked; saveSettings(); renderAll(); return; }
    if (id === "mv" && $("mvSource").value === "estimate") $("mvSource").value = "";
    if (["bc", "weight", "diameter"].includes(id) && val("bulletId")) markEdited();
    if (WX_F.includes(id)) manual.add(id);
    if (id === "bearing") applyAuto(); else { renderChips(); updateDirty(); }
    if (["turret", "turretU", "opTurret", "opTurretU"].includes(id)) { paintTurrets(); followUnits(true); }
    if (id === "opUp") paintUpNote();
    if (id === "windDir" || id === "windSpeed") drawDial();
    schedule();
  });
  document.addEventListener("change", e => {
    const id = e.target.id;
    if (id === "drag") { swapModel(); updateDirty(); schedule(); }
    if (id === "mvSource" || id === "useBands") { renderBulletInfo(); updateDirty(); schedule(); }
  });
  $("calcBtn").addEventListener("click", () => { clearTimeout(calcT); calculate(); refreshWeather({ gps: true }); });
  seg("angSeg", "ang");

  seg("viewSeg", "view");
  window.addEventListener("resize", () => { if (lastRun) renderChart(lastRun.samples); paintScroll(); });
  S.tab = "dope";

  setTab("dope", false);

  shortenHints();

  paintAdv();

  /* ---------------- start ---------------- */
  for (const [f, v] of Object.entries(S.values || {})) if ($(f) && v != null) $(f).value = v;
  await loadLog();
  renderPickers();

  applyRifle();

  applyLoad();
  if (val("bulletId")) loadDB().then(renderBulletInfo).catch(() => {});
  if (curRange()) applyRange(); else applyAuto();
  if (!P.rifles.length) $("rifleDetails").open = true;
  paintAdv();
  drawDial();
}

export { calcT, schedule, paintAdv, TABS, setTab };
