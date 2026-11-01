// Browser test: mocks navigator.bluetooth with a fake Rangecraft, connects, feeds packets, checks the live session + dedupe + disconnect.
import { chromium } from "playwright";
const hex = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));
const A = hex("80 1C 22 01 26 10 31 20 27 50 04 50 D9 02 D9 02 D9 02 D9 02 00 00 00 00 00 00 E3 01 8D 03");
const B = hex("80 1C 22 02 26 10 31 20 33 31 05 07 C3 02 D9 02 C3 02 CE 02 16 00 1E 00 24 00 D4 01 7F 03");
const IDLE = hex("80 0D 21 0E 26 10 31 20 19 11 07 78 03 D9 0E");
const b = await chromium.launch(); const errs = [];
async function page(mock) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  if (mock) await ctx.addInitScript(() => {
    const mkChr = (init) => { const et = new EventTarget(); et.value = init; et.startNotifications = async () => et; et.stopNotifications = async () => et; et.readValue = async () => et.value; return et; };
    const notify = mkChr(null), batt = mkChr(new DataView(Uint8Array.of(87).buffer));
    const dev = new EventTarget(); dev.name = "ATHLONVPR1_060655"; dev.id = "x";
    dev.gatt = { connected: false, async connect() { this.connected = true; return this; }, disconnect() { this.connected = false; dev.dispatchEvent(new Event("gattserverdisconnected")); },
      async getPrimaryService(u) { if (u === "6e40ff01-b5a3-f393-e0a9-4174686c6f6e") return { getCharacteristic: async () => notify };
        if (u === "battery_service") return { getCharacteristic: async () => batt }; throw new DOMException("no", "NotFoundError"); } };
    window.__fake = { dev, send(bytes) { notify.value = new DataView(Uint8Array.from(bytes).buffer); notify.dispatchEvent(new Event("characteristicvaluechanged")); }, opts: null };
    Object.defineProperty(navigator, "bluetooth", { value: { requestDevice: async o => { window.__fake.opts = o; return dev; }, getDevices: async () => [] }, configurable: true });
  });
  else await ctx.addInitScript(() => { Object.defineProperty(navigator, "bluetooth", { value: undefined, configurable: true }); });
  const p = await ctx.newPage();
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
  await p.goto("http://localhost:8765/ballistic-calculator.html");
  await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
  await p.click("#tabBtnLog");   // radar lives on the Log tab
  return p;
}
// 1) no Web Bluetooth
let p = await page(false);
console.log("no-BT:", await p.isDisabled("#radarConnect"), "|", await p.textContent("#radarStatus"), "| one line visible:", await p.isVisible("#radarNo"), "| connect hidden:", !(await p.isVisible("#radarConnect")), "| details hidden:", !(await p.isVisible("#radarMore")));
// 2) mocked radar, no load yet → shots held
p = await page(true);
console.log("initial:", await p.textContent("#radarStatus"), "| setup details hidden until Connect:", !(await p.isVisible("#radarHint")));
await p.click("#radarConnect"); await p.waitForTimeout(200);
console.log("filters:", JSON.stringify(await p.evaluate(() => window.__fake.opts)));
console.log("connected:", await p.textContent("#radarStatus"), "| status shown:", await p.isVisible("#radarStatus"), "| disconnect visible:", await p.isVisible("#radarDisconnect"));
await p.evaluate(a => window.__fake.send(a), IDLE);
await p.evaluate(a => window.__fake.send(a), A); await p.waitForTimeout(200);
console.log("no-load pending:", await p.evaluate(() => window.__bc.radar.RD.pending.length), "|", await p.textContent("#radarStatus"));
const st = async () => (await p.innerText("#slStats")).replace(/\n/g, " ");
console.log("banner:", await p.isVisible("#shotBan"), (await p.textContent("#shotBan")).replace(/\s+/g, " ").trim());
console.log("editor open:", await p.isVisible("#slEditor"), "| src:", await p.inputValue("#slSource"), "| stats:", await st(), "| edRadar:", await p.textContent("#slEdRadar"), "| focus:", await p.evaluate(() => document.activeElement.id));
await p.evaluate(a => window.__fake.send(a), B); await p.waitForTimeout(150);
await p.evaluate(a => window.__fake.send(a), B); await p.evaluate(a => window.__fake.send(a), A); await p.waitForTimeout(150);   // resends → ignored
console.log("after B + 2 dupes:", await st(), "| shots:", JSON.stringify(await p.evaluate(() => window.__bc.log.filter(s => s.source === "bluetooth").map(s => s.shots))));
// split delivery of a new radar string (shot #1 again, new time) → new session
const C = [0x80,0x1C,0x22,0x01,0x26,0x10,0x31,0x20,0x41,0x05,0x04,0x50,0x00,0x03,0x00,0x03,0x00,0x03,0x00,0x03,0,0,0,0,0,0,0xE3,0x01,0x8D,0x03];
await p.evaluate(a => { window.__fake.send(a.slice(0, 20)); window.__fake.send(a.slice(20)); }, C); await p.waitForTimeout(200);
console.log("new string:", JSON.stringify(await p.evaluate(() => window.__bc.log.filter(s => s.source === "bluetooth").map(s => s.shots.map(x => x.v)))));
// unexpected drop → auto retry reconnects
await p.evaluate(() => { const d = window.__fake.dev; d.gatt.connected = false; d.dispatchEvent(new Event("gattserverdisconnected")); });
console.log("dropped:", await p.textContent("#radarStatus"));
await p.waitForTimeout(1900); console.log("after retry:", await p.textContent("#radarStatus"));
if (await p.isVisible("#slEdClose")) await p.click("#slEdClose"); await p.waitForTimeout(100);   // targets round: radar shots no longer open the editor (live banner instead)
// manual disconnect → Reconnect button
await p.click("#radarDisconnect"); await p.waitForTimeout(100);
console.log("manual off:", await p.textContent("#radarStatus"), "| reconnect:", await p.isVisible("#radarReconnect"), await p.textContent("#radarReconnect"));
await p.click("#radarReconnect"); await p.waitForTimeout(150); console.log("reconnected:", await p.textContent("#radarStatus"));
console.log("raw pkts:", await p.textContent("#radarRawN"));
await p.evaluate(() => { document.getElementById("radarRaw").open = true; document.getElementById("slSection").scrollIntoView(); }); await p.waitForTimeout(2500);
await p.screenshot({ path: "/workspace/ballistic-calculator/screenshot-radar.png" });
// reload: seen keys persist → resend of B not re-added
await p.reload(); await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
await p.click("#tabBtnLog");  // app always opens on Dope (round 2)
await p.click("#radarConnect"); await p.waitForTimeout(150); await p.evaluate(a => window.__fake.send(a), B); await p.waitForTimeout(150);
console.log("after reload resend B: editor open?", await p.isVisible("#slEditor"), "| bt sessions:", await p.evaluate(() => window.__bc.log.filter(s => s.source === "bluetooth").length));
console.log("ERRORS", JSON.stringify(errs));
await b.close();
