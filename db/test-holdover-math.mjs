// Bore fit and holdover math. No browser, no storage.
import assert from "node:assert/strict";
import { OPTIC_CATALOG } from "../beta/js/optic-catalog.js";
import { FL6_MARKS, boreOf, hashMarks, holdText, loadFit, scaleFactor, toUnit } from "../beta/js/holdover.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

const fit = (dia) => ({ diameter: dia });
ok(boreOf([]).kind === "unknown", "a gun with no numeric diameters has an unknown bore");
ok(boreOf([fit(""), fit("nope"), fit(null)]).kind === "unknown", "invalid diameters do not invent a bore");
ok(boreOf([fit("0.264"), fit("0.2644")]).kind === "known" && Math.abs(boreOf([fit("0.264"), fit("0.2644")]).dia - 0.264) < 0.0015, "diameters inside 0.0015 in are one bore");
ok(boreOf([fit("0.264"), fit("0.308")]).kind === "mixed", "two diameters outside the tolerance are mixed");
const known = boreOf([fit("0.264")]);
ok(loadFit(fit("0.265"), known) === "fit", "0.001 in is still a fit");
ok(loadFit(fit("0.266"), known) === "wrong", "0.002 in is the wrong size");
ok(loadFit(fit(""), known) === "unknown" && loadFit(fit("abc"), known) === "unknown", "a missing diameter stays unknown size");
ok(loadFit(fit("0.308"), boreOf([])).kind === undefined && loadFit(fit("0.308"), { kind: "unknown" }) === "neutral", "an unknown bore does not warn");
ok(loadFit(fit("0.308"), { kind: "mixed" }) === "neutral" && loadFit(fit(""), { kind: "mixed" }) === "unknown", "a mixed bore does not mark a size wrong");

const even = hashMarks(1, 4);
ok(even.map(m => m.subtension).join() === "1,2,3,4" && even[1].label === "2nd hash", "even hash spacing counts from the first mark");
const moa = holdText({ mode: "hash", unit: "MOA", marks: FL6_MARKS }, { required: 5.8, requiredUnit: "MOA", fp: "FFP" });
ok(moa.text === "Hold 2nd hash (5.95 MOA), 0.15 MOA high", "the nearest FL-6 mark reports the residual high");
const mil = holdText({ mode: "hash", unit: "MIL", spacing: 1, count: 3 }, { required: toUnit(1, "MIL", "MIL"), requiredUnit: "MIL", fp: "FFP" });
ok(/1st hash/.test(mil.text) && /MIL/.test(mil.text), "a MIL hash hold stays in MIL");
ok(Math.abs(toUnit(1, "MIL", "MOA") - 3.437747) < 1e-6, "one mil converts to MOA");
ok(scaleFactor({ fp: "SFP", calibratedMag: 6, currentMag: 3 }) === 2, "SFP subtension scales by calibrated over current mag");
ok(scaleFactor({ fp: "SFP", fixed: true, calibratedMag: 6, currentMag: 3 }) === 1, "fixed power does not scale");
ok(scaleFactor({ fp: "FFP", calibratedMag: 6, currentMag: 3 }) === 1, "FFP subtension stays constant");
const scaled = holdText({ mode: "hash", unit: "MOA", calibratedMag: 6, marks: [{ label: "2nd hash", subtension: 5.95 }] }, { required: 11.9, requiredUnit: "MOA", fp: "SFP", currentMag: 3, calibratedMag: 6 });
ok(/11\.9 MOA/.test(scaled.text), "an SFP hold uses the scaled subtension");
const cds = holdText({ mode: "cds", unit: "MOA", marks: [{ label: "300", distYd: 300, subtension: 8 }, { label: "400", distYd: 400, subtension: 12 }] }, { distance: 320, required: 8.4, requiredUnit: "MOA" });
ok(cds.text.startsWith("Dial to 300 yd, aim center") && /0\.4 MOA low/.test(cds.text), "a CDS dial names the yardage and the residual versus the current load");

const ids = ["vtx-se-1824-ffp-ebr8", "ark-ep8-1828-ffp-klgrid", "sig-tango-msr-1624-sfp-fl6", "sig-tango-msr-1624-sfp-bdc6", "sig-tango-msr-1624-ffp-bdc6", "leu-mark5-3618-ffp-moa", "leu-patrol6-16-sfp-cmr2", "pa-slx-5x-micro", "pa-plxc-18-ffp", "pa-slx-16-sfp", "pa-glx-2510-ffp"];
ok(ids.every(id => OPTIC_CATALOG.some(c => c.id === id)), "the new catalog rows are present");
ok(OPTIC_CATALOG.length === 105, "the optic catalog count includes the new rows");
const flagged = OPTIC_CATALOG.filter(c => ids.includes(c.id) && c.note);
ok(flagged.length >= 5 && flagged.every(c => /confirm on page|greater than|170 MOA/.test(c.note)), "unconfirmed specs carry a source note");
const se = OPTIC_CATALOG.find(c => c.id === "vtx-se-1824-ffp-ebr8");
ok(se.opTurret === "0.25moa" && se.opTravel === "145" && se.opWTravel === "145" && !se.note, "the Strike Eagle travel is the published 145 MOA");
const patrol = OPTIC_CATALOG.find(c => c.id === "leu-patrol6-16-sfp-cmr2");
ok(patrol.opTravel === "170" && /170 MOA/.test(patrol.note), "the Patrol 6HD uses the page's 170 MOA, not 180");
console.log("PASS holdover-math", n);
