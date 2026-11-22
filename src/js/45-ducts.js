/* =========================================================================
 * Module 45: wire routing through wiring ducts
 *  • every duct is an axis-aligned centre line (horizontal or vertical)
 *  • ducts that cross or touch (within their half widths) are joined
 *  • a wire drops straight from its terminal into the nearest duct, follows the
 *    shortest path through the duct network (Dijkstra) and leaves at the point
 *    nearest its other terminal; each wire gets its own lane across the duct width
 * ========================================================================= */
CCS.ducts = (() => {
  const circ = CCS.circuit;
  function segs() {
    return circ.parts.filter(c => c.type === 'duct').map(c => {
      const { h } = CCS.size(c);
      const p1 = CCS.localToWorld(c, 0, h / 2), p2 = CCS.localToWorld(c, CCS.size(c).w, h / 2);
      const H = Math.abs(p1[1] - p2[1]) < 1;
      const a = H ? [Math.min(p1[0], p2[0]), p1[1]] : [p1[0], Math.min(p1[1], p2[1])];
      const b = H ? [Math.max(p1[0], p2[0]), p1[1]] : [p1[0], Math.max(p1[1], p2[1])];
      return { c, H, a, b, half: h / 2, nodes: [] };
    });
  }
  const clamp = CCS.util.clamp;
  /** nearest point on a segment */
  const proj = (s, P) => (s.H ? [clamp(P[0], s.a[0], s.b[0]), s.a[1]] : [s.a[0], clamp(P[1], s.a[1], s.b[1])]);

  function route(A, B, lane = 0) {
    const S = segs(); if (!S.length) return null;
    const nodes = []; // {p:[x,y], onH, onV}
    const addNode = (s, p) => { const n = { p, onH: s.H, onV: !s.H, id: nodes.length }; nodes.push(n); s.nodes.push(n); return n; };
    // joints between ducts
    for (let i = 0; i < S.length; i++) for (let j = 0; j < S.length; j++) {
      if (i >= j) continue;
      const s1 = S[i], s2 = S[j];
      if (s1.H === s2.H) {
        // collinear ducts butting end to end
        const same = s1.H ? Math.abs(s1.a[1] - s2.a[1]) < Math.max(s1.half, s2.half) : Math.abs(s1.a[0] - s2.a[0]) < Math.max(s1.half, s2.half);
        if (!same) continue;
        const k = s1.H ? 0 : 1, gap = Math.max(s1.a[k], s2.a[k]) - Math.min(s1.b[k], s2.b[k]);
        if (gap <= 20) { const p = s1.b[k] <= s2.b[k] ? s1.b : s2.b; const n1 = addNode(s1, proj(s1, p)), n2 = addNode(s2, proj(s2, p)); n1.link = n2; n2.link = n1; }
        continue;
      }
      const h = s1.H ? s1 : s2, v = s1.H ? s2 : s1, tol = 8;
      const x = v.a[0], y = h.a[1];
      if (x >= h.a[0] - v.half - tol && x <= h.b[0] + v.half + tol && y >= v.a[1] - h.half - tol && y <= v.b[1] + h.half + tol) {
        const n = { p: [x, y], onH: true, onV: true, id: nodes.length }; nodes.push(n); h.nodes.push(n); v.nodes.push(n);
      }
    }
    // entry / exit
    const best = P => { let bs = null, bd = 1e18; S.forEach(s => { const q = proj(s, P), d = Math.hypot(q[0] - P[0], q[1] - P[1]); if (d < bd) { bd = d; bs = s; } }); return bs; };
    const sA = best(A), sB = best(B);
    const nA = addNode(sA, proj(sA, A)), nB = addNode(sB, proj(sB, B));
    nA.onH = sA.H; nA.onV = !sA.H; nB.onH = sB.H; nB.onV = !sB.H;
    // graph edges along each duct
    const adj = new Map(nodes.map(n => [n.id, []]));
    S.forEach(s => {
      const k = s.H ? 0 : 1, list = s.nodes.slice().sort((m, n) => m.p[k] - n.p[k]);
      for (let i = 0; i + 1 < list.length; i++) { const d = Math.abs(list[i + 1].p[k] - list[i].p[k]); adj.get(list[i].id).push([list[i + 1].id, d]); adj.get(list[i + 1].id).push([list[i].id, d]); }
    });
    nodes.forEach(n => { if (n.link) adj.get(n.id).push([n.link.id, CCS.util.dist(n.p, n.link.p)]); });
    // Dijkstra
    const dist = new Map([[nA.id, 0]]), prev = new Map(), done = new Set();
    while (true) {
      let u = null, ud = Infinity; dist.forEach((d, id) => { if (!done.has(id) && d < ud) { ud = d; u = id; } });
      if (u === null || u === nB.id) break;
      done.add(u);
      adj.get(u).forEach(([v, w]) => { const nd = ud + w; if (!dist.has(v) || nd < dist.get(v)) { dist.set(v, nd); prev.set(v, u); } });
    }
    if (!dist.has(nB.id)) return null; // ducts not connected
    const path = []; for (let u = nB.id; u !== undefined; u = prev.get(u)) path.unshift(nodes[u]);
    // lane offset across the duct width
    const minHalf = Math.min(...S.map(s => s.half));
    const gap = 4.5, nl = Math.max(1, Math.floor((2 * minHalf - 12) / gap));
    const o = ((lane % nl) - (nl - 1) / 2) * gap;
    const off = n => [n.p[0] + (n.onV ? o : 0), n.p[1] + (n.onH ? o : 0)];
    const pts = [];
    const outside = (T, s) => (s.H ? T[0] < s.a[0] || T[0] > s.b[0] : T[1] < s.a[1] || T[1] > s.b[1]);
    const qA = off(nA), qB = off(nB);
    if (outside(A, sA)) pts.push(sA.H ? [qA[0], A[1]] : [A[0], qA[1]]);
    else pts.push(sA.H ? [A[0], qA[1]] : [qA[0], A[1]]);
    path.forEach(n => pts.push(off(n)));
    if (outside(B, sB)) pts.push(sB.H ? [qB[0], B[1]] : [B[0], qB[1]]);
    else pts.push(sB.H ? [B[0], qB[1]] : [qB[0], B[1]]);
    // drop duplicate / collinear points
    const out = [];
    pts.forEach(p => { const r = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; const l = out[out.length - 1]; if (!l || Math.hypot(l[0] - r[0], l[1] - r[1]) > 0.5) out.push(r); });
    const all = [A, ...out, B], clean = [];
    for (let i = 1; i < all.length - 1; i++) {
      const a = all[i - 1], p = all[i], b = all[i + 1];
      const col = (Math.abs(a[0] - p[0]) < 0.6 && Math.abs(p[0] - b[0]) < 0.6) || (Math.abs(a[1] - p[1]) < 0.6 && Math.abs(p[1] - b[1]) < 0.6);
      if (!col) clean.push(p); else all[i] = a;
    }
    return clean;
  }

  /** lay every wire marked `routed` (or all wires) through the ducts */
  function routeWires(all = false) {
    if (!circ.parts.some(c => c.type === 'duct')) return 0;
    let n = 0;
    const list = circ.wires.filter(w => w.kind === 'wire' && (all || w.routed));
    list.forEach((w, i) => {
      const A = CCS.termPos(circ.byId(w.a.c), w.a.t), B = CCS.termPos(circ.byId(w.b.c), w.b.t);
      if (!A || !B) return;
      const pts = route(A, B, i);
      if (pts) { w.pts = pts; w.routed = true; n++; }
    });
    return n;
  }
  return { route, routeWires, segs };
})();
