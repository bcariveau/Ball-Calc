// beta/js/views/log.js — markup for the Log tab and its sheets (session editor, move session, import).
import { ctxRow, sheetHead, startBtn } from "./parts.js";

export const logTab = `
<!-- ===== Log tab ===== -->
<section class="tab" id="tabLog" data-tab="log" role="tabpanel" aria-labelledby="tabBtnLog">
${ctxRow("ctxLog")}
${startBtn("slStartBtn")}
<!-- ===== Shot log ===== -->
<div class="section" id="slSection">
  <h2>Shot log <span class="row"><button class="sm ghost" type="button" id="slImportBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='17 8 12 3 7 8'/><line x1='12' x2='12' y1='3' y2='15'/></svg> Athlon file</button><button class="sm ghost" type="button" id="slNewBtn" title="Type velocities by hand"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> Session</button></span></h2>
  <p class="slNone" id="slEmpty" hidden>No sessions yet.</p>
  <div id="radarBox">
    <div class="row"><button class="sm" type="button" id="radarConnect"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M19.07 4.93A10 10 0 0 0 6.99 3.34'/><path d='M4 6h.01'/><path d='M2.29 9.62A10 10 0 1 0 21.31 8.35'/><path d='M16.24 7.76A6 6 0 1 0 8.23 16.67'/><path d='M12 18h.01'/><path d='M17.99 11.66A6 6 0 0 1 15.77 16.67'/><circle cx='12' cy='12' r='2'/><path d='m13.41 10.59 5.66-5.66'/></svg> Connect radar</button><button class="sm ghost" type="button" id="radarReconnect" hidden><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/><path d='M21 3v5h-5'/><path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/><path d='M8 16H3v5'/></svg> Reconnect</button><button class="sm ghost" type="button" id="radarDisconnect" hidden>Disconnect</button></div>
    <div class="summary bad" id="radarNo" hidden></div>
    <div id="radarMore" hidden>
    <div class="summary" id="radarStatus">Not connected.</div>
    <div class="hint" id="radarHint">Athlon Rangecraft Velocity PRO over Bluetooth (Chrome on Android). Close Athlon's own app first: the radar talks to one app at a time. Each shot drops into a live session for the selected load.</div>
    <details id="radarRaw"><summary>Raw packets (<span id="radarRawN">0</span>)</summary>
      <div class="row" style="margin-top:4px"><button class="sm ghost" type="button" id="radarCopy"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='8' height='4' x='8' y='2' rx='1' ry='1'/><path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/></svg> Copy</button><button class="sm ghost" type="button" id="radarClear">Clear</button></div>
      <pre id="radarRawPre"></pre></details>
    </div>
  </div>
  <input type="file" id="slFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" hidden>
  <div class="summary" id="slSum">Chronograph sessions for the selected load.</div>
  <div id="slChartBox"><canvas id="slChart" aria-label="Average velocity per session with ±1 SD band"></canvas></div>
  <details id="slCmp" hidden><summary><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 3v16a2 2 0 0 0 2 2h16'/><path d='M18 17V9'/><path d='M13 17V5'/><path d='M8 17v-3'/></svg> Compare sessions (charge / ladder test)</summary>
    <span class="seg" id="slCmpScope" role="group" aria-label="Compare scope"><button type="button" data-v="load" class="on">This load</button><button type="button" data-v="gun">All loads on this gun</button></span>
    <div id="slCmpTbl"></div>
  </details>
  <div id="slList"></div>
  <div id="slSelBar" hidden><span class="n" id="slSelN">0 selected</span><button class="sm ghost" type="button" id="slSelAll">All</button><button class="sm" type="button" id="slSelMove" disabled><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move…</button><button class="sm ghost" type="button" id="slSelDone">Done</button></div>
  <div class="row slTools"><button class="sm ghost" type="button" id="slCsvBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' x2='12' y1='15' y2='3'/></svg> Shot log CSV (all sessions)</button><button class="sm ghost" type="button" id="slSelBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5'/><path d='m9 11 3 3L22 4'/></svg> Select</button></div>
</div>
</section>`;

export const logSheets = `<div id="slEditor" class="ovl" role="dialog" aria-modal="true" aria-label="Chronograph session">
  ${sheetHead("Session", "slEdClose", { titleId: "slEdTitle" })}
  <button type="button" class="sm ghost" id="shotSelDone" hidden>Done</button>
  <div id="slEdScroll">
  <div id="sbDock"></div>
  <div class="summary" id="slEdFor"></div>
  <div id="slEdRecipe"></div>
  <button class="sm ghost" type="button" id="slMoveBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move / reassign (gun, load)</button>
  <button class="sm ghost" type="button" id="slEdRecipeBtn"></button>
  <div class="hint" id="slEdRadar"></div>
  <div class="stats" id="slStats"></div>
  <div id="slMvRow"><button type="button" id="slUseMV" class="ghost">Use avg as MV</button><div class="hint" id="slMvNote" aria-live="polite"></div></div>
  <div id="slStrBar"><div class="hd"><span id="tgHdrT">String 1 · Target A</span><span id="tgHdrS"></span></div>
    <div class="row"><button type="button" class="sm ghost" id="tgNewStr"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New string <small>(same sheet)</small></button><button type="button" class="sm ghost" id="tgNewTgt"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New target <small>(fresh sheet)</small></button></div>
    <div class="row"><button type="button" class="sm" id="tgMarkBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Mark holes</button></div>
    <label class="tgl" for="tgMarkEach"><span>Mark each shot<small>Adds <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Mark impact to the shot banner</small></span><input type="checkbox" id="tgMarkEach" role="switch"></label></div>
  <div id="slAddRow"><input type="text" inputmode="decimal" autocomplete="off" id="slVel" placeholder="fps" enterkeyhint="done" aria-label="Velocity (fps)"><button type="button" id="slAdd"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> Add</button></div>
  <p class="hint sh" id="slAddHint"><span class="h1">Type a velocity and tap Add (or Enter).</span> <button type="button" class="info" id="slAddHelp" aria-expanded="false" aria-label="More about adding shots">?</button><span class="more" hidden> You can paste several at once, e.g. "2701 2698 2710". Tags (Clean, Cold bore, Flier, Input error) can be combined and never change the stats. Remove keeps the shot in the log, grays it, and leaves it out of every stat until you restore it.</span></p>
  <div class="row" id="shotSelTools"><button class="sm ghost" type="button" id="shotSelBtn"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5'/><path d='m9 11 3 3L22 4'/></svg> Select shots</button></div>
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
    <button type="button" id="slSave" style="flex:1 1 100%"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'/><path d='M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7'/><path d='M7 3v4a1 1 0 0 0 1 1h7'/></svg> Save session</button>
  </div>
  <div class="row" style="margin-top:28px;justify-content:flex-end">
    <button type="button" class="danger" id="slDel" style="flex:0 0 auto;width:auto;padding:10px 16px"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg> Delete session…</button>
  </div>
  </div>
  <div id="shotSelBar" hidden>
    <span class="n" id="shotSelN">0 selected</span>
    <button type="button" id="shotMoveOpen" disabled>Move 0 shots</button>
    <button type="button" class="ghost" id="shotSplit" hidden>Split</button>
  </div>
</div>
<div id="shotDestSheet" hidden role="dialog" aria-modal="true" aria-label="Where to move the selected shots">
  <div class="sheetHd"><span>Move shots</span><button type="button" class="sm ghost" id="shotDestClose">Cancel</button></div>
  <select id="shotDestKind" aria-label="Where to move the selected shots"><option value="new">New string for a firearm and load</option><option value="existing">An existing string</option></select>
  <select id="shotDestStr" aria-label="Existing string to move the selected shots to" hidden></select>
  <select id="shotDestGun" aria-label="Firearm to assign the selected shots to"></select>
  <select id="shotDestLoad" aria-label="Load to assign the selected shots to"></select>
  <div id="shotDestList"></div>
  <p class="hint" id="shotDestNote"></p>
  <button type="button" id="shotMoveGo" disabled><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move 0 shots</button>
</div>
<div id="shotDelDlg" hidden role="dialog" aria-modal="true" aria-labelledby="shotDelMsg">
  <div class="box">
    <p id="shotDelMsg">Delete this shot?</p>
    <div class="row">
      <button type="button" class="ghost" id="shotDelCancel">Cancel</button>
      <button type="button" class="danger" id="shotDelGo"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M3 6h18'/><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'/><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'/></svg> Delete</button>
    </div>
  </div>
</div>
<div id="mvSheet" class="ovl" role="dialog" aria-modal="true" aria-label="Move session">
  ${sheetHead("<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m18 8 4 4-4 4'/><path d='M2 12h20'/><path d='m6 8-4 4 4 4'/></svg> Move session", "mvClose", { titleId: "mvTitle" })}
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
