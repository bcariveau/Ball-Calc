// beta/js/dope.js — Dope tab rendering: the card, table, chart, warnings, wind holds, gust spread, field errors.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { setTab } from "./app.js";
import { B, angDec, angs, clkShort, clkTxt, lastRun, mvAdjOn, perMph, pointVals, set_lastRun, turretSpec, windHoldAt } from "./calc.js";
import { ctxPaint, toast } from "./components.js";
import { $, escapeHtml, fmt, norm360, num, resultsDiv, val } from "./core.js";
import { curRifle, updateDirty } from "./gear.js";
import { S, savePresets } from "./storage.js";
import { cv } from "./themes.js";
import { wx } from "./weather.js";

function renderAll() { if (!lastRun) return; setStale(false); renderCard(); renderTable(lastRun.samples); renderChart(lastRun.samples); }
function setStale(on) { $("dopeCard").classList.toggle("stale", on); resultsDiv.classList.toggle("stale", on); document.querySelector(".chart-container").classList.toggle("stale", on); }
// never show old numbers: blank the card, table and chart when the inputs can't be solved
function noResult(bad) {
  set_lastRun(null); setStale(false);
  $("dcElev").textContent = "—"; $("dcWind").textContent = "—"; $("dcElevC").textContent = ""; $("dcWindC").textContent = ""; $("dcBracket").textContent = ""; ["dcElevClk", "dcWindClk", "dcWarn"].forEach(id => $(id).textContent = "");
  $("dcInfo").innerHTML = ""; $("dcChips").innerHTML = ""; $("dcMsg").innerHTML = bad && bad.length ? `<span class="bad">Fix ${bad.length} field${bad.length > 1 ? "s" : ""}: ${bad.map(f => escapeHtml(fieldName(f))).join(", ")}</span><br><button class="sm ghost" type="button" id="dcFix">Go to field</button>` : `<span class="bad">No result</span>`;
  if ($("dcFix")) $("dcFix").onclick = () => goToField(bad[0]);
  resultsDiv.innerHTML = ""; renderChart(null);
}
function fieldName(f) { const l = document.querySelector(`label[for="${f}"]`); return (l ? (l.querySelector("span")?.textContent || l.textContent) : f).replace(/\s*\(.*$/, "").trim() || f; }
function goToField(f) { const el = $(f); if (!el) return; const t = el.closest(".tab"); if (t) setTab(t.dataset.tab); el.closest("details:not([open])") && (el.closest("details").open = true); setTimeout(() => { el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); }, 40); }
const ud = (v, d) => Math.abs(v) < 0.05 ? "0.0" : `${v > 0 ? "U" : "D"} ${Math.abs(v).toFixed(d)}`;
const lr = (v, d) => Math.abs(v) < 0.05 ? "0.0" : `${v > 0 ? "R" : "L"} ${Math.abs(v).toFixed(d)}`;
const CLOCK = d => { const h = Math.round(norm360(d) / 30) % 12; return h === 0 ? 12 : h; };
function renderCard() {
  const R = lastRun, u = S.ang, ts = turretSpec();
  ctxPaint();
  $("dcElevK").textContent = `Dial · ${u}`; $("dcWindK").textContent = `Wind hold · ${u}`;
  $("dcMsg").innerHTML = "";
  if (!R.tgt) {
    $("dcElev").textContent = "—"; $("dcWind").textContent = "—"; ["dcElevC", "dcWindC", "dcElevClk", "dcWindClk", "dcBracket", "dcInfo"].forEach(id => $(id).textContent = "");
    $("dcMsg").innerHTML = R.td ? `<span class="bad">${R.td} yd is beyond where this bullet can reach.</span>` : "Set a target distance.";
    paintWarn(); paintPt(); return;
  }
  const v = pointVals(R.tgt), a = angs(R.tgt), dd = angDec(ts), tt = turnsTxt(a.ec, ts);
  $("dcElev").textContent = ud(a.e, dd); $("dcWind").textContent = lr(a.w, dd);
  $("dcElevClk").textContent = tt ? `${a.ec > 0 ? "U" : "D"} ${tt} (${Math.abs(a.ec)}) · ${ts.lbl}` : `${clkTxt(a.ec, "U", "D")} · ${ts.lbl}`;
  $("dcWindClk").textContent = clkTxt(a.wc, "R", "L") + (ts.sfp ? ` · holds true at ${fmt(ts.sfp, 1)}×` : "");
  $("dcElevC").textContent = `${v.range} yd${R.look ? ` · ${Math.abs(R.look)}° ${R.look > 0 ? "up" : "down"}` : ""}`;
  $("dcWindC").textContent = R.ws ? `${fmt(R.ws, 1)} mph @ ${CLOCK(R.wd)} o'clock` : "no wind (spin drift only)";
  const call = R.ws, gs = gustSpread();
  if (windHoldAt(0) == null) $("dcBracket").textContent = "";
  else if (gs) {   // live weather: bracket from the call up through the gust spread
    const lull = Math.max(0, call - gs / 2), mid = call + gs / 2, hi = call + gs;
    $("dcBracket").innerHTML = `Wind ${fmt(lull, 1)} / <b>${fmt(call, 1)}</b> / ${fmt(mid, 1)} / ${fmt(hi, 1)} mph → ${lr(windHoldAt(lull), dd)} · <b>${lr(a.w, dd)}</b> · ${lr(windHoldAt(mid), dd)} · ${lr(windHoldAt(hi), dd)}` +
      `<span class="gn">Lull / call / gusts · spread ${fmt(wx.wind, 0)}→${fmt(wx.gust, 0)} mph from live weather (10 m wind)</span>`;
  } else {
    const lo = Math.max(0, call - 2), hi = call + 2;
    $("dcBracket").innerHTML = `Wind ${fmt(lo, 1)} / <b>${fmt(call, 1)}</b> / ${fmt(hi, 1)} mph → ${lr(windHoldAt(lo), dd)} · <b>${lr(a.w, dd)}</b> · ${lr(windHoldAt(hi), dd)}`;
  }
  const pm = perMph(R.tgtN, R.tgtF), sp = R.tgtN ? pointVals(R.tgtN).wind : null;
  $("dcInfo").innerHTML = `MV ${Math.round(R.mvNow)} fps${mvAdjOn() ? ` @ ${fmt(R.Tp, 0)}°F powder` : ""} · ${v.vel.toFixed(0)} fps · ${v.energy.toFixed(0)} ft·lb · ${v.tof.toFixed(2)} s · drop ${v.drop.toFixed(1)}"` +
    (pm != null ? ` · 1 mph full = ${pm.toFixed(2)} ${u}` : "") + (sp != null && Math.abs(sp) >= 0.005 ? ` · spin drift ${sp > 0 ? "R" : "L"} ${Math.abs(sp).toFixed(2)} ${u} (in wind hold)` : "");
  paintWarn(); paintPt();
}
function renderTable(samples) {
  const R = lastRun, u = S.ang, full = S.view === "full", ts = turretSpec(), dd = angDec(ts), A = B.Angular, TU = ts.u === "MIL" ? A.MRad : A.MOA, sd = u === "MIL" ? 2 : 1;
  const rows = samples.map((p, i) => ({ p, n: R.sN?.[i], f: R.sF?.[i] }));
  if (R.tgt) {   // the exact target distance is always a row (highlighted)
    const tr = pointVals(R.tgt).range, k = rows.findIndex(r => pointVals(r.p).range >= tr);
    if (k >= 0 && pointVals(rows[k].p).range === tr) rows[k] = { p: R.tgt, n: R.tgtN, f: R.tgtF, tgt: true };
    else { const row = { p: R.tgt, n: R.tgtN, f: R.tgtF, tgt: true }; k < 0 ? rows.push(row) : rows.splice(k, 0, row); }
  }
  const vT = R.vT || 0;
  const clkT = n => { if (!ts.cpt || !n) return clkShort(n, "U", "D"); const m = Math.abs(n); return `${n > 0 ? "U" : "D"}${Math.floor(m / ts.cpt)}+${m % ts.cpt}`; };
  const spin = r => { if (!r.n) return ["—", ""]; const v = pointVals(r.n).wind, c = Math.round(-r.n.windageAngle.In(TU) / ts.v); return [Math.abs(v) < 0.005 ? "0" : `${v > 0 ? "R" : "L"} ${Math.abs(v).toFixed(sd)}`, clkShort(c, "R", "L")]; };
  const rc = (r, tr) => [r.tgt ? "tgt" : "", tr ? "trans" : ""].join(" ").trim(), Tm = '<span class="T" title="Transonic (below Mach 1.2)">T</span>';
  const over = a => ts.up != null && a.eT > ts.up + 1e-9;
  let html;
  if (!full) {
    html = `<table class="dope"><thead><tr><th>Range</th><th>Elev<small>${u} · clk</small></th><th>Wind<small>${u} · 1 mph</small></th><th title="Spin drift correction — already included in Wind">Spin<small>${u} · clk</small></th><th>Drop<small>in</small></th></tr></thead><tbody>`;
    rows.forEach(r => {
      const v = pointVals(r.p), a = angs(r.p), pm = perMph(r.n, r.f), tr = vT && v.vel < vT, [sv, sc] = spin(r);
      html += `<tr class="${rc(r, tr)}"><td>${v.range.toFixed(0)} yd${tr ? Tm : ""}</td><td${over(a) ? ' class="ovr" title="Beyond the optic\'s up travel"' : ""}>${ud(a.e, dd)}<small>${clkT(a.ec)}</small></td>` +
        `<td>${lr(a.w, dd)}<small>${pm != null ? pm.toFixed(2) : "—"}/mph</small></td><td>${sv}<small>${sc}</small></td><td>${(Math.abs(v.drop) < 0.05 ? 0 : v.drop).toFixed(1)}</td></tr>`;
    });
  } else {
    html = `<table class="full"><thead><tr><th>Range</th><th>Elev ${u}</th><th title="Turret clicks (${escapeHtml(ts.lbl)})">Clicks</th><th>Wind ${u}</th><th title="Full-value wind per 1 mph">1 mph</th><th title="Spin drift correction — already included in Wind">Spin ${u}</th><th>Drop in</th><th>Drift in</th><th>Vel fps</th><th>Energy</th><th>TOF s</th></tr></thead><tbody>`;
    rows.forEach(r => {
      const v = pointVals(r.p), a = angs(r.p), pm = perMph(r.n, r.f), tr = vT && v.vel < vT, [sv] = spin(r);
      html += `<tr class="${rc(r, tr)}"><td>${v.range.toFixed(0)} yd${tr ? Tm : ""}</td><td${over(a) ? ' class="ovr"' : ""}>${ud(a.e, dd)}</td><td class="ck">${clkT(a.ec)}</td><td>${lr(a.w, dd)}</td><td class="ck">${pm != null ? pm.toFixed(2) : "—"}</td><td>${sv}</td>` +
        `<td>${(Math.abs(v.drop) < 0.05 ? 0 : v.drop).toFixed(1)}</td><td>${lr(v.drift, 1)}</td><td>${v.vel.toFixed(0)}</td><td>${v.energy.toFixed(0)}</td><td>${v.tof.toFixed(2)}</td></tr>`;
    });
  }
  html += `</tbody></table>`;
  const leg = `Elev = dial U (up) / D (down); clicks in ${escapeHtml(ts.lbl)}${ts.cpt ? ` (U1+23 = 1 turn + 23 clicks, ${ts.cpt} per turn)` : ""}${ts.k !== 1 ? `; dial includes tracking ×${fmt(ts.k, 3)}` : ""}. Wind = dial L/R to correct (includes spin drift); 1 mph = full-value hold per mph (${u}). Spin = spin-drift part alone.` +
    `${ts.sfp ? ` SFP reticle: holds true at ${fmt(ts.sfp, 1)}×.` : ""}${ts.up != null ? ` Underlined elevation = beyond ${ts.upSet ? "" : "~"}${fmt(ts.up, 1)} ${ts.u === "MIL" ? "mil" : "MOA"} up travel.` : ""} Highlighted row = target. <b style="color:var(--warn)">T</b> = transonic (below Mach 1.2 ≈ ${Math.round(vT)} fps at ${fmt(R.aT, 0)}°F). Drop/drift in inches relative to line of sight.`;
  resultsDiv.innerHTML = `<div class="tblBox"><div class="tblWrap">${html}</div><div class="fade" aria-hidden="true"></div></div><div class="swipe">Swipe the table sideways for more columns →</div><div class="legend">${leg}</div>`;
  paintScroll();
}
function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p; return 10 * p; }
var chartLabels = [];
function renderChart(samples) {
  const canvas = $("chart"); const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1, width = canvas.offsetWidth, height = canvas.offsetHeight;
  chartLabels = [];
  if (!width || !height) return;
  canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = cv("panel"); ctx.fillRect(0, 0, width, height);
  if (!samples || samples.length < 2) return;
  const Yd = B.Distance.Yard, In = B.Distance.Inch;
  const cosA = Math.cos((lastRun?.look || 0) * Math.PI / 180), xs = samples.map(p => p.distance.In(Yd) / cosA), drops = samples.map(p => p.slantHeight.In(In));
  const maxX = Math.max(...xs, 1);
  let minD = Math.min(0, ...drops), maxD = Math.max(0, ...drops);
  const ys = niceStep(Math.max(maxD - minD, 1), 4); minD = Math.floor(minD / ys) * ys; maxD = Math.ceil(maxD / ys) * ys; if (maxD === minD) maxD = minD + ys;
  const L = 48, Rm = 16, T = 30, Bm = 28, F = "11px system-ui, sans-serif";
  const X = r => L + (r / maxX) * (width - L - Rm), YY = dv => T + (maxD - dv) / (maxD - minD) * (height - T - Bm);
  // labels are placed on free spots only (bounding boxes), so nothing overlaps or leaves the canvas
  const boxes = [], hit = b => boxes.some(o => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  const inside = b => b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height;
  function label(text, cands, color, font, kind, force) {
    ctx.font = font || F; const w = Math.ceil(ctx.measureText(text).width), h = 13;
    for (const c of cands) {
      let x = c.a === "right" ? c.x - w : c.a === "center" ? c.x - w / 2 : c.x, y = c.y;
      if (force) { x = Math.max(1, Math.min(width - w - 1, x)); y = Math.max(1, Math.min(height - h - 1, y)); }
      const b = { x: x - 1, y: y - 1, w: w + 2, h: h + 1 };
      if (force || (inside(b) && !hit(b))) { boxes.push(b); chartLabels.push({ text, kind, ...b }); ctx.font = font || F; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(text, x, y); return b; }
    }
    return null;
  }
  ctx.lineWidth = 1;
  label("Drop (in) vs range (yd)", [{ x: 8, y: 4 }], cv("muted"), "12px system-ui, sans-serif", "title", true);
  for (let v = minD; v <= maxD + 1e-9; v += ys) { const y = YY(v); ctx.strokeStyle = cv("border"); ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(width - Rm, y); ctx.stroke(); ctx.globalAlpha = 1;
    label(`${Math.round(v)}"`, [{ x: L - 5, y: y - 6.5, a: "right" }], cv("hint"), F, "y", true); }
  const xstep = niceStep(maxX, Math.max(3, Math.min(8, Math.floor((width - L) / 55))));
  for (let r = 0; r <= maxX + 1e-9; r += xstep) { const x = X(r); ctx.strokeStyle = cv("border"); ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, height - Bm); ctx.stroke(); ctx.globalAlpha = 1;
    label(String(Math.round(r)), [{ x, y: height - 17, a: "center" }], cv("hint"), F, "x", true); }
  ctx.strokeStyle = cv("grid2"); ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(L, YY(0)); ctx.lineTo(width - Rm, YY(0)); ctx.stroke(); ctx.setLineDash([]);
  const R = lastRun, mx = R?.trans && R.trans.range <= maxX ? X(R.trans.range) : null;
  if (mx != null) { ctx.save(); ctx.strokeStyle = cv("err"); ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, T); ctx.lineTo(mx, height - Bm); ctx.stroke(); ctx.restore(); }
  ctx.strokeStyle = cv("accent"); ctx.lineWidth = 2.5; ctx.beginPath();
  samples.forEach((p, i) => { const x = X(xs[i]), y = YY(drops[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.lineWidth = 1;
  const td = num("target");
  if (td && td <= maxX) { const tx = X(td); ctx.strokeStyle = cv("warn"); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, T); ctx.lineTo(tx, height - Bm); ctx.stroke(); ctx.lineWidth = 1;
    if (R?.tgt) { const dv = R.tgt.slantHeight.In(In), ty = YY(dv); ctx.fillStyle = cv("warn"); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, 7); ctx.fill();
      const t = `${dv.toFixed(0)}" @ ${td}`;
      label(t, [{ x: tx + 7, y: ty - 18 }, { x: tx - 7, y: ty - 18, a: "right" }, { x: tx + 7, y: ty + 5 }, { x: tx - 7, y: ty + 5, a: "right" }, { x: tx + 7, y: ty - 32 }, { x: tx - 7, y: ty - 32, a: "right" }, { x: tx + 7, y: ty + 19 }, { x: tx - 7, y: ty + 19, a: "right" }], cv("warn"), F, "target"); } }
  if (mx != null) { const c = []; for (let y = T + 2; y <= height - Bm - 14; y += 14) c.push({ x: mx + 4, y }, { x: mx - 4, y, a: "right" });
    label("Mach 1.2", c, cv("err"), "bold 11px system-ui, sans-serif", "mach"); }
  const y0 = YY(0);
  label("line of sight", [{ x: width - Rm - 2, y: y0 - 15, a: "right" }, { x: width - Rm - 2, y: y0 + 3, a: "right" }, { x: L + 4, y: y0 - 15 }, { x: L + 4, y: y0 + 3 }], cv("hint"), F, "los");
}
function paintWarn() {   // warnings stay on the card; plain info goes behind "Details"
  const R = lastRun, warn = [], info = []; if (!R) { $("dcWarn").innerHTML = ""; $("dcChips").innerHTML = ""; return; }
  const g = R.sg, ts = turretSpec(), r = curRifle();
  if (r?.zeroUnconf) warn.push(`<span class="bad zcw" title="${escapeHtml("Zero not confirmed: " + (r.zeroUnconf.why || "optic changed"))}">⚠ Zero not confirmed<button type="button" class="sm" id="dcZeroOk">✓ Confirm zero</button></span>`);
  if (R.tgt && ts.up != null) { const a = angs(R.tgt), tu = ts.u === "MIL" ? "mil" : "MOA";
    if (a.eT > ts.up + 1e-9) warn.push(`<span class="bad">⚠ Needs U ${a.eT.toFixed(1)} ${tu} — only ${ts.upSet ? "" : "~"}${ts.up.toFixed(1)} ${tu} up travel; hold the last ${(a.eT - ts.up).toFixed(1)} ${tu}</span>`); }
  if (g && g.sg != null) {
    const t = `SG ${g.sg.toFixed(2)}`, why = `Miller stability ${g.sg.toFixed(2)} at ${Math.round(R.mvNow)} fps, ${fmt(R.aT, 0)}°F${g.tip ? `, ${g.assumed ? "assumed " : ""}${g.tip}" plastic tip` : ""}`;
    (g.sg < 1.4 ? warn : info).push(g.sg < 1 ? `<span class="bad" title="${escapeHtml(why)}">✖ ${t} unstable — bullet may tumble</span>` : g.sg < 1.4 ? `<span class="w" title="${escapeHtml(why)}">⚠ ${t} marginal (&lt;1.4) — BC may suffer</span>` : `<span title="${escapeHtml(why)}">${t} stable${g.assumed ? " (tip est.)" : ""}</span>`);
  } else if (g && g.none && num("twist")) info.push(`<span>Stability: ${g.none === "length" ? "bullet length unknown — add it under Gear" : "needs bullet data"}</span>`);
  if (R.trans) {
    const past = R.td && R.trans.range <= R.td;
    (past ? warn : info).push(`<span class="${past ? "w" : ""}">${past ? "⚠ " : ""}${R.trans.range ? `Transonic at ${R.trans.range} yd` : "Transonic from the muzzle"} (&lt;${Math.round(R.vT)} fps = Mach 1.2 @ ${fmt(R.aT, 0)}°F)${past ? " — before target" : ""}</span>`);
  }
  if (R.zc) info.push(`<span>Zeroed @ ${fmt(R.zc.temp, 0)}°F${num("zAlt") != null ? ` · ${fmt(R.zc.alt, 0)} ft` : ""}${R.zc.press != null ? ` · ${R.zc.press.toFixed(2)} inHg` : ""}</span>`);
  if (ts.k !== 1) info.push(`<span>Tracking ×${fmt(ts.k, 3)}: dial = required ÷ ${fmt(ts.k, 3)}</span>`);
  if (ts.optic) info.push(`<span>Optic: ${escapeHtml(ts.optic.name)}</span>`);
  $("dcWarn").innerHTML = warn.join(""); $("dcChips").innerHTML = info.join("");
}
function paintPt() {
  const R = lastRun, el = $("ptHint"); if (!el) return;
  el.textContent = !num("ptSens") ? "Powder temp only matters when the load has a temperature sensitivity (Gear → Load details)."
    : num("mvTemp") == null ? "Set the chrono temp on the load to use powder temp."
    : R ? `MV used: ${Math.round(R.mvNow)} fps (chrono ${val("mv")} fps @ ${val("mvTemp")}°F, ${val("ptSens")} fps/10°F).` : "";
}
function gustSpread() { return wx && wx.gust != null && wx.wind != null && wx.gust > wx.wind ? wx.gust - wx.wind : null; }
function turnsTxt(ec, ts) { if (!ts.cpt || !ec) return ""; const n = Math.abs(ec), t = Math.floor(n / ts.cpt), m = n % ts.cpt; return t ? `${t} turn${t > 1 ? "s" : ""} + ${m} click${m === 1 ? "" : "s"}` : ""; }
function paintScroll() {
  const w = resultsDiv.querySelector(".tblWrap"); if (!w) { resultsDiv.classList.remove("scrollX", "atEnd"); return; }
  const end = () => resultsDiv.classList.toggle("atEnd", w.scrollLeft + w.clientWidth >= w.scrollWidth - 2);
  resultsDiv.classList.toggle("scrollX", w.clientWidth > 0 && w.scrollWidth > w.clientWidth + 1); end(); w.onscroll = end;
}

export function init() {
  $("dcWarn").addEventListener("click", e => { if (e.target.closest("#dcZeroOk")) $("zeroConfirm").onclick(); });
  $("zeroConfirm").onclick = () => { const r = curRifle(); if (!r) return; delete r.zeroUnconf; savePresets(); updateDirty(); ctxPaint(); if (lastRun) renderCard(); toast(`Zero confirmed for “${r.name}”`); };
  $("dcMoreBtn").onclick = () => { const open = $("dcMore").hidden; $("dcMore").hidden = !open; $("dcMoreBtn").setAttribute("aria-expanded", String(open)); $("dcMoreBtn").textContent = open ? "Details ▴" : "Details ▾"; };
}

export { renderAll, setStale, noResult, fieldName, goToField, ud, lr, CLOCK, renderCard, renderTable, niceStep, chartLabels, renderChart, paintWarn, paintPt, gustSpread, turnsTxt, paintScroll };
