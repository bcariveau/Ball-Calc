// beta/js/views/parts.js — markup partials shared by the view templates (one definition each).
export const sheetHead = (title, closeId, { titleId = "", btn = "✕ Close", cls = "sm ghost" } = {}) =>
  `<h3><span${titleId ? ` id="${titleId}"` : ""}>${title}</span><button class="${cls}" type="button" id="${closeId}">${btn}</button></h3>`;
export const ctxRow = id => `<div class="ctxRow"><span class="ctx" id="${id}" role="note"></span></div>`;
export const startBtn = id => `<button type="button" id="${id}">▶ Start shooting</button>`;
