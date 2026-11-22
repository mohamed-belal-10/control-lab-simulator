/* =========================================================================
 * Module 24: pneumatic parts — supply, FRL, valves, cylinders, fittings
 * ISO 5599 port numbers: 1 supply · 2/4 outputs · 3/5 exhausts
 * Coil 14 pilots 1→4; coil 12 (or spring) returns to 1→2
 * ========================================================================= */
const VALVE_COIL_R = { '24VDC': 192, '12VDC': 48, '220VAC': 13800 };
const PILOT_MIN = 1.5;

CCS.defType({
  type: 'air', name: 'Compressed air supply', cat: 'Air supply', w: 150, h: 104,
  info: 'Compressor / workshop air line. Click the switch to open or close the supply. Typical lab pressure is 6 bar.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: '0Z1' }, { key: 'bar', label: 'Pressure (bar)', type: 'number', def: 6, min: 1, max: 10, step: 0.5 }],
  terms: () => [{ id: 'out', x: 140, y: 66, k: 'p', d: 'Air outlet', free: 'leak' }],
  init(c) { c.st.on = true; },
  pneu(c, P) { if (c.st.on) P.source(c, 'out', +c.props.bar); },
  act(c, a, ph) { if (a === 'pwr' && ph === 'down') { c.st.on = !c.st.on; return true; } },
  pstep(c, dt, PR, ctx) { if (c.st.on && PR.st(c, 'out') === 'L') ctx.fault(c, 'warn', 'Supply outlet open — air is blowing out.'); },
  draw(c) {
    return `<g filter="url(#fShadow)"><rect x="8" y="34" width="110" height="52" rx="26" fill="#1565c0" stroke="#0d3c7a"/></g>` +
      `<rect x="8" y="34" width="110" height="18" rx="9" fill="#fff" opacity=".15"/>` +
      D.rect(36, 10, 50, 26, '#37474f', { rx: 4 }) + D.circ(61, 23, 8, '#b0bec5') + D.rect(16, 86, 8, 14, '#333') + D.rect(102, 86, 8, 14, '#333') +
      `<circle cx="104" cy="22" r="13" fill="#fff" stroke="#333" stroke-width="2"/><line x1="104" y1="22" x2="${104 + 10 * Math.cos((-220 + 260 * (+c.props.bar) / 10) * Math.PI / 180)}" y2="${22 + 10 * Math.sin((-220 + 260 * (+c.props.bar) / 10) * Math.PI / 180)}" stroke="#d32f2f" stroke-width="1.6"/>` +
      D.rect(118, 60, 16, 12, 'url(#gBrass)') +
      `<g data-act="pwr">${D.rect(14, 50, 30, 20, c.st.on ? '#2e7d32' : '#555', { rx: 4 })}${D.text(29, 64, c.st.on ? 'ON' : 'OFF', { size: 8, fill: '#fff', weight: 700 })}</g>` +
      D.text(78, 64, `${(+c.props.bar).toFixed(1)} bar`, { size: 10, fill: '#fff', weight: 700 }) + D.text(78, 78, c.props.tag, { size: 8, fill: '#cfe' }) +
      D.port(140, 66, 'out', '', 'below');
  },
});

CCS.defType({
  type: 'frl', name: 'Service unit (filter-regulator)', cat: 'Air supply', w: 112, h: 176,
  info: 'Filter-regulator with gauge (e.g. Airtac AFR/AFC2000): IN on the left, regulated OUT on the right. Set the working pressure in the properties.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: '0Z2' }, { key: 'set', label: 'Set pressure (bar)', type: 'number', def: 6, min: 0, max: 10, step: 0.1 }],
  terms: () => [{ id: 'in', x: 8, y: 52, k: 'p', d: 'Air in (from supply)', free: 'closed' }, { id: 'out', x: 104, y: 52, k: 'p', d: 'Regulated air out', free: 'leak' }],
  init(c) { c.st.p = 0; },
  pneu(c, P) { P.reg(c, 'in', 'out', +c.props.set); },
  pstep(c, dt, PR) { c.st.p = PR.p(c, 'out'); },
  draw(c) {
    const ang = (-220 + 260 * Math.min(10, c.st.p) / 10) * Math.PI / 180;
    return `<g filter="url(#fShadow)">${D.rect(18, 36, 76, 34, 'url(#gGrey)', { rx: 4 })}</g>` + D.rect(8, 44, 14, 16, 'url(#gGrey)') + D.rect(90, 44, 14, 16, 'url(#gGrey)') +
      `<circle cx="56" cy="20" r="18" fill="#fff" stroke="#333" stroke-width="2.5"/>` + D.text(56, 31, 'bar', { size: 6 }) +
      `<line x1="56" y1="20" x2="${56 + 14 * Math.cos(ang)}" y2="${20 + 14 * Math.sin(ang)}" stroke="#d32f2f" stroke-width="2"/><circle cx="56" cy="20" r="2" fill="#333"/>` +
      D.text(56, 14, c.st.p.toFixed(1), { size: 7, weight: 700 }) +
      `<path d="M34 70 h44 l-6 74 q-16 10 -32 0 z" fill="url(#gClear)" stroke="#7a8a99"/><path d="M38 128 h36 l-2 16 q-16 8 -32 0 z" fill="#90caf9" opacity=".5"/>` +
      D.rect(48, 146, 16, 18, '#555', { rx: 3 }) + D.text(56, 94, c.props.tag, { size: 8, weight: 700 }) + D.text(56, 106, `set ${(+c.props.set).toFixed(1)}`, { size: 7 }) +
      D.port(8, 52, 'in', 'IN', 'above') + D.port(104, 52, 'out', 'OUT', 'above');
  },
});

CCS.defType({
  type: 'tee', name: 'T push-in fitting', cat: 'Fittings', w: 48, h: 48,
  info: 'Union T push-in fitting (e.g. PE-6 / PE-8). One push-in port takes exactly one tube — use a T to split a line.',
  props: [],
  terms: () => [{ id: 'a', x: 8, y: 20, k: 'p', d: 'Port', free: 'leak' }, { id: 'b', x: 40, y: 20, k: 'p', d: 'Port', free: 'leak' }, { id: 'c', x: 24, y: 40, k: 'p', d: 'Port', free: 'leak' }],
  pneu(c, P) { P.join(c, 'a', 'b'); P.join(c, 'a', 'c'); },
  draw: c => D.rect(8, 14, 32, 12, '#e0e0e0', { rx: 3 }) + D.rect(18, 14, 12, 26, '#e0e0e0', { rx: 3 }) + D.port(8, 20, 'a', '') + D.port(40, 20, 'b', '') + D.port(24, 40, 'c', ''),
});

CCS.defType({
  type: 'manifold', name: 'Distribution manifold 1→4', cat: 'Fittings', w: 156, h: 60,
  info: 'Aluminium distribution block: IN on the left, four outlets on top. Unused outlets are assumed to be plugged.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: '0Z3' }],
  terms: () => [{ id: 'in', x: 8, y: 36, k: 'p', d: 'Inlet', free: 'closed' }].concat([1, 2, 3, 4].map(i => ({ id: 'o' + i, x: 36 + (i - 1) * 32, y: 16, k: 'p', d: 'Outlet ' + i, free: 'closed' }))),
  pneu(c, P) { [1, 2, 3, 4].forEach(i => P.join(c, 'in', 'o' + i)); },
  draw(c) { let s = `<g filter="url(#fShadow)">${D.rect(8, 22, 140, 28, 'url(#gAluV)', { rx: 3 })}</g>` + D.port(8, 36, 'in', 'IN', 'below'); [1, 2, 3, 4].forEach(i => (s += D.port(36 + (i - 1) * 32, 16, 'o' + i, ''))); return s + D.text(100, 42, c.props.tag, { size: 8, weight: 700 }); },
});

/* -------------------------- solenoid valves -------------------------- */
const VALVES = {
  v52s: { name: '5/2 valve, single solenoid', w: 236, coils: ['14'], ports: [['4', 110, 'top'], ['2', 158, 'top'], ['5', 94, 'bot'], ['1', 134, 'bot'], ['3', 174, 'bot']], spring: true,
    paths: pos => pos ? [['1', '4'], ['2', '3']] : [['1', '2'], ['4', '5']], ex: 'Airtac 4V210-08 / 4V110-06', body: [56, 220] },
  v52d: { name: '5/2 valve, double solenoid', w: 276, coils: ['14', '12'], ports: [['4', 118, 'top'], ['2', 158, 'top'], ['5', 102, 'bot'], ['1', 138, 'bot'], ['3', 174, 'bot']], spring: false,
    paths: pos => pos ? [['1', '4'], ['2', '3']] : [['1', '2'], ['4', '5']], ex: 'Airtac 4V220-08 / 4V120-06', body: [56, 220] },
  v32s: { name: '3/2 valve NC, single solenoid', w: 206, coils: ['12'], ports: [['2', 126, 'top'], ['1', 106, 'bot'], ['3', 146, 'bot']], spring: true,
    paths: pos => pos ? [['1', '2']] : [['2', '3']], ex: 'Airtac 3V210-08 NC', body: [56, 190] },
};
const portFree = id => (id === '1' ? 'closed' : id === '3' || id === '5' ? 'vent' : 'leak');
Object.entries(VALVES).forEach(([type, V]) => {
  const coilX = id => (V.coils.length === 2 && id === '12' ? V.w - 28 : 28);
  CCS.defType({
    type, name: V.name, cat: 'Valves', w: V.w, h: 112,
    info: `${V.name} (e.g. ${V.ex}), internally piloted: it needs at least ${PILOT_MIN} bar at port 1 to shift.\nPorts (ISO 5599): 1 = supply, ${V.ports.filter(p => p[0] === '2' || p[0] === '4').map(p => p[0]).join(' / ')} = to the cylinder, ${V.ports.filter(p => p[0] === '3' || p[0] === '5').map(p => p[0]).join(' / ')} = exhaust (fit silencers).\nEach coil has a DIN 43650 plug: terminals 1 and 2 (+ earth). Coil 24 V DC ≈ 3 W (125 mA) — too much for a reed switch or sensor output, use a relay contact.\n` +
      (V.spring ? 'Spring return: the valve goes back as soon as the coil is de-energised (mono-stable).' : 'Double solenoid = memory (bi-stable): the valve stays where the last pulse put it. Never energise both coils together.') +
      '\nThe yellow buttons are the manual overrides.',
    props: [{ key: 'tag', label: 'Tag', type: 'text', def: type === 'v32s' ? '1V2' : '1V1' }, { key: 'coil', label: 'Coil', type: 'select', options: ['24VDC', '12VDC', '220VAC'], def: '24VDC' },
      { key: 'ytag', label: 'Coil names', type: 'text', def: V.coils.length === 2 ? 'Y1,Y2' : 'Y1' }],
    terms: () => {
      const t = [];
      V.coils.forEach(cid => { const x = coilX(cid), nm = cid === '14' ? 'coil 14 (pilots 1→4)' : 'coil 12 (pilots 1→2)'; t.push({ id: 'c' + cid + 'a', x: x - 10, y: 96, k: 'e', d: `Solenoid ${nm}, pin 1` }, { id: 'c' + cid + 'b', x: x + 10, y: 96, k: 'e', d: `Solenoid ${nm}, pin 2` }); });
      V.ports.forEach(([id, x, side]) => t.push({ id: 'p' + id, x, y: side === 'top' ? 16 : 80, k: 'p', d: { 1: 'Supply (P)', 2: 'Output B', 4: 'Output A', 3: 'Exhaust', 5: 'Exhaust' }[id] + ' — port ' + id, free: portFree(id) }));
      return t;
    },
    init(c) { c.st.pos = 0; c.st.coil = {}; c.st.mo = {}; c.st.p1 = 0; c.st.burnt = {}; c.st.burnT = {}; },
    elec(c, N) { V.coils.forEach(cid => { if (!c.st.burnt[cid]) N.res(c, 'c' + cid + 'a', 'c' + cid + 'b', VALVE_COIL_R[c.props.coil], 'coil' + cid); }); },
    step(c, dt, R, ctx) {
      const names = String(c.props.ytag || '').split(',');
      V.coils.forEach((cid, i) => {
        const vd = R.vd(c, 'c' + cid + 'a', 'c' + cid + 'b'), ev = CCS.coil.eval(c.props.coil, vd);
        const st = { burnT: c.st.burnT[cid] || 0, burnt: c.st.burnt[cid] };
        CCS.coil.burnCheck(c, st, ev, dt, ctx, `Solenoid ${names[i] || cid}`);
        c.st.burnT[cid] = st.burnT; c.st.burnt[cid] = st.burnt;
        if (st.burnt) ctx.fault(c, 'error', `Solenoid ${names[i] || cid} burnt. Press "Repair".`);
        c.st.coil[cid] = !st.burnt && ev.eff >= 0.85;
      });
      const on = cid => c.st.coil[cid] || c.st.mo[cid];
      const pilot = c.st.p1 >= PILOT_MIN;
      let target = c.st.pos;
      if (V.coils.length === 1) {
        const want = on(V.coils[0]) ? 1 : 0; // single coil: energised = position 1, spring returns to 0
        if (want && !pilot) { if (c.st.pos === 0) ctx.fault(c, 'warn', `Solenoid energised but only ${c.st.p1.toFixed(1)} bar at port 1 — pilot valve needs ≥ ${PILOT_MIN} bar to shift.`); target = 0; }
        else target = want;
      } else {
        const a = on('14'), b = on('12');
        if (a && b) ctx.fault(c, 'warn', 'Both solenoids energised at the same time — the valve stays where it was. Check your interlocks.');
        else if ((a || b) && !pilot) ctx.fault(c, 'warn', `Only ${c.st.p1.toFixed(1)} bar at port 1 — the pilot needs ≥ ${PILOT_MIN} bar to shift the spool.`);
        else if (a) target = 1; else if (b) target = 0;
      }
      // spool response time (~30 ms for 4V-series pilot valves)
      if (target !== c.st.pos) { c.st.tS = (c.st.tS || 0) + dt; if (c.st.tS >= 0.03) { c.st.pos = target; c.st.tS = 0; } } else c.st.tS = 0;
      V.coils.forEach(cid => { const I = R.i(c, 'coil' + cid).rms; c.st['I' + cid] = I; });
    },
    pneu(c, P) { V.paths(c.st.pos).forEach(([a, b]) => P.path(c, 'p' + a, 'p' + b)); },
    pstep(c, dt, PR, ctx) {
      c.st.p1 = PR.p(c, 'p1');
      V.ports.forEach(([id]) => { if ((id === '2' || id === '4') && PR.st(c, 'p' + id) === 'L') ctx.fault(c, 'warn', `Port ${id} is open — air is blowing out. Connect a tube or fit a blanking plug.`); });
    },
    act(c, a, ph) { if (a.startsWith('mo')) { c.st.mo[a.slice(2)] = ph === 'down'; return true; } },
    draw(c) {
      const [b0, b1] = V.body, names = String(c.props.ytag || '').split(',');
      let s = `<g filter="url(#fShadow)">${D.rect(b0, 26, b1 - b0, 46, 'url(#gAluV)', { rx: 3 })}</g>`;
      // coils
      V.coils.forEach((cid, i) => {
        const x = coilX(cid), on = c.st.coil[cid], left = x < c.props.__w / 2 || x < 100;
        const cx0 = left ? 6 : b1;
        s += D.rect(cx0, 20, 50, 56, 'url(#gBlack)', { rx: 4 }) + D.rect(x - 22, 72, 44, 38, '#3b3f45', { rx: 3 });
        s += D.led(x, 30, on, '#ff3b30', 3) + D.text(x, 46, names[i] || cid, { size: 9, fill: '#fff', weight: 700 }) + D.text(x, 57, CCS.coil.label(c.props.coil), { size: 6.5, fill: '#ccc' });
        s += `<g data-act="mo${cid}"><rect x="${left ? b0 + 4 : b1 - 16}" y="58" width="12" height="10" rx="2" fill="${c.st.mo[cid] ? '#ff8f00' : '#fdd835'}" stroke="#7a6000"/></g>`;
        s += D.screw(x - 10, 96, 'c' + cid + 'a', '1', 'above', { ls: 7 }) + D.screw(x + 10, 96, 'c' + cid + 'b', '2', 'above', { ls: 7 });
        if (c.st.burnt[cid]) s += D.smoke(x, 40);
      });
      if (V.spring) { const x0 = b1; s += D.rect(x0, 34, 14, 30, '#9aa3ad', { rx: 3 }); s += `<path d="M${x0 + 2} 49 l2 -8 l3 16 l3 -16 l3 16 l2 -8" fill="none" stroke="#333"/>`; }
      // ISO symbol window
      const sx = (b0 + b1) / 2 - 30, sy = 36, bw = 30, bh = 18, act = c.st.pos;
      const box = (x, active, paths) => `<rect x="${x}" y="${sy}" width="${bw}" height="${bh}" fill="${active ? '#fff7d6' : '#eef1f4'}" stroke="${active ? '#e65100' : '#777'}" stroke-width="${active ? 1.6 : 1}"/>` + paths;
      const arr = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#222" stroke-width="1"/><circle cx="${x2}" cy="${y2}" r="1.6" fill="#222"/>`;
      if (type === 'v32s') {
        s += box(sx, act === 1, arr(sx + 15, sy + bh, sx + 15, sy)) + box(sx + bw, act === 0, arr(sx + bw + 15, sy, sx + bw + 22, sy + bh) + `<line x1="${sx + bw + 5}" y1="${sy + bh}" x2="${sx + bw + 5}" y2="${sy + bh - 5}" stroke="#222"/><line x1="${sx + bw + 2}" y1="${sy + bh - 5}" x2="${sx + bw + 8}" y2="${sy + bh - 5}" stroke="#222"/>`);
      } else {
        s += box(sx, act === 1, arr(sx + 15, sy + bh, sx + 8, sy) + arr(sx + 22, sy, sx + 22, sy + bh)) + box(sx + bw, act === 0, arr(sx + bw + 15, sy + bh, sx + bw + 22, sy) + arr(sx + bw + 8, sy, sx + bw + 8, sy + bh));
      }
      s += D.text((b0 + b1) / 2, 68, c.props.tag, { size: 8, weight: 700 });
      V.ports.forEach(([id, x, side]) => (s += D.port(x, side === 'top' ? 16 : 80, 'p' + id, id, side === 'top' ? 'above' : 'below')));
      return s;
    },
  });
});

/* ------------------------------ cylinders ------------------------------ */
CCS.cylGeom = c => {
  const stroke = +c.props.stroke, bore = +c.props.bore, sp = Math.max(30, stroke * 0.8);
  const bh = 16 + bore * 0.45, top = 30, bot = top + bh;
  const capL = 8, capW = 22, tubeA = capL + capW, pistW = 12, tubeB = tubeA + sp + pistW + 8, frontW = 22;
  const frontB = tubeB + frontW;
  return { stroke, bore, sp, bh, top, bot, capL, capW, tubeA, tubeB, frontB, pistW, w: frontB + sp + 34, h: bot + 28,
    pistonX: pos => tubeA + 4 + pos * sp, rodEnd: pos => frontB + 10 + pos * sp };
};
const cylProps = def => [{ key: 'tag', label: 'Tag', type: 'text', def }, { key: 'bore', label: 'Bore (mm)', type: 'select', options: ['16', '20', '25', '32', '40', '50', '63'], def: '32' },
  { key: 'stroke', label: 'Stroke (mm)', type: 'select', options: ['25', '50', '75', '100', '125', '150', '200', '250'], def: '100' }, { key: 'speed', label: 'Max speed (mm/s)', type: 'number', def: 250, min: 20, max: 1000, step: 10 }];
const cylDraw = (c, single) => {
  const g = CCS.cylGeom(c), pos = c.st.pos, px = g.pistonX(pos), rx = g.rodEnd(pos), cy = (g.top + g.bot) / 2, rodH = Math.max(6, g.bh * 0.28);
  let s = `<rect x="${g.tubeB}" y="${cy - rodH / 2}" width="${rx - g.tubeB}" height="${rodH}" fill="url(#gChrome)" stroke="#555"/>` +
    D.rect(rx - 2, cy - rodH / 2 - 3, 14, rodH + 6, 'url(#gMetal)', { rx: 2 });
  s += `<g filter="url(#fShadow)"><rect x="${g.tubeA}" y="${g.top}" width="${g.tubeB - g.tubeA}" height="${g.bh}" fill="url(#gAluV)" stroke="#5f6a75"/></g>`;
  s += `<rect x="${px}" y="${g.top + 2}" width="${g.pistW}" height="${g.bh - 4}" fill="#455a64" opacity=".55"/><rect x="${px + 3}" y="${g.top + 2}" width="4" height="${g.bh - 4}" fill="#ff7043" opacity=".55"/>`;
  s += D.rect(g.capL, g.top - 3, g.capW, g.bh + 6, 'url(#gGrey)', { rx: 2 }) + D.rect(g.tubeB, g.top - 3, g.frontB - g.tubeB, g.bh + 6, 'url(#gGrey)', { rx: 2 });
  if (single) for (let i = 0; i < 6; i++) { const x0 = px + g.pistW, x1 = g.tubeB, k = (x1 - x0) / 6; s += `<path d="M${x0 + i * k} ${g.top + 4} l${k / 2} ${g.bh - 8} l${k / 2} ${-(g.bh - 8)}" fill="none" stroke="#666" stroke-width="1"/>`; }
  s += D.tag((g.tubeA + g.tubeB) / 2, 12, `${c.props.tag}  Ø${g.bore}×${g.stroke}`);
  s += D.text((g.tubeA + g.tubeB) / 2, cy + 3, `${Math.round(pos * g.stroke)} mm`, { size: 8, weight: 700, fill: '#263238' });
  s += D.port(g.capL + g.capW / 2, g.top - 2, 'cap', single ? '1' : 'cap', 'left');
  if (!single) s += D.port(g.tubeB + (g.frontB - g.tubeB) / 2, g.top - 2, 'rod', 'rod', 'right');
  else s += `<circle cx="${g.tubeB + 11}" cy="${g.top + 3}" r="2" fill="#222"/>`;
  return s;
};
const cylTerms = (c, single) => {
  const g = CCS.cylGeom(c);
  const t = [{ id: 'cap', x: g.capL + g.capW / 2, y: g.top - 2, k: 'p', d: single ? 'Working port (extends the rod)' : 'Cap-end port (air in → extends)', free: 'atm' }];
  if (!single) t.push({ id: 'rod', x: g.tubeB + (g.frontB - g.tubeB) / 2, y: g.top - 2, k: 'p', d: 'Rod-end port (air in → retracts)', free: 'atm' });
  return t;
};
const cylStep = (c, dt, PR, ctx, single) => {
  const g = CCS.cylGeom(c), cap = PR.st(c, 'cap'), pc = PR.p(c, 'cap');
  const vmax = +c.props.speed || 250;
  let dir = 0, f = 1, p = 0;
  if (single) {
    if ((cap === 'P' || cap === 'L') && pc > 1.0) { dir = 1; p = pc; f = PR.pathFactor(c, 'cap', false); }
    else if (cap === 'E' || cap === 'L') { dir = -1; p = 4; f = PR.pathFactor(c, 'cap', true); }
  } else {
    const rod = PR.st(c, 'rod'), pr = PR.p(c, 'rod');
    const capP = (cap === 'P' || cap === 'L') && pc > 0.3, rodP = (rod === 'P' || rod === 'L') && pr > 0.3;
    const capE = cap === 'E', rodE = rod === 'E';
    if (capP && (rodE || (rod === 'T' && pr < 0.3))) { dir = 1; p = pc; f = Math.min(PR.pathFactor(c, 'cap', false), rodE ? PR.pathFactor(c, 'rod', true) : 1); }
    else if (rodP && (capE || (cap === 'T' && pc < 0.3))) { dir = -1; p = pr; f = Math.min(PR.pathFactor(c, 'rod', false), capE ? PR.pathFactor(c, 'cap', true) : 1); }
    else if (capP && rodP) { if (pc * 1.0 > pr * 0.8 && c.st.pos < 1) ctx.fault(c, 'info', 'Both cylinder ports are pressurised — the rod hardly moves (no exhaust path).'); }
    if (cap === 'L' || rod === 'L') ctx.fault(c, 'warn', 'Leak in the line feeding this cylinder — speed and force reduced.');
  }
  const v = vmax * Math.sqrt(Math.max(0, p) / 6) * Math.max(0.03, f);
  c.st.v = dir * v; c.st.dir = dir;
  if (dir) c.st.pos = CCS.util.clamp(c.st.pos + dir * v * dt / g.stroke, 0, 1);
  const A = Math.PI * (g.bore / 2000) ** 2;
  c.st.F = (dir >= 0 ? pc : PR.p(c, 'rod')) * 1e5 * A * (dir < 0 ? 0.85 : 1);
};
CCS.defType({
  type: 'cylDA', name: 'Double-acting cylinder (magnetic)', cat: 'Actuators', w: c => CCS.cylGeom(c).w, h: c => CCS.cylGeom(c).h,
  info: 'Double-acting pneumatic cylinder with magnetic piston (e.g. Airtac SC / MAL / SDA series). Air on the cap port extends the rod; air on the rod port retracts it.\nThe magnet ring (orange) lets reed switches detect the piston. Drag reed switches onto the barrel to mount them.\nForce ≈ p × piston area (e.g. Ø32 at 6 bar ≈ 480 N extending).',
  props: cylProps('1A1'), terms: c => cylTerms(c, false),
  init(c) { c.st.pos = 0; c.st.v = 0; },
  pstep(c, dt, PR, ctx) { cylStep(c, dt, PR, ctx, false); },
  draw: c => cylDraw(c, false),
});
CCS.defType({
  type: 'cylSA', name: 'Single-acting cylinder (spring return)', cat: 'Actuators', w: c => CCS.cylGeom(c).w, h: c => CCS.cylGeom(c).h,
  info: 'Single-acting cylinder, spring return (e.g. Airtac MSAL). Air on port 1 extends the rod; when the port is exhausted the spring pushes it back. Drive it with a 3/2 valve.',
  props: cylProps('2A1'), terms: c => cylTerms(c, true),
  init(c) { c.st.pos = 0; c.st.v = 0; },
  pstep(c, dt, PR, ctx) { cylStep(c, dt, PR, ctx, true); },
  draw: c => cylDraw(c, true),
});

/* ------------------------------ fittings ------------------------------ */
CCS.defType({
  type: 'flowctl', name: 'One-way flow control (speed)', cat: 'Fittings', w: 96, h: 56,
  info: 'Inline one-way flow control valve (e.g. Airtac ASC). Air flows freely in the arrow direction (IN→OUT) and is throttled the other way.\nFor meter-out speed control (recommended) put it between valve and cylinder with the free-flow arrow pointing TO the cylinder.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: '1V3' }, { key: 'open', label: 'Opening (%)', type: 'range', def: 40, min: 3, max: 100, step: 1 }],
  terms: () => [{ id: 'in', x: 8, y: 34, k: 'p', d: 'IN (free-flow inlet)', free: 'leak' }, { id: 'out', x: 88, y: 34, k: 'p', d: 'OUT (free-flow outlet)', free: 'leak' }],
  pneu(c, P) { P.fc(c, 'in', 'out', +c.props.open / 100); },
  draw(c) {
    return D.rect(16, 26, 64, 16, '#eceff1', { rx: 5 }) + D.rect(38, 4, 20, 24, '#263238', { rx: 3 }) + `<rect x="${42 + (c.props.open / 100) * 6}" y="1" width="6" height="8" rx="1" fill="#f9a825"/>` +
      `<path d="M28 34 h36 m-6 -4 l6 4 l-6 4" stroke="#1e88e5" stroke-width="2" fill="none"/>` + D.text(48, 52, `${c.props.tag} ${c.props.open}%`, { size: 8, fill: '#fff', weight: 700 }) +
      D.port(8, 34, 'in', '') + D.port(88, 34, 'out', '');
  },
});
CCS.defType({
  type: 'silencer', name: 'Silencer (exhaust)', cat: 'Fittings', w: 52, h: 34,
  info: 'Sintered-bronze exhaust silencer (e.g. BSL-1/8). Connect it to the 3 and 5 ports of a valve. Without one the valve still exhausts, only louder.',
  props: [], terms: () => [{ id: 'p', x: 8, y: 17, k: 'p', d: 'Threaded port', free: 'closed' }],
  pneu(c, P) { P.vent(c, 'p'); },
  draw: () => `<rect x="14" y="9" width="32" height="16" rx="8" fill="url(#gBrass)" stroke="#6b5a1e"/><rect x="14" y="9" width="32" height="16" rx="8" fill="url(#pHoles)" opacity=".4"/>` + D.port(8, 17, 'p', ''),
});
CCS.defType({
  type: 'plug', name: 'Blanking plug', cat: 'Fittings', w: 34, h: 34,
  info: 'Blanking plug: closes an unused port (e.g. turns a 5/2 valve into a 3/2).',
  props: [], terms: () => [{ id: 'p', x: 10, y: 17, k: 'p', d: 'Closed port', free: 'closed' }],
  draw: () => D.rect(14, 10, 16, 14, '#b0bec5', { rx: 3 }) + D.port(10, 17, 'p', ''),
});
CCS.defType({
  type: 'gauge', name: 'Pressure gauge', cat: 'Fittings', w: 72, h: 88,
  info: 'Bourdon-tube pressure gauge 0–10 bar. Connect it with a T-fitting into any line to see its pressure.',
  props: [], terms: () => [{ id: 'p', x: 36, y: 80, k: 'p', d: 'Gauge port', free: 'closed' }],
  init(c) { c.st.p = 0; },
  pstep(c, dt, PR) { c.st.p = PR.p(c, 'p'); },
  draw(c) {
    const ang = (-220 + 260 * Math.min(10, c.st.p) / 10) * Math.PI / 180;
    let s = `<g filter="url(#fShadow)"><circle cx="36" cy="34" r="31" fill="#222"/></g><circle cx="36" cy="34" r="27" fill="#fff"/>`;
    for (let i = 0; i <= 10; i++) { const a = (-220 + 26 * i) * Math.PI / 180; s += D.line(36 + 22 * Math.cos(a), 34 + 22 * Math.sin(a), 36 + 26 * Math.cos(a), 34 + 26 * Math.sin(a), '#333', 1.2); }
    s += `<line x1="36" y1="34" x2="${36 + 21 * Math.cos(ang)}" y2="${34 + 21 * Math.sin(ang)}" stroke="#d32f2f" stroke-width="2"/><circle cx="36" cy="34" r="3" fill="#333"/>`;
    return s + D.text(36, 52, c.st.p.toFixed(1) + ' bar', { size: 8, weight: 700 }) + D.rect(31, 64, 10, 10, 'url(#gBrass)') + D.port(36, 80, 'p', '');
  },
});
