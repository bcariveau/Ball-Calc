// app/js/themes.js — Colour themes (dark/light/od/fde/night), the 🎨 menu and the ⓘ About sheet.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { lastRun } from "./calc.js";
import { closeOvl, openOvl, toast } from "./components.js";
import { $ } from "./core.js";
import { renderChart } from "./dope.js";
import { maybeRenderLog, set_slKey, slKey } from "./log.js";
import { load, store } from "./storage.js";
import { drawDial } from "./wind-dial.js";


/* ---------------- color schemes ---------------- */
const K_THEME = "bcalc.theme.v1";
const THEMES = ["dark", "light", "od", "fde", "night"];
const cv = n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim();
function setFavicon() {
  const s = document.querySelector("#appHead .logo"); if (!s) return;
  const inner = s.innerHTML.replace(/var\(--logo-fg[^)]*\)/g, cv("text")).replace(/var\(--logo-ac[^)]*\)/g, cv("accent")).replace(/var\(--logo-bg[^)]*\)/g, cv("bg"));
  $("favicon").href = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${cv("bg")}"/>${inner}</svg>`);
}
function applyTheme(t, persist) {
  if (!THEMES.includes(t)) t = "dark";
  document.documentElement.dataset.theme = t;
  if (persist) store(K_THEME, t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = cv("bg");
  $("themeBar").querySelectorAll("button").forEach(b => { b.classList.toggle("on", b.dataset.t === t); b.setAttribute("aria-pressed", b.dataset.t === t); });
  setFavicon();
}
function openAbout() { $("themeBar").hidden = true; $("themeBtn").setAttribute("aria-expanded", "false"); openOvl("aboutSheet"); $("aboutClose").focus({ preventScroll: true }); }
function closeAbout() { closeOvl("aboutSheet"); $("themeBtn").focus({ preventScroll: true }); }

export function init() {
  applyTheme(document.documentElement.dataset.theme || load(K_THEME, "dark"));
  $("themeBtn").onclick = () => { const bar = $("themeBar"); bar.hidden = !bar.hidden; $("themeBtn").setAttribute("aria-expanded", !bar.hidden); };
  $("aboutBtn").onclick = openAbout;

  $("aboutClose").onclick = closeAbout;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("aboutSheet").classList.contains("show")) { e.stopImmediatePropagation(); closeAbout(); } }, true);
  $("themeBar").addEventListener("click", e => {
    const b = e.target.closest("button[data-t]"); if (!b) return;
    applyTheme(b.dataset.t, true);
    drawDial(); if (lastRun) renderChart(lastRun.samples); set_slKey(null); maybeRenderLog();
    toast(`Color scheme: ${b.textContent.trim()}`);
  });
}

export { K_THEME, THEMES, cv, setFavicon, applyTheme, openAbout, closeAbout };
