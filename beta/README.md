# Ball-Calc beta: module layout

`beta.html` is a thin shell. It holds the `<head>` (meta tags, manifest, icons, and the inline no-flash theme script), the
stylesheet links, and a single `<script type="module" src="beta/js/main.js">`. Everything else lives in this folder as
plain files. **There is no build step**: GitHub Pages serves them as they are, and the browser loads them as ES modules.

The main app (`index.html`, `previous.html`, `legacy.html`, `sw.js`) is **not** part of this layout. It is still a single file.

## Start-up order
`js/main.js` inserts the markup from `js/views/*` into `<body>`, then calls each module's `init*()` in the same order the
original single script ran. Modules only *declare* things when they load (functions, constants, `let` slots), and all
code that runs at start-up sits in `init()`/`init1()`/`init2()`… That keeps the circular imports between modules safe.
If you add start-up code, put it in the owning module's init and keep main.js's call order.

Imports are read-only bindings. When a module needs to assign a variable owned by another module, the owner exports a
writer `set_X(v)` (for example `set_lastRun`, `set_LOG`, `set_slKey`).

## Who owns what
| File | Owns |
|---|---|
| `js/main.js` | Entry point: builds the page from the views and runs the inits in order |
| `js/app.js` | App wiring: tab switching, global listeners, start-up sequence. |
| `js/bulletdb.js` | Bullet database sheet (bullets.json) search and picking. |
| `js/calc.js` | Ballistics engine wrapper: engine loading (importFirst), solving (calculate, solveShot), turret specs, powder temp, angles, Miller stability; owns lastRun. |
| `js/components.js` | Shared UI pieces reused across tabs: toast, sheet open/close (openOvl/closeOvl), the gun·load·zero·unit context line, steppers, segmented controls, hint shortening, the Start/Continue-shooting buttons. |
| `js/core.js` | DOM helpers ($, val/num/fmt/setVal), number + HTML formatting, compass math, dynamic-import helper. No app state. |
| `js/dope-card.js` | Printable dope card view. |
| `js/dope.js` | Dope tab rendering: the card, table, chart, warnings, wind holds, gust spread, field errors. |
| `js/gear.js` | Gear tab: rifle/optic/load profiles, dirty tracking, load-data summary, zero-use helpers. |
| `js/hooks.js` | window.__bc test/debug hooks. |
| `js/log-import.js` | Import of chronograph files (xlsx/csv) into the Log. |
| `js/log.js` | Log tab: chronograph session list/editor and the LOG store. |
| `js/offline.js` | Offline support: service-worker registration, update banner, offline pill. |
| `js/optics.js` | Optics: attach-an-optic sheet, units following the optic, zero prompt, hints. |
| `js/radar.js` | Bluetooth radar (Athlon Rangecraft Velocity PRO): the pure RADAR-PARSER block and the live connection. |
| `js/reassign.js` | Move / reassign sessions between loads. |
| `js/recipes.js` | Saved load recipes and copy-load sheets. |
| `js/sensors.js` | Device sensors: compass/inclinometer sheet. |
| `js/shooting.js` | Shooting view (SH state): start/continue shooting, live string capture. |
| `js/shot-banner.js` | Live shot banner and screen wake-lock. |
| `js/storage.js` | localStorage keys, the persisted settings object S / profiles P, migrations, save/load. |
| `js/strings.js` | Strings (shot strings) model and menus for the shooting view. |
| `js/target-draw.js` | Target drawing (SVG/canvas rendering of targets and groups). |
| `js/target-editor.js` | Target editor sheet (tgEd). |
| `js/targets.js` | Target model: shots, groups, measurements (pure data). |
| `js/themes.js` | Colour themes (dark/light/od/fde/night), the 🎨 menu and the ⓘ About sheet. |
| `js/truing.js` | Muzzle-velocity truing sheet (true to an observed drop). |
| `js/weather.js` | Weather/conditions: fetching, station/altitude, atmosphere inputs and the ↻ Weather button. |
| `js/wind-dial.js` | Wind dial widget (WG/WU state, drag, clock positions). |

### Markup (`js/views/`)
| File | Markup |
|---|---|
| `js/views/chrome.js` | markup for the header, 🎨 theme bar, tab bar, app-level sheets (About, update bar, toast). |
| `js/views/dope.js` | markup for the Dope tab and printable dope card. |
| `js/views/gear.js` | markup for the Gear tab and its sheets (picker, zero prompt, optic, truing, sensors, bullet DB, recipes, copy load). |
| `js/views/log.js` | markup for the Log tab and its sheets (session editor, move session, import). |
| `js/views/parts.js` | markup partials shared by the view templates (one definition each). |
| `js/views/shooting.js` | markup for the Shooting view and live shot banner. |
| `js/views/targets.js` | markup for the Target editor sheet. |

Shared partials (`views/parts.js`) are defined once and reused:
- `sheetHead()` is every sheet's title + ✕ Close bar.
- `ctxRow()` is the gun · load · zero · unit context line on Gear and Log. Dope uses its card header, `#dcFor`, and `components.js` `ctxPaint()` fills all three.
- `startBtn()` is the ▶ Start / Continue shooting button on Dope and Log, painted by `components.js` `shBtnPaint()`.

The runtime UI pieces live in `js/components.js`: `toast()`, `openOvl()`/`closeOvl()` for sheets, steppers, segmented controls, and hint shortening.

### Styles (`css/`)
Linked in this order, which is the original cascade order: `base.css`, `controls.css`, `components.css`, `offline.css`, `sheets.css`, `log.css`, `layout.css`, `targets.css`, `dope.css`, `optics-table.css`, `shooting.css`. `components.css` holds the shared context-line,
Start button, About sheet and Load-data row styles.

## Offline
`../sw-beta.js` (scope `./beta`, which also covers `beta/…`) precaches `beta.html` and every file in this folder, listed in
its `MODULES` array. **When you add, rename or remove a file here, update that list and bump `VERSION`.** The worker's
update check compares the page *and* every module, so a content-only change still shows "Update available".
The main app's `sw.js` only handles its own fixed file list, so it never intercepts or caches `beta/` files.

## Tests
`db/test-bluetooth.mjs` unit-tests the `RADAR-PARSER` block in `js/radar.js`. Keep the BEGIN/END markers and keep the
block self-contained.
