// Gear sections, archive flag, and the beta header mark. Fresh profile. Does not publish.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("/tmp/pw/node_modules/playwright");
const PORT = 8814;
const ROOT = "/workspace";
const ART = "/opt/cursor/artifacts/bb-gear";
fs.mkdirSync(ART, { recursive: true });
const presetRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-v2.json", "utf8");
const sessionRaw = fs.readFileSync(ROOT + "/db/fixtures/link-v3-sessions.json", "utf8");

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 250));
const browser = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => { if (d.type() === "prompt") await d.accept("Scratch"); else await d.accept(); });
let asserts = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); asserts++; };

function changedPaths(before, after, path = "") {
  const out = [];
  if (Object.is(before, after)) return out;
  if (before === null || after === null || typeof before !== "object" || typeof after !== "object") {
    out.push(path || "(root)");
    return out;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((v, i) => out.push(...changedPaths(v, after[i], path + "[" + i + "]")));
    return out;
  }
  for (const k of keys) out.push(...changedPaths(before[k], after[k], path ? path + "." + k : k));
  return out;
}

async function boot(url, preset, sessions) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ preset, sessions }) => {
    localStorage.clear();
    sessionStorage.clear();
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
  }, { preset, sessions });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("h1")?.textContent.replace("™", "") === "BallisticBench");
}
const presets = () => page.evaluate(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")));
const leaks = () => page.evaluate(() => {
  const bad = [];
  const hidden = (el) => { for (let n = el; n; n = n.parentElement) { if (n.hidden) return true; if (n.id === "tabGear" && n.dataset.gearview === "list" && n.contains(el) && el.closest("#gunPicker, #loadPicker, #rangePicker")) return true; } return false; };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    const t = node.nodeValue || "";
    if ((t.includes("<svg") || t.includes("<path")) && !hidden(node.parentElement)) bad.push(t.trim().slice(0, 80));
  }
  return bad;
});

try {
  const seeded = JSON.parse(presetRaw);
  seeded.opticsMig = 1;
  await boot(`http://127.0.0.1:${PORT}/beta.html`, JSON.stringify(seeded), sessionRaw);
  const header = await page.evaluate(() => {
    const h = document.querySelector("h1");
    const tm = h.querySelector("sup.tm");
    const head = document.getElementById("appHead");
    const kids = [...head.children].filter((el) => el.getClientRects().length).map((el) => el.getBoundingClientRect());
    const top = Math.min(...kids.map((r) => r.top));
    return {
      tm: tm && tm.textContent === "™" && tm.getAttribute("aria-hidden") === "true",
      title: document.title,
      oneLine: h.getClientRects().length === 1,
      sameRow: kids.every((r) => Math.abs(r.top - top) < 8),
      color: getComputedStyle(tm).color === getComputedStyle(h).color,
    };
  });
  ok(header.tm && header.title === "BallisticBench", "the beta header shows a superscript ™ and the title is unchanged");
  ok(header.oneLine && header.sameRow && header.color, "the header stays one row at 360 px and the mark matches the name color");
  await page.screenshot({ path: ART + "/after-header-tm.png" });

  await page.click("#tabBtnGear");
  await page.waitForSelector("#gearList .gearItem");
  const guns = await page.locator("#gearList .gearItem").allInnerTexts();
  ok(guns.some((t) => /Rifle A · 24" · 1:8 RH · Razor · Load A/.test(t)) && guns.some((t) => /Rifle B/.test(t)), "the firearm list names every saved gun");
  ok(guns.some((t) => /Last used/.test(t) && /Razor/.test(t)), "a firearm line links its optic, load, and last-used date");
  await page.screenshot({ path: ART + "/after-firearms.png" });

  await page.click('#gearSwitch button[data-sec="optic"]');
  const optics = await page.locator("#gearList .gearItem").allInnerTexts();
  ok(optics.length === 1 && /Razor/.test(optics[0]) && /On Rifle A/.test(optics[0]), "the optic list links the firearm that uses it");
  await page.screenshot({ path: ART + "/after-optics.png" });

  await page.click('#gearSwitch button[data-sec="load"]');
  const loads = await page.locator("#gearList .gearItem").allInnerTexts();
  ok(loads.length === 3 && loads.some((t) => /Load A2/.test(t)) && loads.some((t) => /On Rifle B · 1 string/.test(t)) && loads.some((t) => /On Rifle A · 1 string/.test(t)), "the load list includes every load and its string count");
  await page.screenshot({ path: ART + "/after-loads.png" });
  ok(!(await leaks()).length, "gear lists have no raw icon markup");

  await page.click('#gearSwitch button[data-sec="gun"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  await page.waitForSelector("#gunEss");
  const moreBox = await page.locator("#rifleDetails > summary").boundingBox();
  const tabBox = await page.locator("#tabBar").boundingBox();
  ok(moreBox && tabBox && moreBox.y >= 0 && moreBox.y + moreBox.height <= tabBox.y + 1, "the firearm More toggle sits above the tab bar on a 360px screen");
  ok(await page.locator("#rifleDetails").evaluate((el) => !el.open && !!el.querySelector("summary svg.ic.chev")), "firearm More starts closed and uses a Lucide chevron");
  ok(await page.locator("#zero").isVisible() && await page.locator("#barrel").isVisible() && await page.locator("#twist").isVisible() && await page.locator("#rifleSel").isVisible(), "name, zero, barrel, and twist stay up front");
  ok(!(await page.locator("#zTemp").isVisible()) && !(await page.locator("#rangeLat").isVisible()) && !(await page.locator("#sightHeight").isVisible()), "firearm More fields are hidden while More is closed");
  await page.screenshot({ path: ART + "/edit-screen.png" });
  await page.screenshot({ path: ART + "/more-closed.png" });
  await page.screenshot({ path: ART + "/after-edit-more-closed.png" });
  await page.locator("#rifleDetails > summary").click();
  ok(await page.locator("#zTemp").isVisible() && await page.locator("#rangeLat").isVisible() && (await page.locator("#sightHeight").count()) === 1, "opening More shows the rest of the firearm fields");
  await page.locator("#rifleDetails").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({ path: ART + "/more-open.png" });
  await page.screenshot({ path: ART + "/after-edit-more-open.png" });
  const hash = (name) => crypto.createHash("sha256").update(fs.readFileSync(ART + "/" + name)).digest("hex");
  ok(hash("more-closed.png") !== hash("more-open.png"), "the closed and open More screenshots are different images");

  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="optic"]');
  await page.locator("#gearList .gearItem").first().click();
  const opticMore = await page.locator("#opMore > summary").boundingBox();
  ok(opticMore && opticMore.y + opticMore.height <= tabBox.y + 1, "the optic More toggle sits above the tab bar");
  ok(await page.locator("#opTurret").isVisible() && !(await page.locator("#opReticle").isVisible()) && !(await page.locator("#opTrack").isVisible()), "an optic edit shows the turret and hides the other specs");
  await page.locator("#opMore > summary").click();
  ok(await page.locator("#opReticle").isVisible() && await page.locator("#opFP").isVisible() && await page.locator("#opSH").isVisible() && await page.locator("#opTrack").isVisible(), "optic More reveals every optic spec");
  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="load"]');
  await page.locator('#gearList .gearItem[data-id="l1"]').click();
  const loadMore = await page.locator("#loadDetails > summary").boundingBox();
  ok(loadMore && loadMore.y + loadMore.height <= tabBox.y + 1, "the load More toggle sits above the tab bar");
  ok(await page.locator("#bc").isVisible() && await page.locator("#mv").isVisible() && await page.locator("#drag").isVisible() && !(await page.locator("#weight").isVisible()) && !(await page.locator("#ldPowder").isVisible()), "a load edit shows BC, drag, and MV, with the rest closed");
  await page.locator("#loadDetails > summary").click();
  ok(await page.locator("#weight").isVisible() && await page.locator("#diameter").isVisible() && await page.locator("#length").isVisible() && await page.locator("#ldPowder").isVisible() && await page.locator("#ldCharge").isVisible() && await page.locator("#refMV").isVisible(), "load More reveals the remaining load and recipe fields");
  const fields = ["gunKind", "sightHeight", "zero", "twist", "barrel", "turret", "turretV", "turretU", "zTemp", "zPress", "zAlt", "zHum", "opTurret", "opTurretV", "opTurretU", "opReticle", "opFP", "opMag", "opTurn", "opTravel", "opCant", "opUp", "opSH", "opWTravel", "opTrack", "bc", "drag", "weight", "diameter", "mv", "length", "mvSource", "refMV", "refBarrel", "fpsPerInch", "bulletId", "bulletName", "bcBands", "useBands", "ptSens", "mvTemp", "tipLen", "trued", "ldKind", "ldPowder", "ldCharge", "ldPrimer", "ldCOAL", "ldCBTO", "ldJump", "ldCase", "ldFired", "ldTrim", "ldPrep", "ldMaker", "ldProduct", "ldLot", "ldNotes", "rangeLat", "rangeLon"];
  const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), fields);
  ok(!missing.length, "every gear field is still in the form: " + missing.join(", "));
  await page.click("#gearBack");
  await page.click('#gearSwitch button[data-sec="gun"]');

  const beforeRecall = await page.evaluate(() => {
    const b = window.__bc.P.rifles.find((r) => r.id === "r2");
    return b.lastLoadId;
  });
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle A" }).click();
  await page.click("#gearBack");
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle B" }).click();
  const recalled = await page.evaluate(() => {
    const b = window.__bc.P.rifles.find((r) => r.id === "r2");
    return { last: b.lastLoadId, current: document.querySelector("#loadSel").value };
  });
  ok(recalled.current === beforeRecall && recalled.last === beforeRecall, "selecting a firearm still recalls its last load " + JSON.stringify({ beforeRecall, recalled }));

  await page.click('#gearSwitch button[data-sec="gun"]');
  await page.locator("#gearList .gearItem").filter({ hasText: "Rifle B" }).click();
  const snap = await presets();
  await page.click("#rifleMenu");
  await page.click("#rifleDel");
  await page.waitForSelector("#gearDlg:not([hidden])");
  const blocked = await page.locator("#gearDlgMsg").innerText();
  ok(/can’t be deleted|can't be deleted/.test(blocked) && /Archive/.test(await page.locator("#gearDlgGo").innerText()), "a used firearm cannot be deleted");
  await page.screenshot({ path: ART + "/after-delete-blocked.png" });
  await page.click("#gearDlgCancel");
  await page.click("#gearArchive");
  await page.waitForSelector("#gearDlg:not([hidden])");
  await page.screenshot({ path: ART + "/after-archive-confirm.png" });
  await page.click("#gearDlgGo");
  await page.waitForFunction(() => !document.querySelector("#rifleSel option[value='r2']"));
  const archived = await presets();
  const paths = changedPaths(snap, archived);
  ok(archived.rifles.find((r) => r.id === "r2").archived === true, "Archive writes archived:true on that firearm");
  ok(paths.every((p) => p === "rifles[1].archived" || p === "lastRifleId" || p.startsWith("rifles[1].")), "archiving does not change other records: " + paths.join(", "));
  ok(!(await page.locator("#gearList").innerText()).includes("Rifle B"), "the archived firearm leaves the active list");
  await page.click("#tabBtnLog");
  ok((await page.locator("#slList").innerText()).includes("Rifle B"), "history still shows the archived firearm by name");
  await page.click("#tabBtnGear");
  await page.click("#gearArch");
  ok((await page.locator("#gearList").innerText()).includes("Rifle B") && (await page.locator("#gearList").innerText()).includes("Unarchive"), "the Archived filter lists it with Unarchive");
  await page.screenshot({ path: ART + "/after-archived.png" });
  const beforeUn = await presets();
  await page.locator("#gearList .unarch").click();
  await page.waitForFunction(() => !!document.querySelector("#rifleSel option[value='r2']"));
  const restored = await presets();
  ok(!restored.rifles.find((r) => r.id === "r2").archived && !("archived" in restored.rifles.find((r) => r.id === "r2")), "Unarchive removes the archived field");
  ok(changedPaths(beforeUn, restored).every((p) => p === "rifles[1].archived" || p === "lastRifleId"), "unarchive does not rewrite other fields");

  await page.click("#gearArch");
  await page.click('#gearSwitch button[data-sec="load"]');
  await page.click("#gearAdd");
  await page.waitForFunction(() => [...document.querySelectorAll("#loadSel option")].some((o) => o.textContent === "Scratch"));
  await page.click("#loadMenu");
  await page.click("#loadDel");
  await page.waitForSelector("#gearDlg:not([hidden])");
  ok((await page.locator("#gearDlgGo").innerText()) === "Delete", "an unused load can be deleted after a confirm");
  await page.screenshot({ path: ART + "/after-delete-confirm.png" });
  await page.click("#gearDlgGo");
  await page.waitForFunction(() => ![...document.querySelectorAll("#loadSel option")].some((o) => o.textContent === "Scratch"));
  ok(!(await presets()).rifles.some((r) => (r.loads || []).some((l) => l.name === "Scratch")), "the unused load is removed");
  ok(!pageErrors.length, "no page errors: " + pageErrors.join(" | "));

  const prodPreset = JSON.parse(presetRaw);
  prodPreset.opticsMig = 1;
  prodPreset.rifles.find((r) => r.id === "r2").archived = true;
  const prodSeed = JSON.stringify(prodPreset);
  await boot(`http://127.0.0.1:${PORT}/index.html`, prodSeed, sessionRaw);
  const afterLoad = await presets();
  ok(JSON.stringify(afterLoad) === prodSeed, "production startup does not rewrite a preset that contains archived:true");
  ok(!pageErrors.length, "production loads an archived record with no errors");
  await page.click("#tabBtnLog");
  ok((await page.locator("#slList").innerText()).includes("Rifle B"), "production history still resolves the archived firearm");
  const shown = await page.locator("#rifleSel option").allInnerTexts();
  ok(shown.includes("Rifle B"), "production pickers still show the archived firearm");
  await page.click("#tabBtnGear");
  await page.evaluate(() => { const s = document.getElementById("rifleSel"); s.value = "r1"; s.dispatchEvent(new Event("change", { bubbles: true })); document.getElementById("rifleDetails").open = true; });
  await page.locator("#zero").fill("125", { force: true });
  await page.dispatchEvent("#zero", "input");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles.find((r) => r.id === "r1").zero === "125");
  const saved = await presets();
  ok(saved.rifles.find((r) => r.id === "r2").archived === true, "a production save keeps the archived flag");
  console.log("PASS gear-cleanup", asserts);
} catch (e) {
  console.error("FAIL", e);
  try { await page.screenshot({ path: ART + "/fail.png" }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
