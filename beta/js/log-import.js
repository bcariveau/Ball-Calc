// beta/js/log-import.js — Import of chronograph files (xlsx/csv) into the Log.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { toast } from "./components.js";
import { $, escapeHtml, importFirst } from "./core.js";
import { curLoad, curRifle, recipeSnapshot } from "./gear.js";
import { IMP, LOG, MPS, SHEETJS_URLS, cleanSession, fmtDate, maybeRenderLog, nOrNull, saveLog, set_IMP, set_slKey, shotStats, slKey } from "./log.js";
import { P, uid } from "./storage.js";


/* Athlon Rangecraft / Velocity PRO import (.xlsx, .csv). Rows are found by their labels, not positions. */
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === "," || ch === ";" || ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const numIn = t => { const m = String(t ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
function sheetDate(name) {
  const m = String(name || "").match(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{0,3})/);
  if (!m) return null;
  const d = new Date(2000 + +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || 0));
  return isNaN(d) || +m[2] > 12 || +m[3] > 31 ? null : d;
}
function parseAthlonRows(rows, sheetName, fileName) {
  rows = rows.map(r => (r || []).map(c => String(c ?? "").trim()));
  const hi = rows.findIndex(r => r.some(c => /^shot\s*(#|no\.?|number)?$/i.test(c)) && r.some(c => /speed|velocity/i.test(c)));
  if (hi < 0) return null;
  const H = rows[hi], col = re => H.findIndex(c => re.test(c));
  const cSpeed = col(/speed|velocity/i), cTime = col(/^time/i), cClean = col(/clean/i), cCold = col(/cold/i), cNote = col(/note/i);
  const find = re => rows.find(r => re.test(r[0] || ""));
  const valOf = r => r ? ((r[1] && r[1] !== "") ? r[1] : (r[0].includes(":") ? r[0].split(":").pop().trim() : "")) : "";
  const stat = re => { const r = find(re); return r ? { v: numIn(valOf(r)), unit: (valOf(r).match(/[a-z/]+\s*$/i) || [""])[0].trim().toUpperCase() } : null; };
  let unit = /m\s*\/?\s*p?s\b|\(m\/s\)|mps/i.test(H[cSpeed]) ? "MPS" : /fps|ft\s*\/\s*s/i.test(H[cSpeed]) ? "FPS" : null;
  const avgS = stat(/^average velocity|^avg\.? velocity|^average speed/i);
  if (!unit && avgS?.unit) unit = /M/.test(avgS.unit) && !/FPS|FT/.test(avgS.unit) ? "MPS" : "FPS";
  const k = unit === "MPS" ? MPS : 1;
  const truthy = t => !!t && !/^(no|false|0|-|n)$/i.test(t);
  const shots = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i], v = numIn(r[cSpeed]);
    if (v == null || !r.some(c => c !== "")) { if (shots.length) break; else continue; }
    const s = { v: +(v * k).toFixed(1) };
    if (cTime >= 0 && r[cTime]) s.t = r[cTime].slice(0, 20);
    if (cClean >= 0 && truthy(r[cClean])) s.clean = true;
    if (cCold >= 0 && truthy(r[cCold])) s.cold = true;
    if (cNote >= 0 && r[cNote]) s.note = r[cNote].slice(0, 200);
    shots.push(s);
  }
  if (!shots.length) return null;
  // weather: "Temperature: , ℉: 59" / "Pressure , inHg: 29.9" / "Altitude, m: 300"; zero/blank everywhere = not recorded
  const wxRow = re => { const r = find(re); if (!r) return null; const txt = r.join(" "), v = numIn(valOf(r).replace(/^[^:]*:/, "")); return { v: valOf(r) === "" ? null : v, txt }; };
  const tR = wxRow(/^temperature/i), hR = wxRow(/^humidity/i), pR = wxRow(/^pressure/i), aR = wxRow(/^altitude/i);
  let temp = tR?.v ?? null, hum = hR?.v ?? null, press = pR?.v ?? null, alt = aR?.v ?? null;
  if (temp != null && /℃|°\s*c\b|celsius/i.test(tR.txt)) temp = +(temp * 9 / 5 + 32).toFixed(1);
  if (press != null && /hpa|mbar/i.test(pR.txt)) press = +(press * 0.02953).toFixed(2); else if (press != null && /mmhg/i.test(pR.txt)) press = +(press / 25.4).toFixed(2);
  if (alt != null && /,\s*m\b|\bm:|meters?/i.test(aR.txt) && !/ft|feet/i.test(aR.txt)) alt = Math.round(alt * 3.28084);
  if (!temp && !press && !alt && !hum) temp = hum = press = alt = null;
  if (press === 0) press = null;
  const label = re => { const r = find(re); const v = r ? valOf(r) : ""; return v && !/^n\/?a$/i.test(v) && v !== "0" ? v : ""; };
  const pw = find(/^projectile weight/i) || find(/^bullet weight/i);
  const weight = pw ? numIn(valOf(pw)) : null;
  const kindIdx = rows.findIndex(r => /^projectile weight/i.test(r[0] || "")), kind = kindIdx > 0 ? rows[kindIdx - 1][0] : "";
  let notes = ""; const ni = rows.findIndex(r => /^session notes?/i.test(r[0] || ""));
  if (ni >= 0) notes = rows[ni][1] || (ni + 1 < hi && rows[ni + 1][0] ? rows[ni + 1].filter(Boolean).join(" ") : "");
  const date = sheetDate(sheetName) || sheetDate(fileName) || null;
  const title = [kind, label(/^cartridge/i), label(/^rifle:/i), weight ? weight + " gr" : ""].filter(Boolean).join(" · ");
  const sd = stat(/^standard deviation/i), es = stat(/^extreme spread/i);
  return { date: (date || new Date()).toISOString(), dateKnown: !!date, shots, notes: notes.slice(0, 300), title, unit: unit || "FPS?",
    wx: { temp, humidity: hum, pressure: press, altitude: alt }, weight,
    device: avgS ? { avg: avgS.v, sd: sd?.v ?? null, es: es?.v ?? null, unit: unit || "" } : null,
    importKey: `athlon|${sheetName || fileName}|${shots.map(s => s.v).join(",")}` };
}
async function readChronoFile(file) {
  const name = file.name || "file";
  if (/\.csv$|\.txt$/i.test(name) || /csv|text/.test(file.type)) {
    const s = parseAthlonRows(parseCSV(await file.text()), name.replace(/\.[^.]+$/, ""), name); return s ? [s] : [];
  }
  const XLSX = await importFirst(SHEETJS_URLS);
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
  return wb.SheetNames.map(n => parseAthlonRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: "" }), n, name)).filter(Boolean);
}
function fillImpLoads() {
  const r = P.rifles.find(x => x.id === $("slImpRifle").value), ls = $("slImpLoad");
  ls.innerHTML = ""; (r?.loads || []).filter(l => !l.archived).forEach(l => ls.add(new Option(l.name, l.id)));
  if (r && r.id === curRifle()?.id && curLoad()) ls.value = curLoad().id;
  $("slImpGo").disabled = !ls.value;
}
function openImport(fname) {
  $("slImpFile").textContent = `${fname}: ${IMP.length} session${IMP.length > 1 ? "s" : ""} found${IMP.some(s => s.dup) ? " · already-imported ones are unticked" : ""}.`;
  const rs = $("slImpRifle"); rs.innerHTML = ""; P.rifles.filter(r => !r.archived).forEach(r => rs.add(new Option(r.name, r.id))); rs.value = curRifle() && !curRifle().archived ? curRifle().id : (P.rifles.find(r => !r.archived)?.id || ""); fillImpLoads();
  $("slImpList").innerHTML = IMP.map((s, i) => { const groups = s.tg && s.tg.strings && s.tg.strings.length > 1 ? s.tg.strings.map((st, si) => { const one = shotStats((s.shots || []).filter(sh => (sh.str || s.tg.strings[0].id) === st.id)); return `String ${si + 1}: ${one.n || 0}${one.n ? " · avg " + one.avg.toFixed(0) : ""}`; }).join(", ") : (() => { const one = shotStats(s.shots || []); return `${one.n || 0} shots${one.n ? " · avg " + one.avg.toFixed(0) + " fps" : ""}`; })(); return `<label class="impSess"><input type="checkbox" data-i="${i}"${s.dup ? "" : " checked"}>
    <span><b>${escapeHtml(fmtDate(s.date))}</b>${s.dateKnown ? "" : " (date unknown)"} · ${groups}${s.dup ? ' · <span class="dup">already imported</span>' : ""}
    <span class="d" style="display:block">${escapeHtml(s.title || "")}${s.device ? ` · file: avg ${s.device.avg} ${escapeHtml(s.device.unit)}` : ""} · velocities converted from ${escapeHtml(s.unit)}${s.wx.temp != null ? ` · ${s.wx.temp}°F` : ""}${s.wx.pressure != null ? ` · ${s.wx.pressure} inHg` : ""}</span></span></label>`; }).join("");
  $("slImport").classList.add("show"); document.body.style.overflow = "hidden";
}
function closeImport() { $("slImport").classList.remove("show"); document.body.style.overflow = ""; set_IMP([]); }

export function init() {
  $("slImportBtn").onclick = () => $("slFile").click();
  $("slFile").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    toast("Reading " + f.name + "…");
    try {
      set_IMP(await readChronoFile(f));
      if (!IMP.length) { alert("No chronograph shots found in this file. Expected an Athlon export with a SHOT # / SPEED table."); return; }
      const keys = new Set(LOG.map(s => s.importKey).filter(Boolean));
      IMP.forEach((s, i) => { s.dup = keys.has(s.importKey) || IMP.slice(0, i).some(o => o.importKey === s.importKey); });
      openImport(f.name);
    } catch (err) { console.warn(err); alert("Couldn't read that file: " + (err.message || err) + (/import|fetch|module/i.test(String(err)) ? "\n(The spreadsheet reader downloads on first use — connect to the internet once.)" : "")); }
  };
  $("slImpClose").onclick = closeImport;
  $("slImpRifle").onchange = fillImpLoads;

  $("slImpLoad").onchange = () => $("slImpGo").disabled = !$("slImpLoad").value;
  $("slImpGo").onclick = async () => {
    const rifleId = $("slImpRifle").value, loadId = $("slImpLoad").value, r = P.rifles.find(x => x.id === rifleId); if (!loadId) return;
    const pickd = [...$("slImpList").querySelectorAll("input:checked")].map(x => IMP[+x.dataset.i]);
    pickd.forEach(s => { const c = cleanSession({ ...s, id: uid(), rifleId, loadId, source: "athlon", barrel: nOrNull(r?.barrel), recipe: recipeSnapshot(rifleId, loadId) }); if (c) LOG.push(c); });
    await saveLog(); closeImport(); set_slKey(null); maybeRenderLog();
    toast(pickd.length ? `Imported ${pickd.length} session(s)` : "Nothing imported");
  };
}

export { parseCSV, numIn, sheetDate, parseAthlonRows, readChronoFile, fillImpLoads, openImport, closeImport };
