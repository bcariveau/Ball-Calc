// app/js/weather.js — Weather/conditions: fetching, station/altitude, atmosphere inputs and the ↻ Weather button.
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { schedule } from "./app.js";
import { toast } from "./components.js";
import { $, compass, norm360, num, setVal, val } from "./core.js";
import { curRange, same, updateDirty } from "./gear.js";
import { paintShHint } from "./optics.js";
import { K_LOC, WX_F, load, store } from "./storage.js";
import { drawDial } from "./wind-dial.js";


/* ---------------- weather & auto-fill ---------------- */
let wx = null;                 // last weather reading
const manual = new Set();      // fields the user overrode this session
const auto = {};               // field -> {v, src}
function computeAuto() {
  for (const k in auto) delete auto[k];
  const g = curRange();
  if (g && String(g.altitude ?? "") !== "") auto.altitude = { v: g.altitude, src: "range" };
  else if (wx) auto.altitude = { v: Math.round(wx.elevFt), src: "wx" };
  if (!wx) return;
  auto.windSpeed = { v: Math.round(wx.wind), src: "wx" };
  auto.temp = { v: Math.round(wx.tempF), src: "wx" };
  auto.humidity = { v: Math.round(wx.rh), src: "wx" };
  if (wx.inHg) auto.pressure = { v: wx.inHg.toFixed(2), src: "wx" };
  const b = num("bearing");
  if (b != null) auto.windDir = { v: Math.round(norm360(wx.windFrom - b)), src: "wx" };
}
function applyAuto() {
  computeAuto();
  for (const f of WX_F) if (auto[f] && !manual.has(f)) setVal(f, auto[f].v);
  renderChips(); drawDial(); updateDirty();
}
function renderChips() {
  for (const f of WX_F) {
    const c = $("src-" + f); if (!c) continue;
    const a = auto[f];
    c.className = "chip"; c.textContent = ""; c.onclick = null; c.title = "";
    if (!a) continue;
    const name = a.src === "range" ? "range" : "weather";
    if (!manual.has(f) || same(a.v, $(f).value)) { c.classList.add("wx"); c.textContent = a.src === "range" ? "📍 range" : "🌤 local weather"; }
    else { c.classList.add("man"); c.textContent = `✎ manual · ↺ ${name}`; c.title = `Revert to ${name} value (${a.v})`;
      c.onclick = (e) => { e.preventDefault(); manual.delete(f); setVal(f, a.v); applyAuto(); schedule(); }; }
  }
  paintShHint();
  const b = num("bearing");
  $("bearingHint").textContent = !wx ? "Set this so weather wind direction can be converted to wind relative to your shot."
    : b == null ? `Weather wind is from ${compass(wx.windFrom)} (${Math.round(wx.windFrom)}°). Enter the direction you're facing to convert it to your shot.`
    : `Weather wind from ${compass(wx.windFrom)} (${Math.round(wx.windFrom)}°) while facing ${compass(b)} → ${Math.round(norm360(wx.windFrom - b))}° relative.`;
}
function wxStatus(msg, bad) { const s = $("wxStatus"); s.textContent = msg; s.classList.toggle("bad", !!bad); }
async function fetchJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("not supported here"));
    if (!window.isSecureContext) return rej(new Error("needs https (or localhost)"));
    navigator.geolocation.getCurrentPosition(
      p => { const c = { lat: p.coords.latitude, lon: p.coords.longitude, label: "your location" }; store(K_LOC, c); res(c); },
      e => rej(new Error(e.code === 1 ? "permission denied" : e.code === 3 ? "timed out" : "unavailable")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
}
let wxBusy = false;
async function refreshWeather() {
  if (wxBusy) return;
  if (navigator.onLine === false) { wxStatus("📴 Offline — weather needs a connection. Keeping your manual values; it'll refresh when you're back online.", true); return; }
  wxBusy = true; $("wxBtn").disabled = true;
  try {
    let loc, note = "";
    const g = curRange();
    if (g && val("rangeLat") !== "" && val("rangeLon") !== "" && !isNaN(num("rangeLat")) && !isNaN(num("rangeLon"))) loc = { lat: num("rangeLat"), lon: num("rangeLon"), label: g.name };
    else {
      wxStatus("Getting your location…");
      try { loc = await getPosition(); }
      catch (e) {
        const last = load(K_LOC, null);
        if (last) { loc = last; note = ` (GPS ${e.message}; using last place)`; }
        else { $("placeBox").style.display = "flex"; throw new Error(`Location ${e.message}. Search a place below or keep entering wind manually.`); }
      }
    }
    wxStatus(`Fetching weather for ${loc.label}…`);
    const d = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(4)}&longitude=${loc.lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure&wind_speed_unit=mph&temperature_unit=fahrenheit`);
    const c = d.current; if (!c) throw new Error("No current weather returned");
    wx = { wind: c.wind_speed_10m, windFrom: c.wind_direction_10m, gust: c.wind_gusts_10m, tempF: c.temperature_2m, rh: c.relative_humidity_2m,
      inHg: c.surface_pressure ? c.surface_pressure * 0.0295300 : null, elevFt: (d.elevation ?? 0) * 3.28084, at: new Date() };
    $("placeBox").style.display = "none"; $("wxWindNote").hidden = false;
    applyAuto();
    wxStatus(`🌤 ${loc.label}: wind ${Math.round(wx.wind)} mph from ${compass(wx.windFrom)}` + (wx.gust ? ` (gusts ${Math.round(wx.gust)})` : "") +
      ` · ${Math.round(wx.tempF)}°F · ${Math.round(wx.rh)}% RH · updated ${wx.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${note}`);
    schedule();
  } catch (e) {
    if (navigator.onLine === false || (e instanceof TypeError && /fetch|network|load/i.test(e.message))) { wxStatus(navigator.onLine === false ? "📴 Offline — weather needs a connection. Keeping your manual values; it'll refresh when you're back online." : "Weather unavailable (no connection?) — keeping your manual values.", true); return; }
    const msg = e.name === "AbortError" ? "Weather request timed out" : e.message.startsWith("Location") ? e.message : "Weather unavailable (" + e.message + ")";
    wxStatus(msg + (msg.includes("manually") ? "" : " — keeping your manual values."), true);
  } finally { wxBusy = false; $("wxBtn").disabled = false; }
}
async function placeSearch() {
  const q = val("placeQ"); if (!q) return;
  if (navigator.onLine === false) return toast("Offline — place search needs a connection");
  try {
    const d = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(q)}`);
    const r = d.results?.[0]; if (!r) return toast("Place not found");
    store(K_LOC, { lat: r.latitude, lon: r.longitude, label: [r.name, r.admin1].filter(Boolean).join(", ") });
    refreshWeather();
  } catch (e) { toast("Search failed: " + e.message); }
}

export function init() {
  $("wxBtn").onclick = refreshWeather;
  $("placeGo").onclick = placeSearch;
  $("placeQ").addEventListener("keydown", e => { if (e.key === "Enter") placeSearch(); });
}

export { wx, manual, auto, computeAuto, applyAuto, renderChips, wxStatus, fetchJSON, getPosition, wxBusy, refreshWeather, placeSearch };
