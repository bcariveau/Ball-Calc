// beta/js/cartridges.js — common cartridges and their bullet diameters.
// Diameters are the nominal groove size used by the load form, and each one sits inside the SAAMI bullet min–max
// (centerfire rifle Z299.4, rimfire Z299.1, pistol Z299.3). .22 LR is 0.223, inside the SAAMI .2215–.2255 bullet.

export const CARTRIDGES = [
  { id: "22lr", name: ".22 Long Rifle", short: ".22 LR", diameter: 0.223 },
  { id: "223", name: ".223 Remington / 5.56", short: ".223", diameter: 0.224 },
  { id: "6cm", name: "6mm Creedmoor", short: "6mm CM", diameter: 0.243 },
  { id: "243", name: ".243 Winchester", short: ".243", diameter: 0.243 },
  { id: "65cm", name: "6.5 Creedmoor", short: "6.5 CM", diameter: 0.264 },
  { id: "65prc", name: "6.5 PRC", short: "6.5 PRC", diameter: 0.264 },
  { id: "65x55", name: "6.5x55", short: "6.5x55", diameter: 0.264 },
  { id: "260", name: ".260 Remington", short: ".260", diameter: 0.264 },
  { id: "270", name: ".270 Winchester", short: ".270", diameter: 0.277 },
  { id: "7mm08", name: "7mm-08", short: "7mm-08", diameter: 0.284 },
  { id: "7mmrem", name: "7mm Remington Magnum", short: "7mm Rem", diameter: 0.284 },
  { id: "7prc", name: "7mm PRC", short: "7mm PRC", diameter: 0.284 },
  { id: "308", name: ".308 Winchester", short: ".308", diameter: 0.308 },
  { id: "762nato", name: "7.62 NATO", short: "7.62 NATO", diameter: 0.308 },
  { id: "3006", name: ".30-06 Springfield", short: ".30-06", diameter: 0.308 },
  { id: "300wm", name: ".300 Winchester Magnum", short: "300 WM", diameter: 0.308 },
  { id: "300prc", name: ".300 PRC", short: "300 PRC", diameter: 0.308 },
  { id: "300blk", name: ".300 AAC Blackout", short: "300 BLK", diameter: 0.308 },
  { id: "762x39", name: "7.62x39", short: "7.62x39", diameter: 0.311 },
  { id: "338", name: ".338 Lapua Magnum", short: ".338", diameter: 0.338 },
  { id: "9mm", name: "9mm Luger", short: "9mm", diameter: 0.355 },
  { id: "40", name: ".40 S&W", short: ".40", diameter: 0.400 },
  { id: "10mm", name: "10mm Auto", short: "10mm", diameter: 0.400 },
  { id: "45acp", name: ".45 ACP", short: ".45 ACP", diameter: 0.451 },
  { id: "357", name: ".357 Magnum", short: ".357", diameter: 0.357 },
  { id: "38", name: ".38 Special", short: ".38", diameter: 0.357 },
];

const HINTS = [
  { dia: 0.308, re: /blackout|300\s*aac|300\s*blk/i, label: "300 BLK" },
  { dia: 0.308, re: /300\s*(win|wm)\b|300\s*wsm/i, label: "300 Win" },
  { dia: 0.308, re: /300\s*prc/i, label: "300 PRC" },
  { dia: 0.308, re: /30-06|30\/06/i, label: ".30-06" },
  { dia: 0.308, re: /7\.62\s*nato/i, label: "7.62 NATO" },
  { dia: 0.308, re: /\.308|308\s*win/i, label: ".308 Win" },
  { dia: 0.264, re: /6\.5\s*prc/i, label: "6.5 PRC" },
  { dia: 0.264, re: /6\.5\s*(creed|cm)\b/i, label: "6.5 CM" },
  { dia: 0.264, re: /6\.5\s*x\s*55|6,5\s*x\s*55/i, label: "6.5x55" },
  { dia: 0.264, re: /\.260|260\s*rem/i, label: ".260" },
  { dia: 0.284, re: /7\s*mm\s*prc|7mm\s*prc/i, label: "7mm PRC" },
  { dia: 0.284, re: /7mm-08|7mm\s*08/i, label: "7mm-08" },
  { dia: 0.284, re: /7mm\s*rem|7mm\s*mag/i, label: "7mm Rem Mag" },
];

function fnum(v) { const x = parseFloat(v); return Number.isFinite(x) ? x : null; }

export function cleanCartridge(raw) {
  if (!raw || typeof raw !== "object") return null;
  const dia = fnum(raw.diameter);
  if (dia == null || dia <= 0 || dia > 1) return null;
  const name = String(raw.name || "").trim().slice(0, 40);
  if (!name) return null;
  const out = { name, diameter: +dia.toFixed(3) };
  if (raw.id && CARTRIDGES.some(c => c.id === raw.id)) out.id = raw.id;
  return out;
}

export function softNote(gun, load) {
  const cart = gun && gun.cartridge;
  const dia = cart && fnum(cart.diameter);
  if (dia == null || !cart.name) return "";
  const text = [load && load.name, load && load.bulletName, load && load.ldProduct, load && load.ldNotes].filter(Boolean).join(" ");
  if (!text) return "";
  const near = HINTS.filter(h => Math.abs(h.dia - dia) < 0.0015);
  const mine = near.filter(h => h.re.test(cart.name));
  const theirs = near.filter(h => h.re.test(text));
  if (!mine.length || !theirs.length) return "";
  if (mine.some(m => theirs.some(t => t.label === m.label))) return "";
  return `name says ${theirs[0].label}`;
}
