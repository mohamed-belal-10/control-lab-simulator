# Changelog

## 1.1.0 — select, group and align

- **Rectangle select:** left-drag on empty board; every part the rectangle touches is selected live. On release the rectangle becomes a fixed-size selection frame that travels with the parts. <kbd>Shift</kbd> adds to the selection, <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all.
- **Move together:** grab any selected part or anywhere inside the dotted selection frame. The whole selection moves by one common offset, so spacing and alignment are kept; <kbd>Alt</kbd> drags without grid snapping.
- **Panning** moved to right-drag / middle-drag (mouse wheel still zooms).
- **Groups:** <kbd>Ctrl</kbd>+<kbd>G</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>. A group selects, moves, rotates (about its centre) and duplicates as one unit; <kbd>Alt</kbd>+click picks a single member. Groups are saved in circuit files.
- **Align** (left, centre, right, top, middle, bottom) and **distribute** (horizontal, vertical) for parts and groups, from the properties panel.
- Arrow keys nudge the selection (5 mm, <kbd>Shift</kbd> = 1 mm).

## 1.0.0 — first public release

### Parts
- Power & protection: 230 V mains (TN-S), 2-pole C-curve MCB, 24 V 50 W switching PSU, adjustable bench supply, DIN terminal strip with plug-in bridge (2–16 ways)
- Command and signalling: 22 mm push buttons (NO / NC / NO+NC, momentary or latching), emergency stop, selector switch, LED pilot lamps, buzzer
- Relays: MY4 relay on a 14-pin socket with relay pin numbering (4 3 2 1 / 8 7 6 5 / 12 11 10 9 / 14 14 13), timer relay (ON/OFF delay), contactor 3P + 1NO 1NC, 230 V motor
- Sensors: 3-wire photoelectric / inductive / capacitive (PNP/NPN, NO/NC), reed switches that mount on cylinders, roller limit switch
- Pneumatics: air supply, filter-regulator, manifold, T-fitting, 5/2 single and double solenoid valves, 3/2 valve, double- and single-acting cylinders, one-way flow control, silencer, plug, gauge
- Panel: slotted wiring ducts sized in cm, with cover on or off

### Simulation
- AC/DC nodal-analysis solver with breaker, PSU and bench-supply protection, coil burn-out and pull-in thresholds, contact welding, wire overload
- Pneumatic solver with pressurised, exhausted, trapped and leaking states, pilot pressure, spool response time and meter-in/meter-out speed control
- Installation rules: 2 wires per screw terminal, 1 tube per push-in port

### Tools
- 🩺 Circuit Check: traces each load to the supply, reports the wrong connection with its fix and highlights it; "waiting for" list; Trace with AI in claude.ai
- Multimeter (V DC/AC, Ω/continuity), automatic duct routing with lanes, parts and wire list
- Circuit files: `.ccs` and stand-alone `.html`; undo/redo; restore last work
- Five example circuits, tutorial video, browser test suite, GitHub Pages deployment
