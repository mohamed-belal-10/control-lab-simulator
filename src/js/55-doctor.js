/* =========================================================================
 * Module 55: Circuit Check — traces the circuit like a technician would
 *  • every load (coil, lamp, sensor, PSU input, motor) is traced back to the
 *    + and − of each supply through wires and switch contacts
 *  • reports missing returns, wrong supply type/voltage, reversed sensors,
 *    shorts (now or when contacts close), half-wired contacts, unwired coils
 *  • lists which open contacts a load is waiting for ("energises when …")
 *  • pneumatic side: supply reachability, valve/cylinder tubing mistakes
 * Output: findings {level, title, fix, parts[], terms[]}
 * ========================================================================= */
CCS.doctor = (() => {
  const circ = CCS.circuit;
  const tagOf = c => (c && (c.props.tag || CCS.types[c.type].name)) || '?';
  const tname = k => { const [cid, tid] = k.split(':'); const c = circ.byId(cid); if (!c) return k; return `${tagOf(c)}:${tid === '14b' ? '14' : tid}`; };
  const wiredKey = k => { const [cid, tid] = k.split(':'); const c = circ.byId(cid); return !!(c && c.wired && c.wired[tid]); };

  const SUPPLIES = {
    mains: c => [{ pos: 'L', neg: 'N', kind: 'AC', V: 230, name: `${tagOf(c)} 230 V AC`, posName: 'L', negName: 'N' }],
    psu: c => [{ pos: '+V1', neg: '-V1', kind: 'DC', V: +c.props.vadj, name: `${tagOf(c)} 24 V DC`, posName: '+V', negName: '−V (0 V)' }],
    bench: c => [{ pos: '+', neg: '-', kind: 'DC', V: +c.props.volts, name: `${tagOf(c)} ${(+c.props.volts).toFixed(0)} V DC`, posName: '+', negName: '− (0 V)' }],
  };
  function loadSpec(c, name) {
    const t = tagOf(c), P = CCS.coil.parse;
    switch (c.type) {
      case 'relay4': return { ...P(c.props.coil), label: `relay ${t} coil (13–14)`, coil: true };
      case 'timer': return { ...P(c.props.coil), label: `timer ${t} supply (A1–A2)`, coil: true };
      case 'contactor': return { ...P(c.props.coil), label: `contactor ${t} coil (A1–A2)`, coil: true };
      case 'v52s': case 'v52d': case 'v32s': {
        const names = String(c.props.ytag || '').split(','), idx = name === 'coil12' && c.type === 'v52d' ? 1 : 0;
        return { ...P(c.props.coil), label: `solenoid ${names[idx] || name} of valve ${t}`, coil: true, valve: true };
      }
      case 'lamp': return { V: c.props.rating === '230V AC' ? 230 : 24, kind: 'ANY', label: `lamp ${t}` };
      case 'buzzer': return { V: 24, kind: 'ANY', label: `buzzer ${t}` };
      case 'motor': return { V: 230, kind: 'AC', label: `motor ${t}` };
      case 'prox': return { V: 24, kind: 'DC', min: 6, max: 36, label: `sensor ${t} supply (BN/BU)`, polar: 'BN' };
      case 'psu': return name === 'in' ? { V: 230, kind: 'AC', min: 85, max: 264, label: `power supply ${t} input (L/N)` } : null;
      default: return null;
    }
  }
  function whyOpen(sw) {
    const c = sw.c, t = tagOf(c), st = c.st || {};
    switch (c.type) {
      case 'pushbutton': return st.pressed ? `${t} is pressed` : `${t} is not pressed`;
      case 'selector': return st.pressed ? `${t} is turned to I` : `${t} is at 0`;
      case 'estop': return st.pressed ? `E-stop ${t} is pressed` : `${t}`;
      case 'relay4': case 'contactor': return st.on ? `${t} is energised (NC open)` : `${t} is not energised`;
      case 'timer': return st.out ? `${t} has timed` : `${t} has not timed out yet`;
      case 'mcb': return st.trip ? `breaker ${t} has tripped` : `breaker ${t} is OFF`;
      case 'reed': return c.props.attach ? `the piston magnet is not under reed ${t}` : `reed ${t} is not mounted on a cylinder`;
      case 'prox': return !st.pw ? `sensor ${t} is not powered` : `sensor ${t} sees ${st.obj ? 'an object' : 'nothing'}`;
      case 'limit': return `limit switch ${t} is not actuated`;
      default: return `${t} is open`;
    }
  }
  const swLabel = sw => `${tagOf(sw.c)} ${sw.ta === '14b' ? '14' : sw.ta}–${sw.tb === '14b' ? '14' : sw.tb}`;

  /* ------------------------------------------------------------------ electrical */
  function electrical(F) {
    circ.computeWired();
    CCS.attach.updateReeds();
    const nl = CCS.Elec.build(circ);
    const parent = new Map();
    const add = k => { if (!parent.has(k)) parent.set(k, k); };
    const find = k => { add(k); let r = k; while (parent.get(r) !== r) r = parent.get(r); let x = k; while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; } return r; };
    const unite = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    circ.parts.forEach(c => CCS.termsOf(c).forEach(t => t.k === 'e' && add(c.id + ':' + t.id)));
    nl.Rs.forEach(e => { if (e.kind === 'wire' || e.kind === 'join' || e.kind === 'gnd') unite(e.a, e.b); });
    const netWired = new Set(); parent.forEach((_, k) => { if (wiredKey(k)) netWired.add(find(k)); });
    // switch graph between nets
    const adj = new Map();
    nl.sws.forEach(sw => { const a = find(sw.a), b = find(sw.b); if (a === b) return; sw.na = a; sw.nb = b; [[a, b], [b, a]].forEach(([x, y]) => { if (!adj.has(x)) adj.set(x, []); adj.get(x).push({ to: y, sw }); }); });
    // 0-1 BFS: fewest open contacts from a start net
    function bfs(start) {
      const dist = new Map([[start, 0]]), prev = new Map(), dq = [start];
      while (dq.length) {
        const n = dq.shift(), d = dist.get(n);
        for (const { to, sw } of adj.get(n) || []) {
          const nd = d + (sw.closed ? 0 : 1);
          if (!dist.has(to) || nd < dist.get(to)) { dist.set(to, nd); prev.set(to, { from: n, sw }); sw.closed ? dq.unshift(to) : dq.push(to); }
        }
      }
      return { dist, prev, path(to) { const out = []; let n = to; while (prev.has(n) && n !== start) { const p = prev.get(n); out.push(p.sw); n = p.from; } return out.reverse(); } };
    }
    // supplies
    const sup = [];
    circ.parts.forEach(c => { const f = SUPPLIES[c.type]; if (f) f(c).forEach(s => { s.c = c; s.pk = c.id + ':' + s.pos; s.nk = c.id + ':' + s.neg; s.pn = find(s.pk); s.nn = find(s.nk); s.P = bfs(s.pn); s.N = bfs(s.nn); sup.push(s); }); });
    const loadsPresent = nl.Rs.some(e => e.kind === 'load');
    if (!sup.length && loadsPresent && circ.wires.some(w => w.kind === 'wire')) F.push({ level: 'error', title: 'No power supply in the circuit', fix: 'Add a 24 V DC power supply (or the bench supply) and wire its + and − to your circuit.', parts: [], terms: [] });

    // supply shorts
    sup.forEach(s => {
      if (s.pn === s.nn) F.push({ level: 'error', title: `SHORT: ${s.name} + and − are joined by wires only`, fix: `Find the wire that connects the ${s.posName} side directly to the ${s.negName} side and remove it — every path from + to − must pass through a load (coil, lamp, …).`, parts: [s.c.id], terms: [s.pk, s.nk] });
      else {
        const d = s.P.dist.get(s.nn);
        if (d !== undefined) {
          const path = s.P.path(s.nn);
          if (d === 0) F.push({ level: 'error', title: `SHORT: ${s.name} + reaches − through closed contacts with no load`, fix: `Path: ${path.map(swLabel).join(' → ')}. Put the load (coil/lamp) in that branch, or move the wire that bypasses it.`, parts: [s.c.id, ...path.map(x => x.c.id)], terms: [s.pk, s.nk] });
          else F.push({ level: 'warn', title: `Possible short on ${s.name}`, fix: `If ${path.filter(x => !x.closed).map(swLabel).join(' and ')} close, + connects to − with no load in between (${path.map(swLabel).join(' → ')}). Check that branch has its coil/lamp.`, parts: [s.c.id, ...path.map(x => x.c.id)], terms: [s.pk, s.nk] });
        }
      }
    });

    // loads
    const seenLoad = new Set();
    nl.Rs.filter(e => e.kind === 'load').forEach(e => {
      const c = e.c, spec = loadSpec(c, e.name); if (!spec || seenLoad.has(e.k)) return; seenLoad.add(e.k);
      const A = e.a, B = e.b, wA = netWired.has(find(A)), wB = netWired.has(find(B));
      const partWired = Object.values(c.wired || {}).some(Boolean);
      const hasTubes = circ.wires.some(w => w.kind === 'tube' && (w.a.c === c.id || w.b.c === c.id));
      if (!wA && !wB) {
        if (spec.coil && (partWired || hasTubes)) F.push({ level: spec.valve ? 'warn' : 'error', title: `${spec.label} is not wired`, fix: spec.valve ? `Wire pin 1 and pin 2 of the solenoid plug into your control circuit, otherwise the valve can only be shifted with its manual override.` : `Its contacts are used, but the coil gets no voltage, so they will never change over. Wire ${tname(A)} and ${tname(B)} into a branch between + and 0 V.`, parts: [c.id], terms: [A, B] });
        else if (partWired && c.type === 'prox') F.push({ level: 'error', title: `${spec.label} is not connected`, fix: `Brown (BN) → +24 V, blue (BU) → 0 V. Without them the sensor output never switches.`, parts: [c.id], terms: [A, B] });
        return;
      }
      if (find(A) === find(B)) { F.push({ level: 'warn', title: `${spec.label} is bypassed`, fix: `${tname(A)} and ${tname(B)} are connected by a wire, so no voltage can appear across it. Remove the bridging wire.`, parts: [c.id], terms: [A, B] }); return; }
      for (const [k, w] of [[A, wA], [B, wB]]) if (!w) {
        const other = k === A ? B : A;
        const s0 = sup[0];
        F.push({ level: 'error', title: `${tname(k)} is not connected (${spec.label})`, fix: `${tname(other)} is wired but ${tname(k)} is empty, so no current can flow. ${s0 ? `Connect ${tname(k)} to the other side of the supply (usually ${s0.name} ${s0.negName}, e.g. via the 0 V terminal strip).` : ''}`, parts: [c.id], terms: [k] });
      }
      if (!wA || !wB) return;
      // best supply & orientation
      const nA = find(A), nB = find(B);
      let best = null;
      sup.forEach(s => {
        [[nA, nB, false], [nB, nA, true]].forEach(([hi, lo, rev]) => {
          const d1 = s.P.dist.get(hi), d2 = s.N.dist.get(lo);
          if (d1 === undefined || d2 === undefined) return;
          const tot = d1 + d2;
          if (!best || tot < best.tot) best = { s, tot, rev, hi, lo };
        });
      });
      if (!best) {
        const reach = n => sup.flatMap(s => [s.P.dist.has(n) ? { s, pole: '+' } : null, s.N.dist.has(n) ? { s, pole: '−' } : null]).filter(Boolean);
        const rA = reach(nA), rB = reach(nB);
        const desc = r => (r.length ? r.map(x => `${x.s.name} ${x.pole === '+' ? x.s.posName : x.s.negName}`).join(', ') : 'nothing');
        let fix;
        if (!rA.length && !rB.length) fix = `Neither end reaches a supply. Trace from the supply + through your switches to ${tname(A)}, and from ${tname(B)} back to the supply −. A wire is missing or lands on the wrong terminal.`;
        else if (rA.length && rB.length && rA.every(x => x.pole === '+') && rB.every(x => x.pole === '+')) fix = `Both ends lead to the + side (${desc(rA)}). One end must go to 0 V: move the wire on ${tname(B)} to the 0 V / − terminal.`;
        else if (rA.length && rB.length && rA.every(x => x.pole === '−') && rB.every(x => x.pole === '−')) fix = `Both ends lead to the − (0 V) side. One end must come from + through the switches: move the wire on ${tname(A)}.`;
        else if (rA.length && rB.length) fix = `${tname(A)} reaches ${desc(rA)} but ${tname(B)} reaches ${desc(rB)} — that is two different supplies with separate 0 V, so no loop closes. Connect both to the same supply (or link the two 0 V terminals).`;
        else { const [ok, okR, bad] = rA.length ? [A, rA, B] : [B, rB, A]; const needPole = okR[0].pole === '+' ? 'the − (0 V)' : 'the +'; fix = `${tname(ok)} reaches ${desc(okR)}, but ${tname(bad)} has no path to ${needPole} side of any supply. Check the wire on ${tname(bad)} — it ends somewhere that leads nowhere (or on a wrong terminal).`; }
        F.push({ level: 'error', title: `${spec.label} can never be energised`, fix, parts: [c.id], terms: [A, B] });
        return;
      }
      const s = best.s;
      // supply type/voltage
      if (spec.kind === 'DC' && s.kind === 'AC') F.push({ level: 'error', title: `${spec.label} is a ${spec.V} V DC part fed from ${s.name}`, fix: spec.coil ? `It will burn. Feed it from the 24 V DC side, or use a coil rated 220 V AC.` : `It is a DC device — connect it to the 24 V DC supply, not to mains.`, parts: [c.id, s.c.id], terms: [A, B] });
      else if (spec.kind === 'AC' && s.kind === 'DC') F.push({ level: 'error', title: `${spec.label} needs ${spec.V} V AC but is fed from ${s.name}`, fix: spec.coil ? `It will never pull in. Either feed this branch from the mains side, or change the part to a 24 V DC coil (e.g. MY4 24DC).` : `Feed it from the mains (through the MCB).`, parts: [c.id, s.c.id], terms: [A, B] });
      else {
        const lo = spec.min ?? spec.V * 0.8, hi = spec.max ?? spec.V * 1.3;
        if (s.V < lo || s.V > hi) F.push({ level: 'error', title: `${spec.label} is rated ${spec.V} V but sees ${s.V} V from ${s.name}`, fix: s.V > hi ? `Over-voltage — it will burn. Use the right supply or a part rated ${s.V} V.` : `Too low — it will not operate. Use a ${s.V} V part or the right supply.`, parts: [c.id, s.c.id], terms: [A, B] });
      }
      if (spec.polar) { const posTerm = best.rev ? B : A; if (!posTerm.endsWith(':' + spec.polar)) F.push({ level: 'error', title: `${tagOf(c)}: brown/blue are reversed`, fix: `Brown (BN) must go to + and blue (BU) to 0 V. Swap the two wires.`, parts: [c.id], terms: [A, B] }); }
      // what it is waiting for
      if (best.tot > 0) {
        const up = s.P.path(best.hi), down = s.N.path(best.lo).reverse(), open = up.concat(down).filter(x => !x.closed);
        const chain = [`${s.c.props.tag || ''} ${s.posName}`, ...up.map(swLabel), tagOf(c), ...down.map(swLabel), `${s.negName}`];
        F.push({ level: 'info', title: `${spec.label} energises when: ${open.map(swLabel).join(' + ')}`, fix: `Current path: ${chain.join(' → ')}. Open now because ${[...new Set(open.map(whyOpen))].join('; ')}.`, parts: [c.id, ...open.map(x => x.c.id)], terms: [A, B], waiting: true });
      }
    });

    // half-wired contacts: a wired contact terminal whose partner(s) are all unwired
    const partners = new Map();
    nl.sws.forEach(sw => { [[sw.a, sw.b], [sw.b, sw.a]].forEach(([x, y]) => { if (!partners.has(x)) partners.set(x, { sw, list: [] }); partners.get(x).list.push(y); }); });
    partners.forEach(({ sw, list }, k) => {
      if (!wiredKey(k) || list.some(wiredKey)) return;
      const c = sw.c;
      if (c.type === 'mcb' || c.type === 'mains') return;
      if (c.type === 'prox' && /:(BN|BU)$/.test(k)) return;
      F.push({ level: 'warn', title: `${tname(k)} is wired but its contact partner isn't`, fix: `A contact only conducts between ${tname(k)} and ${list.map(tname).join(' / ')}. ${c.type === 'relay4' ? 'On the MY4 socket each pole is COM 9–12 with NC 1–4 and NO 5–8 (pole 1 = 9/1/5).' : ''} Wire the partner terminal, or move the wire to the right pin.`, parts: [c.id], terms: [k, ...list] });
    });
    // reed switches not mounted
    circ.parts.forEach(c => { if (c.type === 'reed' && !c.props.attach && Object.values(c.wired || {}).some(Boolean)) F.push({ level: 'warn', title: `Reed switch ${tagOf(c)} is not mounted on a cylinder`, fix: 'Drag it by its body onto the cylinder barrel at the end position it should detect.', parts: [c.id], terms: [] }); });
  }

  /* ------------------------------------------------------------------ pneumatic */
  function pneumatic(F) {
    const P = circ.parts, valves = P.filter(c => c.type.startsWith('v')), cyls = P.filter(c => c.type.startsWith('cyl')), airs = P.filter(c => c.type === 'air');
    if (!valves.length && !cyls.length) return;
    if (!airs.length) { F.push({ level: 'error', title: 'No compressed air supply', fix: 'Add "Compressed air supply" (and a service unit), then tube it to port 1 of each valve.', parts: [], terms: [] }); }
    airs.forEach(a => { if (!a.st.on) F.push({ level: 'warn', title: `Air supply ${tagOf(a)} is switched off`, fix: 'Click its ON/OFF switch.', parts: [a.id], terms: [] }); });
    P.filter(c => c.type === 'frl' && +c.props.set < 1.5).forEach(f => F.push({ level: 'warn', title: `Service unit ${tagOf(f)} is set to ${f.props.set} bar`, fix: 'Pilot-operated valves need ≥ 1.5 bar; set about 6 bar.', parts: [f.id], terms: [] }));
    const parent = new Map(), add = k => { if (!parent.has(k)) parent.set(k, k); };
    const find = k => { add(k); let r = k; while (parent.get(r) !== r) r = parent.get(r); return r; };
    const unite = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    const tubed = new Set();
    circ.wires.forEach(w => { if (w.kind !== 'tube') return; const a = w.a.c + ':' + w.a.t, b = w.b.c + ':' + w.b.t; tubed.add(a); tubed.add(b); unite(a, b); });
    P.forEach(c => {
      const k = t => c.id + ':' + t;
      if (c.type === 'tee') { unite(k('a'), k('b')); unite(k('a'), k('c')); }
      if (c.type === 'manifold') [1, 2, 3, 4].forEach(i => unite(k('in'), k('o' + i)));
      if (c.type === 'frl') unite(k('in'), k('out'));
      if (c.type === 'flowctl') unite(k('in'), k('out'));
    });
    const airNets = new Set(airs.map(a => find(a.id + ':out')));
    const portsInNet = n => { const out = []; parent.forEach((_, k) => { if (find(k) === n) out.push(k); }); return out; };
    valves.forEach(v => {
      const k1 = v.id + ':p1';
      if (!tubed.has(k1)) F.push({ level: 'error', title: `Valve ${tagOf(v)}: port 1 (supply) has no tube`, fix: 'Run a tube from the service unit OUT (or a manifold outlet) to port 1.', parts: [v.id], terms: [k1] });
      else if (airs.length && !airNets.has(find(k1))) F.push({ level: 'error', title: `Valve ${tagOf(v)}: port 1 is not connected to the air supply`, fix: 'Follow the tube from port 1 — it must lead back to the supply (through the service unit / manifold), not to a cylinder or another valve output.', parts: [v.id], terms: [k1] });
      ['p3', 'p5'].forEach(p => { const k = v.id + ':' + p; if (tubed.has(k) && portsInNet(find(k)).some(x => /:p[124]$|:cap$|:rod$/.test(x) && x !== k)) F.push({ level: 'error', title: `Valve ${tagOf(v)}: exhaust port ${p.slice(1)} is tubed to a working line`, fix: 'Ports 3 and 5 are exhausts — fit silencers there. Cylinders go on 2 and 4.', parts: [v.id], terms: [k] }); });
    });
    cyls.forEach(c => {
      const ports = c.type === 'cylDA' ? ['cap', 'rod'] : ['cap'];
      const nets = {};
      ports.forEach(p => {
        const k = c.id + ':' + p;
        if (!tubed.has(k)) { F.push({ level: 'error', title: `Cylinder ${tagOf(c)}: ${p === 'cap' ? 'cap-end' : 'rod-end'} port has no tube`, fix: p === 'cap' ? 'Tube it to valve output 4 (A) so it can extend.' : 'Tube it to valve output 2 (B) so it can retract.', parts: [c.id], terms: [k] }); return; }
        const n = find(k), list = portsInNet(n); nets[p] = n;
        if (airNets.has(n)) F.push({ level: 'error', title: `Cylinder ${tagOf(c)}: ${p} port is connected straight to the air supply`, fix: 'There is no valve in between, so nothing can control it. Route the line through a valve output (2 or 4).', parts: [c.id], terms: [k] });
        else if (!list.some(x => /:p[24]$/.test(x))) F.push({ level: 'warn', title: `Cylinder ${tagOf(c)}: ${p} port does not reach a valve output`, fix: 'Follow the tube — it should end on port 2 or 4 of a valve (optionally via a flow control).', parts: [c.id], terms: [k] });
      });
      if (nets.cap && nets.rod && nets.cap === nets.rod) F.push({ level: 'error', title: `Cylinder ${tagOf(c)}: both ports are on the same line`, fix: 'Cap and rod must go to the two different valve outputs (4 and 2).', parts: [c.id], terms: [c.id + ':cap', c.id + ':rod'] });
    });
  }

  function run() {
    const F = [];
    try { electrical(F); } catch (e) { console.error(e); F.push({ level: 'warn', title: 'Electrical check could not finish', fix: String(e.message), parts: [], terms: [] }); }
    try { pneumatic(F); } catch (e) { console.error(e); }
    const rank = { error: 0, warn: 1, info: 2 };
    F.sort((a, b) => rank[a.level] - rank[b.level]);
    return F;
  }

  /** compact text description of the circuit for the AI */
  function describe(findings, goal) {
    const L = [];
    L.push('PARTS (tag — type — settings — live state):');
    circ.parts.forEach(c => {
      const T = CCS.types[c.type], p = c.props, st = c.st || {};
      const props = Object.entries(p).filter(([k, v]) => k !== 'tag' && v !== '' && v !== undefined).map(([k, v]) => `${k}=${k === 'attach' || k === 'link' ? tagOf(circ.byId(v)) : v}`).join(', ');
      const live = ['on', 'pressed', 'pos', 'trip', 'out', 'closed', 'obj', 'pw', 'lit', 'burnt'].filter(k => st[k] !== undefined && typeof st[k] !== 'object').map(k => `${k}=${typeof st[k] === 'number' ? (+st[k]).toFixed(2) : st[k]}`).join(', ');
      L.push(`- ${tagOf(c)} — ${T.name}${props ? ' — ' + props : ''}${live ? ' — [' + live + ']' : ''}`);
    });
    L.push('\nTERMINAL MEANINGS per part type:');
    [...new Set(circ.parts.map(c => c.type))].forEach(type => {
      const c = circ.parts.find(x => x.type === type);
      L.push(`- ${CCS.types[type].name}: ` + CCS.termsOf(c).map(t => `${t.id === '14b' ? '14' : t.id}=${t.d}`).join('; '));
    });
    L.push('\nWIRES (electrical, from → to):');
    circ.wires.filter(w => w.kind === 'wire').forEach(w => L.push(`- ${tname(w.a.c + ':' + w.a.t)} → ${tname(w.b.c + ':' + w.b.t)}`));
    L.push('\nTUBES (pneumatic):');
    circ.wires.filter(w => w.kind === 'tube').forEach(w => L.push(`- ${tname(w.a.c + ':' + w.a.t)} → ${tname(w.b.c + ':' + w.b.t)}`));
    L.push(`\nSIMULATION: ${CCS.sim.running ? 'running for ' + CCS.sim.time.toFixed(1) + ' s' : 'stopped'}`);
    if (CCS.sim.faults.length) { L.push('Simulator fault messages:'); CCS.sim.faults.slice(0, 25).forEach(f => L.push(`- ${f.level}: ${f.c ? tagOf(f.c) + ': ' : ''}${f.msg}`)); }
    L.push('\nAUTOMATIC CHECKER FINDINGS:');
    findings.slice(0, 40).forEach(f => L.push(`- ${f.level}: ${f.title} — ${f.fix}`));
    if (goal) L.push(`\nWHAT THE USER WANTS THE CIRCUIT TO DO:\n${goal}`);
    return L.join('\n');
  }
  return { run, describe };
})();
