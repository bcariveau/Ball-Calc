// beta/js/sensors.js — Device sensors: compass/inclinometer sheet.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { toast } from "./components.js";
import { $, compass, norm360 } from "./core.js";
import { curRange, updateDirty } from "./gear.js";
import { savePresets } from "./storage.js";


/* ---------------- phone sensors: compass aim & shot angle ---------------- */
// Heading/tilt of the back-camera axis (phone upright, camera at target) or of the top edge (phone flat on the scope).
const D2R = Math.PI / 180;
function orient(e) {
  if (e.beta == null || e.gamma == null) return null;
  const a = (e.alpha || 0) * D2R, b = e.beta * D2R, g = e.gamma * D2R;
  const sA = Math.sin(a), cA = Math.cos(a), sB = Math.sin(b), cB = Math.cos(b), sG = Math.sin(g), cG = Math.cos(g);
  const flat = Math.abs(cB * cG) > 0.7;   // screen facing up/down
  let vx, vy, vz;
  if (flat) { vx = -cB * sA; vy = cA * cB; vz = sB; }                       // top edge (device +y)
  else { vx = -(cA * sG + sA * sB * cG); vy = -(sA * sG - cA * sB * cG); vz = -(cB * cG); } // back camera (device −z)
  let heading = null;
  if (e.webkitCompassHeading != null) heading = e.webkitCompassHeading;     // iOS: already a compass heading
  else if (e.absolute || e.type === "deviceorientationabsolute") {
    heading = norm360(Math.atan2(vx, vy) / D2R);
    if (flat) heading = norm360(heading + (screen.orientation?.angle || 0));
  }
  return { heading, angle: Math.asin(Math.max(-1, Math.min(1, vz))) / D2R, flat };
}
let sens = null;   // {mode, sx, sy, n, ang, last}
function sensorHandler(e) {
  if (!sens) return;
  const o = orient(e); if (!o) return;
  if (sens.mode === "aim") {
    if (o.heading == null) { if (e.type === "deviceorientation" && !sens.sawAbs) $("sheetSub").textContent = "Waiting for compass…"; return; }
    if (e.type === "deviceorientationabsolute") sens.sawAbs = true;
    const k = sens.n ? 0.15 : 1;  // exponential smoothing on the unit circle
    sens.sx = (sens.sx || 0) * (1 - k) + Math.sin(o.heading * D2R) * k; sens.sy = (sens.sy || 0) * (1 - k) + Math.cos(o.heading * D2R) * k;
    sens.n++; sens.last = Math.round(norm360(Math.atan2(sens.sx, sens.sy) / D2R));
    $("sheetVal").textContent = `${sens.last}° ${compass(sens.last)}`;
    $("sheetSub").textContent = o.flat ? "Phone flat — using the top edge" : "Phone upright — using the back camera";
  } else {
    const k = sens.n ? 0.15 : 1; sens.ang = (sens.ang ?? o.angle) * (1 - k) + o.angle * k; sens.n++;
    sens.last = Math.round(sens.ang * 2) / 2;   // 0.5° steps
    $("sheetVal").textContent = `${sens.last > 0 ? "+" : ""}${sens.last.toFixed(1)}°`;
    $("sheetSub").textContent = Math.abs(sens.last) < 0.5 ? "Level" : sens.last > 0 ? "Uphill" : "Downhill";
  }
}
async function openSensor(mode) {
  if (!window.isSecureContext) { toast("Phone sensors need the page served over https"); return; }
  try {
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {   // iOS 13+ — must be called from a tap
      const r = await DOE.requestPermission(); if (r !== "granted") throw new Error("Motion & orientation access was denied. Allow it in your browser site settings (iPhone: Settings <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg> Apps <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg> Safari <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg> Motion & Orientation Access), then reload.");
    }
  } catch (e) { toast(e.message || "Sensor permission failed"); return; }
  sens = { mode, n: 0, last: null };
  $("sheetTitle").innerHTML = mode === "aim" ? "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><polygon points='16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76'/></svg> Aim at target" : "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z'/><path d='m14.5 12.5 2-2'/><path d='m11.5 9.5 2-2'/><path d='m8.5 6.5 2-2'/><path d='m17.5 15.5 2-2'/></svg> Measure shot angle";
  $("sheetVal").textContent = "—"; $("sheetSub").textContent = "Waiting for sensor…";
  $("sheetHelp").textContent = mode === "aim"
    ? "Hold the phone upright and point the back camera at the target (or lay it flat with the top edge toward the target). Keep it away from metal and magnets, then tap Lock. Reads magnetic north."
    : "Point the back camera at the target (or lay the phone along the scope, top edge toward the target), hold steady, then tap Lock.";
  $("sheet").classList.add("show");
  window.addEventListener("deviceorientationabsolute", sensorHandler);
  window.addEventListener("deviceorientation", sensorHandler);
  clearTimeout(sens.t); sens.t = setTimeout(() => { if (sens && !sens.n) $("sheetSub").textContent = "No sensor data — this device may not have a " + (mode === "aim" ? "compass" : "motion sensor") + "."; }, 3000);
}
function closeSensor() {
  window.removeEventListener("deviceorientationabsolute", sensorHandler);
  window.removeEventListener("deviceorientation", sensorHandler);
  if (sens) clearTimeout(sens.t); sens = null; $("sheet").classList.remove("show");
}

export function init() {
  $("sheetCancel").onclick = closeSensor;
  $("sheetLock").onclick = () => {
    if (!sens || sens.last == null) { toast("No reading yet"); return; }
    const { mode, last } = sens; closeSensor();
    if (mode === "aim") {
      $("bearing").value = last; $("bearing").dispatchEvent(new Event("input", { bubbles: true }));
      const g = curRange();
      if (g && confirm(`Shooting direction locked at ${last}° ${compass(last)}.\n\nSave it to range “${g.name}”?`)) { g.bearing = String(last); savePresets(); updateDirty(); toast(`Saved to “${g.name}”`); }
      else toast(`Shooting direction set to ${last}° ${compass(last)}`);
    } else {
      $("shotAngle").value = last; $("shotAngle").dispatchEvent(new Event("input", { bubbles: true }));
      toast(`Shot angle set to ${last > 0 ? "+" : ""}${last}°`);
    }
  };
  $("aimBtn").onclick = () => openSensor("aim");
  $("angleBtn").onclick = () => openSensor("angle");
  if ("DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches) {
    document.body.classList.add("has-sensors");
    if (!window.isSecureContext) $("sensorHint").textContent += " Compass/angle buttons need https.";
  }
}

export { D2R, orient, sens, sensorHandler, openSensor, closeSensor };
