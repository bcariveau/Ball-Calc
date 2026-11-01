import { chromium } from "playwright";
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", e => errs.push("PAGEERR " + e.message));
await p.goto("http://localhost:8765/ballistic-calculator.html");
await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
console.log("status1", await p.textContent("#status"));
await p.click("#tabBtnGear");   // Gear tab holds gun/load setup
await p.click("#loadDetails > summary");
await p.click("#dbOpen");
await p.waitForFunction(() => document.querySelectorAll(".dbItem").length > 0, null, { timeout: 20000 });
console.log("cal default", await p.$eval("#dbCal", s => s.options[s.selectedIndex].text), await p.textContent("#dbStatus"));
await p.selectOption("#dbCal", "");
await p.fill("#dbQ", "6.5 140 ELD");
await p.waitForTimeout(200);
console.log(await p.textContent("#dbStatus"));
const items = await p.$$eval(".dbItem", a => a.slice(0, 5).map(x => x.innerText.replace(/\n/g, " | ")));
console.log(items);
// type filter
await p.fill("#dbQ", ""); await p.click('#dbKind button[data-v="handgun"]'); await p.waitForTimeout(200);
console.log("handgun:", await p.textContent("#dbStatus"), "| cal opts", await p.$eval("#dbCal", s => s.options.length), "| first", await p.$eval("#dbCal", s => [...s.options].slice(0,4).map(o=>o.text).join("; ")));
console.log("handgun all-types?", await p.$$eval(".dbItem .m", a => a.every(x => x.textContent.includes("handgun"))));
await p.selectOption("#dbCal", "0.355"); await p.fill("#dbQ", "124"); await p.waitForTimeout(200);
console.log("9mm 124:", await p.textContent("#dbStatus"), await p.$$eval(".dbItem", a => a.slice(0,3).map(x => x.innerText.replace(/\n/g," | "))));
await p.screenshot({ path: "/workspace/ballistic-calculator/screenshot-db-picker-handgun.png" });
await p.click('#dbKind button[data-v="rifle"]'); await p.waitForTimeout(200);
console.log("rifle (cal kept?):", await p.inputValue("#dbCal"), "|", await p.textContent("#dbStatus"), "| cal opts", await p.$eval("#dbCal", s => s.options.length));
await p.selectOption("#dbCal", ""); await p.fill("#dbQ", "6.5 140 ELD"); await p.waitForTimeout(200);
console.log("rifle 6.5 140 ELD:", await p.textContent("#dbStatus"));
await p.screenshot({ path: "/workspace/ballistic-calculator/screenshot-db-picker.png" });
await p.click('#dbKind button[data-v=""]'); await p.waitForTimeout(100);
console.log("all opts", await p.$eval("#dbCal", s => s.options.length));
await p.click(".dbItem >> nth=0");
await p.fill("#mv", "2710"); await p.selectOption("#mvSource", "measured");
await p.waitForTimeout(1200);
await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
console.log("fields", await p.evaluate(() => ["bc","drag","weight","diameter","length","bulletId","bulletName","mv"].map(id => id + "=" + document.getElementById(id).value).join(" ")));
console.log("info", await p.textContent("#bulletInfo")); console.log("sum", await p.textContent("#loadSum"));
console.log("status2", await p.textContent("#status"), "| card:", (await p.textContent("#dopeCard")).slice(0, 120));
// Sierra banded
await p.click("#dbOpen"); await p.waitForSelector(".dbItem"); await p.selectOption("#dbCal", ""); await p.fill("#dbQ", "sierra 168 matchking 308");
await p.waitForTimeout(200); console.log(await p.$$eval(".dbItem", a => a.slice(0, 3).map(x => x.innerText.replace(/\n/g, " | "))));
await p.click(".dbItem >> nth=0"); await p.waitForTimeout(300);
await p.selectOption("#drag", "G1"); await p.waitForTimeout(200); console.log("bc after G1", await p.inputValue("#bc"));
await p.selectOption("#useBands", "1"); await p.waitForTimeout(1500);
console.log("bands", await p.textContent("#bandsTxt"), "| status3", await p.textContent("#status"), "| sum", await p.textContent("#loadSum"));
// barrel + estimate
await p.click("#rifleDetails > summary"); await p.fill("#barrel", "20");
await p.click("#mvEstBox > summary"); await p.fill("#refMV", "2700");
await p.click("#mvEstBtn"); console.log("est", await p.textContent("#mvEstOut"));
await p.click("#mvEstUse"); await p.waitForTimeout(1200); console.log("mv", await p.inputValue("#mv"), await p.inputValue("#mvSource"), await p.textContent("#loadSum"));
await p.waitForTimeout(100);   // edits autosave (no Save buttons)
const saved = await p.evaluate(() => { const P = JSON.parse(localStorage.getItem("bcalc.presets.v1")); const r = P.rifles[0]; return { barrel: r.barrel, load: r.loads[0] }; });
console.log("saved", JSON.stringify(saved));
// export check
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#exportBtn")]);
const fs = await import("fs"); const ex = JSON.parse(fs.readFileSync(await dl.path(), "utf8")); console.log("export has", ex.rifles[0].barrel, ex.rifles[0].loads[0].bulletId, ex.rifles[0].loads[0].refMV);
// import back (replace)
p.once("dialog", d => d.accept());
await p.setInputFiles("#importFile", await dl.path()); await p.waitForTimeout(800);
console.log("after import", await p.evaluate(() => { const r = JSON.parse(localStorage.getItem("bcalc.presets.v1")).rifles[0]; return [r.barrel, r.loads[0].bulletName, r.loads[0].bcBands, r.loads[0].fpsPerInch, r.loads[0].mvSource].join(" | "); }));
// offline: reload with network blocked for bullets.json
console.log("ERRORS before offline test", JSON.stringify(errs)); errs.length = 0;
await p.route("**/bullets.json", r => r.abort());
await p.reload(); await p.waitForFunction(() => document.getElementById("status").textContent.startsWith("Done"), null, { timeout: 30000 });
await p.click("#tabBtnGear");  // app always opens on Dope (round 2)
await p.click("#loadDetails > summary").catch(()=>{}); await p.click("#dbOpen"); await p.waitForTimeout(800); console.log("offline", await p.textContent("#dbStatus"));
await p.click("#dbClose");
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.screenshot({ path: "/workspace/ballistic-calculator/screenshot-db.png", fullPage: false });
await p.screenshot({ path: "/workspace/ballistic-calculator/screenshot-db-full.png", fullPage: true });
console.log("ERRORS during offline test (expected: blocked bullets.json)", errs);
await b.close();
