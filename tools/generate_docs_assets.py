#!/usr/bin/env python3
"""Regenerate documentation assets from the real simulator.

  * examples/*.ccs        — the built-in example circuits as circuit files
  * docs/PARTS.md         — parts reference generated from the part definitions
  * docs/images/*.png     — screenshots used in the README and the user guide

Run after changing parts or examples:
    pip install -r tests/requirements.txt && python -m playwright install chromium
    python tools/generate_docs_assets.py
"""
import asyncio
import json
import os
import pathlib
import re
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import build  # noqa: E402


def slug(text: str) -> str:
    text = text.replace('+', ' plus ').replace('−', ' minus ')
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def gh_anchor(heading: str) -> str:
    """anchor GitHub generates for a markdown heading"""
    return re.sub(r'[^\w\- ]', '', heading.lower()).replace(' ', '-')


async def main() -> None:
    page_path = build.build()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None)
        page = await browser.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=1)
        await page.goto(page_path.as_uri())
        await page.wait_for_timeout(500)

        # ---- example circuit files -------------------------------------------------
        examples = await page.evaluate("""CCS.examples.map(e => ({ name: e.name, desc: e.desc, data: e.build() }))""")
        (ROOT / 'examples').mkdir(exist_ok=True)
        for old in (ROOT / 'examples').glob('*.ccs'):
            old.unlink()
        for ex in examples:
            name = slug(re.sub(r'^\d+\s*·\s*', '', ex['name']))
            num = ex['name'].split('·')[0].strip()
            data = dict(ex['data'], name=ex['name'])
            (ROOT / 'examples' / f'{int(num):02d}-{name}.ccs').write_text(json.dumps(data, indent=1), encoding='utf-8')

        # ---- parts reference ---------------------------------------------------------
        parts = await page.evaluate("""(() => {
          const out = [];
          CCS.catOrder.forEach(cat => Object.values(CCS.types).filter(T => T.cat === cat).forEach(T => {
            const c = CCS.newPart(T.type);
            out.push({ cat, name: T.name, type: T.type, info: T.info || '',
              props: T.props.map(p => ({ label: p.label, options: p.options || null, def: p.def, min: p.min, max: p.max })),
              terms: CCS.termsOf(c).map(t => ({ id: t.id === '14b' ? '14' : t.id, k: t.k, d: t.d || '' })) });
          }));
          (CCS.variants || []).forEach(v => out.push({ cat: v.cat, name: v.name, type: v.type, variantOf: CCS.types[v.type].name, props: [], terms: [], info: '' }));
          return out;
        })()""")
        lines = ['# Parts reference', '',
                 '> Generated from the part definitions by `tools/generate_docs_assets.py` — do not edit by hand.', '',
                 'Every part is modelled on a real component. Terminal numbers are the ones printed on the real part, so a circuit',
                 'built here can be wired on the bench terminal-for-terminal.', '']
        cats = []
        for prt in parts:
            if prt['cat'] not in cats:
                cats.append(prt['cat'])
        lines.append('## Contents')
        lines.append('')
        for cat in cats:
            lines.append(f'- [{cat}](#{gh_anchor(cat)})')
        for cat in cats:
            lines += ['', f'## {cat}', '']
            for prt in [x for x in parts if x['cat'] == cat]:
                lines.append(f'### {prt["name"]}')
                lines.append('')
                if prt.get('variantOf'):
                    lines.append(f'Palette shortcut for **{prt["variantOf"]}** with a different preset type.')
                    lines.append('')
                    continue
                for para in prt['info'].split('\n'):
                    if para.strip():
                        lines.append(para.strip() + '  ')
                lines.append('')
                if prt['props']:
                    lines.append('| Setting | Options / range | Default |')
                    lines.append('|---|---|---|')
                    for pr in prt['props']:
                        rng = ', '.join(pr['options']) if pr['options'] else (f'{pr["min"]} – {pr["max"]}' if pr['min'] is not None else '')
                        lines.append(f'| {pr["label"]} | {rng} | {pr["def"]} |')
                    lines.append('')
                if prt['terms']:
                    seen, rows = set(), []
                    for t in prt['terms']:
                        key = (t['id'], t['d'])
                        if key in seen:
                            continue
                        seen.add(key)
                        rows.append(f'| `{t["id"]}` | {"air port" if t["k"] == "p" else "electrical"} | {t["d"]} |')
                    lines.append('| Terminal | Kind | Meaning |')
                    lines.append('|---|---|---|')
                    lines += rows
                    lines.append('')
        (ROOT / 'docs' / 'PARTS.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

        # ---- screenshots ----------------------------------------------------------------
        img = ROOT / 'docs' / 'images'
        img.mkdir(parents=True, exist_ok=True)

        async def shot(name: str) -> None:
            await page.wait_for_timeout(400)
            await page.evaluate("document.getElementById('hint').classList.remove('show')")
            await page.screenshot(path=str(img / f'{name}.png'))

        # 1. hero: automatic A+/A- cycle running
        await page.evaluate("CCS.ui.loadJSON(CCS.examples[3].build())")
        await page.wait_for_timeout(300)
        await page.evaluate("""(() => { CCS.ui.cmds.run(); const s = CCS.circuit.byId('S1');
          CCS.types.pushbutton.act(s, 'btn', 'down'); setTimeout(() => CCS.types.pushbutton.act(s, 'btn', 'up'), 200); })()""")
        await page.wait_for_timeout(900)
        await shot('hero')
        await page.evaluate("CCS.ui.cmds.reset()")

        # 2. circuit check finding a wrong relay pole
        await page.evaluate("""(() => { CCS.ui.loadJSON(CCS.examples[1].build()); const C = CCS.circuit;
          const w = C.wires.find(w => w.a.c === 'H1' && w.a.t === 'X2'); w.b = { c: 'X1', t: 'b4' }; })()""")
        await page.evaluate("CCS.ui.cmds.run()")
        await page.wait_for_timeout(800)
        await page.evaluate("CCS.ui.doctorDialog(true)")
        await shot('circuit-check')
        await page.keyboard.press('Escape')
        await page.evaluate("CCS.ui.cmds.reset()")

        # 3. wiring ducts (cover on / off)
        await page.evaluate("""(() => {
          CCS.ui.loadJSON(CCS.examples[1].build()); const C = CCS.circuit;
          C.byId('K1').y = 270; C.byId('X1').y = 230; C.byId('X2').y = 440; C.wires.forEach(w => (w.pts = []));
          const d1 = CCS.newPart('duct', 190, 178, { tag: 'W1', length: 36, width: 2 });
          const d2 = CCS.newPart('duct', 0, 0, { tag: 'W2', length: 20, width: 2 }); d2.rot = 90;
          const d3 = CCS.newPart('duct', 190, 520, { tag: 'W3', length: 36, width: 2 });
          [d1, d2, d3].forEach(d => C.add(d));
          const s = CCS.size(d2); d2.x = 200 - s.w / 2; d2.y = 398 - s.h / 2;
          CCS.ducts.routeWires(true); CCS.history.commit(); CCS.view.fit(); })()""")
        await shot('ducts-cover-on')
        await page.evaluate("CCS.circuit.parts.filter(p => p.type === 'duct').forEach(d => (d.props.cover = false)); CCS.circuit.touch()")
        await shot('ducts-cover-off')

        # 4. multimeter + properties on the latch example
        await page.evaluate("CCS.ui.loadJSON(CCS.examples[1].build())")
        await page.evaluate("""(() => { CCS.ui.cmds.run(); CCS.ui.setTool('meter'); CCS.ui.meter.red = 'G2:+'; CCS.ui.meter.black = 'G2:-'; CCS.ui.select(['K1']); })()""")
        await shot('multimeter')
        await page.evaluate("CCS.ui.setTool('select'); CCS.ui.cmds.reset()")

        # 5. power path with breaker + PSU
        await page.evaluate("CCS.ui.loadJSON(CCS.examples[0].build())")
        await page.evaluate("CCS.ui.cmds.run()")
        await page.evaluate("""(() => { const s = CCS.circuit.byId('S1'); CCS.types.pushbutton.act(s, 'btn', 'down'); })()""")
        await shot('power-path')
        await browser.close()
    print('examples, docs/PARTS.md and docs/images/*.png regenerated')


if __name__ == '__main__':
    asyncio.run(main())
