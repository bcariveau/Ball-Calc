// beta/js/components.js — Shared UI pieces reused across tabs: toast, sheet open/close (openOvl/closeOvl), the gun·load·zero·unit context line, steppers, segmented controls, hint shortening, the Start/Continue-shooting buttons.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { turretSpec } from "./calc.js";
import { $, escapeHtml, norm360, val } from "./core.js";
import { renderAll } from "./dope.js";
import { curLoad, curRifle } from "./gear.js";
import { curOptic } from "./optics.js";
import { shPick } from "./shooting.js";
import { S, saveSettings } from "./storage.js";


/* ---------------- helpers ---------------- */
let toastT;
function toast(msg, act) {
  const acts = Array.isArray(act) ? act : (act ? [act] : []);
  const t = $("toast"); t.textContent = msg; t.classList.toggle("act", acts.length > 0);
  acts.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.id = i ? "toastAct" + i : "toastAct"; b.textContent = a.label; b.onclick = () => { clearTimeout(toastT); t.classList.remove("show", "act"); a.fn(); }; t.appendChild(b); });
  t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show", "act"), acts.length ? (acts[0].ms || 7000) : 2200);
}
/* ---------------- uniform: gun · load · zero · unit context line (Dope, Log, Gear) ---------------- */
function ctxParts() {
  const r = curRifle(), l = curLoad(), o = curOptic(); if (!r) return null;
  let u = ""; try { u = turretSpec().u; } catch {}
  return { gun: r.name, optic: o ? o.name : (r.opticId ? "saved optic missing" : "no optic saved"), load: l ? l.name : "no load", zero: `${val("zero") || "?"} yd zero`, unit: u, unconf: !!r.zeroUnconf, why: r.zeroUnconf?.why || "" };
}
function ctxPaint() {
  const c = ctxParts(), sep = `<span class="sep" aria-hidden="true">·</span>`;
  const h = !c ? `<span class="cG">Gun and load not saved yet</span>`
    : `<span class="cG">${escapeHtml(c.gun)}</span>${sep}<span class="cO">${escapeHtml(c.optic)}</span>${sep}<span class="cL">${escapeHtml(c.load)}</span>${sep}<span class="cZ${c.unconf ? " unconf" : ""}">${escapeHtml(c.zero)}${c.unconf ? " ⚠" : ""}</span>${c.unit ? sep + `<span class="cU">${c.unit}</span>` : ""}`;
  const t = !c ? "Gun and load not saved yet" : [c.gun, c.optic, c.load, c.zero + (c.unconf ? " (not confirmed" + (c.why ? ": " + c.why : "") + ")" : ""), c.unit].filter(Boolean).join(" · ");
  document.querySelectorAll(".ctx").forEach(e => { if (e.innerHTML !== h) e.innerHTML = h; e.title = t; e.setAttribute("aria-label", t); });
}

/* ---------------- steppers (swipe / +/- / tap to type) ---------------- */
function clampStep(el, v) {
  const box = el.closest(".stepper"), min = +box.dataset.min, max = +box.dataset.max;
  if (box.dataset.wrap) return norm360(v) % 360;
  return Math.min(max, Math.max(min, v));
}
function bump(el, n) {
  const box = el.closest(".stepper"), step = +box.dataset.step;
  let cur = parseFloat(el.value); if (isNaN(cur)) cur = box.dataset.wrap ? 0 : Math.max(+box.dataset.min, 0);
  const snapped = Math.round(cur / step) * step;
  let v = (snapped !== cur && n !== 0) ? (n > 0 ? Math.ceil(cur / step) * step + (n - 1) * step : Math.floor(cur / step) * step + (n + 1) * step) : cur + n * step;
  v = clampStep(el, +v.toFixed(4));
  if (String(v) !== el.value) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
}
// long helper paragraphs: first sentence on one line, ⓘ expands the rest
function shortenHints() {
  document.querySelectorAll(".hint:not([data-sh])").forEach(h => {
    h.dataset.sh = "1";
    if (h.id || h.children.length) return;
    const t = h.textContent.replace(/\s+/g, " ").trim(); if (t.length < 70) return;
    const m = /^(.{12,}?[.!?:])\s+(.+)$/.exec(t); let first, rest;
    if (m) { first = m[1]; rest = m[2]; } else { const k = t.lastIndexOf(" ", 60); if (k < 20) return; first = t.slice(0, k) + "…"; rest = "…" + t.slice(k + 1); }
    h.textContent = ""; h.classList.add("sh");
    const a = document.createElement("span"); a.className = "h1"; a.textContent = first;
    const b = document.createElement("button"); b.type = "button"; b.className = "info"; b.textContent = "ⓘ"; b.setAttribute("aria-label", "More about this"); b.setAttribute("aria-expanded", "false");
    const r = document.createElement("span"); r.className = "more"; r.hidden = true; r.textContent = " " + rest;
    b.onclick = () => { r.hidden = !r.hidden; h.classList.toggle("open", !r.hidden); b.classList.toggle("on", !r.hidden); b.setAttribute("aria-expanded", String(!r.hidden)); };
    h.append(a, b, r);
  });
}
var shT = 0;
function seg(id, key) {
  const el = $(id);
  const paint = () => el.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === S[key]));
  el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S[key] = b.dataset.v; paint(); saveSettings(); renderAll(); });
  paint();
}
function openOvl(id) { $(id).classList.add("show"); document.body.style.overflow = "hidden"; }
function closeOvl(id) { $(id).classList.remove("show"); document.body.style.overflow = ""; }
function shBtnPaint() {
  const bs = [$("shStartBtn"), $("slStartBtn")].filter(Boolean); if (!bs.length) return; let s = null;
  try { s = curLoad() ? shPick() : null; } catch { s = null; }
  const n = s ? s.shots.filter(x => !x.x).length : 0;
  for (const b of bs) b.innerHTML = s ? `▶ Continue shooting<small>${n} shot${n === 1 ? "" : "s"} in today's session · radar or typed</small>` : `▶ Start shooting<small>chronograph view · radar or typed shots</small>`;
}

export function init1() {
  document.querySelectorAll(".stepper").forEach(box => {
    const el = box.querySelector("input"), noSwipe = el.id === "windSpeed" || el.id === "windDir";   // the wind boxes sit in the scroll path: − / + only
    const mk = (txt, n, label) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", label);
      let t1, t2; const stop = () => { clearTimeout(t1); clearInterval(t2); };
      b.addEventListener("pointerdown", e => { e.preventDefault(); bump(el, n); t1 = setTimeout(() => t2 = setInterval(() => bump(el, n), 70), 400); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, stop));
      b.addEventListener("contextmenu", e => e.preventDefault());
      return b; };
    box.prepend(mk("−", -1, "decrease")); box.append(mk("+", 1, "increase"));
    if (el.id === "target") { box.classList.add("plain"); return; }   // the Dope distance is a normal editable number box: tap and type, − / + still step it
    // horizontal swipe on the number changes it; vertical swipe still scrolls the page (touch-action: pan-y)
    // Read-only until tapped, so a swipe never pops the keyboard; a plain tap (or keyboard focus) allows typing.
    let sx = null, sy = 0, acc = 0, dragging = false, pid = null, lastDrag = 0;
    el.readOnly = true;
    el.addEventListener("focus", () => { if (Date.now() - lastDrag < 350) el.blur(); else el.readOnly = false; });
    el.addEventListener("blur", () => { el.readOnly = true; });
    el.addEventListener("pointerdown", e => {
      if (document.activeElement === el && !el.readOnly) return;   // already typing
      sx = e.clientX; sy = e.clientY; acc = 0; dragging = false; pid = e.pointerId;
      e.preventDefault();
    });
    el.addEventListener("pointermove", e => {
      if (sx === null || e.pointerId !== pid) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragging) {
        if (!noSwipe && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = true; try { el.setPointerCapture(pid); } catch {} el.classList.add("dragging"); sx = e.clientX; }
        else if (Math.abs(dy) > 10 || (noSwipe && Math.abs(dx) > 10)) sx = null;   // vertical: let the page scroll
        return;
      }
      const PX = 14; acc += e.clientX - sx; sx = e.clientX;
      while (acc >= PX) { bump(el, 1); acc -= PX; }
      while (acc <= -PX) { bump(el, -1); acc += PX; }
    });
    const end = e => {
      if (sx === null && !dragging) return;
      const wasDrag = dragging; sx = null; dragging = false; el.classList.remove("dragging");
      if (wasDrag) lastDrag = Date.now();
      else if (e.type === "pointerup") { el.readOnly = false; el.focus(); el.select?.(); }   // a tap = type a value
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("keydown", e => { if (e.key === "ArrowUp") { e.preventDefault(); bump(el, 1); } if (e.key === "ArrowDown") { e.preventDefault(); bump(el, -1); } });
    el.addEventListener("wheel", e => { if (document.activeElement === el) { e.preventDefault(); bump(el, e.deltaY < 0 ? 1 : -1); } }, { passive: false });
  });
}

export function init2() {
  new MutationObserver(() => { clearTimeout(shT); shT = setTimeout(shortenHints, 40); }).observe(document.body, { childList: true, subtree: true });
}

export { toastT, toast, ctxParts, ctxPaint, clampStep, bump, shortenHints, shT, seg, openOvl, closeOvl, shBtnPaint };
