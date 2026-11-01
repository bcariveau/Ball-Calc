// app/js/target-draw.js — Target drawing (SVG/canvas rendering of targets and groups).
// Generated from the single-file app by a mechanical split; statements are verbatim. Code that runs at start-up lives in
// init*() and is called by main.js in the original order.

import { TG_SHAPES, inPerU, tgNice } from "./targets.js";


/* ---- SVG target drawing (sheet inches; y up) ---- */
function shpPath(k, x, y, r) {   // SVG coords (y down)
  const P2 = pts => `<polygon points="${pts.map(p => p.map(v => v.toFixed(3)).join(",")).join(" ")}"/>`, rg = (n, rr, a0) => Array.from({ length: n }, (_, i) => [x + rr * Math.cos(a0 + i * 2 * Math.PI / n), y + rr * Math.sin(a0 + i * 2 * Math.PI / n)]);
  switch (k) {
    case "square": return `<rect x="${(x - r * 0.85).toFixed(3)}" y="${(y - r * 0.85).toFixed(3)}" width="${(r * 1.7).toFixed(3)}" height="${(r * 1.7).toFixed(3)}"/>`;
    case "triangle": return P2(rg(3, r * 1.2, -Math.PI / 2));
    case "diamond": return P2(rg(4, r * 1.2, -Math.PI / 2));
    case "pentagon": return P2(rg(5, r * 1.1, -Math.PI / 2));
    case "hex": return P2(rg(6, r * 1.05, 0));
    case "star": return P2(Array.from({ length: 10 }, (_, i) => { const rr = i % 2 ? r * 0.55 : r * 1.3, a = -Math.PI / 2 + i * Math.PI / 5; return [x + rr * Math.cos(a), y + rr * Math.sin(a)]; }));
    case "cross": { const a = r * 1.1, w = r * 0.42; return P2([[x - a, y - a + w], [x - a + w, y - a], [x, y - w], [x + a - w, y - a], [x + a, y - a + w], [x + w, y], [x + a, y + a - w], [x + a - w, y + a], [x, y + w], [x - a + w, y + a], [x - a, y + a - w], [x - w, y]]); }
    default: return `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${r.toFixed(3)}"/>`;
  }
}
function mkGlyph(i) { return `<svg class="mk" viewBox="-6 -6 12 12" aria-hidden="true"><g class="ms s${i % 6 + 1}">${shpPath(TG_SHAPES[i % 8], 0, 0, 4)}</g></svg>`; }
function tplGrid(tpl, yd, span, u, ext) {   // returns { step, svg } in drawing units (inches, or MOA/mil when u is angular); ext = half-extent to cover
  const h = ext || span / 2, L = (a, b, c, d, cl) => `<line class="${cl}" x1="${a.toFixed(3)}" y1="${b.toFixed(3)}" x2="${c.toFixed(3)}" y2="${d.toFixed(3)}" vector-effect="non-scaling-stroke"/>`;
  const grid = (step, major, lbl) => { let s = ""; const n = Math.ceil(h / step); for (let i = -n; i <= n; i++) { const v = i * step, cl = i === 0 ? "g0" : major && i % major === 0 ? "g1" : "g2"; s += L(v, -h, v, h, cl) + L(-h, v, h, v, cl); } return s; };
  if (u) { const st = tgNice(span / 8); return { step: st, unit: u, svg: grid(st, 0) }; }
  if (tpl === "moa") { const st = inPerU("MOA", yd); return { step: st, unit: "MOA", svg: grid(st, 5) }; }
  if (tpl === "mil") { const st = inPerU("MIL", yd) * 0.2; return { step: st, unit: "0.2mil", svg: grid(st, 5) }; }
  if (tpl === "bull") { const st = Math.max(1, tgNice(span / 14)); let s = ""; for (let i = 6; i >= 1; i--) s += `<circle class="${i <= 2 ? "b1" : "b2"}" cx="0" cy="0" r="${(i * st).toFixed(3)}" vector-effect="non-scaling-stroke"/>`; return { step: st, unit: "ring", svg: s + L(-h, 0, h, 0, "g2") + L(0, -h, 0, h, "g2") }; }
  if (tpl === "steel") { const d = Math.max(6, Math.round(2 * inPerU("MOA", yd))); return { step: d, unit: "plate", svg: `<circle class="pl" cx="0" cy="0" r="${(d / 2).toFixed(3)}" vector-effect="non-scaling-stroke"/><text class="pll" x="0" y="${(d / 2 + span * 0.05).toFixed(3)}" font-size="${(span * 0.035).toFixed(3)}" text-anchor="middle">${d}\u2033 plate</text>` }; }
  const st = span > 48 ? tgNice(span / 24) : 1; return { step: st, unit: "in", svg: grid(st, st === 1 ? 6 : 0) };
}
// layers: [{ i (string index for color/shape), aim {x,y}|null, holes: [{ p {x,y}, n, meas, sel, id }], dim }]
function tgLabels(layers, r, fs) {   // place hole numbers so they don't sit on each other or on holes (current string first); far ones get a leader line
  const all = [], out = new Map(), boxes = [];
  layers.forEach((Ly, li) => Ly.holes.forEach((H, hi) => all.push({ k: li + ":" + hi, x: H.p.x, y: -H.p.y, w: fs * (0.62 * String(H.n).length + 0.45), dim: !!Ly.dim })));
  const hit = (b) => boxes.some(q => Math.abs(q.x - b.x) * 2 < q.w + b.w && Math.abs(q.y - b.y) * 2 < q.h + b.h) || all.some(p => Math.abs(p.x - b.x) < b.w / 2 + r * 0.95 && Math.abs(p.y - b.y) < b.h / 2 + r * 0.95);
  const dirs = [[1, -1], [-1, -1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1], [0, 1]];
  [...all].sort((a, b) => a.dim - b.dim).forEach(p => {
    let best = null;
    for (const m of [1, 1.8, 2.7, 3.7, 4.8, 6]) { for (const [dx, dy] of dirs) { const n = Math.hypot(dx, dy), d = r + fs * 0.55 * m;
      const b = { x: p.x + dx / n * (d + p.w * 0.3 * Math.abs(dx / n)), y: p.y + dy / n * d, w: p.w, h: fs * 1.4 }; if (!hit(b)) { best = { ...b, m, dx: dx / n, dy: dy / n }; break; } } if (best) break; }
    if (!best) { const n = Math.SQRT2; best = { x: p.x + (r + fs) / n, y: p.y - (r + fs) / n, w: p.w, h: fs * 1.4, m: 1, dx: 1 / n, dy: -1 / n }; }
    boxes.push(best);
    const lead = best.m > 1, o = { x: best.x, y: best.y, lead };
    if (lead) { o.lx = p.x + best.dx * r * 1.1; o.ly = p.y + best.dy * r * 1.1; o.ex = best.x - best.dx * fs * 0.45; o.ey = best.y - best.dy * fs * 0.45; }
    out.set(p.k, o);
  });
  return out;
}
function tgSvg(o) {
  const S2 = o.span, h = S2 / 2, cx = o.cx || 0, cy = o.cy || 0, r = S2 / 58 * (o.mk || 1), fs = Math.max(r * 1.9, (o.px || 0) * 13), g = tplGrid(o.tpl, o.yd, o.gspan || S2, o.u, h + Math.max(Math.abs(cx), Math.abs(cy)));
  let s = `<rect class="sheet" x="${(cx - h).toFixed(3)}" y="${(-cy - h).toFixed(3)}" width="${S2.toFixed(3)}" height="${S2.toFixed(3)}"/>`;
  s += `<g class="grid" data-step="${g.step.toFixed(4)}" data-unit="${g.unit}" transform="translate(${(0).toFixed(3)},0)">${g.svg}</g>`;
  const LB = tgLabels(o.layers, r, fs);
  o.layers.forEach((Ly, li) => {
    const sh = TG_SHAPES[Ly.i % 8], cl = `ms s${Ly.i % 6 + 1}${Ly.dim ? " dim" : ""}`;
    if (Ly.aim) { const ax = Ly.aim.x, ay = -Ly.aim.y, a = r * 2.6;
      s += `<g class="aim${Ly.dim ? " dim" : ""}" data-s="${Ly.sid || ""}"><line x1="${(ax - a).toFixed(3)}" y1="${ay.toFixed(3)}" x2="${(ax + a).toFixed(3)}" y2="${ay.toFixed(3)}" vector-effect="non-scaling-stroke"/><line x1="${ax.toFixed(3)}" y1="${(ay - a).toFixed(3)}" x2="${ax.toFixed(3)}" y2="${(ay + a).toFixed(3)}" vector-effect="non-scaling-stroke"/><circle cx="${ax.toFixed(3)}" cy="${ay.toFixed(3)}" r="${(r * 1.3).toFixed(3)}" vector-effect="non-scaling-stroke"/></g>`; }
    Ly.holes.forEach((H, hi) => { const x = H.p.x, y = -H.p.y, L = LB.get(li + ":" + hi);
      s += `<g class="hole${H.sel ? " sel" : ""}${H.meas ? " meas" : ""}" data-h="${H.id || ""}" data-n="${H.n}">` +
        (H.sel ? `<circle class="selr" cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${(r * 2.3).toFixed(3)}" vector-effect="non-scaling-stroke"/>` : "") +
        (H.meas ? `<circle class="mr s${Ly.i % 6 + 1}" cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${(r * 1.75).toFixed(3)}" vector-effect="non-scaling-stroke"/>` : "") +
        `<g class="${cl}">${shpPath(sh, x, y, r)}</g>` + (L.lead ? `<line class="hl${Ly.dim ? " dim" : ""}" x1="${L.lx.toFixed(3)}" y1="${L.ly.toFixed(3)}" x2="${L.ex.toFixed(3)}" y2="${L.ey.toFixed(3)}" vector-effect="non-scaling-stroke"/>` : "") +
        `<text class="hn${Ly.dim ? " dim" : ""}" x="${L.x.toFixed(3)}" y="${L.y.toFixed(3)}" font-size="${fs.toFixed(3)}" text-anchor="middle" dominant-baseline="central">${H.n}</text></g>`; });
  });
  return { vb: `${(cx - h).toFixed(3)} ${(-cy - h).toFixed(3)} ${S2.toFixed(3)} ${S2.toFixed(3)}`, html: s, grid: g };
}

export { shpPath, mkGlyph, tplGrid, tgLabels, tgSvg };
