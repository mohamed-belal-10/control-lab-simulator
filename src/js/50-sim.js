/* =========================================================================
 * Module 50: simulation engine — fixed 5 ms steps
 *  1. electrical solve, iterated until fast states (breakers, sensors, PSU) settle
 *  2. time-based electrical updates (relays, timers, coils, faults)
 *  3. pneumatic solve with current valve positions
 *  4. motion (cylinders) → reed switches / limit switches
 *  5. installation checks (wires per terminal, tubes per port, wire overload)
 * ========================================================================= */
CCS.sim = {
  running: false, paused: false, time: 0, speed: 1, DT: 0.005,
  R: CCS.Elec.EMPTY, PR: null, lastSig: null, lastR: null,
  wireFaults: new Map(), faults: [],

  ctx() {
    return { fault: (c, level, msg) => { if (!c.faults.some(f => f.msg === msg)) c.faults.push({ level, msg }); }, time: this.time };
  },
  solveElec() {
    const circ = CCS.circuit;
    let R = this.R;
    for (let it = 0; it < 12; it++) {
      const nl = CCS.Elec.build(circ), sig = nl.signature();
      R = sig === this.lastSig ? this.lastR : CCS.Elec.solve(nl);
      this.lastSig = sig; this.lastR = R;
      let changed = false;
      circ.parts.forEach(c => { const T = CCS.types[c.type]; if (T.sense && T.sense(c, R)) changed = true; });
      if (!changed) break;
    }
    return R;
  },
  step(dt) {
    const circ = CCS.circuit, ctx = this.ctx();
    circ.parts.forEach(c => (c.faults = []));
    circ.computeWired();
    const R = this.solveElec();
    circ.parts.forEach(c => { const T = CCS.types[c.type]; if (T.step) T.step(c, dt, R, ctx); });
    const PR = CCS.Pneu.solve(circ);
    circ.parts.forEach(c => { const T = CCS.types[c.type]; if (T.pstep) T.pstep(c, dt, PR, ctx); });
    CCS.attach.updateReeds();
    this.installChecks(R, ctx);
    this.R = R; this.PR = PR; this.time += dt;
  },
  installChecks(R, ctx) {
    const circ = CCS.circuit;
    this.wireFaults.clear();
    circ.parts.forEach(c => {
      const T = CCS.types[c.type];
      CCS.termsOf(c).forEach(t => {
        const n = (c.wired || {})[t.id] || 0;
        if (t.k === 'e' && n > 2) ctx.fault(c, 'warn', `${n} wires on terminal ${t.id} — a screw clamp holds max 2 ferruled wires. Use a terminal strip.`);
        if (t.k === 'p' && n > 1) ctx.fault(c, 'error', `${n} tubes on port ${t.id} — a push-in fitting takes exactly one tube. Use a T-fitting.`);
      });
    });
    const lim = { '0.5': 3, '0.75': 6, '1.0': 10, '1.5': 16, '2.5': 24 };
    circ.wires.forEach(w => {
      if (w.kind !== 'wire') return;
      const I = R.wire(w.id).rms, L = lim[w.gauge || '0.75'] || 6;
      if (I > L) this.wireFaults.set(w.id, `Wire overloaded: ${I.toFixed(1)} A in a ${w.gauge || '0.75'} mm² conductor (max ≈ ${L} A).`);
    });
  },
  /** called every animation frame with real elapsed seconds */
  frame(realDt) {
    if (!this.running || this.paused) return;
    let t = Math.min(realDt, 0.1) * this.speed;
    const n = Math.max(1, Math.round(t / this.DT));
    for (let i = 0; i < n; i++) this.step(this.DT);
    this.collect();
  },
  collect() {
    const list = [];
    CCS.circuit.parts.forEach(c => c.faults.forEach(f => list.push({ ...f, c })));
    this.wireFaults.forEach((msg, id) => list.push({ level: 'warn', msg, wire: id }));
    const rank = { error: 0, warn: 1, info: 2 };
    list.sort((a, b) => rank[a.level] - rank[b.level]);
    this.faults = list;
  },
  start() { if (!this.running) { this.running = true; this.paused = false; this.lastSig = null; CCS.Pneu.resetMemory(); this.step(this.DT); this.collect(); } else this.paused = !this.paused; },
  reset() {
    this.running = false; this.paused = false; this.time = 0;
    CCS.circuit.parts.forEach(c => CCS.initPart(c));
    CCS.Pneu.resetMemory();
    this.R = CCS.Elec.EMPTY; this.PR = null; this.lastSig = null; this.faults = []; this.wireFaults.clear();
    CCS.attach.syncAll();
  },
  /** static check while stopped: wires/tubes per terminal only */
  idleCheck() {
    if (this.running) return;
    const ctx = this.ctx();
    CCS.circuit.parts.forEach(c => (c.faults = []));
    CCS.circuit.computeWired();
    this.installChecks(CCS.Elec.EMPTY, ctx);
    this.collect();
  },
};
