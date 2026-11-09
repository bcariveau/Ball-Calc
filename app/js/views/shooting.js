// app/js/views/shooting.js — markup for the Shooting view and live shot banner.
export const shootingView = `<div id="shView" hidden role="dialog" aria-modal="true" aria-labelledby="shStr">
  <div class="shTop">
    <button type="button" class="sm ghost" id="shExit" aria-label="Exit the shooting view"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m15 18-6-6 6-6'/></svg> Exit</button>
    <div class="shTt"><b id="shStr">String 1 · Target A</b><small id="shFor"></small><select id="shGun" aria-label="Active firearm"></select></div>
    <div class="shRadBox"><span id="shRadar" role="status" aria-live="polite"></span><button type="button" class="sm" id="shConn" hidden><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M19.07 4.93A10 10 0 0 0 6.99 3.34'/><path d='M4 6h.01'/><path d='M2.29 9.62A10 10 0 1 0 21.31 8.35'/><path d='M16.24 7.76A6 6 0 1 0 8.23 16.67'/><path d='M12 18h.01'/><path d='M17.99 11.66A6 6 0 0 1 15.77 16.67'/><circle cx='12' cy='12' r='2'/><path d='m13.41 10.59 5.66-5.66'/></svg> Connect</button></div>
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
        <button type="button" data-f="clean" aria-pressed="false">Clean</button><button type="button" data-f="cold" aria-pressed="false">Cold bore</button><button type="button" data-f="fl" aria-pressed="false">Flier</button><button type="button" data-f="ie" aria-pressed="false">Input error</button>
        <input type="text" id="shNote" maxlength="200" placeholder="Note for this shot" aria-label="Note for the last shot">
      </div>
      <div id="shStrMenu" hidden role="menu" aria-label="String actions">
        <p class="lbl2" id="shStrFor">String 1</p>
        <button type="button" role="menuitem" id="shNewStr"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> New string<small>same target</small></button>
        <button type="button" role="menuitem" id="shNewTgt"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> New target<small>next target</small></button>
        <button type="button" role="menuitem" id="shEndStr"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><rect width='14' height='14' x='5' y='5' rx='1'/></svg> End string<small>next shot = new</small></button>
      </div>
      <div class="shBtns">
        <button type="button" class="bad" id="shBad"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='m4.9 4.9 14.2 14.2'/></svg> Remove<br><small>last kept shot</small></button>
        <button type="button" class="ghost" id="shTag" aria-expanded="false" aria-controls="shTagBar"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z'/><circle cx='7.5' cy='7.5' r='.5'/></svg> Tag</button>
        <button type="button" id="shAdd" aria-expanded="false" aria-controls="shAddBox"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M5 12h14'/><path d='M12 5v14'/></svg> Add shot</button>
        <button type="button" class="ghost" id="shStrBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="shStrMenu">String <svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='m6 9 6 6 6-6'/></svg></button>
        <button type="button" class="w2" id="shMark"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Mark holes</button>
      </div>
    </div>
  </div>
</div>`;

export const shotBanner = `<div id="shotBan" hidden role="status" aria-live="polite"><button type="button" id="sbMain" aria-label="Open the session"><span id="sbV"></span><span id="sbN"></span><span id="sbSt"></span></button>
  <div id="sbActs"><button type="button" data-a="x">Remove</button><button type="button" data-a="clean" aria-pressed="false">Clean</button><button type="button" data-a="cold" aria-pressed="false">Cold bore</button><button type="button" data-a="fl" aria-pressed="false">Flier</button><button type="button" data-a="ie" aria-pressed="false">Input error</button><button type="button" data-a="mark" hidden><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><circle cx='12' cy='12' r='6'/><circle cx='12' cy='12' r='2'/></svg> Mark impact</button></div></div>`;
