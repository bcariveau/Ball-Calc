// app/js/core.js — DOM helpers ($, val/num/fmt/setVal), number + HTML formatting, compass math, dynamic-import helper. No app state.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

const $ = id => document.getElementById(id);
let statusEl;   // set in init (was const)
let resultsDiv;   // set in init (was const)
const val = id => $(id).value.trim();
const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
const norm360 = d => ((d % 360) + 360) % 360;
const fmt = (v, d = 1) => (v == null || isNaN(v)) ? "" : String(+(+v).toFixed(d));
function setVal(id, v) { $(id).value = (v ?? "") === "" ? "" : v; }
const COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const compass = d => COMPASS[Math.round(norm360(d) / 22.5) % 16];
/* load data (recipe) */
const n3 = v => { const x = parseFloat(v); return isFinite(x) ? x.toFixed(3) : ""; };
const n1 = v => { const x = parseFloat(v); if (!isFinite(x)) return ""; const s = String(+x.toFixed(2)); return s.includes(".") ? s : x.toFixed(1); };
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
async function importFirst(urls) {               // same-origin vendored copy first (works offline), pinned CDN as a fallback
  let err;
  for (const u of urls) { try { return await import(new URL(u, document.baseURI).href); } catch (e) { err = e; } }
  throw err;
}

export function init() {
  statusEl = $("status");
  resultsDiv = $("results");
}

export { $, statusEl, resultsDiv, val, num, norm360, fmt, setVal, COMPASS, compass, n3, n1, escapeHtml, importFirst };
