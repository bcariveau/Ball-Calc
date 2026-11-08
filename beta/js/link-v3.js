// Linked firearm, optic setup, and load records, plus as-fired string snapshots.
// Migration runs on copies the caller passes in. It does not read or write localStorage or IndexedDB.

const clone = (x) => JSON.parse(JSON.stringify(x));

const OPTIC_KEYS = ["opTurret", "opTurretV", "opTurretU", "opReticle", "opFP", "opTrack", "opSH"];

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

function currentTurretKnown(rifle, optic) {
  if (optic && (optic.opTurret || optic.opTurretV)) return true;
  if (!rifle) return false;
  if (rifle.turret && rifle.turret !== "custom") return true;
  return rifle.turret === "custom" && parseFloat(rifle.turretV) > 0;
}

// Missing historical optic stays null. Current settings may be used only as a labeled fallback.
// If those are missing too, the caller must ask for a turret. This never writes onto the snapshot.
function calcFallback(asFired, rifle, optic) {
  if (asFired && asFired.optic) return { source: "as-fired", warning: null, optic: asFired.optic };
  if (currentTurretKnown(rifle, optic))
    return { source: "current", warning: "No as-fired optic was saved for this string. Using this firearm's current turret settings. This is not written onto the string.", optic: opticSnap(optic) };
  return { source: "missing", warning: "No as-fired optic and no current turret. Enter a turret click value. Nothing was invented.", optic: null };
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

function staleMv(load, shots, movedIds) {
  if (!load || load.mvSource !== "measured" || !(parseFloat(load.mv) > 0)) return null;
  const moved = new Set(movedIds);
  const before = (shots || []).filter((s) => !s.x);
  if (!before.some((s) => moved.has(s.id))) return null;
  const avg = shotStatsOf(before).avg;
  if (avg == null || Math.round(avg) !== Math.round(parseFloat(load.mv))) return null;
  return { mv: load.mv, message: "This load's MV matched the average of shots that include ones you just moved. It was not changed. Use avg as MV again if you want it redone." };
}

function unpairMoved(tg, ids) {
  if (!tg) return tg;
  const next = clone(tg);
  next.strings.forEach((st) => st.holes.forEach((h) => { if (h.sh && ids.has(h.sh)) h.sh = null; }));
  return next;
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
  const st = session.tg && session.tg.strings.find((s) => s.id === stringId);
  const shots = (session.shots || []).filter((s) => (s.str || null) === (stringId || null));
  return { asFired: st ? (st.asFired || null) : null, stats: shotStatsOf(shots) };
}

export {
  clone, opticSnap, cleanAsFired, loadsOf, currentTurretKnown, calcFallback, asFiredFrom, recallFirearm,
  migrateToV3, rollback, exportBundle, importBundle, shotStatsOf, staleMv, moveShots, splitFrom, stringStats,
};
