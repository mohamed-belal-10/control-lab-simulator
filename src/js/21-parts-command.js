/* =========================================================================
 * Module 21: command & signalling devices (22 mm panel devices)
 * IEC contact numbering: NO = 13-14 (or 23-24), NC = 11-12 (or 21-22)
 * ========================================================================= */
CCS.contactSets = {
  'NO': [['13', '14', 'NO']], 'NC': [['11', '12', 'NC']], 'NO+NC': [['13', '14', 'NO'], ['21', '22', 'NC']],
};
/** draws contact blocks below a 22 mm head; returns svg */
CCS.drawBlocks = (sets, y0, w) => {
  let s = '';
  const bw = 34, gap = 6, tot = sets.length * bw + (sets.length - 1) * gap, x0 = (w - tot) / 2;
  sets.forEach(([a, b, kind], i) => {
    const x = x0 + i * (bw + gap);
    s += D.rect(x, y0, bw, 40, '#f2f2ee', { rx: 2 }) + `<rect x="${x + 4}" y="${y0 + 3}" width="${bw - 8}" height="6" rx="1" fill="${kind === 'NO' ? '#43a047' : '#e53935'}"/>` +
      D.text(x + bw / 2, y0 + 19, kind, { size: 7, weight: 700 });
    s += D.screw(x + 8, y0 + 30, a, a, 'below') + D.screw(x + bw - 8, y0 + 30, b, b, 'below');
  });
  return s;
};
CCS.blockTerms = (sets, y0, w) => {
  const bw = 34, gap = 6, tot = sets.length * bw + (sets.length - 1) * gap, x0 = (w - tot) / 2, t = [];
  sets.forEach(([a, b, kind], i) => {
    const x = x0 + i * (bw + gap);
    t.push({ id: a, x: x + 8, y: y0 + 30, k: 'e', d: `${kind} contact ${a}-${b}` }, { id: b, x: x + bw - 8, y: y0 + 30, k: 'e', d: `${kind} contact ${a}-${b}` });
  });
  return t;
};
CCS.blockElec = (c, N, sets, actuated) => sets.forEach(([a, b, kind]) => N.sw(c, a, b, kind === 'NO' ? actuated : !actuated, 'k' + a));
CCS.blockCheck = (c, R, ctx, sets, rating) => sets.forEach(([a, b]) => CCS.contactCheck(c, ctx, R.i(c, 'k' + a).rms, rating, `Contact ${a}-${b}`));

const pbW = c => (c.props.contact === 'NO+NC' ? 96 : 76);
CCS.defType({
  type: 'pushbutton', name: 'Push button 22 mm', cat: 'Command devices', w: pbW, h: 122,
  info: '22 mm panel push button with screw-clamp contact blocks (e.g. Schneider XB2/XB5, LA38 series).\nGreen NO block: 13-14 (closes when pressed). Red NC block: 11-12 or 21-22 (opens when pressed). Contacts rated ~10 A.\nPress with the mouse — momentary buttons spring back on release; latching ones toggle.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'S1' }, { key: 'color', label: 'Colour', type: 'select', options: ['green', 'red', 'black', 'yellow', 'blue', 'white'], def: 'green' },
    { key: 'contact', label: 'Contacts', type: 'select', options: ['NO', 'NC', 'NO+NC'], def: 'NO' }, { key: 'mode', label: 'Action', type: 'select', options: ['momentary', 'latching'], def: 'momentary' },
    { key: 'text', label: 'Legend', type: 'text', def: 'START' }],
  terms: c => CCS.blockTerms(CCS.contactSets[c.props.contact], 72, pbW(c)),
  init(c) { c.st.pressed = false; },
  elec(c, N) { CCS.blockElec(c, N, CCS.contactSets[c.props.contact], c.st.pressed); },
  step(c, dt, R, ctx) { CCS.blockCheck(c, R, ctx, CCS.contactSets[c.props.contact], 10); },
  act(c, a, ph) {
    if (a !== 'btn') return;
    if (c.props.mode === 'latching') { if (ph === 'down') c.st.pressed = !c.st.pressed; } else c.st.pressed = ph === 'down';
    return true;
  },
  draw(c) {
    const w = pbW(c), cx = w / 2, p = c.st.pressed;
    return `<defs>${CCS.headGrad(c.id + 'hg', c.props.color)}</defs>` +
      D.tag(cx, 8, c.props.tag) +
      `<g filter="url(#fShadow)">${D.rect(cx - 30, 16, 60, 54, 'url(#gBlack)', { rx: 6 })}</g>` +
      `<g data-act="btn"><circle cx="${cx}" cy="43" r="22" fill="#c9ced4" stroke="#555"/>` +
      `<circle cx="${cx}" cy="43" r="${p ? 15.5 : 17.5}" fill="url(#${c.id}hg)" stroke="#0007"/>` +
      (p ? '' : `<ellipse cx="${cx - 5}" cy="37" rx="7" ry="4" fill="#fff" opacity=".35"/>`) + D.text(cx, 46, c.props.text, { size: 6.5, weight: 700, fill: c.props.color === 'white' || c.props.color === 'yellow' ? '#222' : '#fff' }) + '</g>' +
      CCS.drawBlocks(CCS.contactSets[c.props.contact], 72, w);
  },
});

CCS.defType({
  type: 'estop', name: 'Emergency stop (mushroom)', cat: 'Command devices', w: 96, h: 132,
  info: 'Emergency-stop push button, Ø40 red mushroom on a yellow plate, latching (push to stop, twist/click again to release). Uses an NC block 11-12 so that a broken wire also stops the machine (fail-safe).',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'S0' }, { key: 'contact', label: 'Contacts', type: 'select', options: ['NC', 'NO+NC'], def: 'NC' }],
  terms: c => CCS.blockTerms(CCS.contactSets[c.props.contact], 82, 96),
  init(c) { c.st.pressed = false; },
  elec(c, N) { CCS.blockElec(c, N, CCS.contactSets[c.props.contact], c.st.pressed); },
  step(c, dt, R, ctx) { if (c.st.pressed) ctx.fault(c, 'info', 'Emergency stop is pressed (latched). Click again to release.'); CCS.blockCheck(c, R, ctx, CCS.contactSets[c.props.contact], 10); },
  act(c, a, ph) { if (a === 'mush' && ph === 'down') { c.st.pressed = !c.st.pressed; return true; } },
  draw(c) {
    const p = c.st.pressed;
    return D.tag(48, 8, c.props.tag) + `<circle cx="48" cy="48" r="34" fill="#fdd835" stroke="#9e8a00"/>` +
      `<path id="${c.id}arc" d="M22 48 A26 26 0 0 1 74 48" fill="none"/><text font-size="6.5" font-weight="700" fill="#222" font-family="Arial"><textPath href="#${c.id}arc" startOffset="50%" text-anchor="middle">EMERGENCY STOP</textPath></text>` +
      `<g data-act="mush"><circle cx="48" cy="50" r="${p ? 20 : 23}" fill="url(#${c.id}hg)" stroke="#6d0000"/><ellipse cx="41" cy="42" rx="9" ry="5" fill="#fff" opacity=".3"/>` +
      (p ? D.text(48, 53, 'PRESSED', { size: 6.5, fill: '#fff', weight: 700 }) : '') + `</g><defs>${CCS.headGrad(c.id + 'hg', 'red')}</defs>` +
      CCS.drawBlocks(CCS.contactSets[c.props.contact], 82, 96);
  },
});

CCS.defType({
  type: 'selector', name: 'Selector switch 2-position', cat: 'Command devices', w: pbW, h: 122,
  info: '22 mm maintained selector switch (0 – I). Contacts change when turned to I and stay there. Click the handle to turn it.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'S3' }, { key: 'contact', label: 'Contacts', type: 'select', options: ['NO', 'NC', 'NO+NC'], def: 'NO' }, { key: 'text', label: 'Legend', type: 'text', def: 'AUTO' }],
  terms: c => CCS.blockTerms(CCS.contactSets[c.props.contact], 72, pbW(c)),
  init(c) { c.st.pressed = false; },
  elec(c, N) { CCS.blockElec(c, N, CCS.contactSets[c.props.contact], c.st.pressed); },
  step(c, dt, R, ctx) { CCS.blockCheck(c, R, ctx, CCS.contactSets[c.props.contact], 10); },
  act(c, a, ph) { if (a === 'knob' && ph === 'down') { c.st.pressed = !c.st.pressed; return true; } },
  draw(c) {
    const w = pbW(c), cx = w / 2, ang = c.st.pressed ? 45 : -45;
    return D.tag(cx, 8, c.props.tag) + `<g filter="url(#fShadow)">${D.rect(cx - 30, 16, 60, 54, 'url(#gBlack)', { rx: 6 })}</g>` +
      D.text(cx - 20, 27, '0', { size: 8, fill: '#fff', weight: 700 }) + D.text(cx + 20, 27, 'I', { size: 8, fill: '#fff', weight: 700 }) +
      `<g data-act="knob"><circle cx="${cx}" cy="45" r="19" fill="#2a2a2a" stroke="#777"/><g transform="rotate(${ang} ${cx} 45)"><rect x="${cx - 5}" y="28" width="10" height="34" rx="4" fill="#111" stroke="#888"/><polygon points="${cx - 3},31 ${cx + 3},31 ${cx},27" fill="#fff"/></g></g>` +
      D.text(cx, 68, c.props.text, { size: 6.5, fill: '#fff' }) +
      CCS.drawBlocks(CCS.contactSets[c.props.contact], 72, w);
  },
});

/* ---------------- signalling ---------------- */
const lampR = c => (c.props.rating === '230V AC' ? 11500 : 1200);
const lampV = c => (c.props.rating === '230V AC' ? 230 : 24);
CCS.defType({
  type: 'lamp', name: 'Pilot lamp 22 mm (LED)', cat: 'Signalling', w: 66, h: 104,
  info: 'LED indicator lamp (e.g. AD16-22DS). Terminals X1/X2, works on AC or DC of its rated voltage (~20 mA). A 24 V lamp on 230 V burns out instantly.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'H1' }, { key: 'color', label: 'Colour', type: 'select', options: ['green', 'red', 'yellow', 'blue', 'white'], def: 'green' }, { key: 'rating', label: 'Rated voltage', type: 'select', options: ['24V AC/DC', '230V AC'], def: '24V AC/DC' }],
  terms: () => [{ id: 'X1', x: 20, y: 88, k: 'e', d: 'Lamp terminal X1' }, { id: 'X2', x: 46, y: 88, k: 'e', d: 'Lamp terminal X2' }],
  init(c) { c.st.lit = 0; c.st.burnt = false; },
  elec(c, N) { if (!c.st.burnt) N.res(c, 'X1', 'X2', lampR(c), 'lamp'); },
  step(c, dt, R, ctx) {
    const v = R.vd(c, 'X1', 'X2'), mag = Math.max(Math.abs(v.dc), v.ac), Vr = lampV(c);
    c.st.V = mag;
    if (c.st.burnt) { ctx.fault(c, 'error', 'Lamp burnt out (over-voltage). Press "Repair" after fixing.'); c.st.lit = 0; return; }
    if (mag > Vr * 1.4) { c.st.bt = (c.st.bt || 0) + dt; ctx.fault(c, 'error', `${mag.toFixed(0)} V on a ${Vr} V lamp!`); if (c.st.bt > 0.15) c.st.burnt = true; } else c.st.bt = 0;
    c.st.lit = mag >= Vr * 0.55 ? Math.min(1, mag / Vr) : 0;
    if (mag > 1 && mag < Vr * 0.55) ctx.fault(c, 'info', `Only ${mag.toFixed(1)} V across the lamp — too low to light.`);
  },
  draw(c) {
    const [a, b] = CCS.colors[c.props.color], lit = c.st.lit;
    return D.tag(33, 8, c.props.tag) + `<g filter="url(#fShadow)">${D.rect(5, 16, 56, 56, 'url(#gBlack)', { rx: 6 })}</g>` +
      `<circle cx="33" cy="44" r="21" fill="#bfc4ca" stroke="#555"/>` +
      (lit ? `<circle cx="33" cy="44" r="34" fill="${a}" opacity="${0.45 * lit}" filter="url(#fGlow)"/>` : '') +
      `<circle cx="33" cy="44" r="16" fill="${lit ? a : b}" opacity="${lit ? 1 : 0.55}" stroke="#0006"/>` +
      `<circle cx="33" cy="44" r="16" fill="url(#gClear)"/>` +
      D.rect(9, 74, 48, 28, '#ddd', { rx: 2 }) + D.screw(20, 88, 'X1', '', 'below') + D.screw(46, 88, 'X2', '', 'below') +
      D.text(33, 80, c.props.rating === '230V AC' ? '230V' : '24V', { size: 6.5, weight: 700 }) +
      (c.st.burnt ? D.smoke(33, 40) : '');
  },
});

CCS.defType({
  type: 'buzzer', name: 'Buzzer 22 mm', cat: 'Signalling', w: 66, h: 104,
  info: 'Panel buzzer (e.g. AD16-22SM), 24 V AC/DC, ~85 dB. Terminals X1/X2.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'H9' }],
  terms: () => [{ id: 'X1', x: 20, y: 88, k: 'e', d: 'X1' }, { id: 'X2', x: 46, y: 88, k: 'e', d: 'X2' }],
  init(c) { c.st.on = false; },
  elec(c, N) { if (!c.st.burnt) N.res(c, 'X1', 'X2', 1000, 'bz'); },
  step(c, dt, R, ctx) {
    const v = R.vd(c, 'X1', 'X2'), mag = Math.max(Math.abs(v.dc), v.ac);
    if (mag > 34) { c.st.burnt = true; }
    if (c.st.burnt) ctx.fault(c, 'error', 'Buzzer destroyed by over-voltage.');
    c.st.on = !c.st.burnt && mag > 14;
  },
  draw(c) {
    let s = D.tag(33, 8, c.props.tag) + `<g filter="url(#fShadow)">${D.rect(5, 16, 56, 56, 'url(#gBlack)', { rx: 6 })}</g><circle cx="33" cy="44" r="20" fill="#222" stroke="#666"/>`;
    for (let i = 0; i < 6; i++) s += `<circle cx="${33 + 9 * Math.cos(i)}" cy="${44 + 9 * Math.sin(i)}" r="2" fill="#000"/>`;
    if (c.st.on) s += `<g stroke="#ffcc33" stroke-width="2" fill="none" opacity="${(Date.now() / 120 | 0) % 2 ? 1 : 0.4}"><path d="M58 30 q8 14 0 28"/><path d="M8 30 q-8 14 0 28"/></g>`;
    return s + D.rect(9, 74, 48, 28, '#ddd', { rx: 2 }) + D.screw(20, 88, 'X1', '', 'below') + D.screw(46, 88, 'X2', '', 'below') + D.text(33, 80, '24V', { size: 6.5, weight: 700 }) + (c.st.burnt ? D.smoke(33, 40) : '');
  },
});
