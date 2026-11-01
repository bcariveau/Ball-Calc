# Vendored libraries (same-origin copies so Ball-Calc works offline)

| File | Source | Version | License |
|---|---|---|---|
| js-ballistics-3.1.0.js | https://cdn.jsdelivr.net/npm/js-ballistics@3.1.0/dist/index.js | 3.1.0 | ISC (© o-murphy, js-ballistics) |
| xlsx-0.20.3.mjs | https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs | 0.20.3 | Apache-2.0 (© SheetJS LLC) |

Both files are byte-for-byte copies of the upstream builds. To upgrade, drop in the new file under a new
name, update the import list in the page (`ENGINE_URLS` / `SHEETJS_URLS`) and the precache list in `sw-beta.js`,
and bump `VERSION` in `sw-beta.js`.
