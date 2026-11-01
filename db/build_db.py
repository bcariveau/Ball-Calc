#!/usr/bin/env python3
"""
Build bullets.json for the ballistic calculator from manufacturer sources + ammolytics (MIT).

  python3 db/build_db.py            # uses db/cache (fast, offline after first run)
  rm -rf db/cache && python3 db/build_db.py   # full refresh from the web

Only factual numeric specs (diameter, weight, BC, length) published by the manufacturers
are used. Output: ../bullets.json (compact) and db/report.txt.
"""
import csv, glob, html, json, os, re, sys, subprocess, datetime, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch import get, pget
SRC = os.path.join(HERE, "sources")
TODAY = datetime.date.today().isoformat()
dec = json.JSONDecoder()

# ---------------------------------------------------------------- helpers
def txt(s):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    t = re.sub(r"<[^>]+>", " | ", t); t = html.unescape(re.sub(r"\s+", " ", t))
    return re.sub(r"(\|\s*)+", "| ", t)
def strip(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()
def f(x):
    if x is None: return None
    m = re.search(r"-?\d*\.?\d+", str(x).replace(",", "."))
    try: return float(m.group(0)) if m else None
    except ValueError: return None

CAL = [(0.172,"17 cal"),(0.204,"20 cal"),(0.224,"22 cal (.224)"),(0.223,"22 Hornet (.223)"),(0.243,"6mm / 243"),(0.251,"25 ACP"),
 (0.257,"25 cal"),(0.264,"6.5mm"),(0.277,"270 / 6.8mm"),(0.284,"7mm"),(0.308,"30 cal (.308)"),(0.309,"30 cal (.309)"),(0.310,"7.62x39 (.310)"),
 (0.311,"303 / 7.62x39 (.311)"),(0.312,"303 / 32 (.312)"),(0.314,"7.65 (.314)"),(0.318,"8mm (.318)"),(0.321,"32 Spl (.321)"),(0.323,"8mm (.323)"),(0.338,"338"),
 (0.355,"9mm (.355)"),(0.356,"9mm (.356)"),(0.357,"357 / 38 (.357)"),(0.358,"35 cal (.358)"),(0.366,"9.3mm"),(0.375,"375"),(0.400,"10mm / 40"),(0.401,"40 (.401)"),
 (0.408,"408 CheyTac"),(0.410,"41 (.410)"),(0.411,"405 / 41 (.411)"),(0.416,"416"),(0.423,"10.75mm (.423)"),(0.429,"44 (.429)"),(0.430,"44 (.430)"),(0.451,"45 (.451)"),
 (0.452,"45 (.452)"),(0.458,"458"),(0.474,"470 NE (.474)"),(0.475,"475 (.475)"),(0.483,"470 NE (.483)"),(0.500,"50 AE (.500)"),(0.505,"505 Gibbs"),(0.510,"50 BMG (.510)")]
def cal_label(d):
    for v, l in CAL:
        if abs(d - v) < 0.0006: return l
    return f".{round(d*1000):03d}"
CALWORD = {"17":0.172,"20":0.204,"22":0.224,"6mm":0.243,"243":0.243,"25":0.257,"6.5mm":0.264,"6.5":0.264,"264":0.264,"270":0.277,"6.8mm":0.277,"7mm":0.284,"284":0.284,
 "30":0.308,"308":0.308,"8mm":0.323,"338":0.338,"35":0.358,"9.3mm":0.366,"375":0.375,"416":0.416,"458":0.458,"50":0.510,"9mm":0.355,"10mm":0.400,"40":0.400,"44":0.429,"45":0.451}

def classify(*parts):
    s = " ".join(p for p in parts if p).lower()
    if re.search(r"gold dot|sbpp|short barrel personal|personal protection|critical defense|critical duty|subsonic handgun|\bxpb\b|\btac-xp", s): return "handgun"
    if re.search(r"\bmth\b|single feed|lazer|raptor|maximus|\besp\b|tac-x\b|gmx|cx\b|ftx|interbond|interlock|traditional|deer|elk|bonded|hunting|hunter|e-tip|lrx|ttsx|tsx|accubond|partition|ballistic tip hunting|eld-x|grand slam|hot-cor|tipped gameking|gameking|pro-hunter|hammer hunter|hammer hammer|absolute hammer|\bhht\b|controlled chaos|tradition|straight-wall|lead free|copper lead|\bpp\b|solid base", s) and not re.search(r"varmint|match", s): return "hunting"
    if re.search(r"pistol|handgun|revolver|xtp|tac-xp|gold dot handgun|jhp|fmj handgun|asp\b|sports master|\bacp\b|9mm|10mm|deepcurl|tmj handgun|lead handgun|swc|wadcutter|round nose lead", s): t = "handgun"
    elif re.search(r"varmint|v-max|vmax|blitz|\btnt\b|ntx|varmageddon|hornet|ballistic tip varmint|varmintking|eld-vt|predator|bee\b", s): t = "varmint"
    elif re.search(r"match|target|competition|bthp|hpbt|vld|hybrid target|a-tip|amax|a-max|eld match|scenar|rdf|otm|fullbore|open tip|elr|benchrest|\bbr\b|tactical", s) and not re.search(r"hunt|game|eld-x|elite hunter|tgk|gameking", s): t = "match"
    elif re.search(r"fmj|full metal|tmj|plinking", s): t = "fmj"
    elif re.search(r"banded solid|\bdgs\b|brass backup|\bsolid\b(?!\s*(?:copper|base))|dangerous game solid", s): t = "solid"
    elif re.search(r"hunt|game|eld-x|sst|interlock|partition|accubond|tsx|ttsx|lrx|grand slam|hot-cor|soft point|spitzer|\bsp\b|round nose|semi.?point|deer|elk|scirocco|a-frame|cx\b|sierra pro|tgk|elite hunter|classic hunter|lazer|mth|maximus|raptor|hammer|hht|hunter", s): t = "hunting"
    else: t = "other"
    return t

def rec(brand, line, name, sku, d, w, g1=None, g7=None, length=None, typ=None, source=None, source_date=TODAY, bands=None, extra=None):
    d = f(d); w = f(w); g1 = f(g1); g7 = f(g7); length = f(length)
    if d and d > 1: d = None
    if length is not None and not (0.15 <= length <= 3.5): length = None
    if g1 is not None and not (0.05 <= g1 <= 1.2): g1 = None
    if g7 is not None and not (0.03 <= g7 <= 0.6): g7 = None
    if g1 and g7 and not (1.6 <= g1 / g7 <= 2.4): g7 = None   # mis-keyed value guard
    if line: line = re.sub(r"\s*[®™]\s*", " ", line).strip()
    r = dict(brand=brand, line=(line or "").strip() or None, name=re.sub(r"\s+", " ", name).strip(), sku=(str(sku).strip() if sku else None),
             diameter_in=round(d, 3) if d else None, weight_gr=(round(w, 1) if w else None), length_in=(round(length, 3) if length else None), g1=g1, g7=g7,
             type=typ or classify(line, name), source=source, source_date=source_date)
    if bands: r["g1_bands"] = bands
    if extra: r.update(extra)
    return r

# ---------------------------------------------------------------- sources
def src_ammolytics():
    out = []
    for row in csv.DictReader(open(os.path.join(SRC, "projectiles/data/projectiles.csv"))):
        name = re.sub(r"\bnull\b\s*", "", row["description"].replace(row["company"], "")).strip()
        typ = {"pistol":"handgun","rifle":None}.get(row["type"], None)
        out.append(rec(row["company"], (row["product_name"] if row["product_name"] not in ("", "null") else None), name, row["sku"], row["diameter_in"], row["weight_gr"], row["bc_g1"], row["bc_g7"],
                       None, typ or classify(row["product_name"], name, row["type"]),
                       "https://github.com/ammolytics/projectiles (MIT)", "2018", extra={"origin": "ammolytics"}))
    return out

def src_berger():
    url = "https://bergerbullets.com/information/lines-and-designs/bullet-reference-charts/"
    s = get(url); out = []
    for tb in re.findall(r"<table.*?</table>", s, flags=re.S):
        for r in re.findall(r"<tr.*?</tr>", tb, flags=re.S):
            c = [strip(x) for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, flags=re.S)]
            if len(c) < 11 or not re.match(r"\d", c[0]): continue
            dm = re.search(r"\((0?\.\d+)\)", c[2]); wm = re.search(r"([\d.]+)\s*gr", c[1])
            if not dm or not wm: continue
            line = re.sub(r"^.*?gr\s*", "", c[1])
            out.append(rec("Berger", line, c[1], c[0], dm.group(1), wm.group(1), c[9], c[10], c[3], None, url,
                           extra={"twist_min": c[12] if len(c) > 12 else None}))
    return out

def src_hornady():
    urls = [u for u in open(os.path.join(SRC, "hornady_sm.txt")).read().split() if re.search(r"/bullets/(rifle|handgun)/.+", u)]
    pages = pget(urls, workers=4); out = []
    for u in urls:
        s = pages[u]
        if not s or "var item = " not in s: continue
        it = dec.raw_decode(s, s.find("var item = ") + 11)[0]
        if it.get("discontinued"): continue
        title = strip(it.get("title")).replace("\u2011", "-")
        line = strip(it.get("linetitle")).split("  ")[0] if it.get("linetitle") else None
        if line: line = re.sub(r"\s+(Extremely|Advanced|Polymer|Super|Dangerous|Hornady|Monolithic|Bonded|Expanding).*$", "", line.replace("\u2011", "-")).strip()
        d = f(it.get("caliberdiameter")) or (f(re.search(r"\.(\d{3})\b", title).group(0)) if re.search(r"\.(\d{3})\b", title) else None)
        g1 = g7 = None
        for v, t in ((it.get("ball_coef"), it.get("ball_coef_type_1") or it.get("ball_coef_type")), (it.get("ball_coef_2"), it.get("ball_coef_type_2"))):
            if not v: continue
            if "7" in str(t) or str(t) == "2": g7 = v
            else: g1 = v
        app = strip(it.get("applicationname"))
        typ = "handgun" if "/handgun/" in u else classify(line, title, app)
        out.append(rec("Hornady", line, title, it.get("sku"), d, it.get("weight"), g1, g7, None, typ, u))
    # Mach-banded BCs (ELD Match / ELD-X / A-Tip / ELD-VT): default = Mach 2.0 value
    bcurl = "https://www.hornady.com/bc"; s = get(bcurl); bands = {}
    for tb in re.findall(r"<table.*?</table>", s, flags=re.S):
        for r in re.findall(r"<tr.*?</tr>", tb, flags=re.S)[1:]:
            c = [strip(x) for x in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, flags=re.S)]
            if len(c) < 4: continue
            vals = [re.findall(r"(\d?\.\d+)\s*G([17])", x) for x in c[1:4]]
            m = re.search(r"([\d.]+)\s*(mm|cal)?\s*([\d.]+)\s*gr", c[0].lower().replace("cal ", "cal"))
            m = re.search(r"(\d+\.?\d*)\s*(mm)?\s*(?:cal)?\.?\s+(\d+)\s*gr", c[0].lower().replace(".22", "22").replace(".25", "25").replace(".30", "30"))
            if not m: continue
            cw = m.group(1) + ("mm" if m.group(2) else "")
            d = CALWORD.get(cw) or CALWORD.get(m.group(1))
            line = "ELD Match" if "match" in c[0].lower() and "eld" in c[0].lower() else "ELD-X" if "eld-x" in c[0].lower() else "A-Tip" if "a-tip" in c[0].lower() else "ELD-VT" if "eld-vt" in c[0].lower() else None
            if not d or not line: continue
            band = {k: {g: float(v) for v, g in vals[i]} for i, k in enumerate(["M2.25", "M2.0", "M1.75"])}
            bands[(line, d, float(m.group(3)))] = band
    hit = 0
    for r in out:
        key_line = next((k for k in ["ELD Match", "ELD-X", "A-Tip", "ELD-VT"] if k.lower().replace("-", "") in (r["name"] + " " + (r["line"] or "")).lower().replace("-", "").replace("®", "").replace("™", "")), None)
        b = bands.get((key_line, r["diameter_in"], r["weight_gr"])) if key_line else None
        if b:
            hit += 1
            r["bc_mach"] = b; r["g1"] = b["M2.0"].get("1", r["g1"]); r["g7"] = b["M2.0"].get("7", r["g7"])
            r["bc_note"] = "Hornady Mach 2.0 (~2,233 fps) BC; by Mach: " + ", ".join(f"{m} " + "/".join(f"G{g} {b[m][g]}" for g in ("1", "7") if b[m].get(g)) for m in ("M2.25", "M2.0", "M1.75") if b.get(m)); r["source2"] = bcurl
    print(f"  hornady /bc bands: {len(bands)} rows, matched {hit}", file=sys.stderr)
    return out

def bc_specs(s):
    m = re.search(r'specsJson\\":\\"(.*?)\\",\\"', s or "")
    if not m: return {}
    try:
        a = json.loads('"' + m.group(1) + '"')
        try: return json.loads(json.loads('"' + a + '"'))
        except Exception: return json.loads(a)
    except Exception: return {}

def sierra_bands():
    """Sierra's published G1 velocity-band listing (rifle 2009, handgun 2007 editions)."""
    res = {}; seen_prev = set()
    for pdf, url in (("sierra_bc_rifle.pdf", "https://kapszli.hu/wp-content/uploads/2016/12/BallisticCoefficient-rifle.pdf"),
                     ("sierra_bc_handgun.pdf", "https://kapszli.hu/wp-content/uploads/2016/12/BallisticCoefficient-handgun.pdf")):
        p = os.path.join(SRC, pdf)
        if not os.path.exists(p):
            subprocess.run(["curl", "-sL", "-o", p, url])
        t = subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True).stdout
        for page in t.split("\f"):
            lines = page.split("\n")
            hdr = next((l for l in lines if l.startswith("Stock")), None)
            if not hdr: continue
            hg = "Handgun Bullets" in page
            col = hdr.find("Stock", 10) - 2
            for half in (0, 1):
                cur = None
                for l in lines:
                    seg = l[:col] if half == 0 else l[col:]
                    m = re.match(r"\s*(\d{4}[A-Z]?)\s+\.(\d{3})\s+(\d+)\s+(.*?)\s{2,}\.\d{3}\s", seg)
                    if m and m.group(1) in seen_prev: cur = None; continue
                    if m:
                        cur = m.group(1)
                        res.setdefault(cur, {"bands": [], "src": url, "dia": "0." + m.group(2), "w": m.group(3), "desc": m.group(4).strip(),
                                             "handgun": hg})
                    elif cur:
                        cont = re.split(r"\s\.\d", seg, 1)[0].strip()
                        if cont and not re.match(r"[\d.]", cont) and cont not in res[cur]["desc"] and len(res[cur]["desc"]) < 60: res[cur]["desc"] += " " + cont
                    if not cur: continue
                    for mm in re.finditer(r"(\.\d+)\s*(?:@|at|At)\s*(\d+)\s*fps\s+and\s+(above|below)|(\.\d+)\s+between\s+(\d+)\s+and\s+(\d+)\s*fps", seg):
                        if mm.group(1): bc, v = float(mm.group(1)), (int(mm.group(2)) if mm.group(3) == "above" else 0)
                        else: bc, v = float(mm.group(4)), min(int(mm.group(5)), int(mm.group(6)))
                        res[cur]["bands"].append({"bc": bc, "v_min_fps": v})
        seen_prev = set(res)
    for k in res: res[k]["bands"].sort(key=lambda b: -b["v_min_fps"])
    return res

def src_sierra():
    urls = open(os.path.join(SRC, "sierra_urls.txt")).read().split()
    pages = pget(urls, workers=4); out = {}; bands = sierra_bands()
    for u in urls:
        sp = bc_specs(pages[u])
        for sku, v in sp.items():
            if not v.get("G1 BC") or not v.get("Bullet Diameter"): continue
            base = re.sub(r"[A-Z]+$", "", sku)
            if base in out: continue
            fam = re.search(r'Product Family\\",\\"value\\":\\"([^\\]+)', pages[u]); fam = fam.group(1) if fam else None
            title = re.search(r"<title>(.*?)</title>", pages[u], flags=re.S); title = strip(title.group(1)).split("|")[0].split(" - ")[0].strip() if title else sku
            w = v.get("Bullet Weight (Grains)") or v.get("Bullet Weight")
            typ = classify(fam, title, v.get("Purpose"), v.get("Pursuit"), v.get("Bullet Type"))
            if re.search(r"handgun|pistol", (v.get("Purpose") or "") + (v.get("Pursuit") or ""), re.I) or (fam and "Sports Master" in fam): typ = "handgun"
            r = rec("Sierra", fam, title, base, v["Bullet Diameter"], w, v.get("G1 BC"), v.get("G7 BC"), None, typ, u)
            b = bands.get(base)
            if b and b["bands"]:
                top = b["bands"][0]["bc"]
                r["g1_bands"] = b["bands"]; r["g1_bands_source"] = b["src"]
                if r["g1"] and abs(top - r["g1"]) / r["g1"] <= 0.05:
                    r["g1"] = top; r["bc_note"] = "Sierra top velocity band (velocity bands available)"
                else:
                    r["bc_note"] = "Current Sierra G1; older Sierra velocity-band listing may differ"
            out[base] = r
    # older Sierra numbers in Sierra's own band listing that are not on the current site: add as older/discontinued
    have = {re.sub(r"[A-Z]+$", "", k) for k in out}
    for stock, b in bands.items():
        base = re.sub(r"[A-Z]+$", "", stock)
        if base in have or not b["bands"] or not b.get("w"): continue
        desc = re.sub(r"\s+", " ", b["desc"]).strip()
        typ = "handgun" if b["handgun"] and not re.search(r"single shot", desc, re.I) else classify(desc)
        if b["handgun"] and re.search(r"single shot", desc, re.I): typ = "hunting"
        if typ == "other" and re.search(r"hollow point", desc, re.I): typ = "varmint" if float(b["dia"]) <= 0.264 else "hunting"
        sline = next((L for L in ("MatchKing", "GameKing", "BlitzKing", "Pro-Hunter", "Sports Master", "Tournament Master", "Varminter", "Single Shot Pistol") if L.lower() in desc.lower()), None)
        if not sline: sline = "Sports Master" if typ == "handgun" else "Sierra (older)"
        r = rec("Sierra", sline, f"{b['w']} gr {desc} #{stock}", base, b["dia"], b["w"], b["bands"][0]["bc"], None, None, typ, b["src"],
                "2009" if not b["handgun"] else "2007", bands=b["bands"],
                extra={"g1_bands_source": b["src"], "status": "older/discontinued (Sierra band listing)", "bc_note": "Sierra top velocity band (velocity bands available)"})
        out[base] = r; have.add(base)
    src_sierra.bands = bands
    return list(out.values())

def src_barnes():
    urls = open(os.path.join(SRC, "barnes_urls2.txt")).read().split()
    pages = pget(urls, workers=4); out = {}
    for u in urls:
        for sku, v in bc_specs(pages[u]).items():
            if v.get("Cartridge") or v.get("Rounds Per Box") or not v.get("G1 BC"): continue
            d = v.get("Diameter") or (re.search(r"/0-(\d{3})-", u) and "0." + re.search(r"/0-(\d{3})-", u).group(1))
            if not d: continue
            line = v.get("Product Line"); w = v.get("Bullet Weight (Grains)")
            name = f"{line or ''} {v.get('Bullet Style') or ''} {w} gr".strip()
            typ = "handgun" if re.search(r"handgun|pistol|defense", (v.get("Purpose") or "") + (v.get("Pursuit") or "") + (line or ""), re.I) else classify(line, v.get("Purpose"), v.get("Pursuit"))
            out[sku] = rec("Barnes", line, name, sku, d, w, v.get("G1 BC") or v.get("Ballistic Coefficient (G1)"), v.get("G7 BC") or v.get("Ballistic Coefficient (G7)"),
                           v.get("Length"), typ, u, extra={"twist_min": v.get("Minimum Twist Rate")} if v.get("Minimum Twist Rate") else None)
    return list(out.values())

def speer_tiles(s):
    t = txt(s); res = []
    for ch in t.split("Quickview |")[1:]:
        ch = ch.split("| Compare")[0]; parts = [p.strip() for p in ch.split("|") if p.strip()]
        if len(parts) < 2: continue
        d = {"name": parts[0], "sku": parts[1]}
        for i, p in enumerate(parts):
            if p.endswith(":") and i + 1 < len(parts): d[p[:-1]] = parts[i + 1]
        res.append(d)
    return res
def src_speer():
    urls = [u for u in open(os.path.join(SRC, "speer_sm.txt")).read().split() if "/bullets/" in u]
    tiles = {}
    for u in urls:
        s = get(u + "?sz=500")
        if s:
            for d in speer_tiles(s): tiles.setdefault(d["sku"], (d, u))
    out = []
    for sku, (d, u) in tiles.items():
        if not d.get("Ballistic Coefficient") or not d.get("Diameter In"): continue
        line = d["name"].split(",")[0]
        typ = "handgun" if "/handgun-bullets/" in u or "Handgun" in line else classify(line, d.get("Bullet Style"), d.get("Usage"))
        out.append(rec("Speer", line, d["name"], sku, d["Diameter In"], d.get("Grain Weight"), d["Ballistic Coefficient"], None, None, typ, u))
    return out

def src_nosler():
    urls = open(os.path.join(SRC, "nosler_products.txt")).read().split()
    pages = pget(urls, workers=4); out = {}
    for u in urls:
        s = pages[u]
        if not s: continue
        rows = {html.unescape(a).strip(): strip(b) for a, b in re.findall(r'<th class="col label" scope="row">(.*?)</th>\s*<td class="col data"[^>]*>(.*?)</td>', s, flags=re.S)}
        if rows.get("Type", "Bullet") != "Bullet" or not rows.get("BC G1"): continue
        sku = rows.get("Manufacturer SKU"); line = rows.get("Bullet Type")
        name = re.sub(r"\s*\(\d+ct\)|\s*-?\s*\d+ct\b|\s*blem|\s*\|\s*\d+\s*count|\s*\(factory seconds?\)|\s*factory seconds?|\s*\(\d+\s*count\)|\s*-?\s*\d+\s*count\b", "", rows.get("Product Name", ""), flags=re.I).strip(" -|")
        key = (name.lower(), rows.get("BC G1"))
        if key in out: continue
        d = rows.get("Diameter") or CALWORD.get((rows.get("Caliber") or "").lower().replace(" cal", ""))
        if not d:
            m = re.match(r"(\d+(?:\.\d)?mm|\d+)", name.lower()); d = CALWORD.get(m.group(1)) if m else None
        typ = classify(line, name, rows.get("Bullet Profile"))
        if re.search(r"asp|sporting handgun|jhp|jsp|fmj", (line or "") + name, re.I) and (f(d) or 0) >= 0.35: typ = "handgun"
        out[key] = rec("Nosler", line, name, sku, d, rows.get("Bullet Weight"), rows.get("BC G1"), rows.get("BC G7"), rows.get("Overall Length (OAL) (in.)"), typ, u)
    return list(out.values())

def woo(name):
    return json.load(open(os.path.join(SRC, f"{name}_woo.json")))
def src_lapua():
    out = []
    for p in woo("lapua"):
        cats = [c["name"] for c in p.get("categories", [])]
        if "Bullet" not in cats: continue
        a = {x["name"]: ", ".join(t["name"] for t in x["terms"]) for x in p.get("attributes", [])}
        w = re.search(r"\(([\d.]+)\s*gr\)", a.get("Bullet weight", "")); w = w.group(1) if w else f(a.get("Bullet weight"))
        d = f(a.get("Bullet diameter"))
        if d and d > 1: d = d / 25.4 if d > 5 else None
        if not d:
            m = re.search(r"\.(\d{3})\b|(\d+(?:\.\d)?)\s*mm", p["name"]); 
            d = (float("0." + m.group(1)) if m and m.group(1) else {"6":0.243,"6.5":0.264,"7":0.284,"7.62":0.308,"8.6":0.338,"9.3":0.366,"5.56":0.224}.get(m.group(2)) if m else None)
        cal = a.get("Caliber", "")
        if not d: d = CALWORD.get(re.sub(r"^\.", "", cal.split()[0]) if cal else "") or {"6.5 mm":0.264,"6 mm":0.243,".30":0.308,".338":0.338,".224":0.224,"7.62 mm":0.308}.get(cal)
        line = a.get("Bullet type") or a.get("Bullet")
        length = None
        for k in ("OAL",): 
            if a.get(k): length = f(a[k]) / (25.4 if f(a[k]) and f(a[k]) > 5 else 1)
        out.append(rec("Lapua", line, strip(p["name"]), a.get("Product no.") or a.get("Bullet Code"), d, w, a.get("BC G1"), a.get("BC G7"), length,
                       classify(line, p["name"], a.get("Purpose")), p.get("permalink")))
    return out
def src_hammer():
    out = []
    for p in woo("hammer"):
        if "Bullet" not in [c["name"] for c in p.get("categories", [])]: continue
        desc = strip(p.get("description", "") + " " + p.get("short_description", ""))
        nm = strip(p["name"])
        m = re.search(r"\.(\d{3})\s*(?:cal)?", nm.lower()); w = re.search(r"(\d+(?:\.\d)?)\s*gr", nm.lower())
        g1 = re.search(r"g1[\s-]*bc\s*[=:]?\s*(\d?\.\d+)", desc, re.I); g7 = re.search(r"g7[\s-]*bc\s*[=:]?\s*(\d?\.\d+)", desc, re.I)
        ln = re.search(r"bullets?\s+length(?:\s+is)?(?:\s+including\s+(?:the\s+)?tip)?(?:\s+is)?\s*:?\s*(\d?\.\d+)", desc, re.I)
        if not (m and w and (g1 or g7)): continue
        length = next((x for x in ln.groups() if x), None) if ln else None
        line = re.search(r"Hammer\s+([A-Za-z ®]+)", nm); line = line.group(1).replace("®", "").strip() if line else "Hammer"
        out.append(rec("Hammer", line, nm, p.get("sku") or p.get("id"), "0." + m.group(1), w.group(1), g1 and g1.group(1), g7 and g7.group(1), length,
                       classify(line, nm, desc[:200]), p.get("permalink"), extra={"bc_note": "Hammer BCs are often listed as estimates"} if "estimat" in desc.lower() else None))
    return out
def src_cuttingedge():
    urls = open(os.path.join(SRC, "ce_urls.txt")).read().split(); pages = pget(urls, workers=2); out = []
    for u in urls:
        s = pages[u]
        if not s: continue
        t = txt(s)
        ti = re.search(r"<title>(.*?)</title>", s, flags=re.S); nm = strip(ti.group(1)).split("–")[0].split(" - Cutting")[0].strip() if ti else u
        g1 = re.search(r"G1 Ballistic Coefficient:?\s*\|?\s*(\d?\.\d+)", t); g7 = re.search(r"G7 Ballistic Coefficient:?\s*\|?\s*(\d?\.\d+)", t)
        oal = re.search(r"\bOAL:?\s*\|?\s*(\d?\.\d+)", t); cal = re.search(r"Caliber:?\s*\|?\s*\.?(\d{3})", t); w = re.search(r"Weight:?\s*\|?\s*(\d+(?:\.\d+)?)\s*gr", t)
        if not cal: cal = re.search(r"^\.(\d{3})", nm)
        if not w: w = re.search(r"(\d+(?:\.\d+)?)\s*gr", nm)
        if not (cal and w and (g1 or g7)): continue
        line = next((L for L in ("Safari Raptor", "Safari Solid", "ER Raptor", "Raptor", "Maximus", "MTH", "Lazer", "ESP", "Single Feed", "Handgun Solid", "Handgun HP", "Match", "Solid", "Safari") if re.search(r"\b" + L + r"\b", nm, re.I)), None)
        if re.search(r"GEN2", nm, re.I) and line: line = line + " GEN2"
        out.append(rec("Cutting Edge", line, re.sub(r"\s*-\s*\d+ct\s*$", "", nm), u.rsplit("/", 1)[-1], "0." + cal.group(1), w.group(1),
                       g1 and g1.group(1), g7 and g7.group(1), oal and oal.group(1), "handgun" if "Handgun" in nm or "(9mm)" in nm else classify(line, nm), u))
    return out

# ---------------------------------------------------------------- merge
SOURCES = [("Hornady", src_hornady), ("Sierra", src_sierra), ("Speer", src_speer), ("Berger", src_berger), ("Nosler", src_nosler),
           ("Barnes", src_barnes), ("Lapua", src_lapua), ("Hammer", src_hammer), ("Cutting Edge", src_cuttingedge)]
EXTRA = []   # later sources append (name, fn)

def keyname(r):
    return (r["brand"].lower(), r["diameter_in"], r["weight_gr"], re.sub(r"[^a-z0-9]", "", (r["line"] or "").lower())[:12])

def main():
    allr = []; per = collections.OrderedDict()
    for name, fn in SOURCES + EXTRA:
        try:
            rs = fn()
        except Exception as e:
            import traceback; traceback.print_exc(); rs = []
        print(f"{name}: {len(rs)}", file=sys.stderr); per[name] = len(rs); allr += rs
    # validate
    good = [r for r in allr if r["diameter_in"] and 0.1 <= r["diameter_in"] <= 0.75 and r["weight_gr"] and 10 <= r["weight_gr"] <= 1200 and (r["g1"] or r["g7"])]
    # dedupe manufacturer-current by brand+sku
    seen = {}; out = []
    for r in good:
        k = (r["brand"].lower(), (r["sku"] or "").lower()) if r["sku"] else None
        if k and k in seen: continue
        if k: seen[k] = 1
        out.append(r)
    # collapse box-count / packaging variants: same brand, diameter, weight, name and BCs -> one record with alt SKUs
    coll = {}; out2 = []
    for r in out:
        nk = re.sub(r"\b\d+\s*(?:ct|count|pk|pack|box)\b|bulk|[^a-z0-9]", "", r["name"].lower())
        k = (r["brand"], r["diameter_in"], r["weight_gr"], nk, r["g1"], r["g7"])
        if k in coll:
            c = coll[k]
            if r["sku"] and r["sku"] != c["sku"]: c.setdefault("alt_skus", []).append(r["sku"])
            for fld in ("length_in", "g1_bands"):
                if not c.get(fld) and r.get(fld): c[fld] = r[fld]
            continue
        coll[k] = r; out2.append(r)
    print(f"collapsed {len(out) - len(out2)} packaging variants", file=sys.stderr); out = out2
    # ammolytics fills gaps (discontinued / older): skip when brand+sku or brand+dia+weight+line already present
    cur_sku = {(r["brand"].lower(), re.sub(r"[A-Z]+$", "", r["sku"] or "")) for r in out}
    cur_sku |= {(r["brand"].lower(), re.sub(r"[A-Z]+$", "", x)) for r in out for x in r.get("alt_skus", [])}
    cur_key = {keyname(r) for r in out}
    cur_dw = collections.defaultdict(list)
    for r in out: cur_dw[(r["brand"].lower(), r["diameter_in"], r["weight_gr"])].append(r)
    am = src_ammolytics(); added = 0
    sb = getattr(src_sierra, "bands", {})
    for r in am:
        if not (r["diameter_in"] and r["weight_gr"] and (r["g1"] or r["g7"])): continue
        if (r["brand"].lower(), re.sub(r"[A-Z]+$", "", r["sku"] or "")) in cur_sku: continue
        if keyname(r) in cur_key: continue
        # same brand/dia/weight with near-identical BC => same bullet
        if any(c["g1"] and r["g1"] and abs(c["g1"] - r["g1"]) < 0.006 for c in cur_dw[(r["brand"].lower(), r["diameter_in"], r["weight_gr"])]): continue
        if r["brand"] == "Sierra" and r["sku"] in sb and sb[r["sku"]]["bands"]:
            r["g1_bands"] = sb[r["sku"]]["bands"]; r["g1_bands_source"] = sb[r["sku"]]["src"]
        r["status"] = "older/discontinued (2018 data)"
        out.append(r); added += 1
        cur_sku.add((r["brand"].lower(), r["sku"]))
    per["ammolytics (gap fill)"] = added
    out.sort(key=lambda r: (r["diameter_in"], r["brand"], r["weight_gr"], r["name"]))
    for i, r in enumerate(out):
        r["id"] = re.sub(r"[^a-z0-9]+", "-", f'{r["brand"]}-{r["sku"] or r["name"]}'.lower()).strip("-")
        r["caliber"] = cal_label(r["diameter_in"])
        r["preferred"] = "G7" if r["g7"] else "G1"
        for k in [k for k, v in r.items() if v is None]: del r[k]
    ids = collections.Counter(r["id"] for r in out)
    dup = collections.defaultdict(int)
    for r in out:
        if ids[r["id"]] > 1: dup[r["id"]] += 1; r["id"] += f"-{dup[r['id']]}"
    meta = {"generated": TODAY, "count": len(out),
            "credits": ["Manufacturer published specifications: Hornady, Sierra, Speer, Berger, Nosler, Barnes, Lapua, Hammer, Cutting Edge (see each record's source URL).",
                        "ammolytics/projectiles (MIT License, (c) 2018 ammolytics) for older/discontinued bullets: https://github.com/ammolytics/projectiles"],
            "note": "Factory BCs are often optimistic; true your data with real drops."}
    js = {"meta": meta, "bullets": out}
    p = os.path.join(HERE, "..", "bullets.json")
    json.dump(js, open(p, "w"), separators=(",", ":"), ensure_ascii=False)
    # report
    br = collections.Counter(r["brand"] for r in out)
    lines = [f"Generated {TODAY}: {len(out)} bullets  ({os.path.getsize(p)//1024} KB)", "", "Per source (raw parsed):"] + [f"  {k}: {v}" for k, v in per.items()] + ["", "Final by brand (total / G7 / length / G1 bands / Mach bands / older):"]
    for b, n in br.most_common():
        rs = [r for r in out if r["brand"] == b]
        lines.append(f"  {b:14s} {n:5d}  G7 {sum('g7' in r for r in rs):4d}  len {sum('length_in' in r for r in rs):4d}  bands {sum('g1_bands' in r for r in rs):4d}  mach {sum('bc_mach' in r for r in rs):3d}  older {sum('status' in r for r in rs):4d}")
    lines += ["", f"With G7: {sum('g7' in r for r in out)}   With length: {sum('length_in' in r for r in out)}   Handgun: {sum(r['type']=='handgun' for r in out)}",
              "Types: " + ", ".join(f"{k} {v}" for k, v in collections.Counter(r["type"] for r in out).most_common())]
    open(os.path.join(HERE, "report.txt"), "w").write("\n".join(lines) + "\n"); print("\n".join(lines))

if __name__ == "__main__":
    main()
