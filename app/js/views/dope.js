// app/js/views/dope.js — markup for the Dope tab and printable dope card.
import { ctxRow, startBtn } from "./parts.js";

export const dopeTab = `<section class="tab" id="tabDope" data-tab="dope" role="tabpanel" aria-labelledby="tabBtnDope">
${ctxRow("ctxDope")}
<div id="suWrap" hidden>
<form class="section" id="suCard" aria-labelledby="suTitle" novalidate>
  <h2 id="suTitle">Set up your rifle <span class="suStep" id="suStepTxt">Step 1 of 3</span></h2>
  <ol class="suDots" aria-hidden="true"><li class="on">Rifle &amp; zero</li><li>Scope</li><li>Load</li></ol>
  <fieldset class="suPane" data-i="0"><legend class="sr">Rifle and zero</legend>
    <div class="grid">
      <div class="full"><label for="suName">Rifle name</label><input type="text" id="suName" maxlength="60" autocomplete="off" placeholder="e.g. Tikka T3x .308"><div class="err" id="e-suName"></div></div>
      <div><label for="suZero">Zero (yd)</label><input type="number" inputmode="numeric" id="suZero" value="100"><div class="err" id="e-suZero"></div></div>
      <div><label for="suSH">Sight height (in)</label><input type="number" inputmode="decimal" id="suSH" step="0.05" value="1.5"><div class="err" id="e-suSH"></div></div>
      <div class="full"><label for="suTwist">Twist (inches per turn)</label><input type="number" inputmode="decimal" id="suTwist" step="0.5" value="10" placeholder="e.g. 10 (for spin drift)"><div class="err" id="e-suTwist"></div></div>
    </div>
  </fieldset>
  <fieldset class="suPane" data-i="1" hidden><legend class="sr">Scope turret</legend>
    <label>Scope turret unit</label>
    <span class="seg suSeg" id="suUnit" role="group" aria-label="Turret unit"><button type="button" data-v="moa">MOA</button><button type="button" data-v="mil">MIL</button></span>
    <label for="suClick" style="margin-top:10px">Click value</label><select id="suClick"></select>
    <div class="hint">Look on the turret cap: “0.1 MRAD” / “1 click = 1 cm @ 100 m” is 0.1 mil; “¼ MOA” is ¼ MOA. Dial clicks always count in this unit.</div>
  </fieldset>
  <fieldset class="suPane" data-i="2" hidden><legend class="sr">Load</legend>
    <button class="sm ghost" type="button" id="suDb" style="width:100%"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m16 6 4 14'/><path d='M12 6v14'/><path d='M8 8v12'/><path d='M4 4v16'/></svg> Pick bullet from database</button>
    <div class="hint" id="suBullet"></div>
    <div class="grid">
      <div class="full"><label for="suLoad">Load name</label><input type="text" id="suLoad" maxlength="60" autocomplete="off" placeholder="e.g. 168gr SMK"><div class="err" id="e-suLoad"></div></div>
      <div><label for="suBc">BC</label><input type="number" inputmode="decimal" id="suBc" step="0.001" placeholder="e.g. 0.243"><div class="err" id="e-suBc"></div></div>
      <div><label for="suDrag">Drag model</label><select id="suDrag"><option value="G7">G7 (boat-tail)</option><option value="G1">G1 (flat-base)</option></select></div>
      <div><label for="suWt">Weight (gr)</label><input type="number" inputmode="decimal" id="suWt" step="1" placeholder="e.g. 168"><div class="err" id="e-suWt"></div></div>
      <div><label for="suDia">Diameter (in)</label><input type="number" inputmode="decimal" id="suDia" step="0.001" placeholder="e.g. 0.308"><div class="err" id="e-suDia"></div></div>
      <div class="full"><label for="suMv">Muzzle velocity (fps)</label><input type="number" inputmode="numeric" id="suMv" step="5" placeholder="chrono or box velocity"><div class="err" id="e-suMv"></div></div>
    </div>
  </fieldset>
  <div class="row suNav"><button type="button" class="ghost" id="suBack"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m15 18-6-6 6-6'/></svg> Back</button><button type="submit" id="suNext">Next <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m9 18 6-6-6-6'/></svg></button></div>
</form>
<button type="button" class="linkBtn" id="suSample">Try with sample data</button>
</div>
<div id="dopeCard" aria-live="polite">
  <div class="dcBig">
    <div><span class="k" id="dcElevK">Dial</span><b id="dcElev">—</b><span class="c" id="dcElevC"></span><span class="clk" id="dcElevClk"></span></div>
    <div><span class="k" id="dcWindK">Wind hold</span><b id="dcWind">—</b><span class="c" id="dcWindC"></span><span class="clk" id="dcWindClk"></span></div>
  </div>
  <div class="dcDist"><div class="stepper" data-step="25" data-min="25" data-max="3000"><input type="number" inputmode="numeric" id="target" value="500" aria-label="Target distance in yards"></div><span class="u">yd</span></div>
  <div class="err" id="e-target"></div>
  <div id="dcBracket"></div>
  <div id="dcMsg"></div>
  <div id="dcWarn"></div>
  <div class="dcMoreRow"><button type="button" id="dcMoreBtn" aria-expanded="false" aria-controls="dcMore">Details <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m6 9 6 6 6-6'/></svg></button><button class="ghost ic wxIc" type="button" id="calcBtn" aria-label="Refresh weather and recalculate" title="Refresh weather and recalculate"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/><path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/><path d='M8 16H3v5'/></svg> <span class="wxL">Weather</span></button></div>
  <div id="dcMore" hidden><div id="dcInfo"></div><div id="dcChips"></div></div>
</div>
<div id="status">Loading ballistics engine…</div>

${startBtn("shStartBtn")}
<div class="section" id="windSec">
  <h2>Wind &amp; angle <button type="button" class="sm ghost" id="windLock" aria-pressed="false"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='18' height='11' x='3' y='11' rx='2' ry='2'/><path d='M7 11V7a5 5 0 0 1 9.9-1'/></svg> Lock dial</button></h2>
  <div class="windbox">
    <canvas id="dial" role="img" aria-label="Wind direction dial: drag around the ring (or press and hold) to set where the wind comes from; tap an hour to snap to it"></canvas>
    <div>
      <label for="windSpeed"><span>Wind speed (mph)</span><span class="chip" id="src-windSpeed"></span></label>
      <div class="stepper" data-step="1" data-min="0" data-max="60"><input type="number" inputmode="decimal" id="windSpeed" value="10"></div>
      <div class="err" id="e-windSpeed"></div><div id="wxShHint" hidden></div>
      <label for="windDir" style="margin-top:8px"><span>Wind from (°)</span><span class="chip" id="src-windDir"></span></label>
      <div class="stepper" data-step="5" data-min="0" data-max="360" data-wrap="1"><input type="number" inputmode="numeric" id="windDir" value="90"></div>
      <div class="err" id="e-windDir"></div>
    </div>
  </div>
  <div id="dirText"></div>
  <div class="hint" id="wxWindNote" hidden>Weather wind is measured 10 m (33 ft) above ground — usually stronger than the wind at shooter height (about ⅔ of it in open ground).</div>
  <div class="hint">Drag around the dial's ring (or press and hold) to set where the wind comes from; tap an hour to snap to it. Use − / + for speed and direction, or tap a number to type it. 0° = wind in your face, 90° = from your right, 180° = from behind, 270° = from your left.</div>
  <div class="grid" style="margin-top:10px">
    <div class="full"><label for="shotAngle"><span>Shot angle (°, + up / − downhill)</span><button class="sm ghost sensorbtn" type="button" id="angleBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z'/><path d='m14.5 12.5 2-2'/><path d='m11.5 9.5 2-2'/><path d='m8.5 6.5 2-2'/><path d='m17.5 15.5 2-2'/></svg> Measure angle</button></label>
      <div class="stepper" data-step="1" data-min="-60" data-max="60"><input type="number" inputmode="decimal" id="shotAngle" value="0"></div>
      <div class="hint" id="sensorHint">Leave 0 for a flat shot. Target distance is the rangefinder (line-of-sight) distance.</div><div class="err" id="e-shotAngle"></div></div>
  </div>
</div>

<div class="section" id="outSec">
  <h2>Trajectory
    <span class="row">
      <span class="seg" id="angSeg"><button type="button" data-v="MOA">MOA</button><button type="button" data-v="MIL">MIL</button></span><span class="seg" id="viewSeg"><button type="button" data-v="dope">Dope</button><button type="button" data-v="full">Full</button></span>
    </span>
  </h2>
  <div id="results"></div>
  <div class="chart-container">
    <canvas id="chart" aria-label="Drop versus range chart"></canvas>
  </div>
  <div class="grid stk" style="margin-top:10px">
    <div><label for="maxRange">Table to (yd)</label>
      <div class="stepper" data-step="50" data-min="100" data-max="3000"><input type="number" inputmode="numeric" id="maxRange" value="1000"></div><div class="err" id="e-maxRange"></div></div>
    <div><label for="step">Every (yd)</label>
      <div class="stepper" data-step="25" data-min="25" data-max="500"><input type="number" inputmode="numeric" id="step" value="100"></div><div class="err" id="e-step"></div></div>
  </div>
  <label class="tgl" for="roundClk"><span>Round to the nearest turret click<small>Shows the dial value you can actually set (click value from the optic in Gear).</small></span><input type="checkbox" id="roundClk" role="switch"></label>
  <div class="row dcBtns" id="dopeTools"><button class="ghost" type="button" id="trueBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Truing</button><button class="ghost" type="button" id="dcBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'/><path d='M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6'/><rect x='6' y='14' width='12' height='8' rx='1'/></svg> Dope card</button></div>
</div>

<details class="section" id="advCond">
  <summary><span>Advanced conditions</span><span class="advSum" id="advSum"></span></summary>
  <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px"><span class="summary" style="margin:0">Live weather</span><button class="sm ghost" type="button" id="wxBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/><path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/><path d='M8 16H3v5'/></svg> Weather</button></div>
  <div id="wxStatus">Weather not loaded yet.</div>
  <div id="placeBox" class="row">
    <input type="text" id="placeQ" placeholder="City or ZIP for weather" style="flex:1 1 160px">
    <button class="sm ghost" type="button" id="placeGo">Find</button>
  </div>
  <div class="grid" style="margin-top:10px">
    <div><label for="temp"><span>Temp (°F)</span><span class="chip" id="src-temp"></span></label>
      <div class="stepper" data-step="1" data-min="-40" data-max="130"><input type="number" inputmode="numeric" id="temp" value="59"></div><div class="err" id="e-temp"></div></div>
    <div><label for="humidity"><span>Humidity (%)</span><span class="chip" id="src-humidity"></span></label>
      <div class="stepper" data-step="5" data-min="0" data-max="100"><input type="number" inputmode="numeric" id="humidity" value="50"></div><div class="err" id="e-humidity"></div></div>
    <div><label for="altitude"><span>Altitude (ft)</span><span class="chip" id="src-altitude"></span></label>
      <div class="stepper" data-step="100" data-min="-1500" data-max="15000"><input type="number" inputmode="numeric" id="altitude" value="0"></div><div class="err" id="e-altitude"></div></div>
    <div><label for="pressure"><span>Station pressure (inHg)</span><span class="chip" id="src-pressure"></span></label>
      <input type="number" inputmode="decimal" id="pressure" step="0.01" placeholder="blank = standard"><div class="err" id="e-pressure"></div></div>
    <div class="full hint">Station pressure is the actual (not sea-level corrected) pressure where you are. Leave it blank to use standard pressure for your altitude.</div>
    <div><label for="powderTemp"><span>Powder temp (°F)</span></label>
      <div class="stepper" data-step="5" data-min="-40" data-max="160"><input type="number" inputmode="numeric" id="powderTemp" placeholder="air"></div><div class="err" id="e-powderTemp"></div></div>
    <div class="hint" id="ptHint" style="align-self:end"></div>
    <div class="full"><label for="bearing"><span>Shooting direction (compass °)</span><button class="sm ghost sensorbtn" type="button" id="aimBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><polygon points='16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76'/></svg> Aim at target</button></label>
      <div class="stepper" data-step="5" data-min="0" data-max="360" data-wrap="1"><input type="number" inputmode="numeric" id="bearing" placeholder="optional, e.g. 270 = west"></div>
      <div class="hint" id="bearingHint">Set this so the weather wind direction can be turned into wind relative to your shot.</div>
      <div class="err" id="e-bearing"></div></div>
  </div>
</details>
</section>`;

export const dopeCardView = `<div id="dcView" class="ovl" role="dialog" aria-modal="true" aria-label="Printable dope card">
  <h3 class="dcvCtl"><span><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'/><path d='M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6'/><rect x='6' y='14' width='12' height='8' rx='1'/></svg> Dope card</span><button class="sm ghost" type="button" id="dcvClose"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M18 6 6 18'/><path d='m6 6 12 12'/></svg> Close</button></h3>
  <div class="dcvCtl dcvRow">
    <span class="seg" id="dcvStep" role="group" aria-label="Range step"><button type="button" data-v="25">25 yd</button><button type="button" data-v="50">50 yd</button><button type="button" data-v="100">100 yd</button></span>
    <span class="seg" id="dcvSize" role="group" aria-label="Card size"><button type="button" data-v="wrist">Wrist coach</button><button type="button" data-v="full">Full page</button></span>
    <span class="seg" id="dcvAng" role="group" aria-label="Shot angle on the card"><button type="button" data-v="flat">0° flat</button><button type="button" data-v="keep" id="dcvKeep">Keep 0°</button></span>
    <label class="dcvMaxL" for="dcvMax">to <input type="number" inputmode="numeric" id="dcvMax" step="50"> yd</label>
    <button type="button" id="dcvPrint"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'/><path d='M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6'/><rect x='6' y='14' width='12' height='8' rx='1'/></svg> Print</button>
  </div>
  <div id="dcPrint" class="wrist"></div>
</div>`;
