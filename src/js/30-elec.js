/* =========================================================================
 * Module 30: electrical solver
 * Modified nodal analysis on a resistive network.
 *  - every wire is a 1 mΩ resistor (so wire currents are known)
 *  - every closed contact is a 3 mΩ resistor (so contact currents are known)
 *  - sources are Norton equivalents (V/Rint || Rint) -> short circuits give
 *    realistic huge currents that trip breakers / PSU overload protection
 *  - AC and DC are solved separately (superposition) with one LU factorisation,
 *    so a 24 V DC coil fed from 230 V AC is detected as such
 *  - every node has a 100 MΩ leak to ground so floating networks stay solvable
 * ========================================================================= */
CCS.Elec = (() => {
  const RWIRE = 1e-3, RCLOSED = 3e-3, GLEAK = 1e-8;
  const key = (c, t) => (t === 'GND' || t.includes(':')) ? t : c.id + ':' + t;

  class Netlist {
    constructor(passive = false) { this.Rs = []; this.Vs = []; this.sws = []; this.passive = passive; }
    res(c, a, b, ohm, name, kind = 'load') { this.Rs.push({ a: key(c, a), b: key(c, b), r: Math.max(ohm, 1e-5), k: c.id + '/' + name, kind, c, name }); }
    /** every switch is recorded (open or closed) so the circuit checker can trace through it */
    sw(c, a, b, closed, name) { this.sws.push({ a: key(c, a), b: key(c, b), closed, k: c.id + '/' + name, c, name, ta: a, tb: b }); if (closed) this.res(c, a, b, RCLOSED, name, 'sw'); }
    join(c, a, b) { this.res(c, a, b, 1e-4, 'j' + a + '_' + b, 'join'); }
    gnd(c, a, name = 'gnd') { this.Rs.push({ a: key(c, a), b: 'GND', r: 1e-3, k: c.id + '/' + name, kind: 'gnd', c }); }
    src(c, p, n, volts, kind, rint, name) {
      if (this.passive) return;
      this.Vs.push({ p: key(c, p), n: key(c, n), v: volts, kind, rint, k: c.id + '/' + name });
    }
    wire(w) { this.Rs.push({ a: w.a.c + ':' + w.a.t, b: w.b.c + ':' + w.b.t, r: RWIRE, k: 'W/' + w.id, kind: 'wire', w }); }
    signature() {
      let s = '';
      for (const e of this.Rs) s += e.k + e.r.toPrecision(5) + ';';
      for (const e of this.Vs) s += e.k + e.v.toPrecision(5) + e.kind + e.rint.toPrecision(4) + ';';
      return s;
    }
  }

  /** dense LU factorisation with partial pivoting (in place) */
  function lu(A, n) {
    const piv = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(A[k * n + k]);
      for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > mx) { mx = v; p = i; } }
      piv[k] = p;
      if (p !== k) for (let j = 0; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; }
      const d = A[k * n + k] || 1e-30;
      for (let i = k + 1; i < n; i++) {
        const f = (A[i * n + k] /= d);
        if (f !== 0) for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      }
    }
    return piv;
  }
  function luSolve(A, piv, n, b) {
    const x = Float64Array.from(b);
    for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; } }
    for (let i = 0; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= A[i * n + j] * x[j]; x[i] = s; }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j]; x[i] = s / (A[i * n + i] || 1e-30); }
    return x;
  }

  function solve(nl) {
    const idx = new Map(); let n = 0;
    const node = k => { if (k === 'GND') return -1; let i = idx.get(k); if (i === undefined) { i = n++; idx.set(k, i); } return i; };
    nl.Rs.forEach(e => { e.ia = node(e.a); e.ib = node(e.b); });
    nl.Vs.forEach(e => { e.ip = node(e.p); e.in = node(e.n); });
    const A = new Float64Array(n * n);
    for (let i = 0; i < n; i++) A[i * n + i] = GLEAK;
    const stamp = (i, j, g) => {
      if (i >= 0) A[i * n + i] += g;
      if (j >= 0) A[j * n + j] += g;
      if (i >= 0 && j >= 0) { A[i * n + j] -= g; A[j * n + i] -= g; }
    };
    nl.Rs.forEach(e => stamp(e.ia, e.ib, 1 / e.r));
    nl.Vs.forEach(e => stamp(e.ip, e.in, 1 / e.rint));
    const bAC = new Float64Array(n), bDC = new Float64Array(n);
    nl.Vs.forEach(e => {
      const b = e.kind === 'AC' ? bAC : bDC, I = e.v / e.rint;
      if (e.ip >= 0) b[e.ip] += I;
      if (e.in >= 0) b[e.in] -= I;
    });
    let xAC = new Float64Array(n), xDC = new Float64Array(n);
    if (n > 0) {
      const piv = lu(A, n);
      if (nl.Vs.some(e => e.kind === 'AC')) xAC = luSolve(A, piv, n, bAC);
      if (nl.Vs.some(e => e.kind === 'DC')) xDC = luSolve(A, piv, n, bDC);
    }
    const V = (x, i) => (i < 0 ? 0 : x[i]);
    const cur = new Map();
    nl.Rs.forEach(e => {
      const ac = (V(xAC, e.ia) - V(xAC, e.ib)) / e.r, dc = (V(xDC, e.ia) - V(xDC, e.ib)) / e.r;
      cur.set(e.k, { ac, dc, rms: Math.hypot(ac, dc) });
    });
    nl.Vs.forEach(e => {
      const vac = V(xAC, e.ip) - V(xAC, e.in), vdc = V(xDC, e.ip) - V(xDC, e.in);
      const ac = e.kind === 'AC' ? (e.v - vac) / e.rint : -vac / e.rint;
      const dc = e.kind === 'DC' ? (e.v - vdc) / e.rint : -vdc / e.rint;
      cur.set(e.k, { ac, dc, rms: Math.hypot(ac, dc) });
    });
    return new Result(idx, xAC, xDC, cur);
  }

  class Result {
    constructor(idx, xAC, xDC, cur) { this.idx = idx; this.xAC = xAC; this.xDC = xDC; this.cur = cur; }
    node(k) { const i = this.idx.get(k); return i === undefined ? { ac: 0, dc: 0, ok: false } : { ac: this.xAC[i], dc: this.xDC[i], ok: true }; }
    /** voltage between two terminals of part c (or full keys) */
    vd(c, a, b) {
      const A = this.node(key(c, a)), B = this.node(key(c, b));
      return { dc: A.dc - B.dc, ac: Math.abs(A.ac - B.ac), ok: A.ok && B.ok };
    }
    i(c, name) { return this.cur.get(c.id + '/' + name) || { ac: 0, dc: 0, rms: 0 }; }
    wire(id) { return this.cur.get('W/' + id) || { ac: 0, dc: 0, rms: 0 }; }
  }
  const EMPTY = new Result(new Map(), new Float64Array(0), new Float64Array(0), new Map());

  /** build the netlist for the whole circuit */
  function build(circ, passive = false) {
    const nl = new Netlist(passive);
    circ.parts.forEach(c => { const T = CCS.types[c.type]; if (T.elec) T.elec(c, nl); });
    circ.wires.forEach(w => { if (w.kind === 'wire') nl.wire(w); });
    return nl;
  }

  /** ohmmeter: all sources removed, 1 V test source between probes */
  function measureR(circ, ka, kb) {
    const nl = build(circ, true);
    nl.passive = false;
    nl.Vs.push({ p: ka, n: kb, v: 1, kind: 'DC', rint: 1e-3, k: 'meter/src' });
    const r = solve(nl);
    const I = r.cur.get('meter/src').dc;
    const R = 1 / Math.max(I, 1e-15) - 1e-3;
    return R > 2e7 ? Infinity : Math.max(0, R);
  }

  return { Netlist, build, solve, measureR, EMPTY, key, RWIRE };
})();
