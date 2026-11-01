// beta/js/views/targets.js — markup for the Target editor sheet.
import { sheetHead } from "./parts.js";

export const targetEditor = `<div id="tgEd" class="ovl" role="dialog" aria-modal="true" aria-label="Target">
  ${sheetHead("Target", "tgEdDone", { titleId: "tgEdT", btn: "✓ Done", cls: "sm" })}
  <button type="button" id="tgSum" aria-expanded="false" aria-controls="tgSetBox"></button>
  <div class="tgSet" id="tgSetBox">
    <div class="full"><label for="tgStrSel">String</label><select id="tgStrSel"></select></div>
    <div><label for="tgTpl">Template</label><select id="tgTpl"><option value="grid1">1″ grid</option><option value="moa">MOA grid</option><option value="mil">MIL grid</option><option value="bull">Bullseye</option><option value="steel">Steel plate</option></select></div>
    <div><label for="tgDist">Distance</label><div class="dd"><input type="number" inputmode="decimal" id="tgDist" min="5" max="3000"><select id="tgDu" aria-label="Distance unit"><option value="yd">yd</option><option value="m">m</option></select></div></div>
    <div class="full"><label for="tgU">Measure in</label><select id="tgU"><option value="in">inches</option><option value="cm">cm</option></select></div>
    <div class="full" id="tgDialBox"><label for="tgDialV">Elevation dialed (<span id="tgDialU">mil</span>)</label><div class="dd"><select id="tgDialD" aria-label="Up or down"><option value="U">U ▲</option><option value="D">D ▼</option></select><input type="number" inputmode="decimal" id="tgDialV" min="0" max="300" step="0.05" placeholder="what you dialed"><button type="button" class="sm ghost" id="tgDialApp">App dope</button></div><div class="hint" id="tgDialH"></div></div>
  </div>
  <div class="seg" id="tgMode" role="group" aria-label="Marking mode"><button type="button" data-v="aim">⊕ Aim point</button><button type="button" data-v="hole">● Holes</button><button type="button" data-v="meas">📏 Measure</button></div>
  <div id="tgTip"></div>
  <div id="tgZbar" role="group" aria-label="Zoom"><button type="button" id="tgZout" aria-label="Zoom out" disabled>－</button><span id="tgZoomT">×1</span><button type="button" id="tgZin" aria-label="Zoom in">＋</button><button type="button" id="tgZfit" disabled>Fit</button><span class="zh">Pinch to zoom · two fingers to pan</span></div>
  <div id="tgWrap"><svg id="tgSvg" viewBox="-6 -6 12 12" role="img" aria-label="Target sheet: tap to mark"></svg><div id="tgLoupe" hidden><svg id="tgLoupeSvg" viewBox="0 0 1 1" aria-hidden="true"></svg></div></div>
  <div id="tgTools"><button type="button" class="sm ghost" id="tgUndo" disabled>↶ Undo</button><input type="text" inputmode="decimal" id="tgAddV" placeholder="fps (optional)" aria-label="Velocity for the added shot (optional)"><button type="button" class="sm ghost" id="tgAddShot">＋ Add shot</button></div>
  <div id="tgMeas" hidden>
    <div id="tgMeasT"></div><div id="tgMPf" class="hint"></div>
    <div id="tgMeasBody">
      <div class="mrow"><div class="seg" id="tgMH" role="group" aria-label="Left or right"><button type="button" data-v="L">◀ L</button><button type="button" data-v="R">R ▶</button></div><button type="button" class="mval" id="tgMX" aria-label="Horizontal distance"></button></div>
      <div class="mrow"><div class="seg" id="tgMV" role="group" aria-label="Up or down"><button type="button" data-v="U">▲ U</button><button type="button" data-v="D">▼ D</button></div><button type="button" class="mval" id="tgMY" aria-label="Vertical distance"></button></div>
      <div class="mrow"><span class="hint" style="align-self:center">Aim point → hole center</span><div class="seg" id="tgMU" role="group" aria-label="Units"><button type="button" data-v="in">in</button><button type="button" data-v="cm">cm</button></div></div>
      <div id="tgKeys"><button type="button" data-k="1">1</button><button type="button" data-k="2">2</button><button type="button" data-k="3">3</button><button type="button" data-k="4">4</button><button type="button" data-k="5">5</button><button type="button" data-k="6">6</button><button type="button" data-k="7">7</button><button type="button" data-k="8">8</button><button type="button" data-k="9">9</button><button type="button" data-k=".">.</button><button type="button" data-k="0">0</button><button type="button" data-k="back" aria-label="Backspace">⌫</button></div>
      <div class="nav"><button type="button" class="ghost" id="tgMPrev">‹ Prev</button><button type="button" id="tgMNext">Next ›</button><button type="button" class="ghost" id="tgMDone">✓ Done measuring</button></div>
    </div>
  </div>
  <div class="sub" style="margin-top:12px">Holes ↔ readings</div>
  <div class="hint">One row per hole, numbered as on the target. Tap ⋯ to re-pair, measure or remove; readings with no hole are listed below.</div>
  <div id="tgList"></div>
  <div id="tgRes"></div>
</div>`;
