/* =========================================================================
 * Module 10: part registry + realistic SVG drawing helpers
 *
 * A part type is a plain object registered with CCS.defType({...}):
 *   type, name, model, cat, w, h        identity + size (local px)
 *   props: [{key,label,type,def,options,min,max,step}]
 *   terms(c)   -> [{id,x,y,k:'e'|'p',d:'description',free?:'vent'|'atm'|'leak'|'closed'}]
 *   init(c)    -> sets c.st (runtime state)
 *   elec(c,N)  -> adds electrical elements (resistors, switches, sources)
 *   sense(c,R) -> fast state changes that need a re-solve (returns true if changed)
 *   step(c,dt,R,ctx)    -> time-based updates + fault reporting
 *   pneu(c,P), pstep(c,dt,PR,ctx)  -> pneumatic elements and motion
 *   draw(c)    -> SVG string in local coordinates
 *   act(c,name,phase)   -> interactive zones (data-act="name")
 *   info       -> real-world notes shown in the properties panel
 * ========================================================================= */
CCS.types = {};
CCS.catOrder = ['Power & protection', 'Command devices', 'Signalling', 'Relays & contactors', 'Sensors', 'Loads',
  'Air supply', 'Valves', 'Actuators', 'Fittings', 'Panel & wiring'];

CCS.defType = def => {
  def.props = def.props || [];
  def.terms = def.terms || (() => []);
  CCS.types[def.type] = def;
  return def;
};

CCS.newPart = (type, x = 0, y = 0, props = {}) => {
  const T = CCS.types[type];
  if (!T) throw new Error('Unknown part type ' + type);
  const c = { id: CCS.util.uid('c'), type, x, y, rot: 0, props: {} };
  T.props.forEach(p => (c.props[p.key] = p.def));
  Object.assign(c.props, props);
  CCS.initPart(c);
  return c;
};
CCS.initPart = c => {
  const T = CCS.types[c.type];
  c.st = {}; c.faults = [];
  if (T.init) T.init(c);
};
CCS.size = c => { const T = CCS.types[c.type]; return { w: typeof T.w === 'function' ? T.w(c) : T.w, h: typeof T.h === 'function' ? T.h(c) : T.h }; };
CCS.termsOf = c => CCS.types[c.type].terms(c);
/** terminal position in world coordinates */
CCS.termPos = (c, tid) => {
  const t = CCS.termsOf(c).find(t => t.id === tid);
  if (!t) return null;
  return CCS.localToWorld(c, t.x, t.y);
};
CCS.localToWorld = (c, x, y) => { const { w, h } = CCS.size(c); const [rx, ry] = CCS.util.rot(x, y, w / 2, h / 2, c.rot || 0); return [rx + c.x, ry + c.y]; };
CCS.worldToLocal = (c, X, Y) => { const { w, h } = CCS.size(c); return CCS.util.rot(X - c.x, Y - c.y, w / 2, h / 2, -(c.rot || 0)); };

/* ------------------------------------------------------------------ */
/* SVG drawing helpers                                                 */
/* ------------------------------------------------------------------ */
const D = (CCS.draw = {
  e: CCS.util.esc,
  rect(x, y, w, h, fill, o = {}) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 3}" fill="${fill}" stroke="${o.stroke ?? '#0007'}" stroke-width="${o.sw ?? 1}"${o.extra || ''}/>`;
  },
  circ(x, y, r, fill, o = {}) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${o.stroke ?? '#0007'}" stroke-width="${o.sw ?? 1}"${o.extra || ''}/>`; },
  text(x, y, s, o = {}) {
    return `<text x="${x}" y="${y}" font-size="${o.size || 9}" text-anchor="${o.anchor || 'middle'}" fill="${o.fill || '#222'}" font-weight="${o.weight || 400}" font-family="${o.mono ? 'Consolas,monospace' : 'Arial,Helvetica,sans-serif'}"${o.extra || ''} pointer-events="none">${D.e(s)}</text>`;
  },
  line(x1, y1, x2, y2, stroke = '#000', sw = 1, extra = '') { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`; },
  /** screw terminal: the hot-spot carries data-term so the editor can wire to it */
  screw(x, y, id, label, lp = 'below', o = {}) {
    const ly = lp === 'below' ? y + 15 : lp === 'above' ? y - 9 : y + 3;
    const lx = lp === 'left' ? x - 10 : lp === 'right' ? x + 10 : x;
    const an = lp === 'left' ? 'end' : lp === 'right' ? 'start' : 'middle';
    return `<g class="term" data-term="${D.e(id)}">` +
      `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="2" fill="${o.box || '#3a3a3a'}" stroke="#0009"/>` +
      `<circle cx="${x}" cy="${y}" r="5" fill="url(#gScrew)" stroke="#555"/>` +
      `<line x1="${x - 3.5}" y1="${y - 3.5}" x2="${x + 3.5}" y2="${y + 3.5}" stroke="#555" stroke-width="1.4"/>` +
      `<circle class="th" cx="${x}" cy="${y}" r="9"/></g>` +
      (label ? D.text(lx, ly, label, { size: o.ls || 8.5, fill: o.lc || '#fff', weight: 700, anchor: an }) : '');
  },
  /** flying lead (sensor cable core) ending in a ferrule */
  lead(x, y, id, color, label) {
    return `<g class="term" data-term="${D.e(id)}"><rect x="${x - 3}" y="${y - 8}" width="6" height="12" rx="1" fill="#c9ccd1" stroke="#555"/>` +
      `<circle cx="${x}" cy="${y + 4}" r="3" fill="${color}" stroke="#222"/><circle class="th" cx="${x}" cy="${y}" r="9"/></g>` +
      D.text(x, y + 18, label, { size: 8, fill: '#fff', weight: 700 });
  },
  /** pneumatic push-in fitting */
  port(x, y, id, label, lp = 'below') {
    const ly = lp === 'below' ? y + 17 : lp === 'above' ? y - 11 : y + 3;
    const lx = lp === 'left' ? x - 13 : lp === 'right' ? x + 13 : x;
    const an = lp === 'left' ? 'end' : lp === 'right' ? 'start' : 'middle';
    return `<g class="term" data-term="${D.e(id)}"><circle cx="${x}" cy="${y}" r="8" fill="url(#gBrass)" stroke="#6b5a1e"/>` +
      `<circle cx="${x}" cy="${y}" r="5" fill="#1e88e5" stroke="#0d47a1"/><circle cx="${x}" cy="${y}" r="2.2" fill="#0b1f3a"/>` +
      `<circle class="th" cx="${x}" cy="${y}" r="10"/></g>` +
      (label ? D.text(lx, ly, label, { size: 8.5, fill: '#fff', weight: 700, anchor: an }) : '');
  },
  led(x, y, on, color = '#ff3b30', r = 3.2) {
    return (on ? `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="${color}" opacity=".35" filter="url(#fGlow)"/>` : '') +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${on ? color : '#3a2a2a'}" stroke="#0008"/>`;
  },
  tag(x, y, s, o = {}) {
    const w = Math.max(22, s.length * 7 + 8);
    return `<rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="15" rx="3" fill="${o.bg || '#fffbe6'}" stroke="#0006"/>` + D.text(x, y + 3.5, s, { size: 10, weight: 700, fill: '#111' });
  },
  smoke(x, y) {
    return `<g opacity=".85" pointer-events="none"><circle cx="${x}" cy="${y}" r="10" fill="#555" opacity=".6"><animate attributeName="cy" values="${y};${y - 22}" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="1.4s" repeatCount="indefinite"/></circle>` +
      `<circle cx="${x + 7}" cy="${y}" r="7" fill="#777" opacity=".5"><animate attributeName="cy" values="${y};${y - 26}" dur="1.9s" repeatCount="indefinite"/><animate attributeName="opacity" values=".6;0" dur="1.9s" repeatCount="indefinite"/></circle>` +
      D.text(x, y + 4, 'BURNT', { size: 8, weight: 700, fill: '#ff4d5e' }) + '</g>';
  },
});

/** global gradients, filters, grid pattern */
CCS.svgDefs = () => `
<pattern id="gridPat" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#1d2b52" stroke-width="1"/></pattern>
<radialGradient id="gScrew" cx=".35" cy=".35"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8d939b"/></radialGradient>
<linearGradient id="gBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dc8a"/><stop offset=".5" stop-color="#c9a33f"/><stop offset="1" stop-color="#8f7124"/></linearGradient>
<linearGradient id="gWhite" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfbf8"/><stop offset="1" stop-color="#d9d9d2"/></linearGradient>
<linearGradient id="gGrey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d939b"/><stop offset="1" stop-color="#5b616a"/></linearGradient>
<linearGradient id="gBlack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3f44"/><stop offset="1" stop-color="#16181b"/></linearGradient>
<linearGradient id="gMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset=".5" stop-color="#c3c9d0"/><stop offset="1" stop-color="#9aa2ab"/></linearGradient>
<linearGradient id="gAluV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".35" stop-color="#c8ced6"/><stop offset=".7" stop-color="#e3e7eb"/><stop offset="1" stop-color="#8c949d"/></linearGradient>
<linearGradient id="gChrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#b9c0c8"/><stop offset=".55" stop-color="#e9edf1"/><stop offset="1" stop-color="#7d858e"/></linearGradient>
<linearGradient id="gCopper" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8651c"/><stop offset=".5" stop-color="#f0a55a"/><stop offset="1" stop-color="#a95a16"/></linearGradient>
<linearGradient id="gClear" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#b9d4e6" stop-opacity=".35"/></linearGradient>
<linearGradient id="gPerf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d6dbe0"/><stop offset="1" stop-color="#b4bbc3"/></linearGradient>
<pattern id="pHoles" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.6" fill="#4b525a"/></pattern>
<pattern id="pThread" width="4" height="40" patternUnits="userSpaceOnUse"><rect width="2" height="40" fill="#0002"/></pattern>
<filter id="fGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="fShadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="2" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".45"/></filter>
`;

/** common head colours for buttons/lamps */
CCS.colors = {
  red: ['#ff6b6b', '#c62828'], green: ['#7ee08a', '#1b8a3a'], yellow: ['#fff38a', '#d4b400'], blue: ['#7fb5ff', '#1556c4'],
  white: ['#ffffff', '#c9cdd3'], black: ['#666', '#111'], orange: ['#ffc07a', '#e06c00'],
};
CCS.headGrad = (id, col) => { const [a, b] = CCS.colors[col] || CCS.colors.green; return `<radialGradient id="${id}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`; };
