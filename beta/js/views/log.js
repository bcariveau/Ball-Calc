// beta/js/views/log.js — markup for the Log tab and its sheets (session editor, move session, import).
import { ctxRow, sheetHead, startBtn } from "./parts.js";

export const logTab = `
<!-- ===== Log tab ===== -->
<section class="tab" id="tabLog" data-tab="log" role="tabpanel" aria-labelledby="tabBtnLog">
${ctxRow("ctxLog")}
${startBtn("slStartBtn")}
<!-- ===== Shot log ===== -->
<div class="section" id="slSection">
  <h2>Shot log <span class="row"><button class="sm ghost" type="button" id="slImportBtn">⇧ Athlon file</button><button class="sm ghost" type="button" id="slNewBtn" title="Type velocities by hand">＋ Session</button></span></h2>
  <p class="slNone" id="slEmpty" hidden>No sessions yet.</p>
  <div id="radarBox">
    <div class="row"><button class="sm" type="button" id="radarConnect">📡 Connect radar</button><button class="sm ghost" type="button" id="radarReconnect" hidden>↻ Reconnect</button><button class="sm ghost" type="button" id="radarDisconnect" hidden>Disconnect</button></div>
    <div class="summary bad" id="radarNo" hidden></div>
    <div id="radarMore" hidden>
    <div class="summary" id="radarStatus">Not connected.</div>
    <div class="hint" id="radarHint">Athlon Rangecraft Velocity PRO over Bluetooth (Chrome on Android). Close Athlon's own app first: the radar talks to one app at a time. Each shot drops into a live session for the selected load.</div>
    <details id="radarRaw"><summary>Raw packets (<span id="radarRawN">0</span>)</summary>
      <div class="row" style="margin-top:4px"><button class="sm ghost" type="button" id="radarCopy">📋 Copy</button><button class="sm ghost" type="button" id="radarClear">Clear</button></div>
      <pre id="radarRawPre"></pre></details>
    </div>
  </div>
  <input type="file" id="slFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden>
  <div class="summary" id="slSum">Chronograph sessions for the selected load.</div>
  <div id="slChartBox"><canvas id="slChart" aria-label="Average velocity per session with ±1 SD band"></canvas></div>
  <details id="slCmp" hidden><summary>📊 Compare sessions (charge / ladder test)</summary>
    <span class="seg" id="slCmpScope" role="group" aria-label="Compare scope"><button type="button" data-v="load" class="on">This load</button><button type="button" data-v="gun">All loads on this gun</button></span>
    <div id="slCmpTbl"></div>
  </details>
  <div id="slList"></div>
  <div id="slSelBar" hidden><span class="n" id="slSelN">0 selected</span><button class="sm ghost" type="button" id="slSelAll">All</button><button class="sm" type="button" id="slSelMove" disabled>↔ Move…</button><button class="sm ghost" type="button" id="slSelDone">Done</button></div>
  <div class="row slTools"><button class="sm ghost" type="button" id="slCsvBtn">⇩ Shot log CSV (all sessions)</button><button class="sm ghost" type="button" id="slSelBtn">☑ Select</button></div>
</div>
</section>`;

export const logSheets = `<div id="slEditor" class="ovl" role="dialog" aria-modal="true" aria-label="Chronograph session">
  ${sheetHead("Session", "slEdClose", { titleId: "slEdTitle" })}
  <div id="sbDock"></div>
  <div class="summary" id="slEdFor"></div>
  <div id="slEdRecipe"></div>
  <button class="sm ghost" type="button" id="slMoveBtn">↔ Move / reassign (gun, load)</button>
  <button class="sm ghost" type="button" id="slEdRecipeBtn"></button>
  <div class="hint" id="slEdRadar"></div>
  <div class="stats" id="slStats"></div>
  <div id="slStrBar"><div class="hd"><span id="tgHdrT">String 1 · Target A</span><span id="tgHdrS"></span></div>
    <div class="row"><button type="button" class="sm ghost" id="tgNewStr">＋ New string <small>(same sheet)</small></button><button type="button" class="sm ghost" id="tgNewTgt">＋ New target <small>(fresh sheet)</small></button></div>
    <div class="row"><button type="button" class="sm" id="tgMarkBtn">🎯 Mark holes</button></div>
    <label class="tgl" for="tgMarkEach"><span>Mark each shot<small>Adds 🎯 Mark impact to the shot banner</small></span><input type="checkbox" id="tgMarkEach" role="switch"></label></div>
  <div id="slAddRow"><input type="text" inputmode="decimal" autocomplete="off" id="slVel" placeholder="fps" enterkeyhint="done" aria-label="Velocity (fps)"><button type="button" id="slAdd">＋ Add</button></div>
  <div class="hint">Type a velocity and tap Add (or Enter). You can paste several at once, e.g. "2701 2698 2710". Tap Cold/Clean/Flier to tag a shot, ⊘ to discard a double read (kept, grayed, left out of stats).</div>
  <div id="slShots"></div>
  <div class="sub" style="margin-top:10px">Targets</div>
  <div id="slTgView"></div>
  <details style="margin-top:10px"><summary>Session details (date, notes, weather, barrel)</summary>
    <div class="grid">
      <div class="full"><label for="slDate">Date / time</label><input type="datetime-local" id="slDate"></div>
      <div class="full"><label for="slNotes">Notes</label><input type="text" id="slNotes" maxlength="300" placeholder="powder lot, seating depth, conditions…"></div>
      <div><label for="slTemp">Temp (°F)</label><input type="number" inputmode="decimal" id="slTemp"></div>
      <div><label for="slPowder">Powder temp (°F)</label><input type="number" inputmode="decimal" id="slPowder"></div>
      <div><label for="slHum">Humidity (%)</label><input type="number" inputmode="decimal" id="slHum"></div>
      <div><label for="slPress">Pressure (inHg)</label><input type="number" inputmode="decimal" id="slPress" step="0.01"></div>
      <div><label for="slAlt">Altitude (ft)</label><input type="number" inputmode="numeric" id="slAlt"></div>
      <div><label for="slBarrel">Barrel (in)</label><input type="number" inputmode="decimal" id="slBarrel" step="0.5"></div>
      <div><label>Source</label><input type="text" id="slSource" disabled></div>
      <div class="full hint" id="slDevStats"></div>
    </div>
  </details>
  <div class="row" style="margin-top:10px">
    <button type="button" id="slUseMV" class="ghost" style="flex:1 1 100%">Use avg as MV (Chronographed)</button>
    <button type="button" id="slSave" style="flex:1 1 100%">💾 Save session</button>
  </div>
  <div class="row" style="margin-top:28px;justify-content:flex-end">
    <button type="button" class="danger" id="slDel" style="flex:0 0 auto;width:auto;padding:10px 16px">🗑 Delete session…</button>
  </div>
</div>
<div id="mvSheet" class="ovl" role="dialog" aria-modal="true" aria-label="Move session">
  ${sheetHead("↔ Move session", "mvClose", { titleId: "mvTitle" })}
  <div class="summary" id="mvFrom"></div>
  <div class="list">
    <label class="fl" for="mvGun">Gun (saved guns)</label>
    <select id="mvGun" aria-label="Gun"></select>
    <label class="fl">Load on this gun (sets the bullet and load data)</label>
    <div id="mvLoads"></div>
    <label class="mvChk"><input type="checkbox" id="mvUpd" checked><span>Update bullet + load data to the selected load<small>Uses the load's saved data. Untick if only the gun/load name was wrong and you want to keep the exact recipe you shot.</small></span></label>
    <div id="mvDiff"></div>
    <div class="hint" id="mvNote"></div>
  </div>
  <div id="mvActs"><button type="button" class="ghost" id="mvCancel">Cancel</button><button type="button" id="mvGo" disabled>Move</button></div>
</div>
<div id="slImport" class="ovl" role="dialog" aria-modal="true" aria-label="Import chronograph file">
  ${sheetHead("Import chronograph file", "slImpClose")}
  <div class="hint" id="slImpFile"></div>
  <div class="grid" style="margin:8px 0">
    <div><label for="slImpRifle">Attach to gun</label><select id="slImpRifle"></select></div>
    <div><label for="slImpLoad">Load</label><select id="slImpLoad"></select></div>
  </div>
  <div id="slImpList"></div>
  <button type="button" id="slImpGo">Import</button>
</div>`;
