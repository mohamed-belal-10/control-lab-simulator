/* =========================================================================
 * Module 23: sensors (3-wire DC proximity, reed switch, roller limit switch)
 * Wire colours (IEC 60947-5-2): BN brown = +V, BU blue = 0 V, BK black = output
 * ========================================================================= */
const SENSOR_KINDS = {
  'Photoelectric diffuse M18': { lens: '#7a1010', range: '10–30 cm', ex: 'E3F-DS30P1 (PNP NO) / E3F-DS30P2 (PNP NC)' },
  'Inductive M12': { lens: '#1565c0', range: '4 mm (metal only)', ex: 'LJ12A3-4-Z/BY (PNP NO)' },
  'Capacitive M18': { lens: '#d9dee3', range: '1–10 mm (any material)', ex: 'LJC18A3-H-Z/BY (PNP NO)', pot: true },
};
CCS.defType({
  type: 'prox', name: 'Photoelectric sensor M18 (3-wire)', cat: 'Sensors', w: 236, h: 76,
  info: 'DC 3-wire proximity sensor, 6–36 V DC, output max 200 mA (short-circuit protected).\nBN (brown) → +24 V, BU (blue) → 0 V, BK (black) → load (relay coil, PLC input).\nPNP: output switches +V to BK (load between BK and 0 V) — the usual choice for relay circuits.\nNPN: output switches BK to 0 V (load between +V and BK).\nNO = output ON when an object is detected; NC = output ON when nothing is detected.\nTypes: photoelectric diffuse (sees objects by reflected light, e.g. E3F-DS30P1 PNP NO / P2 PNP NC), inductive (metal only, a few mm, e.g. LJ12A3-4-Z/BY), capacitive (any material — plastic, wood, glass, liquids — 1–10 mm, sensitivity screw on the back, e.g. LJC18A3-H-Z/BY).\nClick the dashed zone in front of the lens to place / remove an object.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'B1' }, { key: 'kind', label: 'Type', type: 'select', options: Object.keys(SENSOR_KINDS), def: 'Photoelectric diffuse M18' },
    { key: 'out', label: 'Output', type: 'select', options: ['PNP NO', 'PNP NC', 'NPN NO', 'NPN NC'], def: 'PNP NO' }],
  terms: () => [{ id: 'BN', x: 14, y: 54, k: 'e', d: 'Brown: +V supply (6–36 V DC)' }, { id: 'BK', x: 36, y: 54, k: 'e', d: 'Black: switching output (max 200 mA)' }, { id: 'BU', x: 58, y: 54, k: 'e', d: 'Blue: 0 V' }],
  init(c) { c.st.obj = false; c.st.pw = false; c.st.ol = 0; },
  active(c) { const det = c.st.obj, nc = c.props.out.endsWith('NC'); return c.st.pw && c.st.ol <= 0 && (det !== nc); },
  elec(c, N) {
    N.res(c, 'BN', 'BU', 2400, 'self');
    const on = CCS.types.prox.active(c);
    if (c.props.out.startsWith('PNP')) N.sw(c, 'BN', 'BK', on, 'out'); else N.sw(c, 'BK', 'BU', on, 'out');
  },
  sense(c, R) {
    const v = R.vd(c, 'BN', 'BU'), pw = v.dc >= 6 && v.dc <= 40 && v.ac < 5 && !c.st.burnt;
    let ch = pw !== c.st.pw; c.st.pw = pw;
    if (CCS.types.prox.active(c) && R.i(c, 'out').rms > 0.5) { c.st.ol = 1; ch = true; }
    return ch;
  },
  step(c, dt, R, ctx) {
    const v = R.vd(c, 'BN', 'BU');
    if (c.st.ol > 0) { c.st.ol -= dt; ctx.fault(c, 'error', 'Output short circuit / overload (> 200 mA) — protection switched the output off. Never connect BK directly to 0 V / +V.'); }
    const io = R.i(c, 'out').rms; if (io > 0.2 && c.st.ol <= 0) ctx.fault(c, 'warn', `Output current ${(io * 1000).toFixed(0)} mA > 200 mA — drive a relay, not the load directly.`);
    if (v.dc < -6) ctx.fault(c, 'warn', 'Reverse polarity: brown must go to +V and blue to 0 V.');
    if (v.ac > 30 || v.dc > 40) { c.st.burnt = true; }
    if (c.st.burnt) ctx.fault(c, 'error', 'Sensor destroyed by AC/over-voltage (it is a 6–36 V DC device).');
    if (c.wired && (c.wired.BN || c.wired.BU) && !c.st.pw && !c.st.burnt && v.dc >= 0 && v.dc < 6) ctx.fault(c, 'info', 'Sensor not powered (needs 6–36 V DC between BN and BU).');
  },
  act(c, a, ph) { if (a === 'obj' && ph === 'down') { c.st.obj = !c.st.obj; return true; } },
  draw(c) {
    const K = SENSOR_KINDS[c.props.kind], on = CCS.types.prox.active(c);
    let s = '';
    // cable + cores
    s += `<path d="M82 31 C 66 31 66 30 58 34" fill="none" stroke="#555" stroke-width="6" stroke-linecap="round"/>`;
    s += `<path d="M58 34 C 40 34 20 34 14 46" fill="none" stroke="#795548" stroke-width="2.4"/><path d="M58 34 C 48 36 38 38 36 46" fill="none" stroke="#111" stroke-width="2.4"/><path d="M58 34 L58 46" fill="none" stroke="#1e88e5" stroke-width="2.4"/>`;
    s += D.lead(14, 54, 'BN', '#795548', 'BN') + D.lead(36, 54, 'BK', '#111', 'BK') + D.lead(58, 54, 'BU', '#1e88e5', 'BU');
    // threaded barrel
    s += `<g filter="url(#fShadow)">${D.rect(84, 16, 92, 30, 'url(#gBrass)', { rx: 3 })}</g><rect x="84" y="16" width="92" height="30" fill="url(#pThread)"/>`;
    s += D.rect(104, 12, 10, 38, 'url(#gMetal)', { rx: 2 }) + D.rect(150, 12, 10, 38, 'url(#gMetal)', { rx: 2 });
    s += D.rect(78, 18, 10, 26, '#222', { rx: 2 }) + D.led(86, 31, on, '#ff9100', 2.4);
    s += D.rect(176, 18, 8, 26, K.lens, { rx: 3 });
    if (K.pot) s += `<circle cx="80" cy="22" r="3.2" fill="url(#gBrass)" stroke="#6b5a1e"/><line x1="78" y1="22" x2="82" y2="22" stroke="#333" stroke-width="1"/>` + D.text(130, 10, 'capacitive · sens. adj.', { size: 6.5, fill: '#8a9bc4' });
    // detection zone
    s += `<g data-act="obj"><rect x="190" y="8" width="42" height="46" rx="4" fill="#ffffff0d" stroke="#8a9bc4" stroke-dasharray="4 3"/>` +
      (c.st.obj ? `<rect x="198" y="16" width="28" height="30" rx="2" fill="#e8d6b0" stroke="#6b5a3a"/><path d="M198 26 h28" stroke="#6b5a3a"/>` : D.text(211, 35, 'click', { size: 7, fill: '#8a9bc4' })) + '</g>';
    if (c.props.kind.startsWith('Photo') && c.st.pw) s += `<path d="M184 31 L190 31" stroke="#ff5252" stroke-width="2" opacity=".7"/>`;
    s += D.tag(130, 64 - 0, `${c.props.tag} · ${c.props.out}`);
    return s + (c.st.burnt ? D.smoke(130, 30) : '');
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'reed', name: 'Reed switch (cylinder)', cat: 'Sensors', w: 56, h: 74, zTop: true,
  info: 'Magnetic reed switch for slot/tie-rod mounting on a magnetic-piston cylinder (e.g. Airtac CS1-U / CS1-J), 2-wire, 5–240 V, max 100 mA, with LED.\nDrag it by its body onto a cylinder barrel to clamp it there (drop it at the end position you want). It closes when the piston magnet passes underneath.\nBN = brown (+), BU = blue (to the load). Max 100 mA: drive a relay coil, not a solenoid valve.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'a0' }, { key: 'attach', label: 'Mounted on', type: 'cyl', def: '' }, { key: 'pos', label: 'Position (0=retracted, 1=extended)', type: 'range', def: 0, min: 0, max: 1, step: 0.01 }],
  anchor: [28, 9],
  terms: () => [{ id: 'BN', x: 18, y: 58, k: 'e', d: 'Brown (+)' }, { id: 'BU', x: 38, y: 58, k: 'e', d: 'Blue (load side)' }],
  init(c) { c.st.closed = false; c.st.man = false; },
  elec(c, N) { N.sw(c, 'BN', 'BU', c.st.closed, 'sw'); },
  step(c, dt, R, ctx) {
    const I = R.i(c, 'sw');
    c.st.led = c.st.closed && I.dc > 0.002;
    if (I.rms > 0.1) ctx.fault(c, 'warn', `Reed switch current ${(I.rms * 1000).toFixed(0)} mA > 100 mA max — use an interposing relay.`);
    if (c.st.closed && I.dc < -0.002) ctx.fault(c, 'info', 'Polarity reversed — switch works but its LED stays off.');
    if (c.props.attach && !CCS.circuit.byId(c.props.attach)) c.props.attach = '';
  },
  draw(c) {
    return `<path d="M28 18 C 28 30 18 34 18 44" fill="none" stroke="#795548" stroke-width="2.2"/><path d="M28 18 C 28 30 38 34 38 44" fill="none" stroke="#1e88e5" stroke-width="2.2"/>` +
      `<path d="M28 14 L28 24" stroke="#555" stroke-width="5"/>` +
      D.rect(8, 2, 40, 14, '#37474f', { rx: 3 }) + D.rect(10, 4, 24, 10, '#546e7a', { rx: 2 }) + D.led(41, 9, c.st.led, '#ff1744', 2.4) +
      D.lead(18, 58, 'BN', '#795548', '') + D.lead(38, 58, 'BU', '#1e88e5', '') + D.text(28, 72, c.props.tag, { size: 9, weight: 700, fill: '#ffd27a' });
  },
});

/* ------------------------------------------------------------------ */
CCS.defType({
  type: 'limit', name: 'Roller limit switch', cat: 'Sensors', w: 84, h: 124,
  info: 'Roller-lever limit switch with a snap-action change-over contact (e.g. Omron D4MC / TZ-8108 style), 5 A.\nCOM-NO closes and COM-NC opens when the roller is pushed.\nLink it to a cylinder (properties) to make the rod cam operate it at the chosen end, or click the roller to operate it by hand.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'S2' }, { key: 'link', label: 'Operated by', type: 'cyl', def: '' }, { key: 'at', label: 'At cylinder end', type: 'select', options: ['extended', 'retracted'], def: 'extended' }],
  terms: () => [{ id: 'COM', x: 18, y: 106, k: 'e', d: 'Common' }, { id: 'NO', x: 42, y: 106, k: 'e', d: 'Normally open' }, { id: 'NC', x: 66, y: 106, k: 'e', d: 'Normally closed' }],
  init(c) { c.st.man = false; c.st.act = false; },
  elec(c, N) { N.sw(c, 'COM', 'NO', c.st.act, 'no'); N.sw(c, 'COM', 'NC', !c.st.act, 'nc'); },
  step(c, dt, R, ctx) {
    let byCyl = false;
    const cy = c.props.link && CCS.circuit.byId(c.props.link);
    if (cy) byCyl = c.props.at === 'extended' ? cy.st.pos >= 0.985 : cy.st.pos <= 0.015;
    c.st.act = c.st.man || byCyl;
    CCS.contactCheck(c, ctx, Math.max(R.i(c, 'no').rms, R.i(c, 'nc').rms), 5, 'Contact');
  },
  act(c, a, ph) { if (a === 'roller') { c.st.man = ph === 'down'; c.st.act = c.st.man; return true; } },
  draw(c) {
    const a = c.st.act;
    return D.tag(42, 8, c.props.tag) +
      `<g data-act="roller"><g transform="rotate(${a ? 18 : 0} 42 52)"><rect x="39" y="22" width="6" height="32" rx="2" fill="#9e9e9e" stroke="#444"/><circle cx="42" cy="22" r="9" fill="#212121" stroke="#888"/><circle cx="42" cy="22" r="3" fill="#bbb"/></g></g>` +
      `<g filter="url(#fShadow)">${D.rect(8, 48, 68, 74, '#c9c2b0', { rx: 4 })}</g>` + D.rect(8, 48, 68, 22, '#8d867a', { rx: 4 }) +
      D.text(42, 63, a ? 'ACTUATED' : (c.props.link ? '⇄ cyl' : 'manual'), { size: 7, weight: 700, fill: '#fff' }) +
      D.rect(10, 92, 64, 28, '#333', { rx: 2 }) + D.screw(18, 106, 'COM', 'C', 'above', { lc: '#111' }) + D.screw(42, 106, 'NO', 'NO', 'above', { lc: '#111' }) + D.screw(66, 106, 'NC', 'NC', 'above', { lc: '#111' });
  },
});

/* palette variants: same part type, different preset */
CCS.variants = [
  { type: 'prox', name: 'Capacitive sensor M18 (3-wire)', cat: 'Sensors', props: { kind: 'Capacitive M18' } },
  { type: 'prox', name: 'Inductive sensor M12 (3-wire)', cat: 'Sensors', props: { kind: 'Inductive M12' } },
];
