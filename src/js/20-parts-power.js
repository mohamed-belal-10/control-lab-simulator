/* =========================================================================
 * Module 20: power & protection parts + shared coil logic
 * ========================================================================= */

/* ---- shared helpers for any electromagnetic coil (relays, contactors, valve coils) ---- */
CCS.coil = {
  parse(s) { const m = /([\d.]+)\s*V\s*(AC|DC)/i.exec(s || '24VDC'); return { V: +m[1], kind: m[2].toUpperCase() }; },
  /** evaluate the voltage across a coil. returns {eff (0..), bad: null|'burn'|'acOnDc'|'dcOnAc'} */
  eval(rating, vd) {
    const s = CCS.coil.parse(rating);
    let eff, bad = null;
    if (s.kind === 'DC') {
      eff = Math.abs(vd.dc) / s.V;
      if (vd.ac > 0.3 * s.V) { bad = vd.ac > 1.3 * s.V ? 'burn' : 'acOnDc'; eff = 0; }
      if (eff > 1.45) bad = 'burn';
    } else {
      eff = vd.ac / s.V;
      if (Math.abs(vd.dc) > 0.5 * s.V) bad = 'burn';
      else if (Math.abs(vd.dc) > 5 && vd.ac < 0.5 * s.V) { bad = 'dcOnAc'; }
      if (eff > 1.3) bad = 'burn';
    }
    return { eff, bad };
  },
  /** run burn timer; returns true when the coil just burnt */
  burnCheck(c, st, ev, dt, ctx, what) {
    if (ev.bad === 'burn') {
      st.burnT = (st.burnT || 0) + dt;
      ctx.fault(c, 'error', `${what}: over-voltage / wrong supply — coil is overheating!`);
      if (st.burnT > 0.4) { st.burnt = true; return true; }
    } else st.burnT = 0;
    if (ev.bad === 'acOnDc') ctx.fault(c, 'warn', `${what}: AC voltage on a DC coil — it chatters and will not pull in properly.`);
    if (ev.bad === 'dcOnAc') ctx.fault(c, 'warn', `${what}: DC voltage on an AC coil — it will not pull in. Check the coil rating (e.g. MY4 220 V AC vs 24 V DC).`);
    return false;
  },
  label(s) { const p = CCS.coil.parse(s); return p.V + ' V ' + (p.kind === 'DC' ? '⎓' : '∿'); },
};
CCS.contactCheck = (c, ctx, I, rating, name) => {
  if (I > rating * 1.05) ctx.fault(c, 'warn', `${name}: ${I.toFixed(2)} A exceeds the contact rating (${rating} A).`);
};

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'mains', name: 'Mains supply 230 V AC', cat: 'Power & protection', w: 150, h: 92,
  info: 'Wall supply of a TN-S installation: L (brown), N (blue), PE (green-yellow). N is bonded to earth at the source, so touching L to PE or N trips the protection.\nThe building has its own 80 A main breaker: a short circuit with no MCB in your panel trips it (reset by clicking the switch).',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'Mains' }],
  terms: () => [
    { id: 'L', x: 35, y: 74, k: 'e', d: 'Line 230 V AC (brown)' },
    { id: 'N', x: 75, y: 74, k: 'e', d: 'Neutral (blue)' },
    { id: 'PE', x: 115, y: 74, k: 'e', d: 'Protective earth (green-yellow)' }],
  init(c) { c.st.on = true; c.st.trip = false; },
  elec(c, N) {
    if (c.st.on && !c.st.trip) N.src(c, 'L', 'N', 230, 'AC', 0.05, 'src');
    N.gnd(c, 'N', 'gN'); N.gnd(c, 'PE', 'gPE');
  },
  sense(c, R) {
    // downstream breakers get the first chance: the building breaker needs the fault to persist
    if (c.st.on && !c.st.trip && R.i(c, 'src').rms > 80) { c.st.hi = (c.st.hi || 0) + 1; if (c.st.hi >= 3) { c.st.trip = true; return true; } }
    else c.st.hi = 0;
    return false;
  },
  step(c, dt, R, ctx) {
    if (c.st.trip) ctx.fault(c, 'error', 'SHORT CIRCUIT — the building main breaker tripped (no MCB protected this circuit). Fix the wiring, then click the switch to reset.');
    c.st.I = R.i(c, 'src').rms;
  },
  act(c, a, ph) { if (a === 'pwr' && ph === 'down') { if (c.st.trip) { c.st.trip = false; c.st.on = true; } else c.st.on = !c.st.on; return true; } },
  draw(c) {
    const on = c.st.on && !c.st.trip;
    return D.rect(0, 0, 150, 92, 'url(#gWhite)', { rx: 6 }) +
      D.text(75, 14, c.props.tag + ' · 230 V ∿ 50 Hz', { size: 10, weight: 700 }) +
      `<g data-act="pwr">${D.rect(10, 22, 30, 26, on ? '#d32f2f' : '#7a1f1f', { rx: 4 })}${D.text(25, 39, on ? 'I' : 'O', { size: 12, fill: '#fff', weight: 700 })}</g>` +
      D.led(52, 35, on, '#ff3b30') +
      `<rect x="70" y="22" width="68" height="28" rx="14" fill="#e9e9e4" stroke="#0005"/><circle cx="92" cy="36" r="3.5" fill="#222"/><circle cx="116" cy="36" r="3.5" fill="#222"/>` +
      D.rect(18, 58, 114, 32, '#2b2b2b', { rx: 3 }) +
      D.screw(35, 74, 'L', 'L', 'left', { box: '#795548' }) + D.screw(75, 74, 'N', 'N', 'left', { box: '#1e88e5' }) + D.screw(115, 74, 'PE', 'PE', 'left', { box: '#43a047' }) +
      (c.st.trip ? D.text(75, 55, 'MAIN BREAKER TRIPPED', { size: 8, fill: '#d32f2f', weight: 700 }) : '');
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'mcb', name: 'MCB 2-pole (C curve)', cat: 'Power & protection', w: 76, h: 136,
  info: 'Miniature circuit breaker, 2-pole, C characteristic (e.g. C6/C10). Line in on 1, out on 2; neutral in 3, out 4.\nMagnetic trip: instantly above ~7× In (short circuit). Thermal trip: a few seconds to a minute at 1.5–3× In.\nClick the lever to switch ON/OFF or to reset after a trip.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'Q1' }, { key: 'In', label: 'Rating', type: 'select', options: ['2', '4', '6', '10', '16', '20'], def: '6' }],
  terms: () => [
    { id: '1', x: 22, y: 16, k: 'e', d: 'Pole 1 in (L)' }, { id: '3', x: 54, y: 16, k: 'e', d: 'Pole 2 in (N)' },
    { id: '2', x: 22, y: 120, k: 'e', d: 'Pole 1 out (L)' }, { id: '4', x: 54, y: 120, k: 'e', d: 'Pole 2 out (N)' }],
  init(c) { c.st.on = true; c.st.trip = false; c.st.heat = 0; },
  elec(c, N) { N.sw(c, '1', '2', c.st.on, 'p1'); N.sw(c, '3', '4', c.st.on, 'p2'); },
  sense(c, R) {
    const I = Math.max(R.i(c, 'p1').rms, R.i(c, 'p2').rms), In = +c.props.In;
    if (c.st.on && I > 7 * In) { c.st.on = false; c.st.trip = true; c.st.why = `magnetic trip (${I.toFixed(0)} A ≫ ${In} A) — SHORT CIRCUIT`; return true; }
    return false;
  },
  step(c, dt, R, ctx) {
    const I = Math.max(R.i(c, 'p1').rms, R.i(c, 'p2').rms), In = +c.props.In;
    c.st.I = I;
    if (c.st.on && I > 1.13 * In) {
      c.st.heat += dt * ((I / In) ** 2 - 1);
      ctx.fault(c, 'warn', `Overload: ${I.toFixed(2)} A on a ${In} A breaker — thermal trip coming.`);
      if (c.st.heat > 40) { c.st.on = false; c.st.trip = true; c.st.why = 'thermal trip (overload)'; }
    } else c.st.heat = Math.max(0, c.st.heat - dt * 2);
    if (c.st.trip) ctx.fault(c, 'error', `${c.props.tag} tripped: ${c.st.why}. Remove the fault and click the lever to reset.`);
  },
  act(c, a, ph) { if (a === 'lever' && ph === 'down') { if (c.st.trip) { c.st.trip = false; c.st.heat = 0; c.st.on = true; } else c.st.on = !c.st.on; return true; } },
  draw(c) {
    const on = c.st.on;
    return D.rect(4, 0, 68, 136, 'url(#gWhite)', { rx: 4 }) + D.line(38, 4, 38, 132, '#0002') +
      D.screw(22, 16, '1', '1', 'right') + D.screw(54, 16, '3', '3', 'right') +
      D.text(38, 37, 'C' + c.props.In, { size: 12, weight: 700 }) + D.text(38, 45, '230/400V~', { size: 5.5 }) +
      `<g data-act="lever">${D.rect(16, 49, 44, 34, '#dadad4', { rx: 3 })}` +
      `<rect x="22" y="${on ? 52 : 66}" width="32" height="14" rx="3" fill="#2a2a2a"/>` +
      `<rect x="24" y="${on ? 54 : 68}" width="28" height="4" rx="2" fill="${on ? '#d32f2f' : '#43a047'}"/></g>` +
      D.text(38, 93, on ? 'ON  I' : (c.st.trip ? 'TRIPPED' : 'OFF  O'), { size: 7.5, weight: 700, fill: on ? '#c62828' : (c.st.trip ? '#c62828' : '#2e7d32') }) +
      D.tag(38, 104, c.props.tag) +
      D.screw(22, 120, '2', '2', 'right') + D.screw(54, 120, '4', '4', 'right');
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'psu', name: 'Power supply 24 V DC 50 W', cat: 'Power & protection', w: 236, h: 126,
  info: 'Enclosed switching power supply (e.g. Mean Well LRS-50-24): input 85–264 V AC on L/N, FG to earth (PE).\nOutput 24 V DC, 2.2 A; the two +V and the two −V screws are internally connected.\nOver-load protection: above ~150 % the output shuts down and retries (hiccup). AC on the output destroys it.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'G1' }, { key: 'vadj', label: 'Output (V.ADJ)', type: 'number', def: 24, min: 21.6, max: 28.8, step: 0.1 }],
  terms: () => {
    const ids = [['L', 'AC line in'], ['N', 'AC neutral in'], ['FG', 'Frame ground → PE'], ['-V1', 'DC output −V (0 V)'], ['-V2', 'DC output −V (0 V)'], ['+V1', 'DC output +V (24 V)'], ['+V2', 'DC output +V (24 V)']];
    return ids.map(([id, d], i) => ({ id, x: 36 + i * 27, y: 106, k: 'e', d }));
  },
  init(c) { c.st.on = false; c.st.olp = 0; c.st.pout = 0; c.st.burnt = false; },
  elec(c, N) {
    if (!c.st.burnt) N.res(c, 'L', 'N', 230 * 230 / Math.max(3, Math.round(c.st.pout / 0.88 + 1.5)), 'in');
    N.join(c, '+V1', '+V2'); N.join(c, '-V1', '-V2');
    if (c.st.on) N.src(c, '+V1', '-V1', +c.props.vadj, 'DC', 0.03, 'out');
  },
  sense(c, R) {
    const vin = R.vd(c, 'L', 'N');
    const ok = !c.st.burnt && ((vin.ac >= 85 && vin.ac <= 264) || (Math.abs(vin.dc) >= 120 && Math.abs(vin.dc) <= 370)) && c.st.olp <= 0;
    let ch = ok !== c.st.on; c.st.on = ok;
    if (c.st.on && R.i(c, 'out').dc > 2.2 * 1.5) { c.st.on = false; c.st.olp = 0.8; ch = true; c.st.olpMsg = true; }
    return ch;
  },
  step(c, dt, R, ctx) {
    if (c.st.olp > 0) { c.st.olp -= dt; ctx.fault(c, 'error', 'OVERLOAD / SHORT on the 24 V output — protection active (hiccup mode). Check for a short between +V and −V.'); }
    const vo = R.vd(c, '+V1', '-V1'), io = R.i(c, 'out').dc;
    c.st.vout = vo.dc; c.st.iout = c.st.on ? io : 0; c.st.pout = c.st.on ? Math.max(0, vo.dc * io) : 0;
    if (vo.ac > 30) { ctx.fault(c, 'error', 'AC mains connected to the DC output terminals — power supply destroyed!'); c.st.burnt = true; c.st.on = false; }
    if (c.st.burnt) ctx.fault(c, 'error', 'Power supply is damaged. Fix the wiring and press "Repair".');
    if (c.st.on && io > 2.2 * 1.05) ctx.fault(c, 'warn', `Output current ${io.toFixed(2)} A above the 2.2 A rating.`);
    if (c.st.on && !c.wired?.FG) ctx.fault(c, 'info', 'FG (frame ground) is not connected to PE.');
    const vin = R.vd(c, 'L', 'N');
    if (vin.ac > 30 && !c.st.on && !c.st.burnt && c.st.olp <= 0 && vin.ac < 85) ctx.fault(c, 'warn', 'Input voltage too low for the PSU (needs 85–264 V AC).');
  },
  draw(c) {
    const on = c.st.on, blink = c.st.olp > 0 && (Date.now() / 250 | 0) % 2;
    let s = `<g filter="url(#fShadow)">${D.rect(0, 0, 236, 126, 'url(#gPerf)', { rx: 3 })}</g>` +
      `<rect x="6" y="6" width="150" height="80" fill="url(#pHoles)" opacity=".55"/>` +
      D.rect(160, 8, 70, 46, '#f5f5f5', { rx: 2 }) +
      D.text(195, 22, 'SMPS 50 W', { size: 8, weight: 700 }) + D.text(195, 33, 'IN 100-240V~', { size: 6.5 }) +
      D.text(195, 42, `OUT ${(+c.props.vadj).toFixed(1)}V ⎓ 2.2A`, { size: 6.5 }) + D.text(195, 51, c.props.tag, { size: 7, weight: 700 }) +
      D.led(172, 70, on || blink, '#3ddc84') + D.text(185, 73, 'DC OK', { size: 6.5, anchor: 'start' }) +
      `<circle cx="214" cy="70" r="6" fill="#ddd" stroke="#555"/><line x1="210" y1="70" x2="218" y2="70" stroke="#555" stroke-width="1.5"/>` +
      D.text(214, 84, 'V.ADJ', { size: 6 }) +
      D.rect(20, 92, 204, 30, '#1f1f1f', { rx: 2 });
    const labels = ['L', 'N', '⏚', '-V', '-V', '+V', '+V'];
    CCS.termsOf(c).forEach((t, i) => { s += D.screw(t.x, t.y, t.id, '', 'below', { box: i < 3 ? '#444' : '#333' }); s += D.text(t.x, 99 - 10, labels[i], { size: 8, weight: 700, fill: '#111' }); });
    if (c.st.burnt) s += D.smoke(80, 40);
    return s;
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'bench', name: 'Bench DC supply (adjustable)', cat: 'Power & protection', w: 140, h: 100,
  info: 'Laboratory DC supply with current limit. Handy for testing the 24 V side without mains wiring. In constant-current (CC) mode the voltage drops so that the current never exceeds the limit.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'G2' }, { key: 'volts', label: 'Voltage (V)', type: 'number', def: 24, min: 0, max: 30, step: 0.5 }, { key: 'ilim', label: 'Current limit (A)', type: 'number', def: 3, min: 0.1, max: 5, step: 0.1 }],
  terms: () => [{ id: '+', x: 96, y: 84, k: 'e', d: 'Output + (red)' }, { id: '-', x: 122, y: 84, k: 'e', d: 'Output − (black)' }],
  init(c) { c.st.on = true; c.st.cc = false; },
  elec(c, N) { if (c.st.on) N.src(c, '+', '-', +c.props.volts, 'DC', c.st.cc ? Math.max(0.03, c.props.volts / c.props.ilim) : 0.03, 'out'); },
  sense(c, R) {
    if (!c.st.on) return false;
    const I = R.i(c, 'out').dc, lim = +c.props.ilim;
    if (!c.st.cc && I > lim * 1.01) { c.st.cc = true; return true; }
    if (c.st.cc) { const v = R.vd(c, '+', '-').dc; if (v > c.props.volts * 0.985) { c.st.cc = false; return true; } }
    return false;
  },
  step(c, dt, R, ctx) {
    c.st.V = c.st.on ? R.vd(c, '+', '-').dc : 0; c.st.i = c.st.on ? R.i(c, 'out').dc : 0;
    if (c.st.cc) ctx.fault(c, 'warn', 'Supply in current-limit (CC) mode — overload or short circuit on the output.');
    if (R.vd(c, '+', '-').ac > 30) ctx.fault(c, 'error', 'AC voltage applied to the DC supply output!');
  },
  act(c, a, ph) { if (a === 'pwr' && ph === 'down') { c.st.on = !c.st.on; c.st.cc = false; return true; } },
  draw(c) {
    const on = c.st.on;
    return `<g filter="url(#fShadow)">${D.rect(0, 0, 140, 100, '#2f4d7a', { rx: 6 })}</g>` + D.rect(6, 6, 128, 40, '#111', { rx: 3 }) +
      D.text(40, 32, on ? (c.st.V || 0).toFixed(1) : '--.-', { size: 17, fill: c.st.cc ? '#ff8a65' : '#7CFC8A', mono: 1, weight: 700 }) + D.text(40, 42, 'V', { size: 7, fill: '#aaa' }) +
      D.text(100, 32, on ? Math.abs(c.st.i || 0).toFixed(2) : '-.--', { size: 17, fill: '#ffd54f', mono: 1, weight: 700 }) + D.text(100, 42, c.st.cc ? 'A  CC' : 'A', { size: 7, fill: '#aaa' }) +
      `<g data-act="pwr">${D.rect(10, 62, 34, 22, on ? '#2e7d32' : '#555', { rx: 4 })}${D.text(27, 77, on ? 'ON' : 'OFF', { size: 9, fill: '#fff', weight: 700 })}</g>` +
      D.text(70, 60, c.props.tag, { size: 9, fill: '#fff', weight: 700 }) +
      D.circ(96, 84, 10, '#c62828') + D.circ(122, 84, 10, '#222') + D.screw(96, 84, '+', '+', 'above') + D.screw(122, 84, '-', '−', 'above');
  },
});

/* ------------------------------------------------------------------ */
const TB_PITCH = 26;
const tbWays = c => CCS.util.clamp(Math.round(+c.props.ways || 10), 2, 16);
const tbBridgeN = c => { if (!c.props.bridged) return 0; const n = Math.round(+c.props.bridgeN || 0); return n >= 2 ? Math.min(n, tbWays(c)) : tbWays(c); };
CCS.defType({
  type: 'tblock', name: 'DIN terminal strip + bridge', cat: 'Power & protection', w: c => 12 + tbWays(c) * TB_PITCH, h: 112,
  info: 'Feed-through DIN-rail terminals (e.g. UK2.5 / ST2.5 style), each with a top and a bottom wire entry that are connected inside the terminal.\nThe orange plug-in bridge (jumper comb) in the middle row links neighbouring terminals, so ONE incoming wire (e.g. +24 V from the power supply) becomes many outlets: every bridged terminal gives 2 more connection points.\nSet the number of terminals and how many (from terminal 1) the bridge covers — real bridges are cut to length. Leave "Bridged" off to use the terminals as separate feed-throughs.\nA screw/spring entry takes 1–2 ferruled wires; never stack 3.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'X1' }, { key: 'ways', label: 'Terminals', type: 'number', def: 10, min: 2, max: 16, step: 1 },
    { key: 'bridged', label: 'Bridge fitted', type: 'check', def: true }, { key: 'bridgeN', label: 'Bridge length (0 = all)', type: 'number', def: 0, min: 0, max: 16, step: 1 },
    { key: 'color', label: 'Colour', type: 'select', options: ['grey', 'blue', 'red', 'green-yellow'], def: 'grey' }],
  terms: c => { const t = []; for (let i = 1; i <= tbWays(c); i++) { const x = 6 + (i - 1) * TB_PITCH + TB_PITCH / 2; t.push({ id: 'a' + i, x, y: 20, k: 'e', d: `Terminal ${i}, top entry` }); t.push({ id: 'b' + i, x, y: 90, k: 'e', d: `Terminal ${i}, bottom entry` }); } return t; },
  elec(c, N) {
    const n = tbWays(c), br = tbBridgeN(c);
    for (let i = 1; i <= n; i++) { N.join(c, 'a' + i, 'b' + i); if (i < br) N.join(c, 'a' + i, 'a' + (i + 1)); }
  },
  draw(c) {
    const n = tbWays(c), br = tbBridgeN(c), W = 12 + n * TB_PITCH;
    const col = { grey: '#c9ccce', blue: '#4a90e2', red: '#e06666', 'green-yellow': '#8bc34a' }[c.props.color];
    let s = `<g filter="url(#fShadow)">${D.rect(0, 50, W, 14, 'url(#gMetal)', { rx: 1 })}`;
    for (let i = 0; i < n; i++) {
      const x = 6 + i * TB_PITCH;
      s += D.rect(x, 4, TB_PITCH - 1, 104, col, { rx: 2, stroke: '#7d8286' });
    }
    s += '</g>';
    for (let i = 0; i < n; i++) {
      const x = 6 + i * TB_PITCH, cx = x + TB_PITCH / 2;
      if (c.props.color === 'green-yellow') s += `<rect x="${x + 5}" y="34" width="${TB_PITCH - 11}" height="40" fill="#fdd835" opacity=".75"/>`;
      s += D.line(x + 2, 36, x + TB_PITCH - 3, 36, '#0002', 1) + D.line(x + 2, 72, x + TB_PITCH - 3, 72, '#0002', 1);
      // bridge slot (empty) in the middle row
      s += `<circle cx="${cx}" cy="55" r="6.5" fill="#55595c" stroke="#0005"/>`;
      s += D.text(cx, 106, String(i + 1), { size: 7, weight: 700, fill: '#333' });
    }
    if (br >= 2) {
      const x0 = 6 + TB_PITCH / 2, x1 = 6 + (br - 1) * TB_PITCH + TB_PITCH / 2;
      s += `<rect x="${x0 - 5}" y="51" width="${x1 - x0 + 10}" height="8" rx="4" fill="#f57c00" stroke="#a84300"/>`;
      for (let i = 0; i < br; i++) { const cx = x0 + i * TB_PITCH; s += `<circle cx="${cx}" cy="55" r="7" fill="#ff8f00" stroke="#a84300"/><circle cx="${cx}" cy="55" r="3.2" fill="url(#gScrew)" stroke="#777"/><line x1="${cx - 2}" y1="53" x2="${cx + 2}" y2="57" stroke="#666" stroke-width="1"/>`; }
    }
    CCS.termsOf(c).forEach(t => (s += D.screw(t.x, t.y, t.id, '', 'below', { box: '#2b2b2b' })));
    return s + D.tag(W / 2, 40 - 0, c.props.tag);
  },
});
