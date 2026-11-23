/* =========================================================================
 * Module 40: circuit model, attachments, serialisation, undo history
 * ========================================================================= */
CCS.circuit = {
  parts: [], wires: [], version: 0, name: '',
  byId(id) { return this.parts.find(p => p.id === id); },
  wireById(id) { return this.wires.find(w => w.id === id); },
  touch() { this.version++; },
  add(c) { this.parts.push(c); this.touch(); return c; },
  addWire(w) { w.id = w.id || CCS.util.uid('w'); this.wires.push(w); this.touch(); return w; },
  removeParts(ids) {
    const set = new Set(ids);
    this.parts = this.parts.filter(p => !set.has(p.id));
    this.wires = this.wires.filter(w => !set.has(w.a.c) && !set.has(w.b.c));
    this.parts.forEach(p => { if (p.props.attach && set.has(p.props.attach)) p.props.attach = ''; if (p.props.link && set.has(p.props.link)) p.props.link = ''; });
    this.touch();
  },
  removeWire(id) { this.wires = this.wires.filter(w => w.id !== id); this.touch(); },
  wiresAt(cid, tid) { return this.wires.filter(w => (w.a.c === cid && w.a.t === tid) || (w.b.c === cid && w.b.t === tid)); },
  /** drop wires whose terminals no longer exist (after a property change) */
  pruneWires() {
    const ok = end => { const c = this.byId(end.c); return c && CCS.termsOf(c).some(t => t.id === end.t); };
    const n = this.wires.length;
    this.wires = this.wires.filter(w => ok(w.a) && ok(w.b));
    if (n !== this.wires.length) this.touch();
  },
  /** count connections per terminal into c.wired */
  computeWired() {
    this.parts.forEach(p => (p.wired = {}));
    this.wires.forEach(w => [w.a, w.b].forEach(e => { const p = this.byId(e.c); if (p) p.wired[e.t] = (p.wired[e.t] || 0) + 1; }));
  },
  nextTag(prefix) {
    const used = new Set(this.parts.map(p => p.props.tag));
    for (let i = 1; i < 999; i++) if (!used.has(prefix + i)) return prefix + i;
    return prefix;
  },
  toJSON() {
    return {
      app: 'ControlLab-EP-Simulator', version: 2,
      parts: this.parts.map(p => ({ id: p.id, type: p.type, x: Math.round(p.x), y: Math.round(p.y), rot: p.rot || 0, ...(p.group ? { group: p.group } : {}), props: p.props })),
      wires: this.wires.map(w => ({ id: w.id, kind: w.kind, a: w.a, b: w.b, color: w.color, gauge: w.gauge, pts: w.pts || [], ...(w.routed ? { routed: true } : {}) })),
    };
  },
  load(json) {
    if (typeof json === 'string') json = JSON.parse(json);
    if (!json || !Array.isArray(json.parts)) throw new Error('Not a circuit file');
    const parts = [];
    json.parts.forEach(p => {
      if (!CCS.types[p.type]) return;
      const props = Object.assign({}, p.props || {});
      if (p.type === 'tblock' && props.ways === undefined) { props.ways = 4; if (props.bridged === undefined) props.bridged = false; }
      const c = CCS.newPart(p.type, p.x, p.y, props);
      c.id = p.id; c.rot = p.rot || 0; if (p.group) c.group = String(p.group);
      parts.push(c);
    });
    this.parts = parts;
    if (json.name) this.name = json.name;
    if (!json.version || json.version < 2) {
      // v1 used IEC relay marking (11/12/14, A1/A2) → v2 uses relay pin numbers
      const MAP = { 11: '9', 21: '10', 31: '11', 41: '12', 12: '1', 22: '2', 32: '3', 42: '4', 14: '5', 24: '6', 34: '7', 44: '8', A1: '13', A2: '14' };
      const relays = new Set(parts.filter(p => p.type === 'relay4').map(p => p.id));
      (json.wires || []).forEach(w => [w.a, w.b].forEach(e => { if (relays.has(e.c) && MAP[e.t]) e.t = MAP[e.t]; }));
    }
    this.wires = (json.wires || []).filter(w => parts.some(p => p.id === w.a.c) && parts.some(p => p.id === w.b.c)).map(w => ({ ...w, pts: w.pts || [] }));
    this.pruneWires();
    this.touch();
  },
  clear() { this.parts = []; this.wires = []; this.touch(); },
  /** world-space bounding box of a part */
  bbox(c) {
    const { w, h } = CCS.size(c);
    const pts = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => CCS.localToWorld(c, x, y));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  },
};

/* --------- mechanical attachments: reed switches clamp onto cylinders --------- */
CCS.attach = {
  place(reed) {
    const cyl = CCS.circuit.byId(reed.props.attach);
    if (!cyl || !cyl.type.startsWith('cyl')) return;
    const g = CCS.cylGeom(cyl);
    const [wx, wy] = CCS.localToWorld(cyl, g.pistonX(+reed.props.pos) + g.pistW / 2, g.bot - 6);
    reed.rot = cyl.rot || 0;
    const { w, h } = CCS.size(reed), an = CCS.types.reed.anchor;
    const [ax, ay] = CCS.util.rot(an[0], an[1], w / 2, h / 2, reed.rot);
    reed.x = wx - ax; reed.y = wy - ay;
  },
  /** after dragging a reed: clamp it to the cylinder under it (or release it) */
  tryAttach(reed) {
    const an = CCS.types.reed.anchor, [X, Y] = CCS.localToWorld(reed, an[0], an[1]);
    let best = null;
    CCS.circuit.parts.forEach(cy => {
      if (!cy.type.startsWith('cyl')) return;
      const g = CCS.cylGeom(cy), [lx, ly] = CCS.worldToLocal(cy, X, Y);
      if (lx > g.tubeA - 15 && lx < g.tubeB + 15 && ly > g.top - 30 && ly < g.bot + 30) {
        let pos = CCS.util.clamp((lx - g.pistonX(0) - g.pistW / 2) / g.sp, 0, 1);
        if (pos < 0.08) pos = 0; if (pos > 0.92) pos = 1;
        best = { cy, pos: Math.round(pos * 100) / 100 };
      }
    });
    if (best) { reed.props.attach = best.cy.id; reed.props.pos = best.pos; this.place(reed); return true; }
    reed.props.attach = '';
    return false;
  },
  syncAll() { CCS.circuit.parts.forEach(p => { if (p.type === 'reed' && p.props.attach) this.place(p); }); },
  updateReeds() {
    CCS.circuit.parts.forEach(p => {
      if (p.type !== 'reed') return;
      const cy = p.props.attach && CCS.circuit.byId(p.props.attach);
      if (cy) { const g = CCS.cylGeom(cy), win = Math.max(0.012, 3 / g.stroke); p.st.closed = Math.abs(cy.st.pos - p.props.pos) <= win; }
      else p.st.closed = !!p.st.man;
    });
  },
};

/* ------------------------------- undo / redo ------------------------------- */
CCS.history = {
  stack: [], idx: -1,
  snapshot() { return JSON.stringify(CCS.circuit.toJSON()); },
  commit() {
    const s = this.snapshot();
    if (this.stack[this.idx] === s) return;
    this.stack = this.stack.slice(0, this.idx + 1); this.stack.push(s);
    if (this.stack.length > 120) this.stack.shift();
    this.idx = this.stack.length - 1;
    try { localStorage.setItem('ccs.autosave.v1', s); } catch (e) { /* storage may be unavailable */ }
  },
  restore(i) {
    if (i < 0 || i >= this.stack.length) return;
    this.idx = i;
    const keepState = new Map(CCS.circuit.parts.map(p => [p.id, p.st]));
    CCS.circuit.load(this.stack[i]);
    CCS.circuit.parts.forEach(p => { if (keepState.has(p.id)) p.st = keepState.get(p.id); });
    try { localStorage.setItem('ccs.autosave.v1', this.stack[i]); } catch (e) { }
  },
  undo() { this.restore(this.idx - 1); },
  redo() { this.restore(this.idx + 1); },
  reset() { this.stack = []; this.idx = -1; this.commit(); },
};
