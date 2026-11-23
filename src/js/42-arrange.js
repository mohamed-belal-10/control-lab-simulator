/* =========================================================================
 * Module 42: arrange — groups, alignment, distribution, unit rotation
 *  • a group is a set of parts sharing `c.group`; selecting one selects all,
 *    and a group moves, rotates, aligns and duplicates as one unit
 *  • align / distribute work on "units": every group is one unit, every
 *    ungrouped part is its own unit
 *  • reed switches mounted on a cylinder are never moved directly — they
 *    follow their cylinder
 * ========================================================================= */
CCS.arrange = (() => {
  const circ = CCS.circuit;
  const follows = c => c.type === 'reed' && c.props.attach && circ.byId(c.props.attach);

  /** ids + every other member of their groups */
  function expand(ids) {
    const out = new Set();
    ids.forEach(id => {
      const c = circ.byId(id); if (!c) return;
      if (c.group) circ.parts.forEach(p => { if (p.group === c.group) out.add(p.id); });
      else out.add(id);
    });
    return [...out];
  }
  /** selection → units (arrays of movable parts) */
  function units(ids) {
    const set = new Set(ids), seen = new Set(), out = [];
    ids.forEach(id => {
      if (seen.has(id)) return;
      const c = circ.byId(id); if (!c) return;
      const members = c.group ? circ.parts.filter(p => p.group === c.group && set.has(p.id)) : [c];
      members.forEach(m => seen.add(m.id));
      const movable = members.filter(m => !follows(m));
      if (movable.length) out.push(movable);
    });
    return out;
  }
  function box(parts) {
    let x = 1e9, y = 1e9, x2 = -1e9, y2 = -1e9;
    parts.forEach(c => { const b = circ.bbox(c); x = Math.min(x, b.x); y = Math.min(y, b.y); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2); });
    return { x, y, x2, y2, w: x2 - x, h: y2 - y, cx: (x + x2) / 2, cy: (y + y2) / 2 };
  }
  /** move parts and the bends of wires that run entirely between them */
  function move(parts, dx, dy) {
    if (!dx && !dy) return;
    const set = new Set(parts.map(c => c.id));
    parts.forEach(c => { c.x += dx; c.y += dy; });
    circ.wires.forEach(w => { if (set.has(w.a.c) && set.has(w.b.c) && w.pts && w.pts.length && !w.routed) w.pts = w.pts.map(p => [p[0] + dx, p[1] + dy]); });
  }
  function group(ids) {
    const list = expand(ids).map(id => circ.byId(id)).filter(c => c && !follows(c));
    if (list.length < 2) return null;
    const g = CCS.util.uid('g');
    list.forEach(c => (c.group = g));
    circ.touch();
    return g;
  }
  function ungroup(ids) {
    let n = 0;
    ids.forEach(id => { const c = circ.byId(id); if (c && c.group) { delete c.group; n++; } });
    // a group left with a single member is no group at all
    const count = {}; circ.parts.forEach(p => { if (p.group) count[p.group] = (count[p.group] || 0) + 1; });
    circ.parts.forEach(p => { if (p.group && count[p.group] < 2) delete p.group; });
    circ.touch();
    return n;
  }
  /** align units to the selection bounds: left | hcenter | right | top | vcenter | bottom */
  function align(ids, how) {
    const U = units(ids); if (U.length < 2) return 0;
    const all = box(U.flat());
    U.forEach(u => {
      const b = box(u);
      const dx = how === 'left' ? all.x - b.x : how === 'right' ? all.x2 - b.x2 : how === 'hcenter' ? all.cx - b.cx : 0;
      const dy = how === 'top' ? all.y - b.y : how === 'bottom' ? all.y2 - b.y2 : how === 'vcenter' ? all.cy - b.cy : 0;
      move(u, dx, dy);
    });
    circ.touch();
    return U.length;
  }
  /** equal gaps between units along 'h' or 'v'; the two outer units stay put */
  function distribute(ids, axis) {
    const U = units(ids).map(u => ({ u, b: box(u) })); if (U.length < 3) return 0;
    const H = axis === 'h', lo = o => (H ? o.b.x : o.b.y), size = o => (H ? o.b.w : o.b.h);
    U.sort((a, b) => lo(a) - lo(b));
    const first = U[0], last = U[U.length - 1];
    const span = (H ? last.b.x2 : last.b.y2) - lo(first), total = U.reduce((s, o) => s + size(o), 0);
    const gap = (span - total) / (U.length - 1);
    let cur = lo(first) + size(first) + gap;
    for (let i = 1; i < U.length - 1; i++) { const o = U[i], d = cur - lo(o); move(o.u, H ? d : 0, H ? 0 : d); cur += size(o) + gap; }
    circ.touch();
    return U.length;
  }
  /** rotate 90° clockwise; a group turns about its own centre */
  function rotate(ids) {
    units(ids).forEach(u => {
      if (u.length === 1) { u[0].rot = ((u[0].rot || 0) + 90) % 360; return; }
      const B = box(u), set = new Set(u.map(c => c.id));
      u.forEach(c => {
        const { w, h } = CCS.size(c), [ncx, ncy] = CCS.util.rot(c.x + w / 2, c.y + h / 2, B.cx, B.cy, 90);
        c.rot = ((c.rot || 0) + 90) % 360; c.x = ncx - w / 2; c.y = ncy - h / 2;
      });
      circ.wires.forEach(w => { if (set.has(w.a.c) && set.has(w.b.c) && w.pts && !w.routed) w.pts = w.pts.map(p => CCS.util.rot(p[0], p[1], B.cx, B.cy, 90)); });
    });
    circ.touch();
  }
  const groupsIn = ids => new Set(ids.map(id => circ.byId(id)).filter(c => c && c.group).map(c => c.group));
  return { expand, units, box, move, group, ungroup, align, distribute, rotate, groupsIn, follows };
})();
