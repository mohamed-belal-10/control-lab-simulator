/* =========================================================================
 * Module 25: panel hardware — slotted wiring duct (trunking)
 * Board scale for panel hardware: 1 cm = CCS.PX_PER_CM px
 * ========================================================================= */
CCS.PX_PER_CM = 20;
const ductDims = c => ({ L: CCS.util.clamp(+c.props.length || 40, 5, 300) * CCS.PX_PER_CM, W: CCS.util.clamp(+c.props.width || 2.5, 1, 15) * CCS.PX_PER_CM });
CCS.defType({
  type: 'duct', name: 'Wiring duct (slotted)', cat: 'Panel & wiring', w: c => ductDims(c).L, h: c => ductDims(c).W, ductLayer: c => (c.props.cover ? 'cover' : 'floor'),
  info: 'Slotted PVC wiring duct (trunking) with snap-on cover, e.g. 25×25, 25×40, 40×40, 40×60, 60×60 mm. Wires leave the duct through the slots between the fingers to reach each terminal.\nSet length, width and depth in cm. Rotate it (R) for vertical runs. Ducts that touch or cross form one network.\nWith "Route new wires through ducts" ticked in the toolbar, every new wire is laid automatically: straight into the nearest duct, along the connected ducts, out at the duct point nearest its target — each wire in its own lane so wires do not overlap. "Route all wires" tidies existing wires.\nCover on = wires hidden inside (finished panel). Cover off = see the wires in their lanes.\nRule of thumb: fill a duct to at most ~60 % of its cross-section.',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'W1' }, { key: 'length', label: 'Length (cm)', type: 'number', def: 40, min: 5, max: 300, step: 1 },
    { key: 'width', label: 'Width (cm)', type: 'number', def: 2.5, min: 1, max: 15, step: 0.5 }, { key: 'depth', label: 'Depth (cm)', type: 'number', def: 4, min: 1, max: 15, step: 0.5 },
    { key: 'cover', label: 'Cover fitted', type: 'check', def: true }, { key: 'color', label: 'Colour', type: 'select', options: ['grey', 'light grey'], def: 'grey' }],
  terms: () => [],
  draw(c) {
    const { L, W } = ductDims(c), col = c.props.color === 'light grey' ? ['#d9dcdf', '#b9bec3', '#eef0f2'] : ['#9aa0a6', '#7b8188', '#b4b9be'];
    const fd = Math.min(12, Math.max(5, W * 0.24)), pitch = 12, fw = 7;
    let s = `<g filter="url(#fShadow)"><rect width="${L}" height="${W}" rx="2" fill="${col[1]}" stroke="#555b62"/></g>`;
    if (!c.props.cover) {
      s += `<rect x="2" y="${fd}" width="${L - 4}" height="${W - 2 * fd}" fill="#3c4249" opacity=".75"/>`;
      for (let x = 30; x < L - 10; x += 60) s += `<circle cx="${x}" cy="${W / 2}" r="${Math.min(3, W / 10)}" fill="#22272c"/>`;
    }
    for (let x = 2; x + fw <= L - 2; x += pitch) s += `<rect x="${x}" y="0" width="${fw}" height="${fd}" fill="${col[0]}" stroke="#0003"/><rect x="${x}" y="${W - fd}" width="${fw}" height="${fd}" fill="${col[0]}" stroke="#0003"/>`;
    if (c.props.cover) s += `<rect x="1" y="${fd * 0.55}" width="${L - 2}" height="${W - fd * 1.1}" rx="2" fill="${col[2]}" stroke="#6b7177"/><rect x="1" y="${fd * 0.55}" width="${L - 2}" height="${(W - fd * 1.1) * 0.35}" rx="2" fill="#fff" opacity=".18"/>`;
    const lbl = `${c.props.tag} · ${Math.round(+c.props.width * 10)}×${Math.round(+c.props.depth * 10)} mm · ${(+c.props.length)} cm`;
    if (W >= 26 && L >= 160) s += `<text x="${L / 2}" y="${W / 2 + 4}" text-anchor="middle" font-size="${Math.min(12, W * 0.32)}" font-family="Arial" font-weight="700" fill="${c.props.cover ? '#3a4046' : '#d0d4d8'}" pointer-events="none">${D.e(lbl)}</text>`;
    return s;
  },
});
