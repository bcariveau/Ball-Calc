// beta/js/storage.js — localStorage keys, the persisted settings object S / profiles P, migrations, save/load.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { $ } from "./core.js";


/* ---------------- storage ---------------- */
const K_PRESETS = "bcalc.presets.v1";
const K_SETTINGS = "bcalc.settings.v1";
const K_LOC = "bcalc.lastLoc.v1";
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// load data (recipe) fields: handload or factory ammo
const REC_F = ["ldKind", "ldPowder", "ldCharge", "ldPrimer", "ldCOAL", "ldCBTO", "ldJump", "ldCase", "ldFired", "ldTrim", "ldPrep", "ldMaker", "ldProduct", "ldLot", "ldNotes"];
const RIFLE_F = ["gunKind", "sightHeight", "zero", "twist", "barrel", "turret", "turretV", "turretU", "zTemp", "zPress", "zAlt", "zHum"];
const OPTIC_F = ["opTurret", "opTurretV", "opTurretU", "opReticle", "opFP", "opMag", "opTurn", "opTravel", "opCant", "opUp", "opSH", "opWTravel", "opTrack"];
const LOAD_F = ["bc", "drag", "weight", "diameter", "mv", "length", "mvSource", "refMV", "refBarrel", "fpsPerInch", "bulletId", "bulletName", "bcBands", "useBands", "ptSens", "mvTemp", "tipLen", "trued", ...REC_F];
const LONG_F = { trued: 160, bulletName: 100, bcBands: 200, bulletId: 80, ldPowder: 60, ldPrimer: 60, ldCase: 60, ldMaker: 60, ldProduct: 80, ldLot: 40, ldPrep: 200, ldNotes: 300 };
const F_DEF = { drag: "G7", gunKind: "rifle", ldKind: "hand", turretU: "mil", opTurret: "0.1mil", opTurretU: "mil", opReticle: "mil", opFP: "FFP" };   // defaults for presets saved before a field existed
const RANGE_F = ["bearing", "altitude", "target", "rangeLat", "rangeLon"];
const WX_F = ["windSpeed", "windDir", "temp", "humidity", "altitude", "pressure"];
const ALL_F = [...RIFLE_F, ...LOAD_F, ...RANGE_F, "windSpeed", "windDir", "temp", "humidity", "pressure", "powderTemp", "maxRange", "step"];

function seed() {
  return {
    version: 2,
    rifles: [{ id: uid(), name: "My .308", gunKind: "rifle", sightHeight: "1.5", zero: "100", twist: "10",
      loads: [{ id: uid(), name: "168gr SMK", ldKind: "hand", bc: "0.223", drag: "G7", weight: "168", diameter: "0.308", mv: "2750", length: "1.215" }] }],
    ranges: [],
    lastRifleId: null, lastRangeId: null
  };
}
let P;
function migratePresets() {   // v1 → v2: guns get a type, loads get a recipe kind; everything else unchanged
  let ch = false;
  P.rifles = P.rifles.filter(r => r && typeof r === "object");
  P.rifles.forEach(r => { if (!Array.isArray(r.loads)) { r.loads = []; ch = true; } if (r.gunKind !== "rifle" && r.gunKind !== "handgun") { r.gunKind = "rifle"; ch = true; }
    r.loads.forEach(l => { if (l.ldKind !== "hand" && l.ldKind !== "factory") { l.ldKind = "hand"; ch = true; } }); });
  if (P.version !== 2) { P.version = 2; ch = true; }
  // optics (round 2): own list, attached to a gun by rifle.opticId; guns with turret settings get one once
  if (!Array.isArray(P.optics)) { P.optics = []; ch = true; }
  P.optics = P.optics.filter(o => o && typeof o === "object" && o.id);
  P.rifles.forEach(r => { if (r.opticId && !P.optics.some(o => o.id === r.opticId)) { r.opticId = null; ch = true; } });
  if (!P.opticsMig) { P.rifles.forEach(r => migrateGunOptic(r, P.optics)); P.opticsMig = 1; ch = true; }
  return ch;
}
function migrateGunOptic(r, list) {   // old gun turret + sight height → an optic attached to that gun (gun fields kept as the fallback)
  if (!r || !r.turret || r.opticId) return null;
  const tu = r.turret === "custom" ? (r.turretU === "moa" ? "moa" : "mil") : /moa/.test(r.turret) ? "moa" : "mil";
  const o = { id: uid(), name: `${r.name || "Gun"} scope`.slice(0, 60), opTurret: r.turret, opTurretV: r.turretV || "", opTurretU: r.turretU || "mil", opReticle: tu, opFP: "FFP",
    opMag: "", opTurn: "", opTravel: "", opCant: "", opUp: "", opSH: r.sightHeight || "", opWTravel: "", opTrack: "" };
  list.push(o); r.opticId = o.id; return o;
}
let migrated;   // set in init (was const)
let S;   // set in init (was const)
const savePresets = () => store(K_PRESETS, P);
const saveSettings = () => { S.values = {}; ALL_F.forEach(f => S.values[f] = $(f).value); store(K_SETTINGS, S); };

export function init() {
  P = load(K_PRESETS, null);
  if (!P || !Array.isArray(P.rifles)) P = seed();
  if (!Array.isArray(P.ranges)) P.ranges = [];
  migrated = migratePresets();
  S = Object.assign({ ang: "MOA", view: "dope", values: {} }, load(K_SETTINGS, {}));
  if (S.ang !== "MIL" && S.ang !== "MOA") S.ang = "MOA";   // repair settings saved by the nested-toggle bug
  if (S.view !== "dope" && S.view !== "full") S.view = "dope";
  if (migrated) savePresets();
}

export { K_PRESETS, K_SETTINGS, K_LOC, load, store, uid, REC_F, RIFLE_F, OPTIC_F, LOAD_F, LONG_F, F_DEF, RANGE_F, WX_F, ALL_F, seed, P, migratePresets, migrateGunOptic, migrated, S, savePresets, saveSettings };
