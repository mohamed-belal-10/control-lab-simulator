/* =========================================================================
 * Module 60: renderer — parts, wires/tubes, overlay (selection, badges, probes)
 * ========================================================================= */
CCS.view = {
  x: 40, y: 20, z: 1,
  apply() { document.getElementById('world').setAttribute('transform', `translate(${this.x} ${this.y}) scale(${this.z})`); document.getElementById('zoomLbl').textContent = Math.round(this.z * 100) + '%'; const bg = document.getElementById('gridPat'); if (bg) bg.setAttribute('patternTransform', `translate(${this.x} ${this.y}) scale(${this.z})`); },
  toWorld(cx, cy) { const r = document.getElementById('canvas').getBoundingClientRect(); return [(cx - r.left - this.x) / this.z, (cy - r.top - this.y) / this.z]; },
  zoomAt(f, cx, cy) {
    const r = document.getElementById('canvas').getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
    const nz = CCS.util.clamp(this.z * f, 0.2, 3);
    this.x = px - (px - this.x) * nz / this.z; this.y = py - (py - this.y) * nz / this.z; this.z = nz; this.apply();
  },
  fit() {
    const P = CCS.circuit.parts; if (!P.length) { this.x = 40; this.y = 20; this.z = 1; return this.apply(); }
    let x = 1e9, y = 1e9, x2 = -1e9, y2 = -1e9;
    P.forEach(c => { const b = CCS.circuit.bbox(c); x = Math.min(x, b.x); y = Math.min(y, b.y); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2); });
    const r = document.getElementById('canvas').getBoundingClientRect();
    this.z = CCS.util.clamp(Math.min((r.width - 60) / (x2 - x), (r.height - 60) / (y2 - y)), 0.25, 1.4);
    this.x = (r.width - (x2 - x) * this.z) / 2 - x * this.z; this.y = (r.height - (y2 - y) * this.z) / 2 - y * this.z;
    this.apply();
  },
};

CCS.wireColors = [
  ['auto', 'Auto (by terminal)'], ['#d32f2f', 'Red (+24 V DC)'], ['#1a237e', 'Dark blue (0 V DC)'], ['#795548', 'Brown (L)'], ['#4fc3f7', 'Light blue (N)'],
  ['gy', 'Green-yellow (PE)'], ['#111111', 'Black'], ['#f5f5f5', 'White'], ['#fb8c00', 'Orange'], ['#8e24aa', 'Violet'],
];

CCS.render = (() => {
  const els = new Map(), cache = new Map();
  let wiresCache = '', overlayCache = '';
  const $ = id => document.getElementById(id);

  function parts() {
    const L1 = $('layerParts'), present = new Set();
    CCS.circuit.parts.forEach(c => {
      present.add(c.id);
      const T = CCS.types[c.type];
      let g = els.get(c.id);
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'part'); g.dataset.cid = c.id;
        els.set(c.id, g);
      }
      const parent = T.ductLayer ? $(T.ductLayer(c) === 'cover' ? 'layerCover' : 'layerFloor') : T.zTop ? $('layerTop') : L1;
      if (g.parentNode !== parent) parent.appendChild(g);
      const { w, h } = CCS.size(c);
      const tf = `translate(${c.x} ${c.y}) rotate(${c.rot || 0} ${w / 2} ${h / 2})`;
      if (g.getAttribute('transform') !== tf) g.setAttribute('transform', tf);
      let html;
      try { html = T.draw(c); } catch (e) { html = `<rect width="${w}" height="${h}" fill="#f003"/><text y="12" fill="#f66">draw error</text>`; console.error(e); }
      html = `<rect width="${w}" height="${h}" fill="transparent"/>` + html;
      if (cache.get(c.id) !== html) { g.innerHTML = html; cache.set(c.id, html); }
    });
    els.forEach((g, id) => { if (!present.has(id)) { g.remove(); els.delete(id); cache.delete(id); } });
  }

  /** world-space polyline of a wire */
  function wirePts(w) {
    const A = CCS.termPos(CCS.circuit.byId(w.a.c), w.a.t), B = CCS.termPos(CCS.circuit.byId(w.b.c), w.b.t);
    if (!A || !B) return null;
    return [A, ...(w.pts || []), B];
  }
  function pathD(pts, kind) {
    if (pts.length === 2) {
      const [A, B] = pts, d = CCS.util.dist(A, B), sag = Math.min(70, 12 + d * 0.18) * (kind === 'tube' ? 0.8 : 1);
      return `M${A[0]} ${A[1]} C${A[0]} ${A[1] + sag} ${B[0]} ${B[1] + sag} ${B[0]} ${B[1]}`;
    }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], a = pts[i - 1], b = pts[i + 1];
      const r = Math.min(10, CCS.util.dist(a, p) / 2, CCS.util.dist(p, b) / 2);
      const ua = [(a[0] - p[0]) / (CCS.util.dist(a, p) || 1), (a[1] - p[1]) / (CCS.util.dist(a, p) || 1)];
      const ub = [(b[0] - p[0]) / (CCS.util.dist(p, b) || 1), (b[1] - p[1]) / (CCS.util.dist(p, b) || 1)];
      d += ` L${p[0] + ua[0] * r} ${p[1] + ua[1] * r} Q${p[0]} ${p[1]} ${p[0] + ub[0] * r} ${p[1] + ub[1] * r}`;
    }
    const z = pts[pts.length - 1];
    return d + ` L${z[0]} ${z[1]}`;
  }
  function wires() {
    const sim = CCS.sim, R = sim.R, PR = sim.PR, flowOn = $('optFlow').checked, t = performance.now() / 1000;
    const sel = CCS.ui && CCS.ui.sel.wire;
    let s = '';
    CCS.circuit.wires.forEach(w => {
      const pts = wirePts(w); if (!pts) return;
      const d = pathD(pts, w.kind), isSel = sel === w.id;
      if (w.kind === 'tube') {
        let st = 'E';
        if (PR) { const k = PR.nodeOfKey(w.a.c + ':' + w.a.t); st = k ? PR.state.get(k) : 'E'; }
        const pressed = st === 'P' || st === 'T' && (PR && PR.P.get(PR.nodeOfKey(w.a.c + ':' + w.a.t)) > 0.1);
        s += `<path class="wire${isSel ? ' sel' : ''}" d="${d}" stroke="${w.color || '#1e88e5'}" stroke-width="7" opacity="${pressed ? 0.95 : 0.55}"/>`;
        s += `<path class="wire" d="${d}" stroke="#fff" stroke-width="1.6" opacity=".35"/>`;
        if (pressed && flowOn) s += `<path class="flow" d="${d}" stroke="#bbdefb" stroke-width="3" stroke-dashoffset="${(-t * 30) % 12}" opacity=".9"/>`;
        if (st === 'L') s += `<path class="flow" d="${d}" stroke="#ff5252" stroke-width="3" stroke-dashoffset="${(-t * 60) % 12}"/>`;
      } else {
        const I = R.wire(w.id), live = I.rms > 0.001 && sim.running, sw = w.gauge === '1.5' || w.gauge === '2.5' ? 4.4 : 3.4;
        const fault = sim.wireFaults.has(w.id);
        if (live || fault) s += `<path class="wire" d="${d}" stroke="${fault ? '#ff1744' : (I.ac > Math.abs(I.dc) ? '#ffb74d' : '#fff59d')}" stroke-width="${sw + 6}" opacity="${fault ? 0.8 : 0.35}"/>`;
        if (w.color === 'gy') s += `<path class="wire${isSel ? ' sel' : ''}" d="${d}" stroke="#43a047" stroke-width="${sw}"/><path class="wire" d="${d}" stroke="#fdd835" stroke-width="${sw}" stroke-dasharray="9 9"/>`;
        else s += `<path class="wire${isSel ? ' sel' : ''}" d="${d}" stroke="${w.color}" stroke-width="${sw}"/>`;
        s += `<path class="wire" d="${d}" stroke="#fff" stroke-width="1" opacity=".3"/>`;
        if (live && flowOn) {
          const off = I.ac > Math.abs(I.dc) ? Math.sin(t * 6) * 6 : (I.dc > 0 ? -1 : 1) * ((t * (20 + Math.min(60, Math.log10(1 + I.rms * 1000) * 15))) % 12);
          s += `<path class="flow" d="${d}" stroke="#fff" stroke-width="2.2" stroke-dashoffset="${off.toFixed(2)}" opacity=".85"/>`;
        }
        // ferrules at both ends
        [pts[0], pts[pts.length - 1]].forEach(p => (s += `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="#cfd8dc" stroke="#455a64" pointer-events="none"/>`));
      }
      s += `<path class="wire-hit" data-wid="${w.id}" d="${d}"/>`;
    });
    if (s !== wiresCache) { $('layerWires').innerHTML = s; wiresCache = s; }
  }

  function overlay() {
    const ui = CCS.ui, sim = CCS.sim;
    let s = '';
    ui.sel.parts.forEach(id => { const c = CCS.circuit.byId(id); if (!c) return; const b = CCS.circuit.bbox(c); s += `<rect class="sel-box" x="${b.x - 5}" y="${b.y - 5}" width="${b.x2 - b.x + 10}" height="${b.y2 - b.y + 10}" rx="6"/>`; });
    // outline every group that has a selected member
    CCS.arrange.groupsIn([...ui.sel.parts]).forEach(g => {
      const mem = CCS.circuit.parts.filter(p => p.group === g); if (mem.length < 2) return;
      const B = CCS.arrange.box(mem);
      s += `<rect class="group-box" x="${B.x - 12}" y="${B.y - 12}" width="${B.w + 24}" height="${B.h + 24}" rx="9"/><text class="group-tag" x="${B.x - 10}" y="${B.y - 16}">GROUP · ${mem.length}</text>`;
    });
    if (ui.sel.wire) { const w = CCS.circuit.wireById(ui.sel.wire); if (w) (w.pts || []).forEach((p, i) => (s += `<circle class="wpt" data-wpt="${i}" cx="${p[0]}" cy="${p[1]}" r="6"/>`)); }
    // badges
    CCS.circuit.parts.forEach(c => {
      if (!c.faults || !c.faults.length) return;
      const lv = c.faults.some(f => f.level === 'error') ? 'error' : c.faults.some(f => f.level === 'warn') ? 'warn' : 'info';
      const b = CCS.circuit.bbox(c), col = { error: '#ff4d5e', warn: '#ffcc33', info: '#3fa3ff' }[lv];
      s += `<g class="badge" data-badge="${c.id}"><title>${c.faults.map(f => CCS.util.esc(f.msg)).join('\n')}</title><circle cx="${b.x2 + 4}" cy="${b.y - 4}" r="10" fill="#0d1730" stroke="${col}" stroke-width="2"/><text x="${b.x2 + 4}" y="${b.y}" text-anchor="middle" font-size="13" font-weight="700" fill="${col}" font-family="Arial">${lv === 'info' ? 'i' : '!'}</text></g>`;
    });
    // circuit-check highlights
    const hl = ui.hl;
    if (hl && performance.now() - hl.t0 < 12000) {
      const pulse = 10 + 4 * Math.sin(performance.now() / 180);
      hl.parts.forEach(id => { const c = CCS.circuit.byId(id); if (!c) return; const b = CCS.circuit.bbox(c); s += `<rect class="hl-ring" x="${b.x - 8}" y="${b.y - 8}" width="${b.x2 - b.x + 16}" height="${b.y2 - b.y + 16}" rx="8" stroke-dasharray="8 5" opacity=".9"/>`; });
      hl.terms.forEach(k => { const [cid, tid] = k.split(':'), c = CCS.circuit.byId(cid), p = c && CCS.termPos(c, tid); if (p) s += `<circle class="hl-ring" cx="${p[0]}" cy="${p[1]}" r="${pulse.toFixed(1)}" stroke="#ff1744"/>`; });
    }
    // wire being drawn
    if (ui.drawing) {
      const dr = ui.drawing, pts = [dr.from, ...dr.pts, dr.to];
      s += `<path d="M${pts.map(p => p.join(' ')).join(' L')}" fill="none" stroke="${dr.kind === 'tube' ? '#1e88e5' : (dr.color === 'gy' ? '#43a047' : dr.color)}" stroke-width="${dr.kind === 'tube' ? 6 : 3}" stroke-dasharray="7 5" opacity=".85" pointer-events="none"/>`;
    }
    if (ui.box) { const b = ui.box; s += `<rect class="marquee" x="${Math.min(b.x0, b.x1)}" y="${Math.min(b.y0, b.y1)}" width="${Math.abs(b.x1 - b.x0)}" height="${Math.abs(b.y1 - b.y0)}"/>`; }
    // multimeter probes
    if (ui.tool === 'meter') ['red', 'black'].forEach(k => {
      const pk = ui.meter[k]; if (!pk) return;
      const [cid, tid] = pk.split(':'), c = CCS.circuit.byId(cid), p = c && CCS.termPos(c, tid); if (!p) return;
      const col = k === 'red' ? '#e53935' : '#212121';
      s += `<g pointer-events="none"><line x1="${p[0]}" y1="${p[1]}" x2="${p[0] + (k === 'red' ? 22 : -22)}" y2="${p[1] - 38}" stroke="${col}" stroke-width="5" stroke-linecap="round"/><circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#ddd" stroke="${col}" stroke-width="2"/></g>`;
    });
    if (s !== overlayCache) { $('layerOverlay').innerHTML = s; overlayCache = s; }
  }

  function init() {
    $('defs').innerHTML = CCS.svgDefs();
    const top = document.createElementNS('http://www.w3.org/2000/svg', 'g'); top.id = 'layerTop';
    $('layerParts').after(top);
    CCS.view.apply();
  }
  function frame() { CCS.attach.syncAll(); parts(); wires(); overlay(); }
  return { init, frame, wirePts, pathD, invalidate() { cache.clear(); wiresCache = ''; overlayCache = ''; } };
})();
