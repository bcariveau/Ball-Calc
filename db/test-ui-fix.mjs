// Beta UI fix: selection bar, destination sheet, delete confirmation, row layout, icons.
// Fresh Playwright profile. Does not write the fixture files.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8791;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/bb-ui-fix";
fs.mkdirSync(ART, { recursive: true });
const preset = JSON.parse(fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8"));
const sessions = JSON.parse(fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8"));
preset.rifles[1].turret = "0.1mil";
sessions.push({
  id: "sess2", rifleId: "r1", loadId: "l2", date: "2026-11-09T16:00:00.000Z", source: "manual", notes: "other",
  shots: [{ id: "g", v: 2900, str: "st9", cold: true }],
  tg: { targets: [{ id: "t2", tpl: "grid1", dist: 100, du: "yd", u: "in" }], strings: [{ id: "st9", tid: "t2", aim: null, holes: [], asFired: { rifleId: "r1", opticId: "o1", loadId: "l2", optic: { id: "o1", opTurret: "0.1mil" }, recipe: { loadName: "Load A2", gunName: "Rifle A" } } }], cur: "st9", mark: false },
});
for (let i = 0; i < 10; i++) sessions[0].shots.push({ id: "p" + i, v: 2690 + i, str: "st1" });

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, hasTouch: true });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => { await d.accept(); });
let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };

async function boot() {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "dope", round: true, values: {} }));
    await new Promise((res) => { const d = indexedDB.deleteDatabase("bcalc-db"); d.onsuccess = d.onerror = d.onblocked = () => res(); });
    await new Promise((res, rej) => {
      const o = indexedDB.open("bcalc-db", 1);
      o.onupgradeneeded = () => o.result.createObjectStore("kv");
      o.onerror = () => rej(o.error);
      o.onsuccess = () => {
        const tx = o.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put(JSON.parse(sessions), "shotlog");
        tx.oncomplete = () => { o.result.close(); res(); };
      };
    });
  }, { preset: JSON.stringify(preset), sessions: JSON.stringify(sessions) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent.replace("™","") === "BallisticBench" && window.__bc?.log?.length === 2);
}

try {
  await boot();
  await page.click("#tabBtnGear");
  const adds = await page.locator("#rifleSel option, #loadSel option").allInnerTexts();
  ok(adds.includes("+ Add rifle…") && adds.includes("+ Add load…"), "gun and load pickers use plain Add text");
  ok(!adds.some((t) => t.includes("<svg")), "picker options do not contain an SVG");
  const menu = await page.locator("#rifleMenu").evaluate((el) => ({ svg: !!el.querySelector("svg.ic"), text: el.textContent.trim() }));
  ok(menu.svg && menu.text === "", "the gun menu button is a Lucide ellipsis");

  await page.click("#tabBtnDope");
  const step = await page.locator(".dcDist .stepper button").evaluateAll((els) => els.map((el) => ({ svg: !!el.querySelector("svg.ic"), text: el.textContent.trim(), h: el.querySelector("svg")?.getBoundingClientRect().height })));
  ok(step.length === 2 && step.every((b) => b.svg && b.text === "" && b.h <= 20), "Dope steppers use 18 px Lucide minus and plus");

  await page.click("#tabBtnLog");
  await page.click(".slItem");
  await page.waitForSelector("#slEditor.show");
  const help = await page.locator("#slAddHint .h1").evaluate((el) => getComputedStyle(el).whiteSpace);
  ok(help === "nowrap", "the add-shot help stays on one line");
  ok(await page.locator("#slAddHint .more").isHidden(), "the rest of the help starts hidden");
  await page.locator("#slAddHint").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/7-after.png" });
  await page.click("#slAddHelp");
  ok(!(await page.locator("#slAddHint .more").isHidden()) && /Remove keeps the shot/.test(await page.locator("#slAddHint").innerText()), "the ? button shows the rest of the help");

  const row = page.locator(".shot[data-id='a']");
  const rightmost = await row.evaluate((el) => {
    const del = el.querySelector("[data-f='del']");
    const delR = del.getBoundingClientRect().right;
    const others = [...el.querySelectorAll("button, input, .n, .mid")].filter((n) => n !== del);
    return { ok: others.every((n) => n.getBoundingClientRect().right <= delR + 1), color: getComputedStyle(del).color };
  });
  ok(rightmost.ok, "Delete is the rightmost control in the shot row at 360 px");
  const beforeN = await page.locator(".shot").count();
  await row.locator("[data-f='del']").click();
  ok(/Delete shot #/.test(await page.locator("#shotDelMsg").innerText()) && /can't be undone/.test(await page.locator("#shotDelMsg").innerText()), "Delete asks in a dialog");
  ok(await page.locator("#shotDelDlg svg.ic").count() > 0, "the delete dialog renders a Lucide icon");
  await page.click("#shotDelCancel");
  ok(await page.locator(".shot[data-id='a']").count() === 1, "Cancel keeps the shot");
  await row.locator("[data-f='del']").click();
  await page.click("#shotDelGo");
  ok(await page.locator(".shot[data-id='a']").count() === 0 && await page.locator(".shot").count() === beforeN - 1, "Delete removes that shot");

  await page.click("#shotSelBtn");
  await page.locator(".shot").first().locator(".v").click();
  ok(await page.locator(".shotCk:checked").count() === 1, "tapping the row selects it");
  await page.locator(".shot").first().locator(".v").click();
  ok(await page.locator(".shotCk:checked").count() === 0, "tapping the row again clears it");
  ok(await page.locator(".shot .tg, .shot [data-f='del'], .shot .noteBtn").count() === 0, "Remove, Delete, and tags are hidden while selecting");
  await page.locator(".shotCk").nth(0).check();
  await page.locator(".shotCk").nth(1).check();
  ok(await page.locator("#shotSplit").isHidden() === false && await page.locator("#shotSplit").isDisabled(), "Split is disabled until exactly one shot is selected");
  await page.locator(".shotCk").nth(1).uncheck();
  const splitLabel = await page.locator("#shotSplit").innerText();
  ok(/^Split from #\d+$/.test(splitLabel) && !(await page.locator("#shotSplit").isDisabled()), "one selected shot enables Split from #N");
  ok((await page.locator("#shotMoveOpen").innerText()) === "Move 1 shot", "one shot uses the singular move label");
  await page.screenshot({ path: ART + "/5-after.png" });
  await page.locator(".shotCk").nth(1).check();
  ok((await page.locator("#shotMoveOpen").innerText()) === "Move 2 shots", "more than one shot uses the plural");
  const bar0 = await page.locator("#shotSelBar").boundingBox();
  await page.locator("#slEdScroll").evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const bar1 = await page.locator("#shotSelBar").boundingBox();
  ok(bar1 && Math.abs(bar0.y - bar1.y) < 2 && bar1.y + bar1.height <= 742, "the selection bar stays at the bottom while the list scrolls");
  await page.screenshot({ path: ART + "/2-after.png" });
  await page.locator(".shot").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: ART + "/3-after.png" });

  await page.click("#shotMoveOpen");
  await page.selectOption("#shotDestKind", "existing");
  ok(await page.locator("#shotSplit").isHidden(), "Split is hidden for an existing string");
  const labels = await page.locator(".destPick").allInnerTexts();
  ok(labels.some((t) => /^This session · String \d+$/.test(t)), "this session's strings lead with This session");
  ok(labels.some((t) => /^Rifle A · Load A2 — String \d+ · /.test(t)), "another session leads with gun and load");
  const fit = await page.locator(".destPick").evaluateAll((els) => els.every((el) => {
    const s = getComputedStyle(el);
    return s.whiteSpace === "normal" && s.textOverflow !== "ellipsis" && el.scrollWidth <= el.clientWidth + 2 && el.getBoundingClientRect().width > 300;
  }));
  ok(fit, "destination rows are full width and not truncated at 360 px");
  await page.screenshot({ path: ART + "/4-after.png" });
  await page.setViewportSize({ width: 412, height: 740 });
  const fit412 = await page.locator(".destPick").evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth + 2 && el.getBoundingClientRect().width > 340));
  ok(fit412, "destination rows are not truncated at 412 px");
  await page.setViewportSize({ width: 360, height: 740 });

  await page.click(".destPick[data-dest='sess1::st2']");
  const note = await page.locator("#shotDestNote").innerText();
  ok(note.includes("Rifle B has no scope saved, so clicks use its current turret (0.1 mil). Add a scope in Gear to fix."), "a missing optic names the current turret");
  ok(await page.locator("#shotDestSheet svg.ic").count() > 0 && !(await page.locator("#shotDestSheet").innerText()).includes("<svg"), "the sheet renders Lucide icons");
  await page.screenshot({ path: ART + "/6-after.png" });
  await page.click("#shotMoveGo");
  await page.waitForSelector("#toast.show");
  const toast = await page.locator("#toast").innerText();
  ok(/^Moved 2 shots to Rifle B · String 2\./.test(toast.trim()), "the toast is short and past tense");
  const covered = await page.evaluate(() => {
    const t = document.getElementById("toast").getBoundingClientRect();
    return [...document.querySelectorAll("#slShots .shot")].some((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 2 || r.bottom < 0 || r.top > innerHeight) return false;
      return !(t.bottom <= r.top || t.top >= r.bottom || t.right <= r.left || t.left >= r.right);
    });
  });
  ok(!covered, "the toast does not cover the shot list");
  if (await page.locator("#shotSelBtn").isVisible()) await page.click("#shotSelBtn");
  await page.click("#shotMoveOpen");
  ok(await page.locator("#shotDestSheet svg.ic").count() > 0, "Lucide icons still render in the sheet after a move");

  const glyphs = await page.evaluate(() => [...document.querySelectorAll("button")].map((b) => (b.innerText || "").trim()).filter((t) => t === "⋯" || t === "−" || t === "+" || t === "..."));
  ok(!glyphs.length, "no button is labeled with a text glyph");
  ok(!pageErrors.length, "no page errors: " + pageErrors.join(" | "));
  console.log("PASS ui-fix", asserts);
} finally {
  await browser.close();
  server.kill();
}
