/* =========================================================================
 * Module 70: editor UI — palette, canvas interaction, properties, multimeter
 * ========================================================================= */
CCS.ui = (() => {
  const $ = id => document.getElementById(id);
  const U = CCS.util, circ = CCS.circuit, AR = CCS.arrange;
  const ui = {
    tool: 'select', sel: { parts: new Set(), wire: null }, drawing: null, box: null, selRect: null,
    meter: { mode: 'V', red: null, black: null, rCache: null }, wireColor: 'auto', propsSig: 0,
    hl: null, doc: { findings: [], active: false, ai: '', goal: '', busy: false },
  };
  let mode = null, drag = null, spaceDown = false;

  /* ------------------------------------------------------------ helpers */
  const hint = (msg, ms = 2600) => { const h = $('hint'); h.textContent = msg; h.classList.add('show'); clearTimeout(hint.t); hint.t = setTimeout(() => h.classList.remove('show'), ms); };
  const snap = v => Math.round(v / 10) * 10;
  const termAt = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const t = el.closest && el.closest('.term'); const p = t && t.closest('.part');
      if (t && p && p.closest('#world')) return { cid: p.dataset.cid, tid: t.dataset.term };
    }
    return null;
  };
  const termDef = (cid, tid) => { const c = circ.byId(cid); return c && CCS.termsOf(c).find(t => t.id === tid); };
  const commit = () => { circ.pruneWires(); CCS.ducts.routeWires(false); CCS.history.commit(); CCS.sim.idleCheck(); ui.propsSig++; if (ui.doc.active) { clearTimeout(commit.t); commit.t = setTimeout(() => { ui.doc.findings = CCS.doctor.run(); updateChip(); }, 250); } };
  const autoColor = (a, b) => {
    const pick = t => {
      if (t === 'L') return '#795548'; if (t === 'N') return '#4fc3f7'; if (t === 'PE' || t === 'FG') return 'gy';
      if (/^\+/.test(t)) return '#d32f2f'; if (/^-/.test(t)) return '#1a237e';
      return null;
    };
    return pick(a) || pick(b) || '#d32f2f';
  };

  /* ------------------------------------------------------------ palette */
  function buildPalette(filter = '') {
    const list = $('paletteList'); list.innerHTML = '';
    const f = filter.trim().toLowerCase();
    CCS.catOrder.forEach(cat => {
      const items0 = Object.values(CCS.types).filter(T => T.cat === cat).map(T => ({ type: T.type, name: T.name, info: T.info || '', props: {} }))
        .concat((CCS.variants || []).filter(v => v.cat === cat).map(v => ({ type: v.type, name: v.name, info: CCS.types[v.type].info || '', props: v.props })));
      const types = items0.filter(it => !f || (it.name + ' ' + it.info).toLowerCase().includes(f));
      if (!types.length) return;
      const box = document.createElement('div'); box.className = 'pcat';
      box.innerHTML = `<div class="pcat-h"><span>${cat}</span><span>▾</span></div><div class="pitems"></div>`;
      box.querySelector('.pcat-h').onclick = () => box.classList.toggle('closed');
      const items = box.querySelector('.pitems');
      types.forEach(it => {
        const T = CCS.types[it.type], c = CCS.newPart(it.type, 0, 0, U.deep(it.props)); const { w, h } = CCS.size(c);
        const el = document.createElement('div'); el.className = 'pitem'; el.title = it.name;
        el.innerHTML = `<svg viewBox="-4 -4 ${w + 8} ${h + 8}" preserveAspectRatio="xMidYMid meet">${T.draw(c)}</svg><span>${U.esc(it.name)}</span>`;
        el.addEventListener('pointerdown', e => startPaletteDrag(e, it.type, el, it.props));
        items.appendChild(el);
      });
      list.appendChild(box);
    });
  }
  function startPaletteDrag(e, type, el, props = {}) {
    e.preventDefault();
    const ghost = el.cloneNode(true); ghost.style.cssText = 'position:fixed;pointer-events:none;width:110px;opacity:.85;z-index:40;';
    document.body.appendChild(ghost);
    const move = ev => { ghost.style.left = ev.clientX - 55 + 'px'; ghost.style.top = ev.clientY - 35 + 'px'; };
    move(e);
    const sx = e.clientX, sy = e.clientY;
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); ghost.remove();
      const r = $('canvas').getBoundingClientRect();
      const inside = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
      const moved = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6;
      let X, Y;
      if (inside && moved) [X, Y] = CCS.view.toWorld(ev.clientX, ev.clientY);
      else if (!moved) [X, Y] = CCS.view.toWorld(r.left + r.width / 2, r.top + r.height / 2);
      else return;
      addPart(type, X, Y, props);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function addPart(type, X, Y, props = {}) {
    const c = CCS.newPart(type, 0, 0, U.deep(props));
    const { w, h } = CCS.size(c);
    c.x = snap(X - w / 2); c.y = snap(Y - h / 2);
    if ('tag' in c.props && c.props.tag) {
      const m = /^([A-Za-z]+\d*[A-Za-z]*?)(\d+)$/.exec(c.props.tag);
      if (m && circ.parts.some(p => p.props.tag === c.props.tag)) c.props.tag = circ.nextTag(m[1]);
    }
    circ.add(c);
    if (type === 'reed') CCS.attach.tryAttach(c);
    select([c.id]); commit();
  }

  /* ------------------------------------------------------------ selection */
  function select(ids, add = false) {
    if (!add) ui.sel.parts.clear();
    ids.forEach(id => ui.sel.parts.add(id));
    ui.sel.wire = null; ui.propsSig++;
  }
  function clearSel() { ui.sel.parts.clear(); ui.sel.wire = null; ui.propsSig++; }

  /* ------------------------------------------------------------ canvas events */
  function pruneSel() { [...ui.sel.parts].forEach(id => { if (!circ.byId(id)) ui.sel.parts.delete(id); }); if (ui.sel.wire && !circ.wireById(ui.sel.wire)) ui.sel.wire = null; }
  function onDown(e) {
    const svg = $('canvas');
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    pruneSel(); mode = null; drag = null;
    svg.setPointerCapture(e.pointerId);
    const [X, Y] = CCS.view.toWorld(e.clientX, e.clientY);
    const tgt = e.target;
    if (e.button === 1 || e.button === 2 || spaceDown) { if (e.button === 2 && ui.drawing) { ui.drawing = null; return; } mode = 'pan'; drag = { sx: e.clientX, sy: e.clientY, vx: CCS.view.x, vy: CCS.view.y }; svg.classList.add('panning'); return; }
    const term = termAt(e.clientX, e.clientY);
    if (ui.tool === 'meter') {
      if (term) setProbe(term.cid + ':' + term.tid);
      else { mode = 'pan'; drag = { sx: e.clientX, sy: e.clientY, vx: CCS.view.x, vy: CCS.view.y }; }
      return;
    }
    if (ui.drawing) {
      if (term) finishWire(term);
      else ui.drawing.pts.push([snap(X), snap(Y)]);
      return;
    }
    const badge = tgt.closest('[data-badge]');
    if (badge) { select([badge.dataset.badge]); return; }
    const wpt = tgt.closest('[data-wpt]');
    if (wpt && ui.sel.wire) { mode = 'wpt'; drag = { w: circ.wireById(ui.sel.wire), i: +wpt.dataset.wpt }; return; }
    const partEl = tgt.closest('.part'), actEl = tgt.closest('[data-act]');
    if (term && !(actEl && partEl && !tgt.closest('.term'))) { startWire(term, X, Y, e); return; }
    if (actEl && partEl && circ.byId(partEl.dataset.cid)) {
      const c = circ.byId(partEl.dataset.cid), T = CCS.types[c.type];
      if (T.act && T.act(c, actEl.dataset.act, 'down')) { mode = 'act'; drag = { c, name: actEl.dataset.act }; if (!ui.sel.parts.has(c.id)) select([c.id]); return; }
    }
    if (partEl && circ.byId(partEl.dataset.cid)) {
      const id = partEl.dataset.cid;
      const unit = e.altKey ? [id] : AR.expand([id]);
      if (e.shiftKey) { const on = ui.sel.parts.has(id); unit.forEach(u => (on ? ui.sel.parts.delete(u) : ui.sel.parts.add(u))); ui.sel.wire = null; ui.propsSig++; }
      else if (!ui.sel.parts.has(id) || e.altKey) select(unit);
      startMove(X, Y, id);
      return;
    }
    // empty space inside the selection frame: grab the whole selection
    const fr = selFrame();
    if (fr && !e.shiftKey && X >= fr.x && X <= fr.x2 && Y >= fr.y && Y <= fr.y2) { startMove(X, Y, null); drag.frameGrab = true; return; }
    const wh = tgt.closest('[data-wid]');
    if (wh) { clearSel(); ui.sel.wire = wh.dataset.wid; return; }
    // empty board: drag a selection rectangle; parts it touches are selected live (Shift adds)
    mode = 'box'; ui.box = { x0: X, y0: Y, x1: X, y1: Y, sx: e.clientX, sy: e.clientY, moved: false, base: e.shiftKey ? new Set(ui.sel.parts) : new Set() };
    if (!e.shiftKey) { clearSel(); ui.hl = null; }
  }
  /** start moving the whole selection; the grabbed part (or the first one) snaps to the grid, the rest keep their spacing */
  function startMove(X, Y, grabId) {
    mode = 'drag';
    // reeds clamped to a cylinder that is also moving just follow it
    const moving = [...ui.sel.parts].map(pid => circ.byId(pid)).filter(Boolean).filter(c => !(AR.follows(c) && ui.sel.parts.has(c.props.attach)));
    drag = { X, Y, moved: false, start: moving.map(c => ({ c, x: c.x, y: c.y })) };
    drag.anchor = drag.start.find(s => s.c.id === grabId) || drag.start[0];
    const fr = selFrame(); drag.fr0 = fr ? { ...fr } : null;
    // wires fully inside the selection move their bends too
    drag.wires = circ.wires.filter(w => ui.sel.parts.has(w.a.c) && ui.sel.parts.has(w.b.c)).map(w => ({ w, pts: (w.pts || []).map(p => [...p]) }));
  }
  const selSig = () => [...ui.sel.parts].sort().join();
  /** the selection frame: fixed in size once set (the released rectangle, or the selection bounds at that moment),
   *  it only travels with the parts. Grab anywhere inside it to move everything. */
  function selFrame() {
    if (ui.box || ui.sel.parts.size < 2) return null;
    const sig = selSig();
    if (ui.selRect && ui.selRect.sig === sig) return ui.selRect;
    const list = [...ui.sel.parts].map(id => circ.byId(id)).filter(Boolean); if (list.length < 2) return null;
    const B = AR.box(list), m = 14;
    return (ui.selRect = { x: B.x - m, y: B.y - m, x2: B.x2 + m, y2: B.y2 + m, sig });
  }
  /** after align / distribute / rotate: if a part ended up outside the frame, refit it once */
  function refitFrame() {
    const fr = ui.selRect; if (!fr || fr.sig !== selSig()) return;
    const out = [...ui.sel.parts].map(id => circ.byId(id)).filter(Boolean).some(c => { const b = circ.bbox(c); return b.x < fr.x || b.x2 > fr.x2 || b.y < fr.y || b.y2 > fr.y2; });
    if (out) ui.selRect = null;
  }
  /** parts touched by the rectangle, expanded to whole groups */
  function boxHits(b) {
    const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
    return AR.expand(circ.parts.filter(c => { const bb = circ.bbox(c); return bb.x2 >= x0 && bb.x <= x1 && bb.y2 >= y0 && bb.y <= y1; }).map(c => c.id));
  }
  function onMove(e) {
    const [X, Y] = CCS.view.toWorld(e.clientX, e.clientY);
    if (ui.drawing) {
      const t = termAt(e.clientX, e.clientY);
      ui.drawing.to = t ? CCS.termPos(circ.byId(t.cid), t.tid) : [X, Y];
      if (Math.hypot(e.clientX - ui.drawing.sx, e.clientY - ui.drawing.sy) > 8) ui.drawing.moved = true;
    }
    if (mode && mode !== 'wiredrag' && !drag && mode !== 'box') { mode = null; return; }
    if (mode === 'pan') { CCS.view.x = drag.vx + e.clientX - drag.sx; CCS.view.y = drag.vy + e.clientY - drag.sy; CCS.view.apply(); }
    else if (mode === 'drag') {
      const dx = X - drag.X, dy = Y - drag.Y;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      // one common offset for everything: the grabbed part lands on the grid (Alt = no snapping), spacing never changes
      const A = drag.anchor; if (!A) return;
      const ddx = e.altKey ? dx : snap(A.x + dx) - A.x, ddy = e.altKey ? dy : snap(A.y + dy) - A.y;
      drag.start.forEach(s => { s.c.x = s.x + ddx; s.c.y = s.y + ddy; if (s.c.type === 'reed') s.c.props.attach = ''; });
      drag.wires.forEach(o => (o.w.pts = o.pts.map(p => [p[0] + ddx, p[1] + ddy])));
      if (drag.fr0 && ui.selRect) ui.selRect = { ...drag.fr0, x: drag.fr0.x + ddx, x2: drag.fr0.x2 + ddx, y: drag.fr0.y + ddy, y2: drag.fr0.y2 + ddy, sig: selSig() };
    } else if (mode === 'wpt') { drag.w.pts[drag.i] = [snap(X), snap(Y)]; drag.w.routed = false; }
    else if (mode === 'box' && ui.box) {
      const B = ui.box; B.x1 = X; B.y1 = Y;
      if (!B.moved && Math.hypot(e.clientX - B.sx, e.clientY - B.sy) > 4) B.moved = true;
      if (B.moved) {
        const sig = [...new Set([...B.base, ...boxHits(B)])].sort().join();
        if (sig !== B.sig) { B.sig = sig; ui.sel.parts.clear(); if (sig) sig.split(',').forEach(id => ui.sel.parts.add(id)); ui.sel.wire = null; ui.propsSig++; }
      }
    } else if (!mode) {
      // hover: show the move cursor over a multi-part selection
      const fr = selFrame(), svg = $('canvas'), inFr = !!fr && X >= fr.x && X <= fr.x2 && Y >= fr.y && Y <= fr.y2;
      if (inFr !== svg.classList.contains('over-sel')) svg.classList.toggle('over-sel', inFr);
    }
  }
  function onUp(e) {
    try { upInner(e); } catch (err) { console.error(err); }
    mode = null; drag = null; ui.box = null; $('canvas').classList.remove('panning');
  }
  function upInner(e) {
    if (mode && mode !== 'wiredrag' && mode !== 'box' && !drag) return;
    if (mode === 'act') { const T = CCS.types[drag.c.type]; T.act(drag.c, drag.name, 'up'); }
    else if (mode === 'drag') {
      if (drag.moved) { drag.start.forEach(s => { if (s.c.type === 'reed') CCS.attach.tryAttach(s.c); }); commit(); }
      else if (drag.frameGrab) { clearSel(); ui.hl = null; }  // plain click inside the frame deselects
    } else if (mode === 'wpt') commit();
    else if (mode === 'box') {
      // on release the rectangle freezes: it becomes the selection frame, a fixed size that encloses everything selected
      const B = ui.box; ui.box = null;
      if (B.moved && ui.sel.parts.size > 1) {
        const list = [...ui.sel.parts].map(id => circ.byId(id)).filter(Boolean), P = AR.box(list), m = 6;
        ui.selRect = { x: Math.min(B.x0, B.x1, P.x - m), y: Math.min(B.y0, B.y1, P.y - m), x2: Math.max(B.x0, B.x1, P.x2 + m), y2: Math.max(B.y0, B.y1, P.y2 + m), sig: selSig() };
      }
    }
    if (ui.drawing && ui.drawing.moved && mode === 'wiredrag') {
      const t = termAt(e.clientX, e.clientY);
      if (t && !(t.cid === ui.drawing.a.c && t.tid === ui.drawing.a.t)) finishWire(t);
    }
    mode = null; drag = null;
  }
  function onDbl(e) {
    const wpt = e.target.closest('[data-wpt]');
    if (wpt && ui.sel.wire) { const w = circ.wireById(ui.sel.wire); w.pts.splice(+wpt.dataset.wpt, 1); w.routed = false; commit(); return; }
    const wh = e.target.closest('[data-wid]');
    if (wh) {
      const w = circ.wireById(wh.dataset.wid), [X, Y] = CCS.view.toWorld(e.clientX, e.clientY), pts = CCS.render.wirePts(w);
      let bi = 0, bd = 1e9;
      for (let i = 0; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; const d = U.dist(m, [X, Y]); if (d < bd) { bd = d; bi = i; } }
      w.pts.splice(bi, 0, [snap(X), snap(Y)]); w.routed = false; clearSel(); ui.sel.wire = w.id; commit();
    }
  }
  function startWire(term, X, Y, e) {
    const td = termDef(term.cid, term.tid);
    const kind = td.k === 'p' ? 'tube' : 'wire';
    if (kind === 'tube' && circ.wiresAt(term.cid, term.tid).length >= 1) hint('This push-in port already has a tube. Use a T-fitting to branch.');
    const color = kind === 'tube' ? '#1e88e5' : (ui.wireColor === 'auto' ? autoColor(term.tid, '') : ui.wireColor);
    ui.drawing = { a: { c: term.cid, t: term.tid }, kind, color, from: CCS.termPos(circ.byId(term.cid), term.tid), to: [X, Y], pts: [], sx: e.clientX, sy: e.clientY, moved: false };
    mode = 'wiredrag';
    $('canvas').classList.add('wiring');
    hint(kind === 'tube' ? 'Tube: click another blue port (click empty space to add bends, Esc to cancel)' : 'Wire: click another terminal (click empty space to add bends, Esc to cancel)');
  }
  function finishWire(t) {
    const d = ui.drawing, td = termDef(t.cid, t.tid);
    if (t.cid === d.a.c && t.tid === d.a.t) return;
    if ((td.k === 'p') !== (d.kind === 'tube')) { hint('Electrical terminals and air ports cannot be connected to each other.'); return; }
    if (d.kind === 'tube' && circ.wiresAt(t.cid, t.tid).length >= 1) { hint('That port already has a tube — a push-in fitting takes one tube. Add a T-fitting.'); return; }
    if (circ.wires.some(w => (w.a.c === d.a.c && w.a.t === d.a.t && w.b.c === t.cid && w.b.t === t.tid) || (w.b.c === d.a.c && w.b.t === d.a.t && w.a.c === t.cid && w.a.t === t.tid))) { hint('These two points are already connected.'); ui.drawing = null; $('canvas').classList.remove('wiring'); return; }
    let color = d.color;
    if (d.kind === 'wire' && ui.wireColor === 'auto') color = autoColor(d.a.t, t.tid);
    const gauge = d.kind === 'wire' && [d.a.t, t.tid].some(x => ['L', 'N', 'PE', '1', '2', '3', '4', '5', '6'].includes(x) && circ.byId(d.a.c) && ['mains', 'mcb', 'motor', 'contactor'].includes(circ.byId(d.a.c).type)) ? '1.5' : '0.75';
    const auto = d.kind === 'wire' && !d.pts.length && $('optDuct').checked && circ.parts.some(c => c.type === 'duct');
    const w = circ.addWire({ kind: d.kind, a: d.a, b: { c: t.cid, t: t.tid }, color, gauge, pts: d.pts, routed: auto });
    ui.drawing = null; $('canvas').classList.remove('wiring');
    clearSel(); ui.sel.wire = w.id; commit();
  }

  /* ------------------------------------------------------------ commands */
  const cmds = {
    new: () => CCS.dialog.confirm('New circuit', 'Clear the canvas? (Unsaved work is lost — use Save first if needed.)', () => { CCS.sim.reset(); circ.clear(); clearSel(); commit(); }),
    open: () => $('fileInput').click(),
    export: () => exportDialog(),
    examples: () => examplesDialog(),
    bom: () => bomDialog(),
    help: () => helpDialog(),
    undo: () => { CCS.history.undo(); clearSel(); CCS.sim.idleCheck(); if (ui.doc.active) { ui.doc.findings = CCS.doctor.run(); updateChip(); } },
    redo: () => { CCS.history.redo(); clearSel(); CCS.sim.idleCheck(); if (ui.doc.active) { ui.doc.findings = CCS.doctor.run(); updateChip(); } },
    rotate: () => { const ids = [...ui.sel.parts].filter(id => circ.byId(id)); if (!ids.length) return; AR.rotate(ids); refitFrame(); commit(); },
    group: () => {
      const ids = [...ui.sel.parts]; if (AR.expand(ids).length < 2) return hint('Select two or more parts to group them');
      AR.group(ids); select(AR.expand(ids)); commit(); hint('Grouped — the parts now select and move together (Alt+click picks one member)');
    },
    ungroup: () => { const n = AR.ungroup([...ui.sel.parts]); if (!n) return hint('Nothing grouped in the selection'); ui.propsSig++; commit(); hint('Ungrouped'); },
    align: how => { if (AR.align([...ui.sel.parts], how) < 2) return hint('Select two or more parts or groups to align'); refitFrame(); commit(); },
    distribute: axis => { if (AR.distribute([...ui.sel.parts], axis) < 3) return hint('Select three or more parts or groups to distribute'); refitFrame(); commit(); },
    selectAll: () => { select(circ.parts.map(c => c.id)); },
    nudge: (dx, dy) => { const U2 = AR.units([...ui.sel.parts]); if (!U2.length) return; const fr = selFrame(); U2.forEach(u => AR.move(u, dx, dy)); if (fr) ui.selRect = { ...fr, x: fr.x + dx, x2: fr.x2 + dx, y: fr.y + dy, y2: fr.y2 + dy }; circ.touch(); commit(); },
    duplicate: () => {
      const ids = [...ui.sel.parts]; if (!ids.length) return;
      const map = new Map(), news = [];
      ids.forEach(id => { const o = circ.byId(id); const c = CCS.newPart(o.type, o.x + 40, o.y + 40, U.deep(o.props)); c.rot = o.rot; if (c.props.tag) c.props.tag = circ.nextTag(String(c.props.tag).replace(/\d+$/, '')); map.set(id, c.id); circ.add(c); news.push(c.id); });
      circ.wires.filter(w => map.has(w.a.c) && map.has(w.b.c)).forEach(w => circ.addWire({ ...U.deep(w), id: null, a: { c: map.get(w.a.c), t: w.a.t }, b: { c: map.get(w.b.c), t: w.b.t }, pts: (w.pts || []).map(p => [p[0] + 40, p[1] + 40]) }));
      circ.parts.forEach(p => { if (news.includes(p.id) && p.props.attach && map.has(p.props.attach)) p.props.attach = map.get(p.props.attach); });
      // copies of a group form a new group of their own
      const gmap = new Map();
      ids.forEach(id => { const o = circ.byId(id); if (o.group) { if (!gmap.has(o.group)) gmap.set(o.group, U.uid('g')); circ.byId(map.get(id)).group = gmap.get(o.group); } });
      select(news); commit();
    },
    delete: () => {
      if (ui.sel.wire) { circ.removeWire(ui.sel.wire); ui.sel.wire = null; commit(); return; }
      if (ui.sel.parts.size) { circ.removeParts([...ui.sel.parts]); clearSel(); commit(); }
    },
    run: () => { const was = CCS.sim.running; CCS.sim.start(); syncRunBtn(); if (!was) setTimeout(autoDoctor, 400); },
    reset: () => { CCS.sim.reset(); syncRunBtn(); CCS.sim.idleCheck(); ui.doc.active = false; ui.hl = null; $('docChip').classList.add('hidden'); },
    check: () => doctorDialog(true),
    zoomIn: () => { const r = $('canvas').getBoundingClientRect(); CCS.view.zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); },
    zoomOut: () => { const r = $('canvas').getBoundingClientRect(); CCS.view.zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); },
    zoomFit: () => CCS.view.fit(),
  };
  function syncRunBtn() {
    const b = $('btnRun'), s = CCS.sim;
    b.textContent = s.running && !s.paused ? '❚❚ Pause' : (s.paused ? '▶ Resume' : '▶ Run');
    b.classList.toggle('running', s.running && !s.paused);
    const st = $('stState'); st.textContent = s.running ? (s.paused ? '❚❚ Paused' : '● Running') : '● Stopped (de-energised)'; st.classList.toggle('running', s.running && !s.paused);
  }
  function setTool(t) {
    ui.tool = t; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    $('meter').classList.toggle('hidden', t !== 'meter'); $('canvas').classList.toggle('meter', t === 'meter');
    ui.drawing = null;
    if (t === 'meter') hint('Multimeter: click a terminal for the RED probe, then another for the BLACK probe.');
  }

  /* ------------------------------------------------------------ multimeter */
  function setProbe(k) {
    const m = ui.meter;
    if (!m.red || (m.red && m.black)) { m.red = k; m.black = null; } else m.black = k;
    m.rCache = null; m.rT = 0;
  }
  function meterFrame() {
    if (ui.tool !== 'meter') return;
    const m = ui.meter, lcd = $('meterLcd'), sub = $('meterSub');
    const name = k => { if (!k) return '—'; const [cid, tid] = k.split(':'), c = circ.byId(cid); return c ? `${c.props.tag || CCS.types[c.type].name}:${tid}` : '?'; };
    if (!m.red || !m.black) { lcd.textContent = m.mode === 'V' ? '0.00 V' : 'O.L Ω'; sub.textContent = m.red ? `Red on ${name(m.red)} — pick the black probe terminal` : 'Pick the red probe terminal'; return; }
    const R = CCS.sim.R, A = R.node(m.red), B = R.node(m.black);
    const dc = A.dc - B.dc, ac = Math.abs(A.ac - B.ac);
    if (m.mode === 'V') {
      if (!CCS.sim.running) { lcd.textContent = '0.00 V'; sub.textContent = `${name(m.red)} → ${name(m.black)} · circuit not energised (press Run)`; return; }
      lcd.textContent = ac > Math.abs(dc) && ac > 0.05 ? ac.toFixed(ac < 100 ? 2 : 1) + ' V∿' : (Math.abs(dc) < 0.005 ? '0.00' : dc.toFixed(Math.abs(dc) < 100 ? 2 : 1)) + ' V⎓';
      sub.textContent = `${name(m.red)} (+) → ${name(m.black)} (−) · DC ${dc.toFixed(2)} V · AC ${ac.toFixed(1)} V`;
    } else {
      const now = performance.now();
      if (m.rCache === null || now - m.rT > 300) { m.rCache = CCS.Elec.measureR(circ, m.red, m.black); m.rT = now; }
      const r = m.rCache, live = CCS.sim.running && (Math.abs(dc) > 0.5 || ac > 0.5);
      lcd.textContent = r === Infinity ? 'O.L  Ω' : r < 1 ? r.toFixed(2) + ' Ω ♪' : U.fmt(r, 'Ω', 4);
      sub.textContent = (live ? '⚠ LIVE circuit — switch off before measuring resistance! ' : '') + `${name(m.red)} ↔ ${name(m.black)}` + (r < 1 ? ' · continuity (beep)' : '');
    }
  }

  /* ------------------------------------------------------------ properties panel */
  const readoutKeys = [
    ['on', 'Energised', v => (v ? 'YES' : 'no')], ['vc', 'Coil voltage', v => v.toFixed(1) + ' V'], ['out', 'Timed output', v => (v ? 'switched' : 'rest')], ['t', 'Elapsed', v => v.toFixed(2) + ' s'],
    ['pressed', 'Operated', v => (v ? 'YES' : 'no')], ['pos', 'Position', (v, c) => (c.type.startsWith('cyl') ? Math.round(v * 100) + ' %  (' + Math.round(v * c.props.stroke) + ' mm)' : (v ? '1 (14 side)' : '0 (home)'))],
    ['v', 'Speed', v => Math.abs(v).toFixed(0) + ' mm/s'], ['V', 'Voltage', v => v.toFixed(2) + ' V'], ['F', 'Force', v => Math.round(v) + ' N'], ['p1', 'Pilot pressure (port 1)', v => v.toFixed(1) + ' bar'], ['p', 'Pressure', v => v.toFixed(2) + ' bar'],
    ['I', 'Current', v => U.fmt(v, 'A')], ['vout', 'Output voltage', v => v.toFixed(2) + ' V'], ['iout', 'Output current', v => U.fmt(v, 'A')], ['pw', 'Sensor powered', v => (v ? 'yes' : 'no')], ['obj', 'Object present', v => (v ? 'yes' : 'no')],
    ['closed', 'Contact', v => (v ? 'CLOSED' : 'open')], ['act', 'Actuated', v => (v ? 'yes' : 'no')], ['lit', 'Lamp', v => (v ? 'ON' : 'off')], ['trip', 'Tripped', v => (v ? 'YES' : 'no')], ['cc', 'Current limit', v => (v ? 'ACTIVE' : 'off')],
  ];
  function propsStatic() {
    const P = $('props');
    if (ui.sel.wire) {
      const w = circ.wireById(ui.sel.wire); if (!w) { ui.sel.wire = null; return propsStatic(); }
      const da = termDef(w.a.c, w.a.t), db = termDef(w.b.c, w.b.t), ca = circ.byId(w.a.c), cb = circ.byId(w.b.c);
      const pts = CCS.render.wirePts(w); let L = 0; for (let i = 1; i < pts.length; i++) L += U.dist(pts[i - 1], pts[i]);
      L = L / CCS.PX_PER_CM; // board scale: 1 cm = 20 px
      P.innerHTML = `<h3>${w.kind === 'tube' ? 'Air tube (PU)' : 'Wire'}</h3><div class="sub">${U.esc(ca.props.tag || '')}:${w.a.t} (${U.esc(da?.d || '')}) → ${U.esc(cb.props.tag || '')}:${w.b.t} (${U.esc(db?.d || '')})</div>` +
        (w.kind === 'wire' ? `<div class="prow"><label>Colour</label><select id="wColor">${CCS.wireColors.filter(c => c[0] !== 'auto').map(([v, n]) => `<option value="${v}" ${w.color === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>` +
          `<div class="prow"><label>Cross-section</label><select id="wGauge">${['0.5', '0.75', '1.0', '1.5', '2.5'].map(g => `<option ${(w.gauge || '0.75') === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>` :
          `<div class="prow"><label>Tube colour</label><select id="wColor">${[['#1e88e5', 'Blue Ø6'], ['#212121', 'Black Ø6'], ['#90caf9', 'Clear Ø6'], ['#fb8c00', 'Orange Ø8']].map(([v, n]) => `<option value="${v}" ${w.color === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`) +
        `<div class="kv"><span>Approx. length</span><span>${Math.round(L)} cm</span><span>Bends</span><span>${(w.pts || []).length}${w.routed ? ' (in ducts)' : ''}</span></div>` +
        `<div class="sec"><h4>Live</h4><div id="propsLive"></div></div>` +
        `<div class="btnrow">${w.kind === 'wire' && circ.parts.some(c => c.type === 'duct') ? '<button id="wRoute">Route via ducts</button>' : ''}<button id="wStraight">Remove bends</button><button id="wDel">Delete</button></div><p class="info-txt">Double-click the wire to add a bend; drag the white handles; double-click a handle to remove it.</p>`;
      const ch = () => { w.color = $('wColor').value; if ($('wGauge')) w.gauge = $('wGauge').value; commit(); };
      $('wColor').onchange = ch; if ($('wGauge')) $('wGauge').onchange = ch;
      $('wStraight').onclick = () => { w.pts = []; w.routed = false; commit(); }; $('wDel').onclick = cmds.delete;
      if ($('wRoute')) $('wRoute').onclick = () => { w.routed = true; commit(); hint(w.pts.length ? 'Wire laid through the ducts' : 'Ducts are not connected between these two points'); };
      return;
    }
    if (ui.sel.parts.size === 1) {
      const c = circ.byId([...ui.sel.parts][0]); if (!c) { clearSel(); return propsStatic(); }
      const T = CCS.types[c.type];
      let h = `<h3>${U.esc(c.type === 'prox' ? c.props.kind + ' sensor (3-wire)' : T.name)}</h3><div class="sub">${U.esc(c.props.tag || '')}</div>`;
      T.props.forEach(p => {
        const v = c.props[p.key], id = 'pp_' + p.key;
        let inp;
        if (p.type === 'select') inp = `<select id="${id}">${p.options.map(o => `<option ${String(v) === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
        else if (p.type === 'check') inp = `<input type="checkbox" id="${id}" ${v ? 'checked' : ''}>`;
        else if (p.type === 'number') inp = `<input type="number" id="${id}" value="${v}" min="${p.min}" max="${p.max}" step="${p.step}">`;
        else if (p.type === 'range') inp = `<input type="range" id="${id}" value="${v}" min="${p.min}" max="${p.max}" step="${p.step}" title="${v}">`;
        else if (p.type === 'cyl') inp = `<select id="${id}"><option value="">— none —</option>${circ.parts.filter(q => q.type.startsWith('cyl')).map(q => `<option value="${q.id}" ${v === q.id ? 'selected' : ''}>${U.esc(q.props.tag)}</option>`).join('')}</select>`;
        else inp = `<input type="text" id="${id}" value="${U.esc(v)}">`;
        h += `<div class="prow"><label for="${id}">${U.esc(p.label)}</label>${inp}</div>`;
      });
      h += `<div class="sec"><h4>Live readings</h4><div id="propsLive"></div></div>`;
      h += `<div class="btnrow"><button data-pc="rotate">⟳ Rotate</button><button data-pc="duplicate">⧉ Duplicate</button><button data-pc="delete">🗑 Delete</button><button data-pc="repair">🔧 Repair</button>${c.type === 'reed' && c.props.attach ? '<button data-pc="detach">Detach</button>' : ''}${c.group ? '<button data-pc="ungroup" title="Remove this part from its group">⬚ Leave group</button>' : ''}${c.type === 'duct' ? '<button data-pc="routeAll">🧵 Route all wires through ducts</button><button data-pc="unroute">Free all wires</button>' : ''}</div>`;
      h += `<div class="sec"><h4>Real part & wiring notes</h4><div class="info-txt">${U.esc(T.info || '')}</div></div>`;
      h += `<div class="sec"><h4>Terminals</h4><div class="tlist">${CCS.termsOf(c).map(t => `<b>${U.esc(t.id)}</b><span>${U.esc(t.d || '')}${(c.wired || {})[t.id] ? ' · ' + c.wired[t.id] + ' conn.' : ''}</span>`).join('')}</div></div>`;
      P.innerHTML = h;
      T.props.forEach(p => {
        const el = $('pp_' + p.key);
        const apply = () => {
          let v = p.type === 'check' ? el.checked : el.value;
          if (p.type === 'number' || p.type === 'range') { v = U.clamp(+v, p.min, p.max); if (!isFinite(v)) v = p.def; }
          c.props[p.key] = v;
          if (c.type === 'reed' && (p.key === 'attach' || p.key === 'pos')) CCS.attach.place(c);
          circ.touch(); commit();
        };
        el.addEventListener(p.type === 'text' || p.type === 'range' ? 'input' : 'change', apply);
        if (p.type === 'text') el.addEventListener('change', () => (ui.propsSig++));
      });
      P.querySelectorAll('[data-pc]').forEach(b => (b.onclick = () => {
        const a = b.dataset.pc;
        if (a === 'repair') { const keep = { pos: c.st.pos }; CCS.initPart(c); if (keep.pos !== undefined && c.type.startsWith('cyl')) c.st.pos = keep.pos; hint('Part replaced with a new one.'); }
        else if (a === 'detach') { c.props.attach = ''; c.x += 30; c.y += 60; commit(); }
        else if (a === 'routeAll') { const n = CCS.ducts.routeWires(true); commit(); hint(n + ' wire(s) laid through the ducts'); }
        else if (a === 'unroute') { circ.wires.forEach(w => { if (w.routed) { w.routed = false; w.pts = []; } }); commit(); hint('Wires freed from the ducts'); }
        else cmds[a]();
      }));
      return;
    }
    if (ui.sel.parts.size > 1) {
      const ids = [...ui.sel.parts], nU = AR.units(ids).length, nG = AR.groupsIn(ids).size;
      const allOneGroup = nG === 1 && ids.every(id => (circ.byId(id) || {}).group);
      const ico = d => `<svg viewBox="0 0 20 20" width="18" height="18">${d}</svg>`;
      const R = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="currentColor" opacity=".75"/>`;
      const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.6"/>`;
      const AL = [
        ['left', 'Align left edges', L(3, 2, 3, 18) + R(5, 4, 11, 4) + R(5, 12, 7, 4)],
        ['hcenter', 'Align centres (vertical line)', L(10, 2, 10, 18) + R(4, 4, 12, 4) + R(6, 12, 8, 4)],
        ['right', 'Align right edges', L(17, 2, 17, 18) + R(4, 4, 11, 4) + R(8, 12, 7, 4)],
        ['top', 'Align top edges', L(2, 3, 18, 3) + R(4, 5, 4, 11) + R(12, 5, 4, 7)],
        ['vcenter', 'Align middles (horizontal line)', L(2, 10, 18, 10) + R(4, 4, 4, 12) + R(12, 6, 4, 8)],
        ['bottom', 'Align bottom edges', L(2, 17, 18, 17) + R(4, 4, 4, 11) + R(12, 8, 4, 7)],
      ].map(([k, t, d]) => `<button class="ibtn" data-al="${k}" title="${t}"${nU < 2 ? ' disabled' : ''}>${ico(d)}</button>`).join('');
      const DI = [
        ['h', 'Distribute horizontally (equal gaps)', R(2, 6, 3, 8) + R(8.5, 6, 3, 8) + R(15, 6, 3, 8)],
        ['v', 'Distribute vertically (equal gaps)', R(6, 2, 8, 3) + R(6, 8.5, 8, 3) + R(6, 15, 8, 3)],
      ].map(([k, t, d]) => `<button class="ibtn" data-di="${k}" title="${t}"${nU < 3 ? ' disabled' : ''}>${ico(d)}</button>`).join('');
      P.innerHTML = `<h3>${allOneGroup ? 'Group' : ids.length + ' parts selected'}</h3>` +
        `<div class="sub">${allOneGroup ? ids.length + ' parts · moves, rotates and duplicates as one unit · Alt+click to pick one member' : nU + ' unit' + (nU === 1 ? '' : 's') + (nG ? ' · ' + nG + ' group' + (nG > 1 ? 's' : '') : '') + ' — a group counts as one unit'}</div>` +
        `<div class="btnrow">${allOneGroup ? '' : '<button data-pc="group" title="Ctrl+G">▣ Group</button>'}${nG ? '<button data-pc="ungroup" title="Ctrl+Shift+G">⬚ Ungroup</button>' : ''}<button data-pc="rotate">⟳ Rotate</button><button data-pc="duplicate">⧉ Duplicate</button><button data-pc="delete">🗑 Delete</button></div>` +
        `<div class="sec"><h4>Align</h4><div class="ibar">${AL}</div><h4 style="margin-top:8px">Distribute</h4><div class="ibar">${DI}</div><div class="sub" style="margin-top:6px">Drag inside the frame to move everything (Alt = no snapping). Align uses the edges of the whole selection. Arrow keys nudge one grid step (Shift = 1 mm).</div></div>` +
        `<div class="sec"><h4>Faults</h4><div id="propsLive"></div></div>`;
      P.querySelectorAll('[data-pc]').forEach(b => (b.onclick = () => cmds[b.dataset.pc]()));
      P.querySelectorAll('[data-al]').forEach(b => (b.onclick = () => cmds.align(b.dataset.al)));
      P.querySelectorAll('[data-di]').forEach(b => (b.onclick = () => cmds.distribute(b.dataset.di)));
      return;
    }
    const nW = circ.wires.filter(w => w.kind === 'wire').length, nT = circ.wires.length - nW;
    P.innerHTML = `<h3>Circuit</h3><div class="sub">${circ.parts.length} parts · ${nW} wires · ${nT} tubes</div>` +
      (ui.lastSession && !circ.parts.length ? `<div class="btnrow"><button id="restoreLast">↺ Restore my last work</button><button data-pc2="examples">Open an example</button></div>` : '') +
      `<div class="sec"><h4>Faults & warnings</h4><div id="propsLive"></div></div>` +
      `<div class="sec"><h4>Quick start</h4><div class="info-txt">1. Drag parts from the left (or click one to drop it in the middle).\n2. Click a screw terminal, then another, to run a wire. Click a blue air port to run a tube.\n3. Press ▶ Run, then click buttons, sensors and switches on the parts.\n4. Use 🔧 Multimeter to measure voltage or continuity like on the real bench.\nThe "!" badges show wiring mistakes the real hardware would punish.</div></div>`;
    const rl = $('restoreLast'); if (rl) rl.onclick = () => { try { loadJSON(ui.lastSession); ui.lastSession = null; hint('Last work restored'); } catch (e) { hint('Could not restore: ' + e.message); } };
    P.querySelectorAll('[data-pc2]').forEach(b => (b.onclick = () => cmds[b.dataset.pc2]()));
  }
  function faultsHtml(list) {
    if (!list.length) return `<div class="fault info">${CCS.sim.running ? 'No problems detected.' : 'Press ▶ Run to energise the circuit.'}</div>`;
    return list.slice(0, 60).map(f => `<div class="fault ${f.level}" data-fc="${f.c ? f.c.id : ''}" data-fw="${f.wire || ''}"><b>${f.c ? U.esc(f.c.props.tag || CCS.types[f.c.type].name) + ': ' : 'Wire: '}</b>${U.esc(f.msg)}</div>`).join('');
  }
  function propsLive() {
    const el = $('propsLive'); if (!el) return;
    let h = '';
    if (ui.sel.parts.size === 1) {
      const c = circ.byId([...ui.sel.parts][0]); if (!c) return;
      const rows = readoutKeys.filter(([k]) => c.st && c.st[k] !== undefined && typeof c.st[k] !== 'object').map(([k, lbl, f]) => { let v; try { v = f(c.st[k], c); } catch (e) { v = String(c.st[k]); } return `<span>${lbl}</span><span>${v}</span>`; });
      h = rows.length ? `<div class="kv">${rows.join('')}</div>` : '<div class="kv"><span>—</span><span></span></div>';
      if (c.faults && c.faults.length) h += '<div style="margin-top:6px">' + c.faults.map(f => `<div class="fault ${f.level}">${U.esc(f.msg)}</div>`).join('') + '</div>';
    } else if (ui.sel.wire) {
      const w = circ.wireById(ui.sel.wire); if (!w) return;
      if (w.kind === 'wire') { const I = CCS.sim.R.wire(w.id); h = `<div class="kv"><span>Current DC</span><span>${U.fmt(I.dc, 'A')}</span><span>Current AC</span><span>${U.fmt(Math.abs(I.ac), 'A')}</span></div>`; if (CCS.sim.wireFaults.has(w.id)) h += `<div class="fault warn">${U.esc(CCS.sim.wireFaults.get(w.id))}</div>`; }
      else { const PR = CCS.sim.PR, k = PR && PR.nodeOfKey(w.a.c + ':' + w.a.t); h = `<div class="kv"><span>Pressure</span><span>${PR ? (PR.P.get(k) || 0).toFixed(2) + ' bar' : '—'}</span><span>State</span><span>${PR ? { P: 'pressurised', E: 'exhausted', T: 'trapped', L: 'LEAKING' }[PR.state.get(k)] : '—'}</span></div>`; }
    } else {
      const list = ui.sel.parts.size > 1 ? CCS.sim.faults.filter(f => f.c && ui.sel.parts.has(f.c.id)) : CCS.sim.faults;
      h = faultsHtml(list);
    }
    if (el.innerHTML !== h) {
      el.innerHTML = h;
      el.querySelectorAll('[data-fc]').forEach(d => (d.onclick = () => { if (d.dataset.fc) select([d.dataset.fc]); else if (d.dataset.fw) { clearSel(); ui.sel.wire = d.dataset.fw; } }));
    }
  }
  function propsFrame() {
    const sig = [...ui.sel.parts].join(',') + '|' + ui.sel.wire + '|' + circ.version + '|' + ui.propsSig;
    const ae = document.activeElement;
    const editing = ae && $('props').contains(ae) && /INPUT|SELECT|TEXTAREA/.test(ae.tagName);
    if (sig !== ui.lastSig && !editing) { ui.lastSig = sig; propsStatic(); }
    propsLive();
  }
  function statusFrame() {
    const s = CCS.sim, f = s.faults, ne = f.filter(x => x.level === 'error').length, nw = f.filter(x => x.level === 'warn').length;
    const el = $('stFaults'); el.textContent = ne || nw ? `⚠ ${ne} error(s), ${nw} warning(s)` : '✓ no faults'; el.className = ne ? 'err' : nw ? 'warn' : '';
    $('simClock').textContent = s.time.toFixed(2) + ' s';
    const psu = circ.parts.filter(p => p.type === 'psu' || p.type === 'bench');
    $('stInfo').textContent = psu.map(p => `${p.props.tag}: ${(p.st.vout ?? p.st.V ?? 0).toFixed(1)} V / ${U.fmt(Math.abs(p.st.iout ?? p.st.i ?? 0), 'A')}`).join(' · ');
  }

  /* ------------------------------------------------------------ circuit check + AI */
  const AI_INSTRUCTIONS = `You are an experienced industrial electrician and electro-pneumatics lab instructor. A student built the control circuit below in a simulator that uses real parts (MY4 relays on 14-pin sockets numbered like the relay pins, 22 mm push buttons with IEC contact blocks, DIN terminal strips with bridges, 3-wire PNP/NPN sensors, reed switches, 5/2 and 3/2 solenoid valves, cylinders). It does not work as expected.
Trace it exactly like with a multimeter: start at each supply +, follow every wire and contact to each coil / lamp / sensor and back to the supply −; for the air side follow supply → service unit → valve port 1 → outputs 2/4 → cylinder ports, exhausts 3/5 to silencers. Find every wrong, missing or unnecessary connection and every logic mistake (self-holding latch, stop in series, interlocks, PNP/NPN and NO/NC sensor wiring, coil voltage AC vs DC, reed switch 100 mA limit, double-solenoid valve memory, both solenoids on together).
Use ONLY the part tags and terminal names given (e.g. K1:13, X1:b3, 1V1:c14a). Reply in exactly this format, concise, no preamble:
**Verdict:** one sentence.
**Problems & fixes:**
1. what is wrong and where → exact fix (e.g. "move the wire from K2:9 to K2:10", "add a wire K1:14 → X2:b4", "remove the wire S1:13 → S1:14").
**How it works after the fix:** 3–6 short numbered steps (what to press, what energises, what moves).
If the wiring is correct, say so and tell the student what to press to make it run.`;
  let samplePromise = null;
  const getSample = () => (samplePromise ||= (window.claude && typeof window.claude.use === 'function') ? Promise.resolve(window.claude.use('sample')).catch(() => null) : Promise.resolve(null));
  const md = t => U.esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  function updateChip() {
    const ch = $('docChip'), F = ui.doc.findings, ne = F.filter(f => f.level === 'error').length, nw = F.filter(f => f.level === 'warn').length;
    ch.className = ne ? 'err' : nw ? 'warn' : 'ok';
    ch.textContent = ne + nw ? `🩺 Circuit check: ${ne ? ne + ' error' + (ne > 1 ? 's' : '') : ''}${ne && nw ? ', ' : ''}${nw ? nw + ' warning' + (nw > 1 ? 's' : '') : ''} — click to see how to fix` : '🩺 Circuit check: no wiring errors — click to see what each coil is waiting for';
    ch.onclick = () => doctorDialog(false);
  }
  function autoDoctor() { ui.doc.findings = CCS.doctor.run(); ui.doc.active = true; updateChip(); }
  function focusFinding(f) {
    ui.hl = { parts: new Set(f.parts.filter(id => circ.byId(id))), terms: f.terms || [], t0: performance.now() };
    const first = f.parts.find(id => circ.byId(id));
    if (first) {
      select([first]);
      const b = circ.bbox(circ.byId(first)), r = $('canvas').getBoundingClientRect();
      CCS.view.x = r.width / 2 - ((b.x + b.x2) / 2) * CCS.view.z; CCS.view.y = r.height / 2 - ((b.y + b.y2) / 2) * CCS.view.z; CCS.view.apply();
    }
  }
  function doctorDialog(rerun) {
    if (rerun || !ui.doc.active) autoDoctor();
    const F = ui.doc.findings, probs = F.filter(f => f.level !== 'info'), waits = F.filter(f => f.level === 'info');
    const card = (f, i) => `<div class="doc-card ${f.level}" data-f="${i}"><b>${f.level === 'error' ? '❌' : f.level === 'warn' ? '⚠️' : '⏳'} ${U.esc(f.title)}</b><span>${U.esc(f.fix)}</span></div>`;
    const html = `<p class="doc-sum">${probs.length ? `Found <b>${probs.length}</b> wiring problem${probs.length > 1 ? 's' : ''}. Click one to highlight it on the board.` : '✅ No wiring errors found by the automatic trace.'}${CCS.sim.faults.length ? ` The running simulation also reports ${CCS.sim.faults.length} message(s) — see the right panel.` : ''}</p>` +
      F.map((f, i) => (f.level !== 'info' ? card(f, i) : '')).join('') +
      (waits.length ? `<h4 style="margin:12px 0 6px">What each load is waiting for</h4>` + F.map((f, i) => (f.level === 'info' ? card(f, i) : '')).join('') : '') +
      `<div class="ai-box"><b>🤖 Ask Claude AI to trace it</b><div class="info-txt">Sends the parts, every wire/tube, the live states and the findings above to Claude, who traces the circuit and tells you which connection to move.</div>` +
      `<textarea id="aiGoal" placeholder="Optional: what should the circuit do? e.g. START latches K1, cylinder A extends to a1 then returns to a0, STOP ends the cycle">${U.esc(ui.doc.goal)}</textarea>` +
      `<button class="mbtn primary" id="aiGo">${ui.doc.busy ? 'Tracing…' : 'Trace with AI'}</button> <span id="aiNote" class="info-txt"></span><div class="ai-out" id="aiOut">${md(ui.doc.ai)}</div></div>`;
    CCS.dialog.open({
      title: 'Circuit check', html, buttons: [{ label: 'Re-check', onClick: () => { setTimeout(() => doctorDialog(true), 0); } }, { label: 'Close', primary: true }],
      onOpen: body => {
        body.querySelectorAll('[data-f]').forEach(el => (el.onclick = () => { focusFinding(F[+el.dataset.f]); CCS.dialog.close(); }));
        $('aiGoal').oninput = e => (ui.doc.goal = e.target.value);
        getSample().then(sm => { if (!sm && $('aiNote')) { $('aiNote').textContent = 'AI tracing works when the simulator is opened from its claude.ai link (not in the offline file).'; $('aiGo').disabled = true; } });
        $('aiGo').onclick = () => askAI(F);
      },
    });
  }
  async function askAI(F) {
    if (ui.doc.busy) return;
    const sm = await getSample(), out = () => $('aiOut'), note = () => $('aiNote');
    if (!sm) { if (note()) note().textContent = 'AI is not available in this copy — open the claude.ai link.'; return; }
    ui.doc.busy = true; ui.doc.ai = ''; if ($('aiGo')) $('aiGo').textContent = 'Tracing…'; if (out()) out().innerHTML = '<i>Claude is tracing the circuit…</i>';
    const prompt = AI_INSTRUCTIONS + '\n\n=== CIRCUIT ===\n' + CCS.doctor.describe(F, ui.doc.goal.trim());
    try {
      const r = await sm([{ role: 'user', content: prompt }], { modelTier: 'complex', cache: false, onText: ({ text }) => { ui.doc.ai = text; if (out()) out().innerHTML = md(text); } });
      ui.doc.ai = r.text || ui.doc.ai; if (out()) out().innerHTML = md(ui.doc.ai) + (r.truncated ? '<br><i>(answer was cut short)</i>' : '');
    } catch (e) {
      const msg = e && e.code === 'rate_limited' ? 'Too many AI requests — wait a minute and try again.' : e && e.code === 'not_granted' ? 'AI access was not allowed for this page.' : 'AI request failed: ' + ((e && e.message) || e);
      if (note()) note().textContent = msg;
      if (out() && !ui.doc.ai) out().innerHTML = '';
    } finally { ui.doc.busy = false; if ($('aiGo')) $('aiGo').textContent = 'Trace with AI again'; }
  }

  /* ------------------------------------------------------------ dialogs */
  /* circuit files: .ccs (plain circuit file) or a self-opening .html (the simulator with the circuit inside) */
  const safeName = n => (String(n || '').trim().replace(/\.(ccs|json|html?)$/i, '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'my-circuit');
  const circuitText = () => JSON.stringify({ ...circ.toJSON(), name: circ.name || '' }, null, 1);
  /** rebuild this page as a stand-alone HTML file with the circuit embedded */
  function standaloneHTML() {
    const js = [...document.scripts].find(x => x.textContent.includes('CCS.SHELL ='));
    const css = [...document.querySelectorAll('style')].find(x => x.textContent.includes('#topbar'));
    if (!js || !css || !CCS.SHELL) throw new Error('page source not available');
    let out = CCS.SHELL.replace('/*@@CSS@@*/', () => css.textContent).replace('/*@@JS@@*/', () => js.textContent);
    const data = '<script id="ccs-' + 'circuit" type="application/json">' + circuitText().replace(/<\//g, '<\\/') + '<\/script>\n';
    const i = out.lastIndexOf('</body>');
    return out.slice(0, i) + data + out.slice(i);
  }
  async function getDownloads() { try { return window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; } catch (e) { return null; } }
  function blobSave(name, data, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  async function saveCircuit(name, kind, msg) {
    circ.name = name;
    const isHtml = kind === 'html', fname = name + (isHtml ? '.html' : '.ccs');
    let data; try { data = isHtml ? standaloneHTML() : circuitText(); } catch (e) { msg('Could not build the file: ' + e.message); return false; }
    const dl = await getDownloads();
    if (dl) {
      try { await dl.save({ filename: fname, data }); msg(`Saved ${fname}.`); return true; }
      catch (e) { msg(e && e.code === 'declined' ? 'Save cancelled.' : 'Save failed here (' + ((e && e.code) || e) + ').'); return false; }
    }
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: fname, types: [isHtml ? { description: 'Circuit (opens the simulator)', accept: { 'text/html': ['.html'] } } : { description: 'Control Lab circuit', accept: { 'application/octet-stream': ['.ccs'] } }] });
        const w = await h.createWritable(); await w.write(data); await w.close(); msg(`Saved ${h.name}.`); return true;
      } catch (e) { if (e && e.name === 'AbortError') { msg('Save cancelled.'); return false; } /* fall through */ }
    }
    try { blobSave(fname, data, isHtml ? 'text/html' : 'application/octet-stream'); msg(`Saved ${fname} to your Downloads folder.`); return true; } catch (e) { msg('Saving is blocked here.'); return false; }
  }
  async function exportDialog() {
    const inLink = !!(await getDownloads());
    const def = circ.name || 'my-circuit';
    CCS.dialog.open({
      title: 'Save circuit', html: `<div class="prow"><label for="svName">File name</label><input id="svName" type="text" value="${U.esc(def)}"></div>` +
        (inLink ? `<p class="info-txt">Saves <b>name.html</b> — a circuit file that contains the simulator: double-click it to open the circuit, or load it with <b>Open</b> (here or in the offline simulator).</p>`
          : `<p class="info-txt"><b>Save circuit file</b> writes <b>name.ccs</b> — reopen it with <b>Open</b>. <b>Save as stand-alone</b> writes <b>name.html</b> that opens the simulator with this circuit on double-click (handy for sharing).</p>`) +
        `<p id="svMsg" class="info-txt"></p>`,
      buttons: [
        { label: 'Copy as text', onClick: () => { const t = circuitText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => ($('svMsg').textContent = 'Circuit text copied — paste it in Open → paste.')).catch(() => ($('svMsg').textContent = 'Copy blocked here.')); return false; } },
        ...(inLink ? [] : [{ label: 'Save as stand-alone (.html)', onClick: () => { saveCircuit(safeName($('svName').value), 'html', m => ($('svMsg').textContent = m)); return false; } }]),
        { label: inLink ? 'Save circuit file' : 'Save circuit file (.ccs)', primary: true, onClick: () => { saveCircuit(safeName($('svName').value), inLink ? 'html' : 'ccs', m => ($('svMsg').textContent = m)).then(ok => { if (ok) { setTimeout(CCS.dialog.close, 900); hint('Circuit saved'); } }); return false; } },
      ],
      onOpen: b => { const i = b.querySelector('#svName'); i.focus(); i.select(); i.onkeydown = e => { if (e.key === 'Enter') b.parentNode.querySelector('.mbtn.primary').click(); }; },
    });
  }
  /** accepts .ccs / .json text or a saved .html circuit file */
  function parseCircuitFile(text) {
    const all = [...text.matchAll(/<script id="ccs-circuit" type="application\/json">([\s\S]*?)<\/script>/g)];
    return JSON.parse(all.length ? all[all.length - 1][1] : text);
  }
  function openDialog() {
    CCS.dialog.open({
      title: 'Open circuit', html: `<p>Open a saved circuit file (<b>.ccs</b>, or a circuit <b>.html</b> / <b>.json</b>).</p><button class="mbtn primary" id="opFile">Choose circuit file…</button><p class="info-txt" style="margin-top:12px">…or paste circuit text:</p><textarea id="opTxt" placeholder="Paste circuit text here"></textarea><p id="opMsg" class="info-txt"></p>`,
      buttons: [{ label: 'Cancel' }, { label: 'Load pasted text', onClick: () => { try { loadJSON(parseCircuitFile($('opTxt').value)); } catch (e) { $('opMsg').textContent = 'Could not read: ' + e.message; return false; } } }],
      onOpen: b => (b.querySelector('#opFile').onclick = () => $('fileInput').click()),
    });
  }
  function loadJSON(txt) { CCS.sim.reset(); ui.doc.active = false; ui.doc.findings = []; ui.hl = null; $('docChip').classList.add('hidden'); circ.load(txt); clearSel(); CCS.history.reset(); CCS.sim.reset(); CCS.sim.idleCheck(); syncRunBtn(); setTimeout(() => CCS.view.fit(), 30); }
  function examplesDialog() {
    CCS.dialog.open({
      title: 'Example circuits', html: CCS.examples.map((e, i) => `<div class="ex-card" data-ex="${i}"><b>${U.esc(e.name)}</b><small>${U.esc(e.desc)}</small></div>`).join(''),
      buttons: [{ label: 'Close' }],
      onOpen: b => b.querySelectorAll('[data-ex]').forEach(d => (d.onclick = () => { loadJSON(CCS.examples[+d.dataset.ex].build()); CCS.dialog.close(); hint('Example loaded — press ▶ Run'); })),
    });
  }
  function bomDialog() {
    const groups = new Map();
    circ.parts.forEach(c => {
      const T = CCS.types[c.type], p = c.props;
      const spec = c.type === 'duct' ? `${Math.round(p.width * 10)}×${Math.round(p.depth * 10)} mm, ${p.length} cm${p.cover ? ', with cover' : ''}` : [p.coil && 'coil ' + p.coil, p.contact, p.color, p.rating, p.In && 'C' + p.In + ' A', p.bore && `Ø${p.bore} × ${p.stroke} mm`, p.out, p.kind, p.mode].filter(Boolean).join(', ');
      const k = T.name + '|' + spec; const g = groups.get(k) || { name: T.name, spec, tags: [], n: 0 }; g.n++; g.tags.push(p.tag || ''); groups.set(k, g);
    });
    const len = {};
    circ.wires.forEach(w => { const pts = CCS.render.wirePts(w); if (!pts) return; let L = 0; for (let i = 1; i < pts.length; i++) L += U.dist(pts[i - 1], pts[i]); const k = w.kind === 'tube' ? 'PU tube Ø6' : `Wire ${w.gauge || '0.75'} mm² ${CCS.wireColors.find(c => c[0] === w.color)?.[1] || w.color}`; len[k] = (len[k] || 0) + L / CCS.PX_PER_CM + 10; });
    const rows = [...groups.values()];
    const csv = 'Qty,Part,Specification,Tags\n' + rows.map(r => `${r.n},"${r.name}","${r.spec}","${r.tags.join(' ')}"`).join('\n') + '\n' + Object.entries(len).map(([k, v]) => `,"${k}","${Math.ceil(v / 10) * 10} cm (estimate)",`).join('\n');
    CCS.dialog.open({
      title: 'Parts & wire list', html: `<table><tr><th>Qty</th><th>Part</th><th>Specification</th><th>Tags</th></tr>${rows.map(r => `<tr><td>${r.n}</td><td>${U.esc(r.name)}</td><td>${U.esc(r.spec)}</td><td>${U.esc(r.tags.join(' '))}</td></tr>`).join('')}</table>` +
        `<h4>Wires & tubes (length estimate at board scale 1 cm = 20 px, +10 cm per run)</h4><table>${Object.entries(len).map(([k, v]) => `<tr><td>${U.esc(k)}</td><td>${Math.ceil(v / 10) * 10} cm</td></tr>`).join('')}</table><p class="info-txt">Add ferrules for every wire end, DIN rail, and spare tube. Lengths come from the drawing scale, so measure your real panel before buying.</p>`,
      buttons: [{ label: 'Copy as CSV', onClick: () => { try { navigator.clipboard.writeText(csv); } catch (e) { } return false; } }, { label: 'Close', primary: true }],
    });
  }
  function helpDialog() {
    CCS.dialog.open({
      title: 'How to use the simulator', html: `<div class="help">
<h4>Build</h4><ul><li>Drag parts from the left panel onto the board (or click one to place it in the middle). Search box filters parts.</li>
<li><b>Wires:</b> click a screw terminal, then another terminal. Click empty space on the way to add bends. <kbd>Esc</kbd> or right-click cancels. With colour <b>Auto</b>, L/N/PE/+V/−V get standard colours.</li>
<li><b>Tubes:</b> click a blue push-in port, then another port. One tube per port — branch with a T-fitting or manifold.</li>
<li><b>Reed switches:</b> drag them onto the barrel of a cylinder at the end position you want — they clamp on and move with the cylinder.</li>
<li>Select: click a part; <kbd>Shift</kbd>+click adds. Hold the left button on empty board and drag a rectangle — every part it touches is selected as you go (<kbd>Shift</kbd> keeps the old selection). <kbd>Ctrl+A</kbd> selects all.</li>
<li>When you release, the rectangle stays as a fixed-size frame. Grab anywhere inside it (or any selected part) to move everything together — the frame travels with the parts and spacing never changes. <kbd>Alt</kbd> while dragging = no grid snapping. Click inside the frame to deselect.</li>
<li>Groups: <kbd>Ctrl+G</kbd> groups the selection, <kbd>Ctrl+Shift+G</kbd> ungroups. A group selects, moves, rotates and duplicates as one; <kbd>Alt</kbd>+click picks a single member.</li>
<li>Align &amp; distribute: select several parts/groups and use the buttons in the right panel. Arrow keys nudge (<kbd>Shift</kbd> = 1 mm).</li>
<li><kbd>R</kbd> rotate, <kbd>Del</kbd> delete, <kbd>Ctrl+D</kbd> duplicate, <kbd>Ctrl+Z/Y</kbd> undo/redo.</li>
<li>Side panels: the small tabs on the board edges (or <kbd>[</kbd> and <kbd>]</kbd>) hide and show the parts library and the details panel.</li>
<li>Pan: hold the right (or middle) button and drag. Zoom: mouse wheel. <kbd>F</kbd> fits the board.</li></ul>
<h4>Simulate</h4><ul><li><kbd>Space</kbd> or ▶ Run energises the circuit. Push buttons work while held; latching parts toggle on click. Click the dashed zone of a sensor to put an object in front of it.</li>
<li>Glowing wires carry current; white dashes show its direction (AC oscillates). Pressurised tubes are bright blue.</li>
<li>■ Reset returns every part to its initial state (cylinders retracted, breakers on, damaged parts replaced).</li></ul>
<h4>Real-world behaviour that is simulated</h4><ul><li>Short circuits trip the MCB (or the building breaker); overloads trip after a delay; the 24 V PSU shuts down on overload.</li>
<li>Coils check their voltage and type: a 24 V DC coil on 230 V AC burns; below 80 % a relay does not pull in.</li>
<li>Pilot-operated valves need ≥ 1.5 bar at port 1 to shift. Double-solenoid valves remember their position.</li>
<li>Reed switches (100 mA) and sensor outputs (200 mA) warn when they drive too much current — use relays.</li>
<li>Max 2 wires per screw terminal, 1 tube per push-in port, contact and wire current ratings.</li></ul>
<h4>Share</h4><ul><li><b>Save</b> (Ctrl+S) writes a circuit file (.ccs, or a self-opening .html). <b>Open</b> (Ctrl+O) loads it again. <b>Parts list</b> gives a shopping list.</li></ul></div>`,
    });
  }

  /* ------------------------------------------------------------ init */
  /* ------------------------------------------------------------ side panels (open / close) */
  function setPanel(side, open, keepView = true) {
    const app = $('app'), cls = side === 'left' ? 'no-left' : 'no-right';
    if (app.classList.contains(cls) === !open) return;
    const before = $('stage').getBoundingClientRect().left;
    app.classList.toggle(cls, !open);
    // keep the circuit where it is on screen while the board grows or shrinks
    if (keepView) { CCS.view.x += before - $('stage').getBoundingClientRect().left; CCS.view.apply(); }
    const t = $(side === 'left' ? 'tabLeft' : 'tabRight');
    t.querySelector('i').textContent = (side === 'left') === open ? '‹' : '›';
    t.title = (open ? 'Hide' : 'Show') + (side === 'left' ? ' the parts library ( [ )' : ' the details panel ( ] )');
    try { localStorage.setItem('ccs.panels', JSON.stringify({ left: !app.classList.contains('no-left'), right: !app.classList.contains('no-right') })); } catch (e) { }
  }
  const togglePanel = side => setPanel(side, $('app').classList.contains(side === 'left' ? 'no-left' : 'no-right'));

  function init() {
    buildPalette();
    $('tabLeft').onclick = () => togglePanel('left');
    $('tabRight').onclick = () => togglePanel('right');
    try { const pz = JSON.parse(localStorage.getItem('ccs.panels') || '{}'); if (pz.left === false) setPanel('left', false, false); if (pz.right === false) setPanel('right', false, false); } catch (e) { }
    $('paletteSearch').addEventListener('input', e => buildPalette(e.target.value));
    const sw = $('wireColors');
    CCS.wireColors.forEach(([v, n]) => {
      const b = document.createElement('button'); b.className = 'swatch' + (v === 'auto' ? ' auto on' : ''); b.title = n;
      if (v !== 'auto') b.style.background = v === 'gy' ? 'repeating-linear-gradient(45deg,#43a047 0 5px,#fdd835 5px 10px)' : v;
      b.onclick = () => { ui.wireColor = v; sw.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); if (ui.sel.wire && v !== 'auto') { const w = circ.wireById(ui.sel.wire); if (w && w.kind === 'wire') { w.color = v; commit(); } } };
      sw.appendChild(b);
    });
    document.querySelectorAll('[data-cmd]').forEach(b => (b.onclick = () => (b.dataset.cmd === 'open' ? openDialog() : cmds[b.dataset.cmd]())));
    document.querySelectorAll('[data-tool]').forEach(b => (b.onclick = () => setTool(b.dataset.tool)));
    document.querySelectorAll('[data-mmode]').forEach(b => (b.onclick = () => {
      if (b.dataset.mmode === 'clear') { ui.meter.red = ui.meter.black = null; return; }
      ui.meter.mode = b.dataset.mmode; ui.meter.rCache = null; document.querySelectorAll('[data-mmode]').forEach(x => x.classList.toggle('on', x === b));
    }));
    $('simSpeed').onchange = e => (CCS.sim.speed = +e.target.value);
    $('fileInput').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { try { loadJSON(parseCircuitFile(rd.result)); circ.name = f.name.replace(/\.(ccs|json|html?)$/i, ''); CCS.dialog.close(); hint('Opened ' + f.name); } catch (err) { hint('Could not open ' + f.name + ': ' + err.message, 4000); } }; rd.readAsText(f); e.target.value = '';
    };
    const svg = $('canvas');
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    svg.addEventListener('lostpointercapture', () => { if (mode === 'act' && drag) { try { CCS.types[drag.c.type].act(drag.c, drag.name, 'up'); } catch (e) { } } if (mode !== 'wiredrag') { mode = null; drag = null; ui.box = null; } });
    svg.addEventListener('dblclick', onDbl);
    svg.addEventListener('contextmenu', e => { e.preventDefault(); if (ui.drawing) { ui.drawing = null; svg.classList.remove('wiring'); } });
    svg.addEventListener('wheel', e => { e.preventDefault(); CCS.view.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
    window.addEventListener('keydown', e => {
      const ae = document.activeElement;
      const typing = /TEXTAREA/.test(ae.tagName) || (ae.tagName === 'INPUT' && /text|number|search/.test(ae.type));
      if (typing) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { ui.drawing = null; svg.classList.remove('wiring'); clearSel(); CCS.dialog.close(); }
      else if (k === 'delete' || k === 'backspace') { e.preventDefault(); cmds.delete(); }
      else if (k === ' ') { e.preventDefault(); if (!e.repeat) cmds.run(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? cmds.redo() : cmds.undo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); cmds.redo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); cmds.duplicate(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'g') { e.preventDefault(); e.shiftKey ? cmds.ungroup() : cmds.group(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); cmds.selectAll(); }
      else if (k.startsWith('arrow') && ui.sel.parts.size) {
        e.preventDefault(); const st = e.shiftKey ? 2 : 10;
        cmds.nudge(k === 'arrowleft' ? -st : k === 'arrowright' ? st : 0, k === 'arrowup' ? -st : k === 'arrowdown' ? st : 0);
      }
      else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportDialog(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'o') { e.preventDefault(); openDialog(); }
      else if (k === 'r' && !e.ctrlKey) cmds.rotate();
      else if (k === 'm') setTool(ui.tool === 'meter' ? 'select' : 'meter');
      else if (k === 's' && !e.ctrlKey) setTool('select');
      else if (k === 'f') CCS.view.fit();
      else if (e.key === '[') togglePanel('left');
      else if (e.key === ']') togglePanel('right');
    });
    syncRunBtn();
  }
  function emptyFrame() { const el = $('emptyHint'); if (el) el.classList.toggle('hidden', circ.parts.length > 0); }
  function frame() { pruneSel(); for (const f of [meterFrame, propsFrame, statusFrame, syncRunBtn, emptyFrame]) { try { f(); } catch (e) { console.error(e); } } }

  Object.assign(ui, { init, frame, selFrame, setPanel, togglePanel, hint, select, loadJSON, addPart, cmds, setTool, doctorDialog, autoDoctor, standaloneHTML, parseCircuitFile });
  return ui;
})();
