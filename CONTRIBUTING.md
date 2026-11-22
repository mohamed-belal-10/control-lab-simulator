# Contributing

Thanks for helping make Control Lab closer to the real bench. This page explains how to set up, how a part is defined, and what to check before opening a pull request.

## Setup

```bash
git clone https://github.com/mohamed-belal-10/control-lab-simulator.git
cd control-lab-simulator
python build.py                       # → dist/index.html, open it in a browser
pip install -r tests/requirements.txt # for the tests and doc tools
python -m playwright install chromium
```

There is no framework and no package manager. Edit `src/`, run `python build.py`, and reload `dist/index.html`.

## Adding a part

1. Choose the file by category, or create a new `src/js/2x-parts-*.js`. Files load in name order, after `10-catalog-core.js` and before `30-elec.js`.
2. Register the part:

```js
CCS.defType({
  type: 'lamp', name: 'Pilot lamp 22 mm (LED)', cat: 'Signalling', w: 66, h: 104,
  info: 'Real part, model examples and how it is wired (shown in the properties panel).',
  props: [{ key: 'tag', label: 'Tag', type: 'text', def: 'H1' },
          { key: 'color', label: 'Colour', type: 'select', options: ['green', 'red'], def: 'green' }],
  terms: () => [{ id: 'X1', x: 20, y: 88, k: 'e', d: 'Lamp terminal X1' },
                { id: 'X2', x: 46, y: 88, k: 'e', d: 'Lamp terminal X2' }],
  init(c) { c.st.lit = 0; },
  elec(c, N) { N.res(c, 'X1', 'X2', 1200, 'lamp'); },             // a 20 mA load
  step(c, dt, R, ctx) {
    const v = R.vd(c, 'X1', 'X2');                                  // {dc, ac}
    c.st.lit = Math.max(Math.abs(v.dc), v.ac) > 13 ? 1 : 0;
    if (v.ac > 34) ctx.fault(c, 'error', 'Over-voltage!');
  },
  draw(c) { return D.rect(5, 16, 56, 56, '#222') + D.screw(20, 88, 'X1', 'X1') + D.screw(46, 88, 'X2', 'X2'); },
});
```

3. Follow these conventions:
   - **Terminal ids are the numbers printed on the real part** (`13`, `14`, `A1`, `BN`, `p1` …), and `d` says what each one does.
   - Draw terminals with `D.screw()` (screw clamp), `D.lead()` (cable core) or `D.port()` (push-in air fitting), so they become wiring hot-spots.
   - Use `N.sw()` for every contact, even an open one. The Circuit Check traces through it.
   - Use `ctx.fault(c, 'error'|'warn'|'info', message)`. Write messages as advice: say what is wrong and what to do.
   - Use `CCS.coil.eval()` / `CCS.coil.burnCheck()` / `CCS.armature()` for anything with a coil.
   - For a coil, add its rating to `loadSpec()` in `55-doctor.js` so the Circuit Check knows the voltage it needs. Add a `whyOpen()` case for a new switching part.
   - Put the real model number and datasheet values in `info`.
4. To offer a preset of an existing part in the palette (e.g. *Capacitive sensor* is the 3-wire sensor with another type), add it to `CCS.variants`.
5. Run `python tools/generate_docs_assets.py` to refresh `docs/PARTS.md`.

## Code style

- Plain ES2020, no dependencies, 2-space indentation, single quotes.
- Each module starts with a comment block that says what it does.
- Keep physics in `step` / `pstep` and appearance in `draw`.
- Don't use browser `alert/confirm/prompt`; use `CCS.dialog`. Wrap `localStorage` in `try/catch`.

## Before a pull request

```bash
for f in src/js/*.js; do node --check "$f"; done   # syntax
python tests/test_simulator.py                      # 17 browser tests must pass
python tools/generate_docs_assets.py                # if parts, examples or the UI changed
```

Add a test to `tests/test_simulator.py` for new behaviour. Each test is a JavaScript snippet that returns `true` or a failure message. Note the change in `CHANGELOG.md`.

## Reporting a problem

Use the issue templates: **Bug report** (attach the `.ccs` circuit) or **New part request** (attach a datasheet or shop link).
