// beta/js/hooks.js — window.__bc test/debug hooks.
// Generated from the single-file beta by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { DB, loadDB } from "./bulletdb.js";
import { angs, lastRun, millerSG, mvAdjust, turretSpec } from "./calc.js";
import { ctxPaint, ctxParts } from "./components.js";
import { importFirst } from "./core.js";
import { chartLabels, gustSpread, turnsTxt } from "./dope.js";
import { openDopeCard } from "./dope-card.js";
import { ldShort } from "./gear.js";
import { ED, LOG, addShotsToLiveSession, slEmptyHTML } from "./log.js";
import { parseAthlonRows } from "./log-import.js";
import { SWS, swCheck, updShow } from "./offline.js";
import { attachOptic, curOptic, effSH, followUnits } from "./optics.js";
import { RD, radarBytes, radarPaint, vprParse, vprReassemble } from "./radar.js";
import { openMove } from "./reassign.js";
import { copyMV, projMatch, recipeMatches } from "./recipes.js";
import { SH, shDevCls, shEnergy, shEsAt, shExit, shPaint, shStart, shStatsOf } from "./shooting.js";
import { banHide, mutSess, wakeSync } from "./shot-banner.js";
import { P, S } from "./storage.js";
import { tgDope } from "./strings.js";
import { tgLabels } from "./target-draw.js";
import { openTgEd, shotDetail, tgThumb } from "./target-editor.js";
import { BAN, LIVE, TE, WL, cleanDial, cleanTg, grpStats, inPerU, pearson, tgEnsure, tgView, velVert } from "./targets.js";
import { openAbout } from "./themes.js";
import { TR, solveTrue } from "./truing.js";
import { auto, manual, wx } from "./weather.js";
import { dialDecide, dialZone } from "./wind-dial.js";



export function init() {

  window.__bc = { ctxPaint, ctxParts, ldShort, openAbout, get SWS() { return SWS; }, swCheck, updShow, importFirst, get SH() { return SH; }, shStart, shExit, shStatsOf, shEsAt, shEnergy, shPaint, shDevCls, dialDecide, dialZone, slEmptyHTML, tgView, tgEnsure, cleanTg, cleanDial, tgDope, tgThumb, velVert, tgLabels, get TR() { return TR; }, grpStats, pearson, inPerU, shotDetail, banHide, openTgEd, mutSess, get BAN() { return BAN; }, get TE() { return TE; }, get LIVE() { return LIVE; }, get WL() { return WL; }, wakeSync,  millerSG, mvAdjust, turretSpec, solveTrue, openDopeCard, curOptic, effSH, turnsTxt, gustSpread, attachOptic, followUnits, angs, get chartLabels() { return chartLabels; }, get lastRun() { return lastRun; }, P, S, manual, auto, get wx() { return wx; }, get db() { return DB; }, loadDB, get log() { return LOG; }, addShotsToLiveSession, parseAthlonRows, get ED() { return ED; }, openMove, projMatch, recipeMatches, copyMV, radar: { RD, vprParse, vprReassemble, feed: radarBytes, paint: radarPaint } };
}

export {  };
