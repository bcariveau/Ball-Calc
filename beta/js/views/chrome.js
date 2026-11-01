// beta/js/views/chrome.js — markup for the header, 🎨 theme bar, tab bar, app-level sheets (About, update bar, toast).
import { sheetHead } from "./parts.js";

export const header = `<header id="appHead"><div class="brand"><svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="23" stroke="var(--logo-fg, #e8f5e9)" stroke-width="3"/><path d="M32 5v11M32 48v11M5 32h11M48 32h11" stroke="var(--logo-fg, #e8f5e9)" stroke-width="3"/><path d="M32 23v2M32 39v2M23 32h2M39 32h2" stroke="var(--logo-fg, #e8f5e9)" stroke-width="2" opacity=".55"/><path d="M3 59C9 24 25 4 32 32" pathLength="100" stroke="var(--logo-bg, #0a1f14)" stroke-width="7" stroke-dasharray="0 38 62 0"/><path d="M3 59C9 24 25 4 32 32" pathLength="100" stroke="var(--logo-ac, #2ecc71)" stroke-width="2.4" stroke-dasharray="0.1 6.5" opacity=".75"/><path d="M3 59C9 24 25 4 32 32" pathLength="100" stroke="var(--logo-ac, #2ecc71)" stroke-width="3.4" stroke-dasharray="0 40 60 0"/></g><circle cx="32" cy="32" r="4.4" fill="var(--logo-ac, #2ecc71)" stroke="var(--logo-bg, #0a1f14)" stroke-width="1.5"/></svg><div><h1>Ball<span>-</span>Calc</h1><div class="tag">Ballistics · Loads · Chrono</div></div></div><span id="offPill" role="status" hidden title="No connection — the app still works; weather needs a connection">📴 Offline</span><button class="sm ghost" type="button" id="themeBtn" aria-label="Color scheme" aria-expanded="false" title="Color scheme">🎨</button></header>
<div id="themeBar" role="group" aria-label="Color scheme" hidden><button type="button" data-t="dark" aria-label="Dark color scheme"><i style="background:linear-gradient(135deg,#0a1f14 0 55%,#2ecc71 55%)"></i>Dark</button><button type="button" data-t="light" aria-label="Daylight color scheme"><i style="background:linear-gradient(135deg,#eef1ec 0 55%,#0a7a36 55%)"></i>Daylight</button><button type="button" data-t="od" aria-label="OD Green color scheme"><i style="background:linear-gradient(135deg,#1c2012 0 55%,#b5c96a 55%)"></i>OD Green</button><button type="button" data-t="fde" aria-label="Desert FDE color scheme"><i style="background:linear-gradient(135deg,#241d14 0 55%,#d9b77e 55%)"></i>Desert FDE</button><button type="button" data-t="night" aria-label="Night red color scheme"><i style="background:linear-gradient(135deg,#000000 0 55%,#ff3b2f 55%)"></i>Night red</button><button type="button" id="aboutBtn" aria-haspopup="dialog">ⓘ About</button></div>

<!-- ===== Dope tab ===== -->
<main>`;

export const tabBar = `</main>

<nav id="tabBar" role="tablist" aria-label="Sections">
  <button type="button" role="tab" id="tabBtnDope" data-tab="dope" aria-controls="tabDope"><span class="i">🎯</span>Dope</button>
  <button type="button" role="tab" id="tabBtnGear" data-tab="gear" aria-controls="tabGear"><span class="i">🧰</span>Gear</button>
  <button type="button" role="tab" id="tabBtnLog" data-tab="log" aria-controls="tabLog"><span class="i">📈</span>Log</button>
</nav>
`;

export const appSheets = `<div id="aboutSheet" class="ovl" role="dialog" aria-modal="true" aria-labelledby="aboutT">
  ${sheetHead("ⓘ About Ball-Calc", "aboutClose", { titleId: "aboutT" })}
  <div class="abBody list">
    <p>Powered by js-ballistics (point-mass 3DoF + spin drift). Weather from Open-Meteo. Values are approximations — always verify with a chronograph and real-world testing.</p>
    <p>Bullet database: specifications published by Hornady, Sierra, Speer, Berger, Nosler, Barnes, Lapua, Hammer and Cutting Edge (each entry links its source), plus older bullets from <a href="https://github.com/ammolytics/projectiles" style="color:inherit">ammolytics/projectiles</a> (MIT License). Manufacturer names are trademarks of their owners.</p>
    <p class="abNote">Your guns, loads and shot log are stored only on this device (export them from Gear). The app works offline once it has been opened online.</p>
  </div>
</div>
<div id="updBar" role="status" aria-live="polite" hidden><span>Update available</span> <span class="dot" aria-hidden="true">·</span> <button type="button" id="updGo">Reload</button> <button type="button" id="updX" aria-label="Dismiss update notice" title="Later">✕</button></div>
<div id="toast"></div>`;
