// beta/js/views/dope.js — markup for the Dope tab and printable dope card.
import { startBtn } from "./parts.js";

export const dopeTab = `<section class="tab" id="tabDope" data-tab="dope" role="tabpanel" aria-labelledby="tabBtnDope">
<div id="dopeCard" aria-live="polite">
  <div class="dcTop"><span class="dcFor ctx" id="dcFor" role="note"></span><button class="ghost ic wxIc" type="button" id="calcBtn" aria-label="Refresh weather and recalculate" title="Refresh weather and recalculate">↻ Weather</button></div>
  <div class="dcBig">
    <div><span class="k" id="dcElevK">Dial</span><b id="dcElev">—</b><span class="c" id="dcElevC"></span><span class="clk" id="dcElevClk"></span></div>
    <div><span class="k" id="dcWindK">Wind hold</span><b id="dcWind">—</b><span class="c" id="dcWindC"></span><span class="clk" id="dcWindClk"></span></div>
  </div>
  <div class="dcDist"><div class="stepper" data-step="25" data-min="25" data-max="3000"><input type="number" inputmode="numeric" id="target" value="500" aria-label="Target distance in yards"></div><span class="u">yd</span></div>
  <div class="err" id="e-target"></div>
  <div id="dcBracket"></div>
  <div id="dcMsg"></div>
  <div id="dcWarn"></div>
  <div class="dcMoreRow"><button type="button" id="dcMoreBtn" aria-expanded="false" aria-controls="dcMore">Details ▾</button></div>
  <div id="dcMore" hidden><div id="dcInfo"></div><div id="dcChips"></div></div>
</div>
<div id="status">Loading ballistics engine…</div>

${startBtn("shStartBtn")}
<div class="section" id="windSec">
  <h2>Wind &amp; angle <button type="button" class="sm ghost" id="windLock" aria-pressed="false">🔓 Lock dial</button></h2>
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
    <div class="full"><label for="shotAngle"><span>Shot angle (°, + up / − downhill)</span><button class="sm ghost sensorbtn" type="button" id="angleBtn">📐 Measure angle</button></label>
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
  <div class="row dcBtns" id="dopeTools"><button class="ghost" type="button" id="trueBtn">🎯 Truing</button><button class="ghost" type="button" id="dcBtn">🖨 Dope card</button></div>
</div>

<details class="section" id="advCond">
  <summary><span>Advanced conditions</span><span class="advSum" id="advSum"></span></summary>
  <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px"><span class="summary" style="margin:0">Live weather</span><button class="sm ghost" type="button" id="wxBtn">↻ Weather</button></div>
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
    <div class="full"><label for="bearing"><span>Shooting direction (compass °)</span><button class="sm ghost sensorbtn" type="button" id="aimBtn">🧭 Aim at target</button></label>
      <div class="stepper" data-step="5" data-min="0" data-max="360" data-wrap="1"><input type="number" inputmode="numeric" id="bearing" placeholder="optional, e.g. 270 = west"></div>
      <div class="hint" id="bearingHint">Set this so the weather wind direction can be turned into wind relative to your shot.</div>
      <div class="err" id="e-bearing"></div></div>
  </div>
</details>
</section>`;

export const dopeCardView = `<div id="dcView" class="ovl" role="dialog" aria-modal="true" aria-label="Printable dope card">
  <h3 class="dcvCtl"><span>🖨 Dope card</span><button class="sm ghost" type="button" id="dcvClose">✕ Close</button></h3>
  <div class="dcvCtl dcvRow">
    <span class="seg" id="dcvStep" role="group" aria-label="Range step"><button type="button" data-v="25">25 yd</button><button type="button" data-v="50">50 yd</button><button type="button" data-v="100">100 yd</button></span>
    <span class="seg" id="dcvSize" role="group" aria-label="Card size"><button type="button" data-v="wrist">Wrist coach</button><button type="button" data-v="full">Full page</button></span>
    <span class="seg" id="dcvAng" role="group" aria-label="Shot angle on the card"><button type="button" data-v="flat">0° flat</button><button type="button" data-v="keep" id="dcvKeep">Keep 0°</button></span>
    <label class="dcvMaxL" for="dcvMax">to <input type="number" inputmode="numeric" id="dcvMax" step="50"> yd</label>
    <button type="button" id="dcvPrint">🖨 Print</button>
  </div>
  <div id="dcPrint" class="wrist"></div>
</div>`;
