// B: linked firearm / optic / load, as-fired snapshots, copy-only migration, shot move.
// Does not read or write a browser profile.
import assert from "node:assert/strict";
import {
  angConvert, asFiredFrom, assignShots, calcFallback, clicksFor, cleanAsFired, dialComeUp, exportBundle, histLoad, histSource, importBundle, migrateToV3, moveShots, placeOnString, recordedDial, specFromSaved,
  recallFirearm, rollback, splitFrom, staleMv, stringStats,
} from "../beta/js/link-v3.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

const v2 = {
  version: 2,
  rifles: [{
    id: "r1", name: "6.5", gunKind: "rifle", opticId: "o1", lastLoadId: "l1", turret: "0.1mil",
    loads: [{ id: "l1", name: "140", diameter: "0.264", mv: "2710", mvSource: "measured", bc: "0.326" }, { id: "l2", name: "130", diameter: "0.264", mv: "2750" }],
  }, {
    id: "r2", name: "No optic", gunKind: "rifle", lastLoadId: "l3",
    loads: [{ id: "l3", name: "150", diameter: "0.308", mv: "2700" }],
  }],
  optics: [{ id: "o1", name: "Razor", opTurret: "0.1mil", opTrack: "1" }],
  ranges: [],
};
const sessions = [{
  id: "s1", rifleId: "r1", loadId: "l1", date: "2026-06-01T00:00:00.000Z", source: "manual",
  recipe: { loadName: "140", diameter: "0.264", mv: "2710" },
  shots: [{ id: "a", v: 2700, str: "st1" }, { id: "b", v: 2710, str: "st1" }, { id: "c", v: 2800, str: "st1", ie: true }],
  tg: { targets: [{ id: "t", dist: 100, du: "yd", u: "in" }], strings: [{ id: "st1", tid: "t", aim: { x: 0, y: 0 }, holes: [{ id: "h", x: 1, y: 0, sh: "c" }] }], cur: "st1" },
  wx: { temp: 59 },
}];
const rawP = JSON.stringify(v2), rawS = JSON.stringify(sessions);

const m1 = migrateToV3(v2, sessions);
ok(JSON.stringify(v2) === rawP && JSON.stringify(sessions) === rawS, "inputs are not mutated");
ok(m1.changed && m1.presets.version === 3, "version becomes 3");
ok(m1.presets.loads.length === 3 && m1.presets.rifles[0].loadIds.join() === "l1,l2", "loads lifted, ids kept");
ok(!m1.presets.rifles[0].loads, "nested loads removed only on the copy");
ok(m1.presets.rifles[0].lastOpticId === "o1" && m1.presets.rifles[1].lastOpticId === null, "last optic only when one existed");
ok(m1.sessions[0].tg.strings[0].asFired.opticId === "o1", "string with a saved optic keeps it");
ok(m1.sessions[0].tg.strings[0].asFired.recipe.diameter === "0.264", "recipe identity kept");
ok(m1.backup.presets.version === 2 && JSON.stringify(m1.backup.presets) === rawP, "backup is the original v2 bytes");

const back = rollback(m1.backup);
ok(JSON.stringify(back.presets) === rawP && JSON.stringify(back.sessions) === rawS, "rollback restores v2 and the log");

const m2 = migrateToV3(m1.presets, m1.sessions);
ok(!m2.changed && m2.presets.version === 3 && m2.presets.loads.length === 3, "idempotent");

const bundle = exportBundle(m1.presets, m1.sessions);
const again = importBundle(bundle);
ok(again.presets.rifles[1].lastOpticId === null, "unknown optic stays null through export");
ok(again.sessions[0].shots[2].ie === true && again.sessions[0].shots[2].id === "c", "shot identity and tag survive");

const recalled = recallFirearm(m1.presets, m1.presets.rifles[0]);
ok(recalled.opticId === "o1" && recalled.loadId === "l1", "firearm recalls its last optic and load");

const rifle = m1.presets.rifles[0];
const edited = { ...m1.presets.loads[0], mv: "2999" };
const snap = m1.sessions[0].tg.strings[0].asFired;
ok(snap.recipe.mv === "2710" && edited.mv === "2999", "editing the load does not rewrite the as-fired recipe");

const none = calcFallback({ optic: null }, { turret: "0.1mil" }, null);
ok(none.source === "current" && /not written/.test(none.warning), "missing optic uses current turret with a warning");
const absent = calcFallback({ optic: null }, { turret: "custom", turretV: "" }, null);
ok(absent.source === "missing" && /Nothing was invented/.test(absent.warning), "missing current turret requires entry");
const known = calcFallback(snap, rifle, null);
ok(known.source === "as-fired" && known.warning === null, "saved optic is not a fallback");

const moved = moveShots(m1.sessions[0], ["c"], "st1");
ok(moved.session.shots.find((s) => s.id === "a").str === "st1", "unselected shot stays");
ok(moved.session.tg.strings[0].holes[0].sh === null, "moved shot drops its hole pairing");
const undone = moved.undo;
ok(undone.shots.find((s) => s.id === "c").str === "st1" && undone.tg.strings[0].holes[0].sh === "c", "undo restores pairing");

const split = splitFrom(m1.sessions[0], "b");
ok(split.session.shots.find((s) => s.id === "a").str === "st1", "shots before the split stay");
ok(split.session.shots.find((s) => s.id === "b").str === split.newStringId, "split starts at the chosen shot");
ok(split.session.shots.find((s) => s.id === "c").str === split.newStringId, "later shots follow the split");
ok(split.undo.shots.map((s) => s.str).join() === "st1,st1,st1", "split undo is the original string");
ok(split.session.wx === undefined || split.session.date === m1.sessions[0].date, "date stays on the session");

const load = { mv: "2737", mvSource: "measured" };
const stale = staleMv(load, [{ id: "a", v: 2700 }, { id: "b", v: 2774 }], ["b"]);
ok(stale && /not changed/.test(stale.message) && /Redo MV/.test(stale.message), "stale measured MV is flagged and not rewritten");
const scoped = staleMv({ id: "l1", mv: "2700", mvSource: "measured" }, [
  { id: "a", v: 2700, str: "s1" }, { id: "b", v: 2700, str: "s1" }, { id: "c", v: 2900, str: "s2" },
], ["b"], { loadId: "l1", tg: { strings: [{ id: "s1", asFired: { loadId: "l1" } }, { id: "s2", asFired: { loadId: "l9" } }] } });
ok(scoped && scoped.mv === "2700", "stale MV is the source load, not the other firearm's shots");
const other = staleMv({ id: "l9", mv: "2900", mvSource: "measured" }, [
  { id: "a", v: 2700, str: "s1" }, { id: "b", v: 2700, str: "s1" },
], ["b"], { loadId: "l1", tg: { strings: [{ id: "s1", asFired: { loadId: "l1" } }] } });
ok(other === null, "a load that did not own the moved shots is not flagged");
ok(staleMv({ mv: "2700", mvSource: "factory" }, [{ id: "a", v: 2700 }], ["a"]) === null, "a factory MV is not flagged");

const mixed = split.session;
const left = stringStats(mixed, "st1");
const right = stringStats(mixed, split.newStringId);
ok(left.stats.n === 1 && left.stats.avg === 2700, "first string keeps only its shot");
ok(right.stats.n === 2 && right.stats.avg === 2755, "second string has the moved shots");
ok(left.asFired.rifleId === "r1" && right.asFired.rifleId === "r1", "both strings keep the as-fired firearm");

const fresh = asFiredFrom({ id: "r2" }, null, { id: "l3" }, { mv: "2700" });
ok(fresh.opticId === null && fresh.optic === null, "a new string does not invent an optic");

const dest = asFiredFrom({ id: "r2", name: "Rifle B", opticId: null }, null, { id: "l9", name: "Load B", mv: "2800" }, { mv: "2800", diameter: "0.308" });
const crossed = assignShots(m1.sessions[0], ["c"], dest);
ok(crossed.session.shots.find((s) => s.id === "c").str === crossed.destId, "chosen shot moves to the new firearm");
ok(crossed.session.shots.find((s) => s.id === "a").str === "st1", "unrelated shot stays on the source string");
const destStr = crossed.session.tg.strings.find((s) => s.id === crossed.destId);
const srcStr = crossed.session.tg.strings.find((s) => s.id === "st1");
ok(destStr.asFired.rifleId === "r2" && destStr.asFired.loadId === "l9" && destStr.asFired.optic === null, "destination is the chosen firearm and load, optic stays null");
ok(srcStr.asFired.rifleId === "r1" && srcStr.asFired.loadId === "l1", "source as-fired is not rewritten");
ok(srcStr.holes.every((h) => h.sh !== "c") && destStr.holes.length === 0, "invalid target pairing is dropped");
ok(stringStats(crossed.session, "st1").stats.n === 2 && stringStats(crossed.session, crossed.destId).stats.n === 1, "both strings recompute");
ok(crossed.undo.shots.find((s) => s.id === "c").str === "st1" && crossed.undo.tg.strings.length === 1, "undo is the session from before the move");
const splitB = assignShots(m1.sessions[0], ["b"], dest, { splitFromId: "b" });
ok(splitB.movedIds.join() === "b,c", "split takes the chosen shot and the ones after it");
ok(splitB.session.tg.strings.find((s) => s.id === splitB.destId).asFired.loadId === "l9", "split stamps the chosen load");
ok(splitB.undo.shots.map((s) => s.str).join() === "st1,st1,st1", "split undo is exact");

const recorded = specFromSaved({ id: "o1", opTurret: "0.1mil", opTrack: "1", opSH: "1.75" });
const quarter = specFromSaved({ id: "o1", opTurret: "0.25moa", opTrack: "1", opSH: "2.00" });
const milClicks = clicksFor(2.8, recorded);
const moaClicks = clicksFor(2.8 * 3.437747, quarter);
ok(milClicks.c === 28 && milClicks.u === "MIL" && Math.abs(milClicks.e - 2.8) < 1e-9, "2.8 mil on a 0.1 mil turret is 28 clicks");
ok(moaClicks.c === 39 && moaClicks.u === "MOA", "the same angle on a ¼ MOA turret is 39 clicks");
ok(clicksFor(2.8, specFromSaved({ opTurret: "0.1mil", opTrack: "1.02" })).c === 27, "tracking 1.02 changes 2.8 mil to 27 clicks");
const snapOptic = { optic: { id: "o1", opTurret: "0.1mil", opTrack: "1" } };
const kept = histSource(snapOptic, { turret: "0.25moa" }, { id: "o1", opTurret: "0.25moa", opTrack: "1.02" }, quarter);
ok(kept.source === "as-fired" && clicksFor(2.8, kept.spec).c === 28 && snapOptic.optic.opTurret === "0.1mil" && snapOptic.optic.opTrack === "1", "a saved turret still converts 28 clicks after the current turret changes");
const unknown = histSource({ optic: null }, { id: "r1", turret: "0.25moa" }, null, quarter);
ok(unknown.source === "current" && /not written/.test(unknown.warning) && clicksFor(2.8 * 3.437747, unknown.spec).c === 39, "unknown history uses the current turret and says so");
const bare = { optic: null };
const missed = histSource(bare, { turret: "custom", turretV: "" }, { id: "o1", opTurret: "custom", opTurretV: "" }, null);
ok(missed.source === "missing" && missed.spec === null && bare.optic === null && /Nothing was invented/.test(missed.warning), "a missing current click value blocks and does not invent one");
const oldDial = recordedDial({ e: 2.8, u: "MIL", c: 28, cl: "0.1 mil" });
ok(oldDial.c === 28 && oldDial.u === "MIL" && oldDial.dir === "U", "a saved dial keeps its recorded clicks when the optic snapshot is missing");
const recordedLoad = { bulletName: "140 ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710" };
const currentLoad = { bulletName: "150 FMJ", bc: "0.550", drag: "G1", weight: "150", diameter: "0.308", mv: "3200" };
const rawLoad = JSON.stringify(recordedLoad);
const keptLoad = histLoad(recordedLoad, currentLoad);
ok(keptLoad.source === "as-fired" && keptLoad.used.mv === "2710" && keptLoad.used.bc === "0.326" && keptLoad.used.drag === "G7" && JSON.stringify(recordedLoad) === rawLoad, "a recorded load is used whole and is not rewritten");
const partial = histLoad({ mv: "2710", drag: "G7" }, currentLoad);
ok(partial.source === "current" && partial.used.mv === "2710" && partial.used.bc === "0.550" && partial.fromCurrent.includes("bc") && /not written/.test(partial.warning), "a missing recorded BC uses the current load and says so");
const gone = histLoad({}, { bc: "", drag: "", weight: "", diameter: "", mv: "" });
ok(gone.source === "missing" && /Nothing was invented/.test(gone.warning), "missing recorded and current load inputs block");
const milUp = dialComeUp({ e: 2.8, u: "MIL", k: 1 }, 1.5, 600);
const moaUp = dialComeUp({ e: 2.8 * 3.437747, u: "MOA", k: 1 }, 1.5, 600);
ok(Math.abs(milUp.mil - moaUp.mil) < 1e-6 && Math.abs(milUp.moa - moaUp.moa) < 1e-6, "a mil dial and the same angle saved in MOA are one come-up");
ok(Math.abs(angConvert(milUp.mil, "MIL", "MOA") - milUp.moa) < 1e-9, "display conversion does not change the angle");
console.log("COMEUP mil", milUp.mil.toFixed(4), "moa", milUp.moa.toFixed(4));
const srcS = { id: "s1", rifleId: "r1", loadId: "l1", shots: [{ id: "a", v: 2700, str: "st1", ie: true }, { id: "b", v: 2710, str: "st1", x: true }], tg: { targets: [{ id: "t" }], strings: [{ id: "st1", asFired: { rifleId: "r1", loadId: "l1", optic: { id: "o1", opTurret: "0.1mil" } }, holes: [{ sh: "a" }] }, { id: "st2", asFired: { rifleId: "r1", loadId: "l2", optic: { id: "o1", opTurret: "0.1mil" } }, holes: [] }] } };
const dstS = { id: "s2", rifleId: "r2", loadId: "l9", shots: [{ id: "c", v: 2800, str: "st9" }], tg: { targets: [{ id: "t" }], strings: [{ id: "st9", asFired: { rifleId: "r2", loadId: "l9", optic: null }, holes: [] }] } };
const rawSrc = JSON.stringify(srcS), rawDst = JSON.stringify(dstS);
const cross = placeOnString(srcS, dstS, ["a"], "st9");
ok(JSON.stringify(srcS) === rawSrc && JSON.stringify(dstS) === rawDst, "placing shots copies both sessions");
ok(cross.source.shots.length === 1 && cross.dest.shots.find((s) => s.id === "a").ie === true && cross.dest.shots.find((s) => s.id === "a").str === "st9", "a cross-session move keeps the tag and lands on the destination string");
ok(cross.source.tg.strings[0].holes[0].sh === null && cross.dest.tg.strings[0].asFired.optic === null, "the move drops the hole pairing and does not invent an optic");
ok(cross.undoSource.shots.length === 2 && cross.undoDest.shots.length === 1, "undo snapshots still have every shot");
const sameStr = placeOnString(srcS, srcS, ["a"], "st2");
ok(sameStr.same && sameStr.source.shots.find((s) => s.id === "a").str === "st2" && sameStr.source.shots.find((s) => s.id === "b").x === true, "a same-session string keeps the removed flag");
ok(placeOnString(srcS, srcS, ["a"], "st1").error, "moving onto the current string changes nothing");
console.log("CLICKS recorded", milClicks.c, "current-quarter-moa", moaClicks.c);

console.log("PASS link-v3 assertions", n);
