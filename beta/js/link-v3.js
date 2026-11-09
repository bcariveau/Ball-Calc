// Linked firearm, optic setup, and load records, plus as-fired string snapshots.
// Migration runs on copies the caller passes in. It does not read or write localStorage or IndexedDB.

const clone = (x) => JSON.parse(JSON.stringify(x));

const OPTIC_KEYS = ["opTurret", "opTurretV", "opTurretU", "opReticle", "opFP", "opTrack", "opSH"];
const TURRET_TABLE = { "0.1mil": ["MIL", 0.1, "0.1 mil"], "0.05mil": ["MIL", 0.05, "0.05 mil"], "0.25moa": ["MOA", 0.25, "¼ MOA"], "0.125moa": ["MOA", 0.125, "⅛ MOA"], "0.5moa": ["MOA", 0.5, "½ MOA"] };
const CURRENT_WARN = "No as-fired optic was saved for this string. Using this firearm's current turret settings. This is not written onto the string.";
const MISSING_WARN = "No as-fired optic and no current turret. Enter a turret click value. Nothing was invented.";
const MOA_PER_MIL_H = 3.437747;
const LOAD_REQUIRED = ["bc", "drag", "weight", "diameter", "mv"];

function opticSnap(o) {
  if (!o || !o.id) return null;
  const out = { id: String(o.id) };
  OPTIC_KEYS.forEach((k) => { if (o[k] != null && String(o[k]).trim() !== "") out[k] = o[k]; });
  return out;
}

function cleanAsFired(a) {
  if (!a || typeof a !== "object") return null;
  const out = {
    rifleId: a.rifleId ? String(a.rifleId).slice(0, 40) : null,
    opticId: a.opticId ? String(a.opticId).slice(0, 40) : null,
    loadId: a.loadId ? String(a.loadId).slice(0, 40) : null,
    optic: opticSnap(a.optic),
    recipe: a.recipe && typeof a.recipe === "object" ? clone(a.recipe) : null,
  };
  if (out.opticId && !out.optic) out.optic = null;
  return out;
}

function loadsOf(p, rifle) {
  if (!rifle) return [];
  if (p && p.version === 3 && Array.isArray(p.loads) && Array.isArray(rifle.loadIds))
    return rifle.loadIds.map((id) => p.loads.find((l) => l.id === id)).filter(Boolean);
  return Array.isArray(rifle.loads) ? rifle.loads : [];
}

function specFromSaved(src) {
  if (!src) return null;
  const key = src.opTurret || src.turret;
  const track = parseFloat(src.opTrack);
  const k = track >= 0.8 && track <= 1.2 ? track : 1;
  const sh = parseFloat(src.opSH);
  const sight = sh > 0 ? sh : null;
  if (key && TURRET_TABLE[key]) {
    const [u, v, lbl] = TURRET_TABLE[key];
    return { u, v, lbl, k, sh: sight };
  }
  if (key === "custom") {
    const raw = src.opTurretV != null && src.opTurretV !== "" ? src.opTurretV : src.turretV;
    const v = parseFloat(raw);
    const u = (src.opTurretU || src.turretU) === "moa" ? "MOA" : "MIL";
    if (v > 0) return { u, v, lbl: `${v} ${u === "MIL" ? "mil" : "MOA"}`, k, sh: sight };
  }
  return null;
}

function recordedDial(d) {
  if (!d || d.c == null || d.e == null || (d.u !== "MIL" && d.u !== "MOA")) return null;
  const dir = d.e < 0 ? "D" : "U";
  return { c: Math.round(d.c), e: d.e, u: d.u, dir, lbl: d.cl || "" };
}

function fieldSet(src, key) {
  return !!(src && src[key] != null && String(src[key]).trim() !== "");
}

function histLoad(recipe, current) {
  const rec = recipe && typeof recipe === "object" ? recipe : null;
  const used = {};
  const fromCurrent = [];
  const missing = [];
  LOAD_REQUIRED.forEach((key) => {
    if (fieldSet(rec, key)) used[key] = String(rec[key]).trim();
    else if (fieldSet(current, key)) { used[key] = String(current[key]).trim(); fromCurrent.push(key); }
    else missing.push(key);
  });
  ["length", "ptSens", "mvTemp", "bulletName"].forEach((key) => { if (fieldSet(rec, key)) used[key] = String(rec[key]).trim(); });
  if (used.drag) used.drag = /g1/i.test(used.drag) ? "G1" : "G7";
  let warning = null;
  if (missing.length) warning = `This string is missing ${missing.join(", ")}. Enter ${missing.length > 1 ? "them" : "it"}. Nothing was invented.`;
  else if (fromCurrent.length) warning = `No as-fired ${fromCurrent.join(", ")} was saved. Using the current load for ${fromCurrent.length > 1 ? "those" : "that"}. This is not written onto the string.`;
  return { source: missing.length ? "missing" : fromCurrent.length ? "current" : "as-fired", used, missing, fromCurrent, warning };
}

function angConvert(v, from, to) {
  if (from === to) return v;
  if (from === "MIL" && to === "MOA") return v * MOA_PER_MIL_H;
  if (from === "MOA" && to === "MIL") return v / MOA_PER_MIL_H;
  return null;
}

function dialComeUp(dial, offsetInches, yd) {
  if (!dial || dial.e == null || (dial.u !== "MIL" && dial.u !== "MOA") || !(yd > 0) || !isFinite(offsetInches)) return null;
  const k = dial.k >= 0.8 && dial.k <= 1.2 ? dial.k : 1;
  const dialMil = (dial.u === "MOA" ? dial.e / MOA_PER_MIL_H : dial.e) * k;
  const offMil = offsetInches / (3.6 * yd / 100);
  const mil = dialMil - offMil;
  return { mil, moa: mil * MOA_PER_MIL_H, unit: dial.u };
}

function clicksFor(angle, spec) {
  if (!spec || !(spec.v > 0) || angle == null || !isFinite(angle)) return null;
  const eT = angle / (spec.k || 1);
  const c = Math.round(eT / spec.v);
  return { c, e: c * spec.v, u: spec.u, lbl: spec.lbl, k: spec.k || 1 };
}

function currentTurretKnown(rifle, optic) {
  if (specFromSaved(optic)) return true;
  if (optic) return false;
  return !!specFromSaved(rifle);
}

// A recorded optic click value wins. Current settings are used only when that history has no click value.
// This never writes the current turret back onto the snapshot.
function histSource(asFired, rifle, optic, liveSpec) {
  const saved = asFired && asFired.optic ? specFromSaved(asFired.optic) : null;
  if (saved) return { source: "as-fired", spec: saved, warning: null };
  const live = liveSpec && liveSpec.v > 0 ? { u: liveSpec.u, v: liveSpec.v, lbl: liveSpec.lbl, k: liveSpec.k || 1, sh: liveSpec.sh || null } : null;
  const cur = live || specFromSaved(optic) || (optic ? null : specFromSaved(rifle));
  if (cur) return { source: "current", spec: cur, warning: CURRENT_WARN };
  return { source: "missing", spec: null, warning: MISSING_WARN };
}

function calcFallback(asFired, rifle, optic, liveSpec) {
  const h = histSource(asFired, rifle, optic, liveSpec);
  return { source: h.source, warning: h.warning, spec: h.spec, optic: h.source === "as-fired" ? asFired.optic : null };
}

// The one sentence shown when a string has no saved scope. The data-layer warning stays on histSource for callers that
// need to know the fallback happened; screens use this sentence instead of that warning text.
function scopeSentence(gunName, source, label) {
  if (!source || source === "as-fired") return "";
  const gun = gunName || "This firearm";
  if (source === "current" && label) return `${gun} has no scope saved, so clicks use its current turret (${label}). Add a scope in Gear to fix.`;
  return `${gun} has no scope saved, and it has no turret click value. Add a scope in Gear to fix.`;
}

function asFiredFrom(rifle, optic, load, recipe) {
  return cleanAsFired({
    rifleId: rifle?.id || null,
    opticId: optic?.id || null,
    loadId: load?.id || null,
    optic: optic ? opticSnap(optic) : null,
    recipe: recipe || null,
  });
}

function opticOn(p, rifle) {
  if (!rifle) return null;
  const optics = (p && p.optics) || [];
  const id = rifle.lastOpticId && optics.some((o) => o.id === rifle.lastOpticId) ? rifle.lastOpticId : (rifle.opticId || null);
  return id ? (optics.find((o) => o.id === id) || null) : null;
}

function recallFirearm(p, rifle) {
  if (!rifle) return { opticId: null, loadId: null };
  const optics = p.optics || [];
  const loads = loadsOf(p, rifle);
  let opticId = rifle.opticId || null;
  if (rifle.lastOpticId && optics.some((o) => o.id === rifle.lastOpticId)) opticId = rifle.lastOpticId;
  let loadId = rifle.lastLoadId && loads.some((l) => l.id === rifle.lastLoadId) ? rifle.lastLoadId : (loads[0]?.id || null);
  return { opticId, loadId };
}

function annotateSession(session, v2) {
  const s = clone(session);
  const rifle = (v2.rifles || []).find((r) => r.id === s.rifleId) || null;
  const optic = rifle && rifle.opticId ? (v2.optics || []).find((o) => o.id === rifle.opticId) || null : null;
  const load = rifle && (rifle.loads || []).find((l) => l.id === s.loadId) || null;
  const asFired = s.asFired ? cleanAsFired(s.asFired) : asFiredFrom(rifle, optic, load, s.recipe || null);
  if (!s.asFired) {
    asFired.opticId = optic ? optic.id : null;
    asFired.optic = opticSnap(optic);
  }
  s.asFired = asFired;
  if (s.tg && Array.isArray(s.tg.strings)) {
    s.tg = clone(s.tg);
    s.tg.strings = s.tg.strings.map((st) => ({ ...st, asFired: st.asFired ? cleanAsFired(st.asFired) : clone(asFired) }));
  }
  return s;
}

function migrateToV3(presets, sessions) {
  const originalP = clone(presets);
  const originalS = clone(sessions || []);
  if (!originalP || !Array.isArray(originalP.rifles)) throw new Error("not a presets object");
  if (originalP.version === 3 && Array.isArray(originalP.loads))
    return { presets: originalP, sessions: originalS, changed: false, backup: null };
  const loads = [];
  const rifles = originalP.rifles.filter((r) => r && typeof r === "object").map((r) => {
    const loadIds = [];
    (Array.isArray(r.loads) ? r.loads : []).forEach((l) => {
      if (!l || !l.id) return;
      if (!loads.some((x) => x.id === l.id)) loads.push(clone(l));
      loadIds.push(l.id);
    });
    const opticId = r.opticId || null;
    const lastLoadId = r.lastLoadId && loadIds.includes(r.lastLoadId) ? r.lastLoadId : (loadIds[0] || null);
    const out = { ...clone(r), loadIds, lastLoadId, lastOpticId: opticId };
    delete out.loads;
    return out;
  });
  const nextP = { ...clone(originalP), version: 3, rifles, loads, optics: clone(originalP.optics || []) };
  const nextS = originalS.map((s) => annotateSession(s, originalP));
  return { presets: nextP, sessions: nextS, changed: true, backup: { presets: clone(presets), sessions: clone(sessions || []) } };
}

function rollback(backup) {
  if (!backup || !backup.presets) throw new Error("no backup");
  return { presets: clone(backup.presets), sessions: clone(backup.sessions || []) };
}

function exportBundle(presets, sessions) {
  return { app: "ballistic-calculator", schema: presets.version || 2, presets: clone(presets), shotSessions: clone(sessions || []) };
}

function importBundle(bundle) {
  if (!bundle || !bundle.presets || !Array.isArray(bundle.presets.rifles)) throw new Error("not a backup");
  return { presets: clone(bundle.presets), sessions: clone(bundle.shotSessions || []) };
}

function shotStatsOf(shots) {
  const v = (shots || []).filter((s) => s && !s.x && s.v != null).map((s) => s.v);
  const n = v.length;
  if (!n) return { n: 0, avg: null, sd: null, es: null };
  const avg = v.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;
  return { n, avg: +avg.toFixed(1), sd: +sd.toFixed(1), es: +(Math.max(...v) - Math.min(...v)).toFixed(1) };
}

function staleMv(load, shots, movedIds, session) {
  if (!load || load.mvSource !== "measured" || !(parseFloat(load.mv) > 0)) return null;
  const moved = new Set(movedIds);
  const before = (shots || []).filter((s) => {
    if (!s || s.x) return false;
    if (!session) return true;
    const st = session.tg && session.tg.strings.find((x) => x.id === s.str);
    return (st?.asFired?.loadId || session.loadId || null) === load.id;
  });
  if (!before.some((s) => moved.has(s.id))) return null;
  const avg = shotStatsOf(before).avg;
  if (avg == null || Math.round(avg) !== Math.round(parseFloat(load.mv))) return null;
  return { mv: load.mv, message: "This load's MV matched the average of its kept shots, including ones you just moved. It was not changed. Redo MV uses the shots that stayed and drops removed shots." };
}

function unpairMoved(tg, ids) {
  if (!tg) return tg;
  const next = clone(tg);
  next.strings.forEach((st) => st.holes.forEach((h) => { if (h.sh && ids.has(h.sh)) h.sh = null; }));
  return next;
}

function sameFired(a, b) {
  if (!a || !b) return false;
  return (a.rifleId || null) === (b.rifleId || null) && (a.loadId || null) === (b.loadId || null) && (a.opticId || null) === (b.opticId || null);
}
function assignShots(session, shotIds, asFired, opts = {}) {
  const fired = cleanAsFired(asFired);
  if (!fired || !fired.rifleId || !fired.loadId) throw new Error("choose a firearm and a load");
  const undo = clone(session);
  let moving = [...shotIds];
  if (opts.splitFromId) {
    const shot = (session.shots || []).find((s) => s.id === opts.splitFromId);
    if (!shot) throw new Error("shot not found");
    const str = shot.str || null;
    const inStr = session.shots.filter((s) => (s.str || null) === str);
    const at = inStr.findIndex((s) => s.id === opts.splitFromId);
    moving = inStr.slice(Math.max(0, at)).map((s) => s.id);
  }
  const idset = new Set(moving);
  const tg = session.tg ? clone(session.tg) : { targets: [{ id: "t", tpl: "grid1", dist: 100, du: "yd", u: "in" }], strings: [], cur: null, mark: false };
  if (!tg.targets.length) tg.targets.push({ id: "t", tpl: "grid1", dist: 100, du: "yd", u: "in" });
  let dest = (tg.strings || []).find((st) => sameFired(st.asFired, fired) && !(session.shots || []).some((s) => s.str === st.id && !idset.has(s.id)));
  if (!dest) {
    dest = { id: "s" + Math.random().toString(36).slice(2, 8), tid: tg.targets[0].id, aim: null, holes: [], asFired: fired };
    tg.strings = [...(tg.strings || []), dest];
  }
  const shots = (session.shots || []).map((s) => idset.has(s.id) ? { ...s, str: dest.id } : { ...s });
  const sourceIds = [...new Set((undo.shots || []).filter((s) => idset.has(s.id)).map((s) => s.str).filter(Boolean))];
  return { session: { ...clone(session), shots, tg: unpairMoved({ ...tg, cur: dest.id }, idset) }, undo, movedIds: [...idset], destId: dest.id, sourceIds };
}
function placeOnString(source, destSession, shotIds, destStringId, ctx = {}) {
  const ids = [...new Set(shotIds || [])];
  const idset = new Set(ids);
  if (!source || !destSession || !idset.size) return { error: "Choose at least one shot. Nothing was moved." };
  const destStr = destSession.tg && destSession.tg.strings.find((st) => st.id === destStringId);
  if (!destStr) return { error: "That string is no longer there. Nothing was moved." };
  const found = (source.shots || []).filter((s) => idset.has(s.id));
  if (found.length !== idset.size) return { error: "A selected shot is no longer in this session. Nothing was moved." };
  if (source.id === destSession.id && found.every((s) => s.str === destStringId)) return { error: "Those shots are already on that string. Nothing was moved." };
  if (source.id !== destSession.id && (destSession.shots || []).some((s) => idset.has(s.id))) return { error: "The other session already has one of these shots. Nothing was moved." };
  const undoSource = clone(source);
  const undoDest = source.id === destSession.id ? null : clone(destSession);
  const moved = found.map((s) => ({ ...s, str: destStringId }));
  let sourceNext, destNext;
  if (source.id === destSession.id) {
    const shots = source.shots.map((s) => idset.has(s.id) ? { ...s, str: destStringId } : { ...s });
    sourceNext = { ...clone(source), shots, tg: unpairMoved(source.tg, idset) };
    destNext = null;
  } else {
    sourceNext = { ...clone(source), shots: source.shots.filter((s) => !idset.has(s.id)), tg: unpairMoved(source.tg, idset) };
    destNext = { ...clone(destSession), shots: [...destSession.shots, ...moved], tg: unpairMoved(destSession.tg, idset) };
  }
  const srcStr = source.tg && source.tg.strings.find((st) => st.id === found[0].str);
  const differs = !sameFired(srcStr && srcStr.asFired, destStr.asFired);
  const fb = destStr.asFired ? calcFallback(destStr.asFired, ctx.rifle || null, ctx.optic || null) : null;
  const warning = !destStr.asFired ? "This string has no saved firearm or load. Nothing was invented, and its snapshot was not changed." : (fb && fb.warning);
  return {
    same: source.id === destSession.id, source: sourceNext, dest: destNext, undoSource, undoDest,
    movedIds: ids, destStringId, destAsFired: destStr.asFired || null, differs, warning,
  };
}
function moveShots(session, shotIds, destStringId) {
  const ids = new Set(shotIds);
  const undo = clone(session);
  const shots = session.shots.map((s) => ids.has(s.id) ? { ...s, str: destStringId } : { ...s });
  const stale = staleMv(null, session.shots, [...ids]);
  return { session: { ...clone(session), shots, tg: unpairMoved(session.tg, ids) }, undo, movedIds: [...ids], stale };
}

function splitFrom(session, shotId) {
  const undo = clone(session);
  const shot = (session.shots || []).find((s) => s.id === shotId);
  if (!shot) throw new Error("shot not found");
  const str = shot.str || null;
  const inStr = session.shots.filter((s) => (s.str || null) === str);
  const at = inStr.findIndex((s) => s.id === shotId);
  const moving = inStr.slice(at).map((s) => s.id);
  const src = session.tg && session.tg.strings.find((st) => st.id === str);
  const neu = { id: "s" + Math.random().toString(36).slice(2, 8), tid: src ? src.tid : (session.tg?.targets?.[0]?.id || null), aim: null, holes: [], asFired: src && src.asFired ? clone(src.asFired) : (session.asFired ? clone(session.asFired) : null) };
  const tg = session.tg ? clone(session.tg) : { targets: [], strings: [], cur: neu.id, mark: false };
  tg.strings = [...(tg.strings || []), neu];
  tg.cur = neu.id;
  const moved = moveShots({ ...session, tg }, moving, neu.id);
  return { ...moved, undo, newStringId: neu.id };
}

function stringStats(session, stringId) {
  const strings = (session.tg && session.tg.strings) || [];
  const st = strings.find((s) => s.id === stringId);
  const known = new Set(strings.map((s) => s.id));
  const first = strings[0] ? strings[0].id : null;
  const shots = (session.shots || []).filter((s) => ((s && s.str && known.has(s.str)) ? s.str : first) === stringId);
  return { asFired: st ? (st.asFired || null) : null, stats: shotStatsOf(shots) };
}

export {
  clone, opticSnap, cleanAsFired, loadsOf, specFromSaved, recordedDial, clicksFor, histLoad, angConvert, dialComeUp, currentTurretKnown, histSource, calcFallback, asFiredFrom, opticOn, recallFirearm,
  migrateToV3, rollback, exportBundle, importBundle, shotStatsOf, staleMv, moveShots, splitFrom, assignShots, placeOnString, stringStats, scopeSentence,
};
