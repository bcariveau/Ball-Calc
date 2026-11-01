// Round 3.1: an optic that changes gun loses its Up travel (undo restores it); detach/replace/duplicate; one-tap “✓ Confirm zero” on the Dope card.
import { chromium } from "playwright"; import assert from "assert/strict";
const URL_ = "http://localhost:8765/ballistic-calculator.html", OUT = "/workspace/ballistic-calculator/";
const b = await chromium.launch(); const errs = []; let pass = 0;
const ok = (name, cond, extra = "") => { assert.ok(cond, name + " " + extra); pass++; console.log("✓", name, extra); };
const near = (a, b2, t) => Math.abs(a - b2) <= t;
// round-2 shaped data: optics without opUp, a third gun with no optic
const SEED = { version: 2, rifles: [
  { id: "r1", name: "6.5 CM", gunKind: "rifle", sightHeight: "1.75", zero: "100", twist: "8", barrel: "24", turret: "0.1mil", opticId: "o1", lastLoadId: "l1",
    loads: [{ id: "l1", name: "140 ELD-M", bulletName: "Hornady 140gr ELD-M", bc: "0.326", drag: "G7", weight: "140", diameter: "0.264", mv: "2710", length: "1.390", mvSource: "measured", ldKind: "hand" }] },
  { id: "r2", name: "308 Win", gunKind: "rifle", sightHeight: "1.6", zero: "100", twist: "10", barrel: "22", turret: "0.25moa", opticId: "o2", lastLoadId: "l2",
    loads: [{ id: "l2", name: "175 SMK", bc: "0.243", drag: "G7", weight: "175", diameter: "0.308", mv: "2600", length: "1.240", mvSource: "measured", ldKind: "factory" }] },
  { id: "r3", name: "Tikka 6mm", gunKind: "rifle", sightHeight: "1.5", zero: "100", twist: "7.5", barrel: "24", lastLoadId: "l3",
    loads: [{ id: "l3", name: "108 ELD-M", bc: "0.270", drag: "G7", weight: "108", diameter: "0.243", mv: "2950", length: "1.250", mvSource: "measured", ldKind: "hand" }] }],
  optics: [{ id: "o1", name: "Razor HD", opTurret: "0.1mil", opTurretV: "", opTurretU: "mil", opReticle: "mil", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.75", opWTravel: "", opTrack: "" },
           { id: "o2", name: "308 scope", opTurret: "0.25moa", opTurretV: "", opTurretU: "mil", opReticle: "moa", opFP: "FFP", opMag: "", opTurn: "", opTravel: "", opCant: "", opSH: "1.6", opWTravel: "", opTrack: "" },
           { id: "o3", name: "Spare Vortex", opTurret: "0.1mil", opTurretV: "", opTurretU: "mil", opReticle: "mil", opFP: "SFP", opMag: "12", opTurn: "10", opTravel: "30", opCant: "", opSH: "", opWTravel: "", opTrack: "" }],
  opticsMig: 1, ranges: [], lastRifleId: "r1", lastRangeId: null };
const SETTINGS = { ang: "MIL", view: "dope", values: { target: "1000", maxRange: "1000", step: "100", windSpeed: "10", windDir: "90", temp: "59", humidity: "0", altitude: "0", pressure: "", shotAngle: "0" } };
let WX = { w: 8, g: 14 };
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, permissions: ["geolocation"], geolocation: { latitude: 44.98, longitude: -93.27 } });
await ctx.addInitScript(`if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.clear();
  localStorage.setItem("bcalc.presets.v1", ${JSON.stringify(JSON.stringify(SEED))}); localStorage.setItem("bcalc.settings.v1", ${JSON.stringify(JSON.stringify(SETTINGS))}); }`);
await ctx.route("https://api.open-meteo.com/v1/forecast**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: 260,
  current: { temperature_2m: 59, relative_humidity_2m: 40, wind_speed_10m: WX.w, wind_direction_10m: 270, wind_gusts_10m: WX.g, surface_pressure: 984 } }) }));
await ctx.route("https://api.open-meteo.com/v1/elevation**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ elevation: [260] }) }));
const p = await ctx.newPage();
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
let promptAns = null; p.on("dialog", d => d.type() === "prompt" ? d.accept(promptAns ?? d.defaultValue()) : d.accept());
const ready = () => p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done") && !document.getElementById("dopeCard").classList.contains("stale"), null, { timeout: 30000 });
const settle = async () => { await p.waitForTimeout(350); await ready(); };
const setv = async (id, v) => { await p.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, [id, String(v)]); };
const menu = async (k, item) => { await p.click(`#${k}Menu`); await p.waitForSelector("#pkMenu.show"); await p.click(`#${item}`); await p.waitForTimeout(80); };
const txt = s => p.textContent(s);
const nums = s => (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);
const gun = async id => { await p.selectOption("#rifleSel", id); await p.waitForTimeout(250); };
const R = () => p.evaluate(() => window.__bc.P.rifles.map(r => ({ id: r.id, o: r.opticId || null, z: r.zeroUnconf ? r.zeroUnconf.why : null })));
const zOf = async id => (await R()).find(r => r.id === id);
const lum = h => { const m = h.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map(x => x / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const cr = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((m, k) => k - m); return (x + 0.05) / (y + 0.05); };
const colors = sels => p.evaluate(sels => { const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(.*, 0\)$/.test(c) && c !== "transparent") return c; } return getComputedStyle(document.body).backgroundColor; };
  return sels.flatMap(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent || getComputedStyle(e).position === "fixed").map(e => [s, getComputedStyle(e).color, bgOf(e)])); }, sels);
// visible text that is cut off (ellipsis / overflow) or doesn't fit its input/select
const cutScan = () => p.evaluate(() => { const c = document.createElement("canvas").getContext("2d"), res = [];
  for (const e of document.querySelectorAll("main *")) { if (!e.offsetParent || e.closest(".ovl") || e.id === "status") continue; const s = getComputedStyle(e);
    if (e.tagName === "SELECT" || e.tagName === "INPUT" && !["checkbox", "radio", "range", "hidden"].includes(e.type)) {
      const tx = e.tagName === "SELECT" ? e.selectedOptions[0]?.text || "" : e.value || e.placeholder; c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const extra = e.tagName === "SELECT" ? 16 : 0, avail = e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - extra;
      if (c.measureText(tx).width > avail + 1) res.push(`${e.id} "${tx}" ${Math.round(c.measureText(tx).width)}>${Math.round(avail)}`);
    } else if ((s.textOverflow === "ellipsis" || s.overflow === "hidden" || s.whiteSpace === "nowrap") && e.scrollWidth > e.clientWidth + 1 && e.textContent.trim() && !e.matches("canvas"))
      res.push(`${e.id || e.className} "${e.textContent.trim().slice(0, 30)}" ${e.scrollWidth}>${e.clientWidth}`);
  } return res; });
await p.goto(URL_); await ready();
await p.evaluate(async () => { window.__B = await import("https://cdn.jsdelivr.net/npm/js-ballistics@3/dist/index.js"); });
const reqMil = () => p.evaluate(() => -window.__bc.lastRun.tgt.dropAngle.In(window.__B.Angular.MRad));
const ts = () => p.evaluate(() => { const t = window.__bc.turretSpec(); return { up: t.up, set: !!t.upSet }; });
const op = id => p.evaluate(id => { const o = window.__bc.P.optics.find(x => x.id === id); return o && { up: o.opUp ?? "", re: !!o.opUpRe }; }, id);
const toastT = () => p.evaluate(() => document.getElementById("toast").textContent);
const undo = async () => { await p.click("#toastAct"); await p.waitForTimeout(250); };
const confirmAll = () => p.evaluate(() => { window.__bc.P.rifles.forEach(r => delete r.zeroUnconf); });

/* setup: r1 / Razor HD with measured up travel 9 (estimate would be 7) */
await p.click("#tabBtnGear"); await p.click("#opMore > summary"); await setv("opTravel", "14"); await setv("opUp", "9"); await p.waitForTimeout(150);
ok("setup: up travel 9 set on Razor HD", (await ts()).up === 9 && (await ts()).set && (await op("o1")).up === "9");

/* 1a) move via ⋯ › Attach (other gun's optic) */
await gun("r3"); await menu("optic", "opAttach"); await p.click('#opList .opItem[data-id="o1"]'); await p.waitForTimeout(250);
let t = await ts();
ok("move (Attach sheet): optic is on the new gun, both zeros flagged", (await zOf("r3")).o === "o1" && !(await zOf("r1")).o && /moved here/.test((await zOf("r3")).z || "") && /moved to/.test((await zOf("r1")).z || ""));
ok("move clears Up travel → estimate with “~” (min(14, 7) = 7)", (await op("o1")).up === "" && (await p.inputValue("#opUp")) === "" && t.up === 7 && !t.set, JSON.stringify(t));
await p.click("#opMore > summary").catch(() => {}); await p.evaluate(() => document.getElementById("opMore").open = true);
ok("note: re-measure up travel on this rifle (Gear)", (await p.isVisible("#opUpNote")) && /re-measure up travel on this rifle/.test(await txt("#opUpNote")));
ok("toast says it was cleared and offers Undo", /up travel cleared, re-measure on this rifle/.test(await toastT()) && (await p.isVisible("#toastAct")) && (await txt("#toastAct")) === "Undo", await toastT());
await p.click("#tabBtnDope"); await settle();
const w1 = await txt("#dcWarn");
ok("Dope: travel warning (if any) uses the estimate “~”", !/up travel/.test(w1) || /only ~7\.0 mil up travel/.test(w1), w1);
await p.click("#tabBtnGear");
await p.evaluate(() => { const t = document.getElementById("toast"); t.classList.add("show"); });   // keep the toast up for Undo
await undo(); await gun("r1");
t = await ts();
ok("Undo of the move: optic back on the old gun, Up travel 9 restored, flags restored (none)", (await zOf("r1")).o === "o1" && !(await zOf("r3")).o && !(await zOf("r1")).z && !(await zOf("r3")).z && (await op("o1")).up === "9" && !(await op("o1")).re && t.up === 9 && t.set, JSON.stringify([await R(), t]));
ok("after Undo the Gear form shows 9 and no note", (await p.inputValue("#opUp")) === "9" && !(await p.isVisible("#opUpNote")));

/* 1b) move via the optic picker on the other gun */
await gun("r3"); await p.selectOption("#opticSel", "o1"); await p.waitForTimeout(250);
ok("move (optic picker) also clears Up travel and notes it", (await zOf("r3")).o === "o1" && (await op("o1")).up === "" && (await op("o1")).re && (await p.isVisible("#opUpNote")));
await p.reload(); await ready(); await p.click("#tabBtnGear"); await p.evaluate(() => document.getElementById("opMore").open = true);
ok("note survives a reload until re-measured", (await p.isVisible("#opUpNote")) && (await p.evaluate(() => window.__bc.P.lastRifleId)) === "r3");
await setv("opUp", "8.5"); await p.waitForTimeout(120);
ok("entering a new value hides the note", !(await p.isVisible("#opUpNote")) && (await ts()).up === 8.5 && (await ts()).set);
await p.waitForTimeout(100); await gun("r1"); await gun("r3");
ok("new value saved, note gone for good", (await op("o1")).up === "8.5" && !(await op("o1")).re);
// move back for the rest
await gun("r1"); await p.selectOption("#opticSel", "o1"); await p.waitForTimeout(250); await confirmAll();
ok("moving back clears it again", (await zOf("r1")).o === "o1" && (await op("o1")).up === "");
await setv("opUp", "9"); await p.waitForTimeout(100); await gun("r3"); await gun("r1");

/* 1c) duplicate doesn't carry Up travel */
const n0 = await p.evaluate(() => window.__bc.P.optics.length);
await menu("optic", "opDup"); await p.waitForTimeout(150);
const dup = await p.evaluate(() => window.__bc.P.optics.at(-1));
ok("duplicate: copy has no Up travel, original keeps 9", (await p.evaluate(() => window.__bc.P.optics.length)) === n0 + 1 && dup.name === "Razor HD (copy)" && dup.opUp === "" && !dup.opUpRe && dup.opTravel === "14" && (await op("o1")).up === "9");

/* 1d) new optic copied from the current one doesn't carry it */
promptAns = "Razor Gen3"; await menu("optic", "opNew"); await p.waitForTimeout(200);
const nw = await p.evaluate(() => window.__bc.curOptic());
ok("new optic (copied specs, replaces Razor HD): no Up travel on either", nw.name === "Razor Gen3" && nw.opUp === "" && nw.opTravel === "14" && (await op("o1")).up === "" && /changed from/.test((await zOf("r1")).z || ""));

/* 1e) replace: the optic taken off loses it */
await p.selectOption("#opticSel", "o1"); await p.waitForTimeout(200); await setv("opUp", "9"); await p.waitForTimeout(100);
await p.selectOption("#opticSel", "o3"); await p.waitForTimeout(200);
ok("replace: removed optic's Up travel cleared, new one's untouched", (await op("o1")).up === "" && !(await op("o1")).re && (await zOf("r1")).o === "o3");

/* 1f) detach clears it (no stale value on an unattached optic) */
await p.selectOption("#opticSel", "o1"); await p.waitForTimeout(200); await setv("opUp", "9"); await p.waitForTimeout(100); await confirmAll();
await menu("optic", "opDetach");
ok("detach clears Up travel and says so; zero flagged as before", (await op("o1")).up === "" && /removed/.test((await zOf("r1")).z || "") && /up travel was cleared/.test(await toastT()), await toastT());
await menu("optic", "opAttach"); await p.click('#opList .opItem[data-id="o1"]'); await p.waitForSelector("#zpDlg.show"); await p.click("#zpNo"); await p.waitForTimeout(150);

/* 2) one-tap Confirm zero on the Dope card */
ok("setup: r1 zero not confirmed", /not zeroed/.test((await zOf("r1")).z || ""));
await p.click("#tabBtnDope"); await settle();
const zb = await p.evaluate(() => { const b2 = document.getElementById("dcZeroOk"); if (!b2) return null; const r = b2.getBoundingClientRect(); return { t: b2.textContent, h: r.height, w: r.width, in: !!b2.closest("#dopeCard") }; });
ok("Dope card warning has “✓ Confirm zero” button ≥ 44 px tall", zb && zb.t === "✓ Confirm zero" && zb.h >= 44 && zb.in && (await txt("#dcWarn")).includes("Zero not confirmed"), JSON.stringify(zb));
for (const w of [360, 412]) { await p.setViewportSize({ width: w, height: 915 }); await p.waitForTimeout(120);
  ok(`${w}px: warning + button fit, no sideways scroll`, await p.evaluate(w => { const b2 = document.getElementById("dcZeroOk").getBoundingClientRect(), c = document.getElementById("dopeCard").getBoundingClientRect(); return document.documentElement.scrollWidth <= w && b2.left >= c.left && b2.right <= c.right; }, w)); }
await p.evaluate(() => { document.getElementById("toast").classList.remove("show"); document.getElementById("dopeCard").scrollIntoView({ block: "start" }); window.scrollBy(0, -10); }); await p.waitForTimeout(200);
await p.screenshot({ path: OUT + "screenshot-r3-1-dope-confirm.png" });
const zc = [];
for (const th of ["dark", "light", "od", "fde", "night"]) {
  await p.click("#themeBtn"); await p.click(`#themeBar button[data-t="${th}"]`); await p.click("#themeBtn"); await p.waitForTimeout(80);
  const rows = await colors(["#dcZeroOk", "#dcWarn .zcw"]);
  const low = rows.map(([s, c, bg]) => [s, cr(c, bg)]).filter(([, r]) => r < 4.5);
  ok(`theme ${th}: Confirm zero button + warning AA ≥ 4.5:1`, rows.length === 2 && low.length === 0, rows.map(([s, c, bg]) => s + " " + cr(c, bg).toFixed(2)).join(", "));
}
await p.click("#themeBtn"); await p.click('#themeBar button[data-t="dark"]'); await p.click("#themeBtn");
await p.click("#dcZeroOk"); await p.waitForTimeout(200);
ok("tap clears the flag right there (card + Gear), same as the Gear button", !(await zOf("r1")).z && !(await txt("#dcWarn")).includes("Zero not confirmed") && !(await p.$("#dcZeroOk")) && /Zero confirmed for/.test(await toastT()) && await p.evaluate(() => document.getElementById("zeroFlag").hidden));
ok("cleared flag is saved", await p.evaluate(() => !JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles.find(r => r.id === "r1").zeroUnconf));
console.log("ERRORS", JSON.stringify(errs));
console.log(pass + " checks passed"); await b.close();
if (errs.length) process.exit(1);
