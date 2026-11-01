// beta/js/views/shooting.js — markup for the Shooting view and live shot banner.
export const shootingView = `<div id="shView" hidden role="dialog" aria-modal="true" aria-labelledby="shStr">
  <div class="shTop">
    <button type="button" class="sm ghost" id="shExit" aria-label="Exit the shooting view">← Exit</button>
    <div class="shTt"><b id="shStr">String 1 · Target A</b><small id="shFor"></small></div>
    <div class="shRadBox"><span id="shRadar" role="status" aria-live="polite"></span><button type="button" class="sm" id="shConn" hidden>📡 Connect</button></div>
  </div>
  <div class="shMain">
    <div class="shL">
      <div class="shHero" id="shHero" aria-live="polite"><span id="shV">—</span><span id="shVu">fps</span><span id="shMeta" class="wait">Waiting for the first shot</span></div>
      <div id="shEndNote" hidden></div>
      <div class="shStats" id="shStats"></div>
      <div id="shEs"></div>
      <div id="shDope"></div>
    </div>
    <div class="shR">
      <div id="shList" aria-label="Shots in this string, newest first"></div>
      <div id="shAddBox" hidden>
        <input type="number" inputmode="decimal" id="shVel" placeholder="fps" aria-label="Shot velocity in fps">
        <button type="button" id="shAddGo">Add</button><button type="button" class="ghost" id="shAddDone" aria-label="Done: close the velocity entry">Done</button>
      </div>
      <div id="shTagBar" hidden>
        <p class="lbl2" id="shTagFor">Tag the last shot</p>
        <button type="button" data-f="cold" aria-pressed="false">❄ Cold</button><button type="button" data-f="clean" aria-pressed="false">🧽 Clean</button><button type="button" data-f="fl" aria-pressed="false">↯ Flier</button>
        <input type="text" id="shNote" maxlength="200" placeholder="Note for this shot" aria-label="Note for the last shot">
      </div>
      <div id="shStrMenu" hidden role="menu" aria-label="String actions">
        <p class="lbl2" id="shStrFor">String 1</p>
        <button type="button" role="menuitem" id="shNewStr">＋ New string<small>same target</small></button>
        <button type="button" role="menuitem" id="shNewTgt">◎ New target<small>next target</small></button>
        <button type="button" role="menuitem" id="shEndStr">■ End string<small>next shot = new</small></button>
      </div>
      <div class="shBtns">
        <button type="button" class="bad" id="shBad">✗ Bad read<br><small>discard last</small></button>
        <button type="button" class="ghost" id="shTag" aria-expanded="false" aria-controls="shTagBar">🏷 Tag</button>
        <button type="button" id="shAdd" aria-expanded="false" aria-controls="shAddBox">＋ Add shot</button>
        <button type="button" class="ghost" id="shStrBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="shStrMenu">String ▾</button>
        <button type="button" class="w2" id="shMark">🎯 Mark holes</button>
      </div>
    </div>
  </div>
</div>`;

export const shotBanner = `<div id="shotBan" hidden role="status" aria-live="polite"><button type="button" id="sbMain" aria-label="Open the session"><span id="sbV"></span><span id="sbN"></span><span id="sbSt"></span></button>
  <div id="sbActs"><button type="button" data-a="x">Discard</button><button type="button" data-a="cold" aria-pressed="false">Cold bore</button><button type="button" data-a="clean" aria-pressed="false">Clean bore</button><button type="button" data-a="fl" aria-pressed="false">Flier</button><button type="button" data-a="mark" hidden>🎯 Mark impact</button></div></div>`;
