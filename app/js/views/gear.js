// app/js/views/gear.js — markup for the Gear tab and its sheets (picker, zero prompt, optic, truing, sensors, bullet DB, recipes, copy load).
import { ctxRow, sheetHead } from "./parts.js";

export const gearTab = `
<!-- ===== Gear tab ===== -->
<section class="tab" id="tabGear" data-tab="gear" role="tabpanel" aria-labelledby="tabBtnGear">
${ctxRow("ctxGear")}
<!-- ===== Presets ===== -->
<div class="section" id="gearSec">
  <h2>Gear <span class="row"><button class="sm ghost" id="exportBtn" type="button"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' x2='12' y1='15' y2='3'/></svg> Export</button><button class="sm ghost" id="importBtn" type="button"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='17 8 12 3 7 8'/><line x1='12' x2='12' y1='3' y2='15'/></svg> Import</button></span></h2>
  <input type="file" id="importFile" accept="application/json,.json" hidden>

  <div class="picker">
    <div class="lbl"><span>Gun</span><span class="saved" id="rifleSaved" aria-live="polite"></span></div>
    <div class="row pkRow">
      <select id="rifleSel" aria-label="Gun"></select>
      <button class="ghost pkMenuBtn" type="button" id="rifleMenu" aria-label="Gun actions" aria-haspopup="dialog" title="Gun: new, duplicate, rename, delete"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/></svg></button>
    </div>
    <div class="summary" id="rifleSum"></div>
    <div id="sampleNote" class="zflag sampleNote" hidden><span>This is sample data, not your rifle.</span><button class="sm" type="button" id="suResume">Set up my rifle</button></div>
    <div id="zeroFlag" class="zflag" hidden><span id="zeroFlagTxt"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'/><path d='M12 9v4'/><path d='M12 17h.01'/></svg> Zero not confirmed</span><button class="sm" type="button" id="zeroConfirm"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M20 6 9 17l-5-5'/></svg> Confirm zero</button></div>
    <div class="opPk" id="opticPk">
      <div class="lbl"><span><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 21h6'/><path d='M9 21v-4'/><path d='M14 5 9 3 4 5l5 3Z'/><path d='M9 8v9'/><path d='m14 5 5 2v4c0 4-3 6-5 7-2-1-5-3-5-7V7'/></svg> Optic</span><span class="saved" id="opticSaved" aria-live="polite"></span></div>
      <div class="row pkRow">
        <select id="opticSel" aria-label="Optic on this gun"></select>
        <button class="ghost pkMenuBtn" type="button" id="opticMenu" aria-label="Optic actions" aria-haspopup="dialog" title="Optic: new, rename, duplicate, delete, attach"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/></svg></button>
      </div>
      <div class="summary" id="opticSum"></div>
      <div id="opticBody" hidden>
        <div class="grid" style="margin-top:8px">
          <div class="full"><label for="opTurret">Turret · unit and click value</label><div class="tuRow"><span class="seg tuSeg" id="opTurretUSeg" role="group" aria-label="Turret unit"><button type="button" data-v="moa">MOA</button><button type="button" data-v="mil">MIL</button></span><select id="opTurret" aria-label="Turret click value"><option value="0.1mil">0.1 mil</option><option value="0.05mil">0.05 mil</option><option value="0.25moa">¼ MOA</option><option value="0.125moa">⅛ MOA</option><option value="0.5moa">½ MOA</option><option value="custom">Custom…</option></select></div><div class="hint">Clicks always count in the turret unit; the Dope MOA/MIL switch only changes how numbers read.</div></div>
          <div id="opTurretCustom" hidden><label for="opTurretV">Click value</label><input type="number" inputmode="decimal" id="opTurretV" step="0.01" placeholder="e.g. 0.2"><div class="err" id="e-opTurretV"></div></div>
          <div id="opTurretCustomU" hidden><label for="opTurretU">Click unit</label><select id="opTurretU"><option value="mil">mil</option><option value="moa">MOA</option></select></div>
          <div class="full"><label for="opReticle">Reticle unit</label><select id="opReticle"><option value="mil">MIL reticle</option><option value="moa">MOA reticle</option></select></div>
          <div class="full"><details id="opMore"><summary>More specs <span class="rsum" id="opMoreSum"></span></summary>
            <div class="grid">
              <div><label for="opFP">Focal plane</label><select id="opFP"><option value="FFP">FFP (first)</option><option value="SFP">SFP (second)</option></select></div>
              <div id="opMagRow" hidden><label for="opMag">Holds true at (×)</label><input type="number" inputmode="decimal" id="opMag" step="1" placeholder="e.g. 10"><div class="err" id="e-opMag"></div></div>
              <div><label for="opTurn">Elevation per turn <span class="u2">(mil)</span></label><input type="number" inputmode="decimal" id="opTurn" step="0.5" placeholder="e.g. 10"><div class="err" id="e-opTurn"></div></div>
              <div><label for="opTravel">Total elev. travel <span class="u2">(mil)</span></label><input type="number" inputmode="decimal" id="opTravel" step="0.5" placeholder="e.g. 29"><div class="err" id="e-opTravel"></div></div>
              <div><label for="opCant">Canted base (MOA)</label><input type="number" inputmode="decimal" id="opCant" step="5" placeholder="e.g. 20"><div class="err" id="e-opCant"></div></div>
              <div><label for="opUp">Up travel from zero <span class="u2">(mil)</span></label><input type="number" inputmode="decimal" id="opUp" step="0.1" placeholder="estimate"><div class="err" id="e-opUp"></div><p class="hint" id="opUpNote" hidden>Moved — re-measure up travel on this rifle.</p></div>
              <div><label for="opSH">Sight height (in)</label><input type="number" inputmode="decimal" id="opSH" step="0.05" placeholder="blank = gun's"><div class="err" id="e-opSH"></div></div>
              <div><label for="opWTravel">Windage travel <span class="u2">(mil)</span></label><input type="number" inputmode="decimal" id="opWTravel" step="0.5" placeholder="optional"><div class="err" id="e-opWTravel"></div></div>
              <div><label for="opTrack">Tracking factor</label><input type="number" inputmode="decimal" id="opTrack" step="0.005" placeholder="e.g. 1.02"><div class="err" id="e-opTrack"></div></div>
              <div class="full hint" id="opHint">Up travel from zero: dial fully up from your zero and enter what's left; blank = estimate of half the total travel + the canted base. Tracking factor = how far the scope really moves per dialed unit (1.02 = 2% more), so dial = required ÷ factor.</div>
            </div></details></div>
        </div>
      </div>
    </div>
    <details id="rifleDetails">
      <summary>Gun details</summary>
      <div class="grid">
        <div class="full"><label for="gunKind">Type</label><select id="gunKind"><option value="rifle">Rifle</option><option value="handgun">Handgun</option></select></div>
        <div class="full hint" id="gunOptNote" hidden></div>
        <div id="gunSHRow"><label for="sightHeight">Sight height (in)<span class="ro" id="gunSHRoL" hidden>set by optic</span></label><div class="roVal" id="gunSHRo" hidden></div><input type="number" inputmode="decimal" id="sightHeight" step="0.1" value="1.5"><div class="err" id="e-sightHeight"></div></div>
        <div><label for="zero">Zero range (yd)</label><div class="stepper" data-step="25" data-min="10" data-max="1000"><input type="number" inputmode="numeric" id="zero" value="100"></div><div class="err" id="e-zero"></div></div>
        <div><label for="barrel">Barrel length (in)</label><input type="number" inputmode="decimal" id="barrel" step="0.5" placeholder="optional, e.g. 20"><div class="err" id="e-barrel"></div></div>
        <div class="full"><label for="twist">Twist rate (inches per turn)</label><input type="number" inputmode="decimal" id="twist" step="0.5" value="10" placeholder="e.g. 10 (blank = ignore)"><div class="hint">Right-hand twist is positive, left-hand negative. Used for spin drift and the stability check (needs bullet length).</div><div class="err" id="e-twist"></div></div>
        <div class="full" id="gunTurretRow"><label for="turret">Turret · unit and click value<span class="ro" id="gunTurretRoL" hidden>set by optic</span></label><div class="roVal" id="gunTurretRo" hidden></div><div class="tuRow"><span class="seg tuSeg" id="turretUSeg" role="group" aria-label="Turret unit"><button type="button" data-v="moa">MOA</button><button type="button" data-v="mil">MIL</button></span><select id="turret" aria-label="Turret click value"><option value="">Enter a click value</option><option value="0.1mil">0.1 mil</option><option value="0.05mil">0.05 mil</option><option value="0.25moa">¼ MOA</option><option value="0.125moa">⅛ MOA</option><option value="0.5moa">½ MOA</option><option value="custom">Custom…</option></select></div></div>
        <div id="turretCustom" hidden><label for="turretV">Click value</label><input type="number" inputmode="decimal" id="turretV" step="0.01" placeholder="e.g. 0.2"><div class="err" id="e-turretV"></div></div>
        <div id="turretCustomU" hidden><label for="turretU">Click unit</label><select id="turretU"><option value="mil">mil</option><option value="moa">MOA</option></select></div>
        <div class="full"><details id="zeroDetails"><summary>Zero conditions <span class="rsum" id="zeroSum">same as today</span></summary>
          <div class="grid">
            <div><label for="zTemp">Temp (°F)</label><input type="number" inputmode="numeric" id="zTemp" placeholder="blank = today"><div class="err" id="e-zTemp"></div></div>
            <div><label for="zHum">Humidity (%)</label><input type="number" inputmode="numeric" id="zHum" placeholder="blank = today"><div class="err" id="e-zHum"></div></div>
            <div><label for="zAlt">Altitude (ft)</label><input type="number" inputmode="numeric" id="zAlt" placeholder="blank = today"><div class="err" id="e-zAlt"></div></div>
            <div><label for="zPress">Station pressure (inHg)</label><input type="number" inputmode="decimal" id="zPress" step="0.01" placeholder="blank = today"><div class="err" id="e-zPress"></div></div>
            <div class="full"><button class="sm ghost" type="button" id="zUseCur" style="width:100%;padding:10px"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='8' height='4' x='8' y='2' rx='1' ry='1'/><path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/></svg> Use current conditions</button></div>
            <div class="full hint">Conditions on the day you zeroed. Blank = today's conditions.</div>
          </div></details></div>
      </div>
    </details>
  </div>

  <div class="picker">
    <div class="lbl"><span>Load (ammo for this gun)</span><span class="saved" id="loadSaved" aria-live="polite"></span></div>
    <div class="row pkRow">
      <select id="loadSel" aria-label="Load"></select>
      <button class="ghost pkMenuBtn" type="button" id="loadMenu" aria-label="Load actions" aria-haspopup="dialog" title="Load: new, duplicate, rename, delete"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/></svg></button>
    </div>
    <div class="summary" id="loadSum"></div>
    <div class="grid" id="loadBasic">
        <div class="full"><button class="sm ghost" type="button" id="dbOpen" style="width:100%;padding:10px"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m16 6 4 14'/><path d='M12 6v14'/><path d='M8 8v12'/><path d='M4 4v16'/></svg> Pick bullet from database</button>
          <div id="bulletInfo"></div>
          <button class="sm ghost rcBtn" type="button" id="rcBulletBtn" hidden></button>
          <input type="hidden" id="bulletId"><input type="hidden" id="bulletName"><input type="hidden" id="bcBands"></div>
        <div><label for="bc">Ballistic coefficient (BC)</label><input type="number" inputmode="decimal" id="bc" step="0.001" value="0.223"><div class="err" id="e-bc"></div></div>
        <div><label for="drag">Drag model</label><select id="drag"><option value="G7" selected>G7 (boat-tail)</option><option value="G1">G1 (flat-base)</option></select></div>
        <div class="full"><label for="mv">Muzzle velocity (fps)</label><input type="number" inputmode="numeric" id="mv" step="5" value="2750"><div class="err" id="e-mv"></div></div>
    </div>
    <details id="loadDetails">
      <summary><span>More <span class="mArr" aria-hidden="true"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m6 9 6 6 6-6'/></svg></span></span><span class="rsum" id="loadMoreSum"></span></summary>
      <div class="grid">
        <div><label for="weight">Bullet weight (gr)</label><input type="number" inputmode="decimal" id="weight" step="1" value="168"><div class="err" id="e-weight"></div></div>
        <div><label for="diameter">Diameter (in)</label><input type="number" inputmode="decimal" id="diameter" step="0.001" value="0.308"><div class="err" id="e-diameter"></div></div>
        <div><label for="mvSource">MV is…</label><select id="mvSource"><option value="">(not set)</option><option value="measured">Chrono</option><option value="factory">Box / factory</option><option value="estimate">Estimated</option><option value="trued">Trued</option></select></div>
        <div><label for="length">Bullet length (in)</label><input type="number" inputmode="decimal" id="length" step="0.01" value="1.215" placeholder="optional"><div class="err" id="e-length"></div></div>
        <div><label for="tipLen">Plastic tip (in)</label><input type="number" inputmode="decimal" id="tipLen" step="0.01" placeholder="tipped bullets"><div class="err" id="e-tipLen"></div></div>
        <div><label for="ptSens">Temp sensitivity (fps per 10°F)</label><input type="number" inputmode="decimal" id="ptSens" step="1" placeholder="0 = off"><div class="err" id="e-ptSens"></div></div>
        <div><label for="mvTemp">Chrono temp (°F)</label><input type="number" inputmode="numeric" id="mvTemp" placeholder="at chrono"><div class="err" id="e-mvTemp"></div></div>
        <div class="full hint">Many powders shift 1–2 fps per °F (10–20 per 10°F). MV used = chrono MV + sensitivity × (powder temp − chrono temp) ÷ 10; leave sensitivity blank or 0 to turn it off. Tip length (blank = estimated for tipped bullets) refines the stability check.</div>
        <div class="full summary" id="truedNote" hidden></div><input type="hidden" id="trued">
        <div class="full" id="bandsRow" style="display:none"><label for="useBands">Sierra velocity-banded G1</label><select id="useBands"><option value="">Use single BC above</option><option value="1">Use velocity bands (G1 only)</option></select><div class="hint" id="bandsTxt"></div></div>
        <div class="full hint">BC must match the drag model printed on the box (G1 vs G7). Bullet length is optional; it enables spin drift. Factory BCs are often optimistic — true them against real drops.</div>
        <div class="full"><details id="mvEstBox"><summary>Estimate MV for a different barrel (no chronograph)</summary>
          <div class="grid">
            <div><label for="refMV">Reference MV (fps)</label><input type="number" inputmode="numeric" id="refMV" step="5" placeholder="box / load data"><div class="err" id="e-refMV"></div></div>
            <div><label for="refBarrel">Ref. barrel (in)</label><input type="number" inputmode="decimal" id="refBarrel" step="0.5" placeholder="24"><div class="err" id="e-refBarrel"></div></div>
            <div><label for="fpsPerInch">fps per inch</label><input type="number" inputmode="decimal" id="fpsPerInch" step="1" placeholder="25"><div class="err" id="e-fpsPerInch"></div></div>
            <div><label>&nbsp;</label><button class="sm ghost" type="button" id="mvEstBtn" style="width:100%;padding:10px">Estimate MV for this barrel</button></div>
            <div class="full" id="mvEstOut"></div>
            <div class="full hint">Estimate = reference MV + (your barrel − reference barrel) × fps per inch. Rough guide only (typically 20–30 fps/in); a chronographed MV always wins. Set your barrel length under Gun details.</div>
          </div></details></div>
      </div>
      <details id="recipeDetails">
        <summary>Load data <span class="rsum" id="recipeSum" hidden></span></summary>
        <span class="seg" id="ldKindSeg" role="group" aria-label="Ammo type"><button type="button" data-v="hand"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2'/><path d='M8.5 2h7'/><path d='M7 16h10'/></svg> Handload</button><button type="button" data-v="factory"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z'/><path d='M12 22V12'/><path d='m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7'/></svg> Factory ammo</button></span>
        <input type="hidden" id="ldKind" value="hand">
        <button class="sm ghost rcBtn" type="button" id="rcFind" hidden></button>
        <div class="grid" id="ldHand">
          <div class="full"><label for="ldPowder">Powder</label><input type="text" list="dlPowder" id="ldPowder" maxlength="60" autocomplete="off" placeholder="e.g. Hodgdon H4350"></div>
          <div><label for="ldCharge">Charge (gr)</label><div class="stepper" data-step="0.1" data-min="0" data-max="200"><input type="number" inputmode="decimal" id="ldCharge" step="0.1" placeholder="—"></div></div>
          <div><label for="ldCOAL">COAL (in)</label><div class="stepper" data-step="0.001" data-min="0" data-max="6"><input type="number" inputmode="decimal" id="ldCOAL" step="0.001" placeholder="—"></div></div>
          <div class="full"><label for="ldPrimer">Primer</label><input type="text" list="dlPrimer" id="ldPrimer" maxlength="60" autocomplete="off" placeholder="e.g. CCI BR-2 or Federal 210M"></div>
          <div><label for="ldCBTO">CBTO (in)</label><input type="number" inputmode="decimal" id="ldCBTO" step="0.001" placeholder="optional"></div>
          <div><label for="ldJump">Jump to lands (in)</label><input type="number" inputmode="decimal" id="ldJump" step="0.001" placeholder="e.g. 0.020"></div>
          <div class="full"><label for="ldCase">Case / brass</label><input type="text" list="dlCase" id="ldCase" maxlength="60" autocomplete="off" placeholder="e.g. Lapua"></div>
          <div><label for="ldFired">Times fired</label><input type="number" inputmode="numeric" id="ldFired" step="1" min="0" placeholder="e.g. 3"></div>
          <div><label for="ldTrim">Trim length (in)</label><input type="number" inputmode="decimal" id="ldTrim" step="0.001" placeholder="optional"></div>
          <div class="full"><label for="ldPrep">Case prep</label><input type="text" id="ldPrep" maxlength="200" placeholder="annealed, mandrel…"></div>
        </div>
        <div class="grid" id="ldFactory" hidden>
          <div class="full"><label for="ldMaker">Brand</label><input type="text" list="dlMaker" id="ldMaker" maxlength="60" autocomplete="off" placeholder="e.g. Federal"></div>
          <div class="full"><label for="ldProduct">Product / line</label><input type="text" id="ldProduct" maxlength="80" placeholder="e.g. Gold Medal Match 175 gr SMK"></div>
          <div class="full"><label for="ldLot">Lot #</label><input type="text" id="ldLot" maxlength="40" placeholder="from the box"></div>
        </div>
        <div class="grid" style="margin-top:10px">
          <div class="full"><label for="ldNotes">Load notes</label><input type="text" id="ldNotes" maxlength="300" placeholder="die setting, lot, signs…"></div>
          <div class="full hint">Changes save to this load automatically. Every chrono session keeps its own copy of the recipe, so later edits don't change old sessions. Always work up from published load data.</div>
        </div>
        <datalist id="dlPowder"><option value="Hodgdon H4350"><option value="Hodgdon Varget"><option value="Hodgdon H4895"><option value="Hodgdon H322"><option value="Hodgdon H335"><option value="Hodgdon BL-C(2)"><option value="Hodgdon Benchmark"><option value="Hodgdon CFE 223"><option value="Hodgdon CFE BLK"><option value="Hodgdon CFE Pistol"><option value="Hodgdon H380"><option value="Hodgdon H414"><option value="Hodgdon H4831"><option value="Hodgdon H4831SC"><option value="Hodgdon H1000"><option value="Hodgdon Retumbo"><option value="Hodgdon H50BMG"><option value="Hodgdon Superformance"><option value="Hodgdon LEVERevolution"><option value="Hodgdon H110"><option value="Hodgdon Lil&#x27;Gun"><option value="Hodgdon Titegroup"><option value="Hodgdon HP-38"><option value="Hodgdon Clays"><option value="Hodgdon Universal"><option value="Hodgdon Longshot"><option value="Hodgdon US 869"><option value="IMR 3031"><option value="IMR 4064"><option value="IMR 4166"><option value="IMR 4198"><option value="IMR 4227"><option value="IMR 4320"><option value="IMR 4350"><option value="IMR 4451"><option value="IMR 4831"><option value="IMR 4895"><option value="IMR 7828"><option value="IMR 7977"><option value="IMR 8133"><option value="IMR 8208 XBR"><option value="IMR Enduron 4166"><option value="IMR Red"><option value="IMR Unequal"><option value="IMR Trail Boss"><option value="Alliant Reloder 7"><option value="Alliant Reloder 10x"><option value="Alliant Reloder 15"><option value="Alliant Reloder 16"><option value="Alliant Reloder 17"><option value="Alliant Reloder 19"><option value="Alliant Reloder 22"><option value="Alliant Reloder 23"><option value="Alliant Reloder 25"><option value="Alliant Reloder 26"><option value="Alliant Reloder 33"><option value="Alliant AR-Comp"><option value="Alliant Power Pro 2000-MR"><option value="Alliant Power Pro Varmint"><option value="Alliant Bullseye"><option value="Alliant Red Dot"><option value="Alliant Green Dot"><option value="Alliant Unique"><option value="Alliant Herco"><option value="Alliant Blue Dot"><option value="Alliant 2400"><option value="Alliant Power Pistol"><option value="Alliant Sport Pistol"><option value="Alliant BE-86"><option value="Alliant 300-MP"><option value="Alliant 20/28"><option value="Vihtavuori N110"><option value="Vihtavuori N120"><option value="Vihtavuori N130"><option value="Vihtavuori N133"><option value="Vihtavuori N135"><option value="Vihtavuori N140"><option value="Vihtavuori N150"><option value="Vihtavuori N160"><option value="Vihtavuori N165"><option value="Vihtavuori N170"><option value="Vihtavuori N540"><option value="Vihtavuori N550"><option value="Vihtavuori N555"><option value="Vihtavuori N560"><option value="Vihtavuori N565"><option value="Vihtavuori N568"><option value="Vihtavuori N570"><option value="Vihtavuori 3N37"><option value="Vihtavuori 3N38"><option value="Vihtavuori N310"><option value="Vihtavuori N320"><option value="Vihtavuori N330"><option value="Vihtavuori N340"><option value="Vihtavuori N350"><option value="Vihtavuori N105"><option value="Accurate No. 2"><option value="Accurate No. 5"><option value="Accurate No. 7"><option value="Accurate No. 9"><option value="Accurate LT-30"><option value="Accurate LT-32"><option value="Accurate 1680"><option value="Accurate 2015"><option value="Accurate 2200"><option value="Accurate 2230"><option value="Accurate 2460"><option value="Accurate 2495"><option value="Accurate 2520"><option value="Accurate 4064"><option value="Accurate 4350"><option value="Accurate 2700"><option value="Accurate MagPro"><option value="Ramshot TAC"><option value="Ramshot X-Terminator"><option value="Ramshot Big Game"><option value="Ramshot Hunter"><option value="Ramshot Magnum"><option value="Ramshot Enforcer"><option value="Ramshot Silhouette"><option value="Ramshot True Blue"><option value="Ramshot Competition"><option value="Ramshot Zip"><option value="Winchester 231"><option value="Winchester 244"><option value="Winchester 296"><option value="Winchester 748"><option value="Winchester 760"><option value="Winchester StaBall 6.5"><option value="Winchester StaBall HD"><option value="Winchester StaBall Match"><option value="Winchester WST"><option value="Winchester Super Handicap"><option value="Winchester AutoComp"><option value="Norma 203B"><option value="Norma URP"><option value="Norma MRP"><option value="Shooters World Precision Rifle"><option value="Shooters World Match Rifle"></datalist><datalist id="dlPrimer"><option value="CCI 200 (large rifle)"><option value="CCI 250 (large rifle magnum)"><option value="CCI BR-2 (large rifle bench rest)"><option value="CCI 400 (small rifle)"><option value="CCI 450 (small rifle magnum)"><option value="CCI BR-4 (small rifle bench rest)"><option value="CCI 41 (small rifle, 5.56)"><option value="CCI 500 (small pistol)"><option value="CCI 550 (small pistol magnum)"><option value="CCI 300 (large pistol)"><option value="CCI 350 (large pistol magnum)"><option value="CCI 34 (large rifle, 7.62)"><option value="Federal 205 (small rifle)"><option value="Federal 205M (small rifle match)"><option value="Federal GM205M (small rifle match)"><option value="Federal 210 (large rifle)"><option value="Federal 210M (large rifle match)"><option value="Federal GM210M (large rifle match)"><option value="Federal 215 (large rifle magnum)"><option value="Federal 215M (large rifle magnum match)"><option value="Federal 100 (small pistol)"><option value="Federal 100M (small pistol match)"><option value="Federal 200 (small pistol magnum)"><option value="Federal 150 (large pistol)"><option value="Federal 155 (large pistol magnum)"><option value="Winchester WSR (small rifle)"><option value="Winchester WSRM (small rifle magnum)"><option value="Winchester WLR (large rifle)"><option value="Winchester WLRM (large rifle magnum)"><option value="Winchester WSP (small pistol)"><option value="Winchester WSPM (small pistol magnum)"><option value="Winchester WLP (large pistol)"><option value="Remington 6½ (small rifle)"><option value="Remington 7½ BR (small rifle bench rest)"><option value="Remington 9½ (large rifle)"><option value="Remington 9½M (large rifle magnum)"><option value="Remington 1½ (small pistol)"><option value="Remington 5½ (small pistol magnum)"><option value="Remington 2½ (large pistol)"><option value="Murom KVB-223 (small rifle)"><option value="Fiocchi SRP (small rifle)"><option value="Fiocchi LRP (large rifle)"><option value="Fiocchi SPP (small pistol)"><option value="Fiocchi LPP (large pistol)"><option value="PMC / Murom KVB-7 (large rifle)"></datalist><datalist id="dlCase"><option value="Lapua"><option value="Peterson"><option value="Alpha Munitions"><option value="Hornady"><option value="Norma"><option value="Nosler"><option value="Starline"><option value="Winchester"><option value="Remington"><option value="Federal"><option value="ADG"><option value="Sig Sauer"><option value="Gunwerks"><option value="Bertram"><option value="PPU"><option value="Fiocchi"><option value="Speer"><option value="Blazer Brass"><option value="Lake City"><option value="Mixed range brass"></datalist><datalist id="dlMaker"><option value="Hornady"><option value="Federal"><option value="Federal Premium"><option value="Winchester"><option value="Remington"><option value="Sierra"><option value="Nosler"><option value="Berger"><option value="Black Hills"><option value="Sig Sauer"><option value="Norma"><option value="Lapua"><option value="PPU"><option value="Fiocchi"><option value="Barnes"><option value="CCI"><option value="Speer"><option value="Aguila"><option value="Magtech"><option value="Blazer"><option value="Underwood"><option value="HSM"><option value="Prvi Partizan"><option value="Wolf"><option value="Browning"></datalist>
      </details>
    </details>
    <div class="summary" id="loadRecipe"></div>
  </div>

  <div class="picker">
    <div class="lbl"><span>Shooting range / location</span><span class="saved" id="rangeSaved" aria-live="polite"></span></div>
    <div class="row pkRow">
      <select id="rangeSel" aria-label="Range"></select>
      <button class="ghost pkMenuBtn" type="button" id="rangeMenu" aria-label="Range actions" aria-haspopup="dialog" title="Range: new, duplicate, rename, delete"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='1'/><circle cx='19' cy='12' r='1'/><circle cx='5' cy='12' r='1'/></svg></button>
    </div>
    <div class="summary" id="rangeSum"></div>
    <details id="rangeDetails">
      <summary>Range location</summary>
      <div class="grid">
        <div><label for="rangeLat">Latitude</label><input type="number" inputmode="decimal" id="rangeLat" step="0.0001" placeholder="optional"><div class="err" id="e-rangeLat"></div></div>
        <div><label for="rangeLon">Longitude</label><input type="number" inputmode="decimal" id="rangeLon" step="0.0001" placeholder="optional"><div class="err" id="e-rangeLon"></div></div>
        <div class="full"><button class="sm ghost" type="button" id="rangeHere"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'/><circle cx='12' cy='10' r='3'/></svg> Use my current location</button></div>
        <div class="full hint">A range saves its location (for weather), shooting direction, altitude and default target distance (set them on the Dope tab; changes save automatically). Leave lat/lon blank to use your phone's location.</div>
      </div>
    </details>
  </div>
</div>
</section>`;

export const gearSheets = `<div id="pkMenu" role="dialog" aria-modal="true" aria-labelledby="pkTitle"><div class="box">
  <h3 id="pkTitle">Actions</h3>
  <div class="grp" data-k="rifle">
    <button type="button" id="rifleNew"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New gun</button>
    <button type="button" id="rifleDup"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg> Duplicate gun (with its loads)</button>
    <button type="button" id="rifleRename"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg> Rename gun</button>
    <div class="sep"></div>
    <button type="button" class="del" id="rifleDel"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg> Delete gun…</button>
  </div>
  <div class="grp" data-k="load">
    <button type="button" id="loadNew"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New load</button>
    <button type="button" id="loadCopy"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg> Duplicate / copy to another gun…</button>
    <button type="button" id="loadMove"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move to another gun…</button>
    <button type="button" id="loadRename"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg> Rename load</button>
    <div class="sep"></div>
    <button type="button" class="del" id="loadDel"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg> Delete load…</button>
  </div>
  <div class="grp" data-k="optic">
    <button type="button" id="opNew"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New optic on this gun</button>
    <button type="button" id="opAttach"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg> Attach existing optic…</button>
    <button type="button" id="opDup"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg> Duplicate optic</button>
    <button type="button" id="opRename"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg> Rename optic</button>
    <button type="button" id="opDetach"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71'/><line x1='8' x2='8' y1='2' y2='5'/><line x1='2' x2='5' y1='8' y2='8'/><line x1='16' x2='16' y1='19' y2='22'/><line x1='19' x2='22' y1='16' y2='16'/></svg> Detach from this gun</button>
    <div class="sep"></div>
    <button type="button" class="del" id="opDel"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg> Delete optic…</button>
  </div>
  <div class="grp" data-k="range">
    <button type="button" id="rangeNew"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New range</button>
    <button type="button" id="rangeDup"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg> Duplicate range</button>
    <button type="button" id="rangeRename"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/><path d='m15 5 4 4'/></svg> Rename range</button>
    <div class="sep"></div>
    <button type="button" class="del" id="rangeDel"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg> Delete range…</button>
  </div>
  <button type="button" class="ghost" id="pkCancel">Cancel</button>
</div></div>

<div id="zpDlg" role="alertdialog" aria-modal="true" aria-labelledby="zpQ" aria-describedby="zpFor"><div class="box">
  <h3 id="zpQ">Is this rifle already zeroed with this scope?</h3>
  <p id="zpFor"></p>
  <div class="row"><button type="button" class="ghost" id="zpNo">No — not yet</button><button type="button" id="zpYes">Yes, it's zeroed</button></div>
</div></div>
<div id="opSheet" class="ovl" role="dialog" aria-modal="true" aria-label="Attach an optic">
  ${sheetHead("<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'/><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'/></svg> Attach an optic", "opSheetClose")}
  <div class="summary" id="opSheetFor"></div>
  <div class="list" id="opList"></div>
</div>
<div id="trSheet" class="ovl" role="dialog" aria-modal="true" aria-label="True muzzle velocity or BC">
  ${sheetHead("<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> True to an observed drop", "trClose")}
  <div class="summary" id="trFor"></div>
  <div class="list">
    <div class="grid">
      <div><label for="trRange">Range (yd)</label><input type="number" inputmode="numeric" id="trRange"><div class="err" id="e-trRange"></div></div>
      <div><label for="trObs">Observed</label><input type="number" inputmode="decimal" id="trObs" step="0.05" placeholder="e.g. 7.4"><div class="err" id="e-trObs"></div></div>
      <div class="full"><label for="trAngle">Shot angle used (°, + up / − down)</label><input type="number" inputmode="decimal" id="trAngle" step="1" value="0"><div class="hint" id="trAngHint">Angle of the truing shot — 0 = flat. It is not taken from the Dope tab.</div></div>
      <div class="full"><span class="seg" id="trUnit" role="group" aria-label="Observed unit"><button type="button" data-v="MIL">mil dialed</button><button type="button" data-v="MOA">MOA dialed</button><button type="button" data-v="IN">inches low</button></span></div>
      <div class="full"><span class="seg" id="trWhat" role="group" aria-label="What to solve"><button type="button" data-v="mv">Solve MV</button><button type="button" data-v="bc">Solve BC scale</button></span></div>
      <div class="full"><button type="button" id="trGo">Solve</button></div>
      <div class="full" id="trOut" aria-live="polite"></div>
      <div class="full"><button type="button" class="ghost" id="trSave" disabled><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'/><path d='M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7'/><path d='M7 3v4a1 1 0 0 0 1 1h7'/></svg> Save to this load</button></div>
      <div class="full hint">Shoot at a known range in today's conditions and enter the elevation that actually centered the group (or how many inches low the shots landed with the predicted dial). Solve MV at medium range (supersonic); solve a BC scale at long range once MV is right.</div>
    </div>
  </div>
</div>`;

export const gearSheets2 = `<div id="sheet" role="dialog" aria-modal="true">
  <h3 id="sheetTitle"></h3>
  <div id="sheetVal">—</div>
  <div id="sheetSub"></div>
  <div id="sheetHelp"></div>
  <div class="row"><button type="button" class="ghost" id="sheetCancel">Cancel</button><button type="button" id="sheetLock"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='18' height='11' x='3' y='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/></svg> Lock</button></div>
</div>
<div id="dbSheet" role="dialog" aria-modal="true" aria-label="Bullet database">
  ${sheetHead("<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m16 6 4 14'/><path d='M12 6v14'/><path d='M8 8v12'/><path d='M4 4v16'/></svg> Bullet database", "dbClose")}
  <div class="filters">
    <input type="search" id="dbQ" placeholder="Search, e.g. 6.5 140 ELD" autocomplete="off" enterkeyhint="search">
    <span class="seg" id="dbKind" role="group" aria-label="Bullet type"><button type="button" data-v="" class="on">All</button><button type="button" data-v="rifle">Rifle</button><button type="button" data-v="handgun">Handgun</button></span>
    <select id="dbCal" aria-label="Caliber"></select>
    <select id="dbBrand" aria-label="Brand"></select>
  </div>
  <div class="note">Factory BCs are often optimistic. Pick fills BC, drag model, weight, diameter and length; you still enter your muzzle velocity.</div>
  <div class="hint" id="dbStatus">Loading…</div>
  <div id="dbList"></div>
</div>
<div id="rcSheet" class="ovl" role="dialog" aria-modal="true" aria-label="Saved recipes for this bullet">
  ${sheetHead("<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M12 7v14'/><path d='M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'/></svg> Saved recipes", "rcClose")}
  <div class="summary" id="rcFor"></div>
  <div class="hint">Recipes saved on any of your guns for this same bullet (same database bullet, or same diameter, weight and BC). Tap one to put it in this load's data (saved automatically). Velocities from another gun or barrel will differ — always work up again.</div>
  <div class="list" id="rcList"></div>
</div>
<div id="cpSheet" class="ovl" role="dialog" aria-modal="true" aria-label="Copy load">
  ${sheetHead("Copy load", "cpClose", { titleId: "cpTitle" })}
  <div class="summary" id="cpFor"></div>
  <div class="list">
    <button type="button" id="cpDup"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> Duplicate on this gun</button>
    <div class="hint">Same bullet, MV and load data under a new name — handy for a ladder or seating-depth test at a new charge.</div>
    <div class="sub">Copy to another gun</div>
    <div class="row" id="cpMvRow"><span class="hint" style="margin:0">Muzzle velocity on the other gun</span><span class="seg" id="cpMv" role="group" aria-label="Muzzle velocity on the other gun"><button type="button" data-v="est">Estimate for its barrel</button><button type="button" data-v="keep">Keep, mark estimated</button></span></div>
    <div id="cpList"></div>
    <button class="sm ghost" type="button" id="cpAllBtn" hidden></button>
    <div class="hint" style="margin-top:10px">Copies the bullet, BC, drag model, MV and load data. Zero, sight height, twist and barrel stay with each gun. Chrono sessions are not copied. The copy opens on its gun, ready to edit.</div>
  </div>
</div>`;
