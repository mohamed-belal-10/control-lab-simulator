/* =========================================================================
 * Module 22: relays, timers, contactors, loads
 * ========================================================================= */
const RELAY_COIL_R = { '220VAC': 22000, '24VAC': 640, '24VDC': 650, '12VDC': 160 };
const relayPoles = [1, 2, 3, 4];

/** shared electromagnetic armature logic: pick-up ≥80 %, drop-out <30 %, ~15 ms operate time */
CCS.armature = (c, eff, dt, forced) => {
  const st = c.st;
  const want = forced || (!st.burnt && (eff >= 0.8 || (st.on && eff >= 0.3)));
  if (want !== st.on) { st.tOp = (st.tOp || 0) + dt; if (st.tOp >= (want ? 0.015 : 0.008) || forced) { st.on = want; st.tOp = 0; } }
  else st.tOp = 0;
};

CCS.defType({
  type: 'relay4', name: 'Relay MY4 14-pin + base socket', cat: 'Relays & contactors', w: 150, h: 212,
  info: 'Control relay MY4 with 14-pin base socket, as sold by Derhali (GENROON MY4, coil 12 V DC / 24 V AC / 24 V DC / 220 V AC). Same pin-out as Omron MY4 on a PYF14A-type socket.\n4 change-over contacts (4PDT), ~5 A each.\nSocket terminals are numbered like the relay pins (top view: 4 3 2 1 / 8 7 6 5 / 12 11 10 9 / 14 14 13).\nPole 1: COM 9, NC 1, NO 5 · pole 2: COM 10, NC 2, NO 6 · pole 3: COM 11, NC 3, NO 7 · pole 4: COM 12, NC 4, NO 8.\nCoil: 13 and 14 (both screws marked 14 are the same terminal).\nPull-in ≥ 80 % of the rated coil voltage, drop-out < 30 %.\nCoil current ≈ 10 mA at 220 V AC, ≈ 37 mA at 24 V DC.\nPlain MY4 has no LED; choose MY4N for the version with an LED indicator.\nWATCH OUT: a 220 V AC coil cannot be switched by 24 V DC sensors or reed switches — for a 24 V DC control circuit order the 24 DC coil.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'K1' }, { key: 'coil', label: 'Coil', type: 'select', options: ['220VAC', '24VAC', '24VDC', '12VDC'], def: '220VAC' },
    { key: 'model', label: 'Model', type: 'select', options: ['MY4 (no LED)', 'MY4N (LED)'], def: 'MY4 (no LED)' }],
  // PYF14A socket, top view — same numbering as the relay pins:
  //   4  3  2  1   NC      8  7  6  5   NO      12 11 10  9   COM      14 14 13   coil
  terms: () => {
    const t = [], X = p => 30 + (4 - p) * 30;
    relayPoles.forEach(p => {
      t.push({ id: String(p), x: X(p), y: 16, k: 'e', d: `Pin ${p} — NC contact, pole ${p} (IEC ${p}2)` });
      t.push({ id: String(4 + p), x: X(p), y: 44, k: 'e', d: `Pin ${4 + p} — NO contact, pole ${p} (IEC ${p}4)` });
      t.push({ id: String(8 + p), x: X(p), y: 152, k: 'e', d: `Pin ${8 + p} — COM, pole ${p} (IEC ${p}1)` });
    });
    t.push({ id: '14', x: 30, y: 180, k: 'e', d: 'Pin 14 — coil (A2)' }, { id: '14b', x: 75, y: 180, k: 'e', d: 'Pin 14 — coil (A2), second screw, internally joined' }, { id: '13', x: 120, y: 180, k: 'e', d: 'Pin 13 — coil (A1)' });
    return t;
  },
  init(c) { c.st.on = false; c.st.burnt = false; c.st.weld = {}; c.st.test = false; },
  elec(c, N) {
    N.join(c, '14', '14b');
    if (!c.st.burnt) N.res(c, '13', '14', RELAY_COIL_R[c.props.coil], 'coil');
    relayPoles.forEach(p => {
      const w = c.st.weld[p];
      N.sw(c, String(8 + p), String(4 + p), c.st.on || w, 'no' + p);
      N.sw(c, String(8 + p), String(p), !c.st.on && !w, 'nc' + p);
    });
  },
  step(c, dt, R, ctx) {
    const vd = R.vd(c, '13', '14'), ev = CCS.coil.eval(c.props.coil, vd);
    c.st.vc = Math.max(Math.abs(vd.dc), vd.ac); c.st.eff = ev.eff;
    CCS.coil.burnCheck(c, c.st, ev, dt, ctx, 'Relay coil');
    if (c.st.burnt) ctx.fault(c, 'error', 'Relay coil burnt — open circuit. Press "Repair" after fixing.');
    if (ev.eff > 0.05 && ev.eff < 0.8 && !c.st.on && !ev.bad) ctx.fault(c, 'warn', `Coil voltage ${c.st.vc.toFixed(1)} V is below pull-in (80 % of ${CCS.coil.label(c.props.coil)}).`);
    CCS.armature(c, c.st.burnt ? 0 : ev.eff, dt, c.st.test);
    relayPoles.forEach(p => {
      const I = Math.max(R.i(c, 'no' + p).rms, R.i(c, 'nc' + p).rms);
      CCS.contactCheck(c, ctx, I, 5, `Pole ${p}`);
      if (I > 20) { c.st.weld[p] = true; }
      if (c.st.weld[p]) ctx.fault(c, 'error', `Pole ${p} contacts WELDED by over-current. Press "Repair".`);
    });
  },
  act(c, a, ph) { if (a === 'test') { c.st.test = ph === 'down'; return true; } },
  draw(c) {
    const on = c.st.on, led = String(c.props.model).startsWith('MY4N');
    const cv = CCS.coil.parse(c.props.coil);
    // base socket (black, 14 screw terminals)
    let s = `<g filter="url(#fShadow)">${D.rect(4, 0, 142, 212, 'url(#gBlack)', { rx: 5 })}</g>` + D.rect(0, 88, 6, 20, '#555', { rx: 1 }) + D.rect(144, 88, 6, 20, '#555', { rx: 1 });
    CCS.termsOf(c).forEach(t => (s += D.screw(t.x, t.y, t.id, t.id === '14b' ? '14' : t.id, 'right', { ls: 7.5 })));
    s += D.text(14, 30, 'NC', { size: 6, fill: '#aaa' }) + D.text(14, 58, 'NO', { size: 6, fill: '#aaa' }) + D.text(14, 166, 'COM', { size: 6, fill: '#aaa' });
    // clear relay case seen from the top
    s += D.rect(14, 60, 122, 80, '#3a4652', { rx: 4 });
    s += `<rect x="20" y="96" width="44" height="38" rx="4" fill="url(#gCopper)" stroke="#6b3a10"/>`;
    for (let i = 0; i < 6; i++) s += D.line(20, 100 + i * 6, 64, 100 + i * 6, '#7a4012', 0.8);
    relayPoles.forEach((p, i) => {
      const x = 74 + (3 - i) * 15;
      s += `<line x1="${x}" y1="134" x2="${x}" y2="${on ? 112 : 120}" stroke="#ffd27a" stroke-width="1.6" transform="rotate(${on ? -8 : 8} ${x} 134)"/>` + `<circle cx="${x}" cy="108" r="1.8" fill="#e0b050"/><circle cx="${x}" cy="126" r="1.8" fill="#e0b050"/>`;
      if (c.st.weld[p]) s += `<circle cx="${x}" cy="118" r="4" fill="#ff4d5e"/>`;
    });
    s += `<rect x="14" y="60" width="122" height="80" rx="4" fill="url(#gClear)" stroke="#9cb3c8"/>`;
    // white top label with the printed contact diagram
    s += D.rect(20, 64, 110, 28, '#f4f4f0', { rx: 2 });
    s += D.text(44, 76, 'MY4' + (led ? 'N' : ''), { size: 9, weight: 700 }) + D.text(44, 87, `${cv.kind}${cv.V}V`, { size: 8, weight: 700, fill: '#c62828' });
    s += `<rect x="64" y="70" width="10" height="16" fill="none" stroke="#333" stroke-width=".8"/><line x1="64" y1="86" x2="74" y2="70" stroke="#333" stroke-width=".6"/>`;
    for (let i = 0; i < 4; i++) { const x = 82 + i * 12; s += `<path d="M${x} 86 v-4 l4 -7 M${x - 3} 71 h3 M${x + 5} 71 h3" stroke="#333" stroke-width=".8" fill="none"/>`; }
    if (led) s += D.led(126, 100, on, '#ff3b30', 2.6);
    s += `<rect x="${on ? 118 : 110}" y="133" width="10" height="4" fill="#ff9800"/>`;
    s += D.tag(75, 202, c.props.tag);
    if (c.st.burnt) s += D.smoke(42, 112);
    return s;
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'timer', name: 'Timer relay (on/off delay)', cat: 'Relays & contactors', w: 130, h: 190,
  info: 'Plug-in timer relay, 2 change-over timed contacts on an 8-pin socket (e.g. Omron H3Y-2 / H3CR family, socket PYF08A).\nCoil A1/A2. Timed contacts: COM 15/25 · NC 16/26 · NO 18/28 (IEC marking for time-delayed contacts).\nON-delay: contacts change T seconds after the coil is energised, reset instantly when it drops.\nOFF-delay: contacts change instantly and return T seconds after the coil drops.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'KT1' }, { key: 'mode', label: 'Function', type: 'select', options: ['ON-delay', 'OFF-delay'], def: 'ON-delay' },
    { key: 'T', label: 'Time (s)', type: 'number', def: 2, min: 0.1, max: 600, step: 0.1 }, { key: 'coil', label: 'Coil', type: 'select', options: ['24VDC', '220VAC'], def: '24VDC' }],
  terms: () => [
    { id: '18', x: 40, y: 16, k: 'e', d: 'Timed NO, set 1' }, { id: '28', x: 90, y: 16, k: 'e', d: 'Timed NO, set 2' },
    { id: '16', x: 40, y: 44, k: 'e', d: 'Timed NC, set 1' }, { id: '26', x: 90, y: 44, k: 'e', d: 'Timed NC, set 2' },
    { id: '15', x: 40, y: 146, k: 'e', d: 'COM set 1' }, { id: '25', x: 90, y: 146, k: 'e', d: 'COM set 2' },
    { id: 'A1', x: 40, y: 174, k: 'e', d: 'Coil +' }, { id: 'A2', x: 90, y: 174, k: 'e', d: 'Coil −' }],
  init(c) { c.st.on = false; c.st.out = false; c.st.t = 0; },
  elec(c, N) {
    if (!c.st.burnt) N.res(c, 'A1', 'A2', c.props.coil === '24VDC' ? 400 : 32000, 'coil');
    [1, 2].forEach(k => { N.sw(c, k + '5', k + '8', c.st.out, 'no' + k); N.sw(c, k + '5', k + '6', !c.st.out, 'nc' + k); });
  },
  step(c, dt, R, ctx) {
    const vd = R.vd(c, 'A1', 'A2'), ev = CCS.coil.eval(c.props.coil, vd);
    CCS.coil.burnCheck(c, c.st, ev, dt, ctx, 'Timer supply');
    if (c.st.burnt) ctx.fault(c, 'error', 'Timer destroyed by over-voltage. Press "Repair".');
    const pw = !c.st.burnt && ev.eff >= 0.8, T = Math.max(0.05, +c.props.T);
    c.st.on = pw;
    if (c.props.mode === 'ON-delay') {
      if (pw) { c.st.t = Math.min(T, c.st.t + dt); if (c.st.t >= T) c.st.out = true; } else { c.st.t = 0; c.st.out = false; }
    } else {
      if (pw) { c.st.out = true; c.st.t = 0; } else if (c.st.out) { c.st.t += dt; if (c.st.t >= T) { c.st.out = false; c.st.t = 0; } }
    }
    [1, 2].forEach(k => CCS.contactCheck(c, ctx, Math.max(R.i(c, 'no' + k).rms, R.i(c, 'nc' + k).rms), 5, `Contact set ${k}`));
  },
  draw(c) {
    const T = Math.max(0.05, +c.props.T), frac = c.props.mode === 'ON-delay' ? c.st.t / T : (c.st.out && !c.st.on ? 1 - c.st.t / T : (c.st.out ? 1 : 0));
    let s = `<g filter="url(#fShadow)">${D.rect(10, 0, 110, 190, 'url(#gBlack)', { rx: 5 })}</g>`;
    CCS.termsOf(c).forEach(t => (s += D.screw(t.x, t.y, t.id, t.id, 'right', { ls: 7.5 })));
    s += D.rect(18, 60, 94, 74, '#d9dde2', { rx: 5 });
    const a0 = -220, a1 = a0 + 260 * Math.min(1, frac), r = 20, cx = 50, cy = 98;
    const pt = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    s += `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="#fff" stroke="#888"/>` + (frac > 0.001 ? `<path d="M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z" fill="#ff9800" opacity=".7"/>` : '') +
      `<circle cx="${cx}" cy="${cy}" r="7" fill="#333"/>` + D.text(cx, cy + 34, `T = ${(+c.props.T).toFixed(1)} s`, { size: 7.5, weight: 700 });
    s += D.led(92, 76, c.st.on, '#3ddc84', 2.6) + D.text(92, 88, 'PWR', { size: 5.5 }) + D.led(92, 100, c.st.out, '#ff9800', 2.6) + D.text(92, 112, 'OUT', { size: 5.5 });
    s += D.text(92, 124, c.props.mode === 'ON-delay' ? 'ON-dly' : 'OFF-dly', { size: 6.5, weight: 700 });
    return s + D.tag(65, 56, c.props.tag) + (c.st.burnt ? D.smoke(60, 100) : '');
  },
});

/* ------------------------------------------------------------------ */
const CT_X = [18, 46, 74, 102, 130, 158];
CCS.defType({
  type: 'contactor', name: 'Contactor 3P + 1NO 1NC', cat: 'Relays & contactors', w: 176, h: 152,
  info: 'Power contactor, 9 A AC-3 (e.g. Schneider LC1D09 / Chint NXC-09 style).\nCoil A1/A2 (typical 220–230 V AC; 24 V DC variants exist). Main poles 1/L1-2/T1, 3/L2-4/T2, 5/L3-6/T3. Auxiliary NO 13-14 and NC 21-22.\nThe grey test plunger operates the contacts by hand.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'KM1' }, { key: 'coil', label: 'Coil', type: 'select', options: ['220VAC', '24VDC'], def: '220VAC' }],
  terms: () => [
    ['A1', 'Coil A1'], ['1', '1/L1 main pole in'], ['3', '3/L2 main pole in'], ['5', '5/L3 main pole in'], ['13', 'Aux NO 13'], ['21', 'Aux NC 21']].map(([id, d], i) => ({ id, x: CT_X[i], y: 16, k: 'e', d }))
    .concat([['A2', 'Coil A2'], ['2', '2/T1 main pole out'], ['4', '4/T2 main pole out'], ['6', '6/T3 main pole out'], ['14', 'Aux NO 14'], ['22', 'Aux NC 22']].map(([id, d], i) => ({ id, x: CT_X[i], y: 136, k: 'e', d }))),
  init(c) { c.st.on = false; c.st.test = false; },
  elec(c, N) {
    if (!c.st.burnt) N.res(c, 'A1', 'A2', c.props.coil === '220VAC' ? 7000 : 107, 'coil');
    [['1', '2'], ['3', '4'], ['5', '6'], ['13', '14']].forEach(([a, b]) => N.sw(c, a, b, c.st.on, 'k' + a));
    N.sw(c, '21', '22', !c.st.on, 'k21');
  },
  step(c, dt, R, ctx) {
    const vd = R.vd(c, 'A1', 'A2'), ev = CCS.coil.eval(c.props.coil, vd);
    c.st.vc = Math.max(Math.abs(vd.dc), vd.ac);
    CCS.coil.burnCheck(c, c.st, ev, dt, ctx, 'Contactor coil');
    if (c.st.burnt) ctx.fault(c, 'error', 'Contactor coil burnt. Press "Repair".');
    if (ev.eff > 0.05 && ev.eff < 0.8 && !c.st.on && !ev.bad) ctx.fault(c, 'warn', `Coil voltage ${c.st.vc.toFixed(1)} V too low for a ${CCS.coil.label(c.props.coil)} coil.`);
    CCS.armature(c, c.st.burnt ? 0 : ev.eff, dt, c.st.test);
    ['1', '3', '5'].forEach(a => CCS.contactCheck(c, ctx, R.i(c, 'k' + a).rms, 25, `Main pole ${a}`));
    ['13', '21'].forEach(a => CCS.contactCheck(c, ctx, R.i(c, 'k' + a).rms, 10, `Aux contact ${a}`));
  },
  act(c, a, ph) { if (a === 'test') { c.st.test = ph === 'down'; return true; } },
  draw(c) {
    const on = c.st.on;
    let s = `<g filter="url(#fShadow)">${D.rect(4, 0, 168, 152, 'url(#gWhite)', { rx: 6 })}</g>` + D.rect(4, 30, 168, 92, '#e4e6e8', { rx: 2 });
    const lbl = ['A1', '1/L1', '3/L2', '5/L3', '13NO', '21NC'], lbl2 = ['A2', '2/T1', '4/T2', '6/T3', '14NO', '22NC'];
    CCS.termsOf(c).forEach((t, i) => (s += D.screw(t.x, t.y, t.id, '', 'below')));
    lbl.forEach((l, i) => (s += D.text(CT_X[i], 38, l, { size: 6.5, weight: 700 })));
    lbl2.forEach((l, i) => (s += D.text(CT_X[i], 122, l, { size: 6.5, weight: 700 })));
    s += `<g data-act="test"><rect x="62" y="56" width="52" height="34" rx="4" fill="#9aa0a6" stroke="#555"/><rect x="72" y="${on ? 70 : 62}" width="32" height="14" rx="3" fill="${on ? '#43a047' : '#5f6368'}"/></g>`;
    s += D.text(88, 102, `${c.props.tag} · coil ${CCS.coil.label(c.props.coil)}`, { size: 7.5, weight: 700 }) + D.text(88, 112, '9 A AC-3', { size: 6.5 });
    return s + (c.st.burnt ? D.smoke(88, 70) : '');
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'motor', name: 'AC motor / fan 230 V', cat: 'Loads', w: 120, h: 132,
  info: 'Single-phase 230 V AC fan motor, ~60 W (≈0.26 A). Terminals L, N and PE in the terminal box. Typically switched by a contactor\'s main poles, not by a 24 V relay contact directly.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'M1' }],
  terms: () => [{ id: 'L', x: 30, y: 116, k: 'e', d: 'Line' }, { id: 'N', x: 60, y: 116, k: 'e', d: 'Neutral' }, { id: 'PE', x: 90, y: 116, k: 'e', d: 'Earth' }],
  init(c) { c.st.ang = 0; c.st.spd = 0; },
  elec(c, N) { N.res(c, 'L', 'N', 880, 'w'); },
  step(c, dt, R, ctx) {
    const v = R.vd(c, 'L', 'N');
    const target = v.ac > 150 ? 1 : v.ac > 60 ? 0.3 : 0;
    c.st.spd += (target - c.st.spd) * Math.min(1, dt * 2);
    c.st.ang = (c.st.ang + c.st.spd * dt * 900) % 360;
    if (Math.abs(v.dc) > 30) ctx.fault(c, 'warn', 'AC motor fed with DC voltage — it will not run (and may overheat).');
    if (c.st.spd > 0.1 && !c.wired?.PE) ctx.fault(c, 'warn', 'Motor frame is not earthed (PE not connected).');
  },
  draw(c) {
    let s = `<g filter="url(#fShadow)"><circle cx="60" cy="50" r="46" fill="url(#gGrey)" stroke="#333"/></g><circle cx="60" cy="50" r="38" fill="#2b2f33"/>`;
    s += `<g transform="rotate(${c.st.ang.toFixed(1)} 60 50)">`;
    for (let i = 0; i < 5; i++) s += `<path d="M60 50 q 6 -30 -4 -34 q -12 8 4 34" fill="#b0bec5" stroke="#555" transform="rotate(${i * 72} 60 50)"/>`;
    s += `<circle cx="60" cy="50" r="7" fill="#90a4ae"/></g>`;
    for (let i = -32; i <= 32; i += 8) s += D.line(60 + i, 50 - Math.sqrt(38 * 38 - i * i), 60 + i, 50 + Math.sqrt(38 * 38 - i * i), '#0006', 1);
    return s + D.rect(14, 98, 92, 32, '#455a64', { rx: 3 }) + D.screw(30, 116, 'L', 'L', 'above', { box: '#795548' }) + D.screw(60, 116, 'N', 'N', 'above', { box: '#1e88e5' }) + D.screw(90, 116, 'PE', 'PE', 'above', { box: '#43a047' }) + D.tag(100, 8, c.props.tag);
  },
});
