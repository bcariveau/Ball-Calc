// app/js/views/parts.js — markup partials shared by the view templates (one definition each).
export const sheetHead = (title, closeId, { titleId = "", btn = "<svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><path d='M18 6 6 18'/><path d='m6 6 12 12'/></svg> Close", cls = "sm ghost" } = {}) =>
  `<h3><span${titleId ? ` id="${titleId}"` : ""}>${title}</span><button class="${cls}" type="button" id="${closeId}">${btn}</button></h3>`;
export const ctxRow = id => `<div class="ctxRow"><span class="ctx" id="${id}" role="note"></span></div>`;
export const startBtn = id => `<button type="button" id="${id}"><svg class='ic' viewBox='0 0 24 24' aria-hidden='true'><polygon points='6 3 20 12 6 21 6 3'/></svg> Start shooting</button>`;
