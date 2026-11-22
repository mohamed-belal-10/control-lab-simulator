/* =========================================================================
 * Module 31: pneumatic solver
 * Ports joined by tubes form nodes. Parts add internal connections:
 *   source  (compressed-air supply)      reg (pressure regulator, one-way)
 *   path    (open valve passage)         fc  (one-way flow control)
 *   vent    (silencer / exhaust)         join (fittings, same node)
 * Unconnected ports follow their `free` rule: vent (exhaust to air),
 * atm (open to atmosphere, harmless), leak (air blows out = fault), closed.
 * Each node ends up Pressurised, Exhausted, Trapped (keeps last pressure) or Leaking.
 * ========================================================================= */
CCS.Pneu = (() => {
  const key = (c, t) => c.id + ':' + t;
  class PNet {
    constructor() { this.src = []; this.regs = []; this.paths = []; this.fcs = []; this.vents = []; this.joins = []; }
    source(c, port, bar) { this.src.push({ k: key(c, port), bar }); }
    reg(c, a, b, set) { this.regs.push({ a: key(c, a), b: key(c, b), set }); }
    path(c, a, b) { this.paths.push({ a: key(c, a), b: key(c, b) }); }
    fc(c, a, b, f) { this.fcs.push({ a: key(c, a), b: key(c, b), f }); }
    vent(c, port) { this.vents.push({ k: key(c, port), type: 'vent', c }); }
    join(c, a, b) { this.joins.push([key(c, a), key(c, b)]); }
  }

  const lastP = new Map(); // port key -> bar (memory for trapped air)
  function resetMemory() { lastP.clear(); }

  function solve(circ) {
    const net = new PNet();
    const ports = [];            // {k,c,t}
    const parent = new Map();
    const find = k => { let r = k; while (parent.get(r) !== r) r = parent.get(r); let x = k; while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
    const unite = (a, b) => { if (!parent.has(a) || !parent.has(b)) return; const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    circ.parts.forEach(c => {
      CCS.termsOf(c).forEach(t => { if (t.k === 'p') { const k = key(c, t.id); ports.push({ k, c, t }); parent.set(k, k); } });
      const T = CCS.types[c.type]; if (T.pneu) T.pneu(c, net);
    });
    const tubed = new Set();
    circ.wires.forEach(w => { if (w.kind !== 'tube') return; const a = w.a.c + ':' + w.a.t, b = w.b.c + ':' + w.b.t; tubed.add(a); tubed.add(b); unite(a, b); });
    net.joins.forEach(([a, b]) => unite(a, b));
    // vents from unconnected ports
    ports.forEach(p => {
      if (tubed.has(p.k)) return;
      const f = p.t.free || 'leak';
      if (f !== 'closed') net.vents.push({ k: p.k, type: f, c: p.c, t: p.t });
    });
    // graph
    const adj = new Map();
    const addAdj = (a, b, e) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, e }); };
    const P = new Map();
    const get = n => P.get(n) || 0;
    const edgesBoth = [];
    net.paths.forEach(e => { const a = find(e.a), b = find(e.b); if (a !== b) { edgesBoth.push([a, b]); addAdj(a, b, null); addAdj(b, a, null); } });
    net.fcs.forEach(e => { const a = find(e.a), b = find(e.b); if (a !== b) { const fc = { inN: a, outN: b, f: e.f }; edgesBoth.push([a, b]); addAdj(a, b, fc); addAdj(b, a, fc); } });
    const regs = net.regs.map(e => ({ a: find(e.a), b: find(e.b), set: e.set }));
    regs.forEach(r => { addAdj(r.a, r.b, null); addAdj(r.b, r.a, null); });
    const srcNodes = new Set();
    net.src.forEach(s => { const n = find(s.k); srcNodes.add(n); P.set(n, Math.max(get(n), s.bar)); });
    // pressure relaxation
    for (let it = 0; it < 60; it++) {
      let ch = false;
      for (const [a, b] of edgesBoth) { const m = Math.max(get(a), get(b)); if (m > get(a) + 1e-9) { P.set(a, m); ch = true; } if (m > get(b) + 1e-9) { P.set(b, m); ch = true; } }
      for (const r of regs) { const v = Math.min(get(r.a), r.set); if (v > get(r.b) + 1e-9) { P.set(r.b, v); ch = true; } }
      if (!ch) break;
    }
    // vent reachability (regulators are not crossed backwards)
    const ventNodes = new Set(); const leakPorts = [];
    net.vents.forEach(v => { const n = find(v.k); ventNodes.add(n); if (get(n) > 0.05 && (v.type === 'leak' || v.type === 'vent')) leakPorts.push(v); });
    const vented = new Set(ventNodes); const q = [...ventNodes];
    const adjBoth = new Map();
    edgesBoth.forEach(([a, b]) => { if (!adjBoth.has(a)) adjBoth.set(a, []); if (!adjBoth.has(b)) adjBoth.set(b, []); adjBoth.get(a).push(b); adjBoth.get(b).push(a); });
    while (q.length) { const n = q.pop(); (adjBoth.get(n) || []).forEach(m => { if (!vented.has(m)) { vented.add(m); q.push(m); } }); }
    // node states
    const state = new Map();
    const allNodes = new Set(ports.map(p => find(p.k)));
    allNodes.forEach(n => {
      const p = get(n);
      if (p > 0.05) { if (vented.has(n)) { state.set(n, 'L'); P.set(n, p * 0.6); } else state.set(n, 'P'); }
      else if (vented.has(n)) state.set(n, 'E');
      else state.set(n, 'T');
    });
    // trapped nodes keep the highest pressure their ports remember
    const trappedP = new Map();
    ports.forEach(p => { const n = find(p.k); if (state.get(n) === 'T') trappedP.set(n, Math.max(trappedP.get(n) || 0, lastP.get(p.k) || 0)); });
    trappedP.forEach((v, n) => P.set(n, v));
    ports.forEach(p => lastP.set(p.k, get(find(p.k))));

    return {
      find, P, state, leakPorts, srcNodes, ventNodes,
      p(c, t) { const k = key(c, t); return parent.has(k) ? get(find(k)) : 0; },
      st(c, t) { const k = key(c, t); return parent.has(k) ? state.get(find(k)) : 'E'; },
      nodeOfKey(k) { return parent.has(k) ? find(k) : null; },
      /** min throttle factor on the path from port to an exhaust (toVent) or to the supply */
      pathFactor(c, t, toVent) {
        const start = find(key(c, t));
        const targets = toVent ? ventNodes : srcNodes;
        const seen = new Map([[start, 1]]); const qq = [start];
        while (qq.length) {
          const n = qq.shift(); const f = seen.get(n);
          if (targets.has(n) && n !== start) return f;
          if (targets.has(n) && n === start) return 1;
          for (const { to, e } of adj.get(n) || []) {
            if (seen.has(to)) continue;
            let ff = f;
            if (e) { const flowFrom = toVent ? n : to; if (flowFrom === e.outN) ff = Math.min(f, e.f); }
            seen.set(to, ff); qq.push(to);
          }
        }
        return 1;
      },
    };
  }
  return { solve, resetMemory, PNet };
})();
