#!/usr/bin/env python3
"""Browser tests for the simulator (Playwright + Chromium).

    pip install -r tests/requirements.txt
    python -m playwright install chromium
    python tests/test_simulator.py          # set CHROME_PATH to use a local Chrome instead

Each test drives the real page through the CCS namespace and checks the
physics (electrical + pneumatic), the circuit checker and file save/load.
"""
import asyncio
import os
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import build  # noqa: E402

# helper JS shared by the tests: load an example, step the simulation without the UI loop
PRELUDE = """
window.T = {
  load(i) { CCS.ui.loadJSON(CCS.examples[i].build()); CCS.sim.reset(); CCS.sim.running = true; CCS.sim.paused = true; },
  run(sec) { for (let t = 0; t < sec; t += CCS.sim.DT) CCS.sim.step(CCS.sim.DT); CCS.sim.collect(); },
  P(id) { return CCS.circuit.byId(id); },
  press(id, ph, a = 'btn') { const c = CCS.circuit.byId(id); CCS.types[c.type].act(c, a, ph); },
  wire(a, at, b, bt) { return CCS.circuit.addWire({ kind: 'wire', a: { c: a, t: at }, b: { c: b, t: bt }, color: '#111', pts: [] }); },
  find(a, at, b, bt) { return CCS.circuit.wires.find(w => (w.a.c === a && w.a.t === at && w.b.c === b && w.b.t === bt) || (w.b.c === a && w.b.t === at && w.a.c === b && w.a.t === bt)); },
};
"""

TESTS = {
    'all examples load and run without faults': """(() => { for (let i = 0; i < CCS.examples.length; i++) { T.load(i); T.run(0.3);
        const e = CCS.sim.faults.filter(f => f.level === 'error'); if (e.length) return 'example ' + i + ': ' + e[0].msg; } return true; })()""",
    'PSU powers a lamp through a push button': """(() => { T.load(0); T.run(0.2); if (!T.P('G1').st.on) return 'PSU off';
        T.press('S1', 'down'); T.run(0.1); if (!(T.P('H1').st.lit > 0.5)) return 'lamp not lit'; T.press('S1', 'up'); T.run(0.1); return T.P('H1').st.lit === 0 || 'lamp stays on'; })()""",
    'short on the 24 V output trips the PSU protection': """(() => { T.load(0); T.run(0.1); T.wire('G1', '+V1', 'G1', '-V1'); T.run(0.2); return (!T.P('G1').st.on && T.P('G1').st.olp > 0) || 'no protection'; })()""",
    'mains short trips the MCB, not the building breaker': """(() => { T.load(0); T.wire('Q1', '2', 'Q1', '4'); T.run(0.05); return (T.P('Q1').st.trip && !T.P('mains').st.trip) || 'wrong breaker'; })()""",
    '24 V lamp on 230 V burns out': """(() => { T.load(0); T.wire('Q1', '2', 'H1', 'X1'); T.wire('Q1', '4', 'H1', 'X2'); T.run(0.4); return T.P('H1').st.burnt || 'lamp survived'; })()""",
    'bench supply limits current on a short': """(() => { const C = CCS.circuit; C.clear(); const b = CCS.newPart('bench', 0, 0); C.add(b); T.wire(b.id, '+', b.id, '-');
        CCS.sim.reset(); CCS.sim.running = true; CCS.sim.paused = true; T.run(0.2); return (b.st.cc && Math.abs(b.st.i - 3) < 0.05) || ('I = ' + b.st.i); })()""",
    'self-holding latch: START latches, STOP releases': """(() => { T.load(1); T.run(0.1); if (T.P('K1').st.on) return 'on at start';
        T.press('S1', 'down'); T.run(0.05); T.press('S1', 'up'); T.run(0.1); if (!T.P('K1').st.on) return 'did not latch';
        T.press('S0', 'down'); T.run(0.05); T.press('S0', 'up'); T.run(0.1); return !T.P('K1').st.on || 'did not release'; })()""",
    '220 V AC relay coil does not pull in on 24 V DC': """(() => { T.load(1); T.P('K1').props.coil = '220VAC'; T.press('S1', 'down'); T.run(0.2); return !T.P('K1').st.on || 'pulled in'; })()""",
    'single-solenoid valve extends and retracts the cylinder': """(() => { T.load(2); T.run(0.1); T.press('S1', 'down'); T.run(0.8); if (T.P('A1').st.pos < 0.99) return 'not extended';
        T.press('S1', 'up'); T.run(0.8); return T.P('A1').st.pos < 0.01 || 'not retracted'; })()""",
    'pilot valve does not shift without air': """(() => { T.load(2); T.P('air').st.on = false; T.press('S1', 'down'); T.run(0.5); return T.P('V1').st.pos === 0 || 'shifted'; })()""",
    'automatic A+ A- cycles and stops at a0': """(() => { T.load(3); T.run(0.1); T.press('S1', 'down'); T.run(0.05); T.press('S1', 'up');
        let ext = false, back = false; for (let k = 0; k < 400; k++) { T.run(0.01); const p = T.P('A1').st.pos; if (p > 0.99) ext = true; if (ext && p < 0.01) back = true; }
        if (!ext || !back) return 'no full cycle'; T.press('S0', 'down'); T.run(0.05); T.press('S0', 'up'); T.run(2);
        return (T.P('A1').st.pos < 0.02 && !T.P('K1').st.on) || 'did not stop retracted'; })()""",
    'ON-delay timer switches after its time': """(() => { T.load(4); T.run(0.1); T.press('B1', 'down', 'obj'); T.run(1.0); if (T.P('H1').st.lit) return 'too early'; T.run(1.2); return T.P('H1').st.lit > 0.5 || 'never switched'; })()""",
    'circuit check: correct circuit has no errors': """(() => { T.load(3); const F = CCS.doctor.run(); const e = F.filter(f => f.level !== 'info'); return !e.length || e[0].title; })()""",
    'circuit check: coil with both ends on + is reported': """(() => { T.load(1); T.find('K1', '14', 'X2', 'b1').b = { c: 'X1', t: 'b4' };
        return CCS.doctor.run().some(f => f.level === 'error' && /can never be energised/.test(f.title)) || 'not found'; })()""",
    'circuit check: missing valve supply tube is reported': """(() => { T.load(3); const C = CCS.circuit; C.removeWire(C.wires.find(w => w.kind === 'tube' && (w.a.t === 'p1' || w.b.t === 'p1')).id);
        return CCS.doctor.run().some(f => /port 1 \\(supply\\) has no tube/.test(f.title)) || 'not found'; })()""",
    'circuit file round-trip (.ccs and stand-alone .html)': """(() => { T.load(3); const txt = JSON.stringify(CCS.circuit.toJSON()); const html = CCS.ui.standaloneHTML();
        const a = CCS.ui.parseCircuitFile(txt), b = CCS.ui.parseCircuitFile(html);
        return (a.parts.length === CCS.circuit.parts.length && b.parts.length === a.parts.length && b.wires.length === a.wires.length) || 'mismatch'; })()""",
    'wires are routed through connected ducts': """(() => { T.load(1); const C = CCS.circuit; C.wires.forEach(w => (w.pts = []));
        const d1 = CCS.newPart('duct', 190, 178, { length: 36, width: 2 }), d2 = CCS.newPart('duct', 190, 520, { length: 36, width: 2 }), d3 = CCS.newPart('duct', 0, 0, { length: 20, width: 2 });
        d3.rot = 90; [d1, d2, d3].forEach(d => C.add(d)); const s = CCS.size(d3); d3.x = 200 - s.w / 2; d3.y = 398 - s.h / 2;
        const n = CCS.ducts.routeWires(true); return n === C.wires.filter(w => w.kind === 'wire').length || ('routed ' + n); })()""",
}


async def main() -> int:
    page_path = build.build()
    failures = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None)
        page = await browser.new_page(viewport={'width': 1500, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(page_path.as_uri())
        await page.wait_for_timeout(400)
        await page.evaluate(PRELUDE)
        for name, js in TESTS.items():
            try:
                res = await page.evaluate(js)
            except Exception as exc:  # noqa: BLE001
                res = f'exception: {exc}'
            ok = res is True
            failures += 0 if ok else 1
            print(f"{'PASS' if ok else 'FAIL'}  {name}" + ('' if ok else f'  ->  {res}'))
        # the example circuit files in examples/ must open
        for f in sorted((ROOT / 'examples').glob('*.ccs')):
            n = await page.evaluate("t => { CCS.ui.loadJSON(CCS.ui.parseCircuitFile(t)); return CCS.circuit.parts.length; }", f.read_text(encoding='utf-8'))
            ok = n > 0
            failures += 0 if ok else 1
            print(f"{'PASS' if ok else 'FAIL'}  example file opens: {f.name}")
        if errors:
            failures += 1
            print('FAIL  page errors:', errors[:3])
        await browser.close()
    print(f'\n{failures} failure(s)' if failures else '\nall tests passed')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
