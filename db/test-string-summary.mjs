// Strings for a load: summary rows, drill-down, and a cross-session overlay. Beta only.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8866;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("dialog", async (d) => { await d.accept(); });
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

try {
  await page.goto(`http://127.0.0.1:${PORT}/beta.html`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    localStorage.setItem("bcalc.presets.v1", preset);
    localStorage.setItem("bcalc.settings.v1", JSON.stringify({ ang: "MIL", view: "dope", tab: "gear", round: true, values: {} }));
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
  }, { preset: presetRaw, sessions: sessionRaw });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");
  await page.evaluate(() => {
    const log = window.__bc.log;
    const a = log.find((s) => s.id === "sess1");
    a.recipe = { ...(a.recipe || {}), ldKind: "hand", ldPowder: "H4350", ldCharge: "41.5" };
    a.tg.strings[0].asFired.recipe = { ...(a.tg.strings[0].asFired.recipe || {}), ldCharge: "41.5", ldPowder: "H4350" };
    a.tg.strings[0].holes.push({ id: "h1b", x: -0.4, y: 0.6 });
    const st2 = a.tg.strings[1];
    st2.asFired.rifleId = "r1";
    st2.asFired.loadId = "l1";
    st2.aim = { x: 0, y: 0 };
    st2.holes = [{ id: "hx", x: 0.8, y: 0.3 }, { id: "hy", x: -0.5, y: 0.9 }];
    log.push({
      id: "sess2", rifleId: "r1", loadId: "l1", date: "2026-07-02T15:00:00.000Z", source: "manual", notes: "July", wx: {},
      recipe: { ldKind: "hand", ldPowder: "H4350", ldCharge: "41.5", loadName: "Load A" },
      shots: [{ id: "p", v: 2720, str: "st9" }, { id: "q", v: 2740, str: "st9" }],
      tg: {
        targets: [{ id: "t9", tpl: "grid1", dist: 300, du: "yd", u: "in" }],
        strings: [{ id: "st9", tid: "t9", aim: { x: 0, y: 0 }, holes: [{ id: "h9", x: 1.2, y: -0.4 }, { id: "h9b", x: 0.2, y: 0.8 }], asFired: { rifleId: "r1", loadId: "l1", recipe: { ldCharge: "41.5", ldPowder: "H4350" } } }],
        cur: "st9",
      },
    });
    log.push({
      id: "sessB", rifleId: "r2", loadId: "l3", date: "2026-08-01T15:00:00.000Z", source: "manual", notes: "other rifle", wx: {},
      shots: [{ id: "z", v: 2600, str: "stb" }],
      tg: {
        targets: [{ id: "tb", tpl: "grid1", dist: 100, du: "yd", u: "in" }],
        strings: [{ id: "stb", tid: "tb", aim: { x: 0, y: 0 }, holes: [{ id: "hb", x: 0.5, y: 0.5 }], asFired: { rifleId: "r2", loadId: "l1", recipe: { ldCharge: "41.5" } } }],
        cur: "stb",
      },
    });
  });
  await page.click("#tabBtnGear");
  await page.click('#gearSwitch button[data-sec="load"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Load A" }).first().click();
  await page.locator("#bc").dispatchEvent("input");
  const moreOpen = await page.locator("#loadDetails").evaluate((el) => el.open);
  const nested = await page.evaluate(() => ({ recipe: document.getElementById("recipeDetails").open, mv: document.getElementById("mvEstBox").open, sum: !document.getElementById("loadDetails").open && !document.getElementById("loadMoreSum").hidden }));
  ok(!moreOpen && !nested.recipe && !nested.mv, "More, load data, and the MV estimate start collapsed");
  await page.locator("#loadDetails").screenshot({ path: ART + "/loads-layout-closed.png" });
  await page.locator("#loadDetails > summary").screenshot({ path: ART + "/v2-loads-more-closed.png" });
  await page.click("#loadDetails > summary");
  const opened = await page.evaluate(() => {
    const sum = document.getElementById("loadMoreSum");
    const cs = getComputedStyle(sum);
    return { open: document.getElementById("loadDetails").open, hidden: cs.display === "none", recipeInMore: !sum.textContent.includes("H4350") && !sum.textContent.includes("41.5") };
  });
  ok(opened.open && opened.hidden, "the More summary hides once More is open");
  await page.waitForTimeout(200);
  await page.locator("#loadDetails > summary").screenshot({ path: ART + "/loads-layout-open.png" });
  await page.locator("#loadDetails > summary").screenshot({ path: ART + "/v2-loads-more-open.png" });
  const chevrons = await page.evaluate(() => [...document.querySelectorAll("details")].flatMap((details) => {
    const svg = details.querySelector(":scope > summary svg.ic.chev");
    if (!svg) return [];
    const read = () => {
      const path = [...svg.querySelectorAll("path")].find((p) => getComputedStyle(p).display !== "none");
      return { d: path && path.getAttribute("d"), tr: getComputedStyle(svg).transform };
    };
    const was = details.open;
    details.open = false;
    const closed = read();
    details.open = true;
    const opened = read();
    details.open = was;
    return [{ id: details.id || (details.querySelector("summary") && details.querySelector("summary").textContent.slice(0, 28)), closed, opened }];
  }));
  ok(chevrons.length >= 6 && chevrons.every((c) => c.closed.d === "m6 9 6 6 6-6" && c.closed.tr === "none" && c.opened.d === "m6 15 6-6 6 6" && c.opened.tr === "none"), "every details chevron is down when closed and up when open, with no rotation: " + chevrons.map((c) => c.id + " " + c.closed.d + "/" + c.opened.tr).join("; "));
  const rows = await page.locator("#ldStrList .ldStr").allInnerTexts();
  ok(rows.length === 4 && rows[0].includes("S1") && rows[0].includes("41.5"), "one summary row per string for this load, newest first, with the charge");
  ok(rows.some((t) => /fps/.test(t)) && rows.some((t) => /hole|″|in/.test(t) || /\d/.test(t)), "rows include velocity and a group when holes exist");
  await page.locator("#ldStrings").screenshot({ path: ART + "/strings-for-load.png" });
  await page.locator("#ldStrList .ldStr").first().click();
  const detail = await page.locator("#ldStrDetail").innerText();
  ok(/fps/.test(detail) && /Back to strings/.test(detail) && /Open overlay/.test(detail), "a row drills into that string's shots");
  await page.locator("#ldStrDetail").screenshot({ path: ART + "/string-detail.png" });
  await page.click("#ldStrBack");
  await page.click("#ldCompare");
  await page.waitForSelector("#cmpSheet.show");
  const cmp = await page.evaluate(() => ({
    note: document.getElementById("cmpNote").textContent,
    rifles: [...document.getElementById("cmpRifle").options].map((o) => o.textContent),
    chips: document.querySelectorAll("#cmpChips .sc").length,
    svg: !!document.querySelector("#cmpBoard svg"),
    legend: document.getElementById("cmpLeg").innerText,
  }));
  ok(cmp.svg && cmp.chips >= 2 && /rifle/i.test(cmp.note) && /fps/.test(cmp.legend), "the overlay compares this rifle's strings and lists a stat per string");
  ok(cmp.rifles.includes("Rifle B") && cmp.rifles.includes("Rifle A"), "another rifle that used this load can be chosen");
  const colorsOf = (svgSel, legSel) => page.evaluate(({ svgSel, legSel }) => {
    const svg = document.querySelector(svgSel);
    const legs = [...document.querySelectorAll(legSel + " i")];
    return [...svg.querySelectorAll("g.hole")].map((h) => {
      const ms = h.querySelector(".ms");
      const cls = [...ms.classList].find((c) => /^s[1-6]$/.test(c));
      const circle = ms.querySelector("circle");
      const cs = getComputedStyle(circle);
      const sw = legs.find((i) => i.classList.contains(cls));
      return { fill: cs.fill, stroke: cs.stroke, dash: cs.strokeDasharray, bg: sw ? getComputedStyle(sw).backgroundColor : "" };
    });
  }, { svgSel, legSel });
  const crossColors = await colorsOf("#cmpBoard svg", "#cmpLeg");
  ok(crossColors.length >= 2 && crossColors.every((h) => h.fill === h.bg && h.stroke === h.bg && (h.dash === "none" || h.dash === "0px")), "cross-session holes use each string's legend color and are not dashed");
  await page.locator("#cmpSheet").screenshot({ path: ART + "/compare-cross-session.png" });
  await page.locator("#cmpSheet").screenshot({ path: ART + "/v2-compare-cross-session.png" });
  await page.selectOption("#cmpRifle", "r2");
  const other = await page.locator("#cmpChips").innerText();
  ok(/S1/.test(other), "choosing the other rifle shows its strings for this load");
  await page.click("#cmpClose");
  await page.click("#gearBack");
  await page.click("#tabBtnLog");
  await page.waitForSelector("#slList .slItem");
  await page.locator("#slList .slItem").filter({ hasText: "fixture" }).click();
  await page.waitForSelector("#slEditor.show");
  await page.waitForSelector("#slTgSvg");
  const liveColors = await colorsOf("#slTgSvg", "#slTgLeg");
  ok(liveColors.length >= 2 && liveColors.every((h) => h.fill === h.bg && h.stroke === h.bg && (h.dash === "none" || h.dash === "0px")), "in-session holes use each string's legend color and are not dashed");
  await page.locator("#slTgView").screenshot({ path: ART + "/v2-compare-in-session.png" });
  await page.evaluate(() => document.getElementById("slCompare").scrollIntoView({ block: "center" }));
  await page.click("#slCompare");
  await page.waitForSelector("#cmpSheet.show");
  ok(await page.locator("#cmpBoard svg").count() === 1, "the session compare button opens the same overlay");
  await page.click("#cmpClose");
  await page.click("#tgMarkBtn");
  await page.waitForSelector("#tgEd.show");
  await page.click("#tgSum");
  await page.locator("#tgDialBox").screenshot({ path: ART + "/dial-row.png" });
  await page.click("#tgEdDone");
  const csv = "SHOT #,SPEED (FPS)\n1,2700\n2,2710\n";
  await page.setInputFiles("#slFile", { name: "sample.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.waitForSelector("#slImport.show");
  const impRaw = await page.evaluate(() => {
    const bad = [];
    const root = document.getElementById("slImport");
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      const t = node.nodeValue || "";
      if (t.includes("<svg") || t.includes("<path")) bad.push(t.trim().slice(0, 80));
    }
    return bad;
  });
  ok(!impRaw.length, "the import sheet has no raw icon markup: " + impRaw.join(" | "));
  await page.waitForFunction(() => !document.getElementById("toast").classList.contains("show"));
  await page.locator("#slImport").screenshot({ path: ART + "/v2-import-sheet.png" });
  await page.click("#slImpClose");
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  ok(keys.every((k) => k === "bcalc.presets.v1" || k === "bcalc.settings.v1"), "the string list adds no storage key");
  console.log("PASS string-summary", n);
} catch (e) {
  console.error("FAIL string-summary", e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
