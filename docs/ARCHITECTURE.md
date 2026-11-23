# Architecture

Control Lab is a single page with no framework, no build dependencies and no server. The source lives in `src/` as an HTML shell, one stylesheet and a set of JavaScript modules that share one namespace, `window.CCS`. `build.py` concatenates the modules in file-name order and inlines everything into `dist/index.html`.

```
src/js/00-util.js         CCS namespace, helpers, modal dialog
src/js/01-shell.js        copy of the page shell (filled in by build.py)
src/js/10-catalog-core.js part registry, terminal geometry, SVG drawing helpers, gradients
src/js/20…25-parts-*.js   part definitions
src/js/30-elec.js         electrical solver
src/js/31-pneu.js         pneumatic solver
src/js/40-circuit.js      circuit model, attachments, serialisation, undo
src/js/42-arrange.js      groups, align / distribute, group rotation (selection "units")
src/js/45-ducts.js        duct routing
src/js/50-sim.js          simulation loop, installation checks
src/js/55-doctor.js       Circuit Check
src/js/60-render.js       SVG renderer, view (pan/zoom)
src/js/70-ui.js           editor, properties, multimeter, dialogs, files
src/js/80-examples.js     example circuits
src/js/99-main.js         boot and animation loop
```

## Part model

A part type is registered with `CCS.defType(definition)`:

| Field | Purpose |
|---|---|
| `type`, `name`, `cat`, `info` | identity, palette category, real-part notes shown in the properties panel |
| `w`, `h` | size in board pixels (number, or a function of the instance, e.g. cylinder stroke, duct length) |
| `props` | editable settings `{key, label, type: text/number/select/check/range/cyl, def, options, min, max, step}` |
| `terms(c)` | terminals `{id, x, y, k: 'e' or 'p', d: description, free: 'vent'/'atm'/'leak'/'closed'}` in local coordinates |
| `init(c)` | sets the runtime state `c.st` |
| `elec(c, N)` | adds electrical elements to the netlist (see below) |
| `sense(c, R)` | fast state changes that need an immediate re-solve (breakers, sensor outputs, supply on/off); returns `true` if something changed |
| `step(c, dt, R, ctx)` | time-based behaviour (relay timing, timers, burn-out, thermal trips) and fault reporting via `ctx.fault(c, level, msg)` |
| `pneu(c, P)` / `pstep(c, dt, PR, ctx)` | pneumatic connections and motion |
| `draw(c)` | returns an SVG string in local coordinates; terminals use `D.screw()` / `D.lead()` / `D.port()` so the editor can wire to them |
| `act(c, name, phase)` | clickable zones marked `data-act="name"` in the SVG (`phase` = `down`/`up`) |

A part instance is `{id, type, x, y, rot, props, st}`. Rotation is in 90° steps. `CCS.termPos(c, id)` gives the world position of a terminal.

## Electrical solver (`30-elec.js`)

**Netlist.** Each step builds a netlist:

- `N.res(c, a, b, ohms, name)` adds a load: coil, lamp, sensor self-consumption, PSU input.
- `N.sw(c, a, b, closed, name)` adds a contact. A closed contact is a 3 mΩ resistor. Every switch, open or closed, is also recorded in `N.sws` for the Circuit Check.
- `N.join(c, a, b)` is an internal bus (0.1 mΩ). `N.gnd(c, a)` bonds a terminal to earth, as at the mains source.
- `N.src(c, p, n, volts, 'AC'|'DC', rint, name)` adds a source with internal resistance.
- Every wire is a 1 mΩ resistor, so wire currents are known.

**Solving.** This is modified nodal analysis without extra unknowns: sources are stamped as their Norton equivalents (current V/Rint in parallel with Rint). Every node has a 100 MΩ leak to ground, so floating networks (an isolated 24 V side) stay solvable. The matrix is LU-factorised once with partial pivoting and then solved twice: once with only the AC sources active and once with only the DC sources (superposition). A 24 V DC coil fed from 230 V AC is therefore detected for what it is.

**Iteration.** `sense()` may change a state, for example a magnetic trip, a sensor output turning on or the PSU starting up. The step then re-solves, up to 12 times, until nothing changes. Results are cached by a netlist signature (element keys, values and source internal resistances), so an unchanged circuit is not re-solved.

**Protection models.**

| Device | How it trips or limits |
|---|---|
| MCB | Magnetic trip above 7 × In; thermal integral of (I/In)² − 1 |
| Mains | 80 A building breaker that trips only if the fault persists for 3 solver passes, so a downstream MCB acts first |
| PSU | Over-load protection above 150 % with a 0.8 s hiccup |
| Bench supply | Constant-current mode |

## Pneumatic solver (`31-pneu.js`)

1. Ports joined by tubes, and fittings that join ports internally, are merged into nodes (union-find).
2. Parts add `source`, `reg` (one-way regulator), `path` (open valve passage), `fc` (one-way flow control with a throttle factor) and `vent` (silencer/exhaust) connections.
3. Pressure is relaxed through the graph. Unconnected ports follow their `free` rule:
   - `vent`: an exhaust port
   - `atm`: a cylinder port open to atmosphere
   - `leak`: air blows out, which is reported as a fault
   - `closed`
4. Each node becomes **P**ressurised, **E**xhausted, **T**rapped (keeps the last pressure) or **L**eaking.
5. Cylinders move when one side is pressurised and the other can exhaust. Speed = v_max · √(p/6 bar) · the smallest throttle factor on the supply and exhaust paths (`pathFactor`), so meter-in and meter-out both work.

Valves need at least 1.5 bar at port 1 to shift (internal pilot) and have a 30 ms spool response. Reed switches are attached to a cylinder (`props.attach`, `props.pos`), follow its geometry on screen, and close when the piston magnet is within ±3 mm.

## Simulation loop (`50-sim.js`)

Each fixed 5 ms step, scaled by the speed setting:

1. electrical solve and iteration
2. `step()` for every part
3. pneumatic solve
4. `pstep()` (motion)
5. reed and limit switch update
6. installation checks: wires per screw terminal, tubes per push-in port, wire current against cross-section

Rendering runs on `requestAnimationFrame`, independently of the simulation.

## Circuit Check (`55-doctor.js`)

- **Nets:** wires, joins and earth bonds are merged with union-find. Contacts become edges between nets, with weight 0 if closed and 1 if open.
- **Supplies** are recognised by part type (mains L/N, PSU +V/−V, bench +/−). Their poles are found even when the simulation is stopped.
- For every **load** element, a 0-1 BFS finds the route from each supply pole to each load terminal that needs the fewest open contacts. The best supply and orientation give:
  - **unreachable:** a diagnosis of which side is missing, which pole each end reaches, and whether two separate supplies are involved
  - **reachable:** checks of supply type and voltage against the rated values, and sensor polarity
  - **reachable through open contacts:** a "waiting for" entry, which names each open contact and why it is open (`whyOpen`)
- **Shorts:** a path from + to − through contacts only, with no load in between.
- **Contacts:** a wired contact terminal whose partners are all unwired (e.g. a NO pin with an empty COM).
- **Pneumatics:** tube connectivity, valve supply, cylinder port tubing, exhausts.
- `describe()` writes a compact text description (parts, terminal meanings, wires, tubes, states, findings) that **Trace with AI** sends to Claude through the claude.ai artifact `sample` capability, when that capability is available.

## Duct routing (`45-ducts.js`)

Each duct is an axis-aligned centre line with a half-width. Ducts are joined at crossings, T-junctions and corners (within their half-widths) and when collinear ducts butt end to end. A wire is routed as follows:

1. Each terminal is projected onto its nearest duct.
2. Dijkstra finds the shortest path between the two projections along the duct network.
3. The path is offset by a per-wire **lane** across the duct width, so parallel wires don't overlap.
4. Straight legs connect each terminal to the duct.

Wires marked `routed` are re-laid on every edit, so they follow parts and ducts when these move.

## Rendering (`60-render.js`)

The board is one SVG with these layers:

| Layer | Contents |
|---|---|
| `layerFloor` | ducts without cover |
| `layerParts` | parts |
| `layerTop` | reed switches mounted on cylinders |
| `layerWires` | wires and tubes |
| `layerCover` | ducts with cover |
| `layerOverlay` | selection, badges, highlights, probes, the wire being drawn |

Each part's SVG string is cached and the DOM is only updated when the string changes. Wires are smooth curves (no bends) or polylines with rounded corners. Current flow is a dashed overlay whose offset follows the sign of the current.

## Circuit file format

A `.ccs` file is UTF-8 JSON:

```json
{
  "app": "ControlLab-EP-Simulator",
  "version": 2,
  "name": "my-circuit",
  "parts": [ { "id": "K1", "type": "relay4", "x": 460, "y": 200, "rot": 0, "props": { "tag": "K1", "coil": "24VDC" } } ],
  "wires": [ { "id": "w1", "kind": "wire", "a": { "c": "S1", "t": "14" }, "b": { "c": "K1", "t": "13" },
               "color": "#d32f2f", "gauge": "0.75", "pts": [[387, 425], [580, 425]], "routed": false } ]
}
```

- `kind` is `wire` or `tube`. `pts` are bend points in board coordinates. `routed` marks wires laid through ducts.
- **Version 1** files used IEC numbers on the relay socket (11/12/14, A1/A2). They are converted to pin numbers when loaded.
- A stand-alone `.html` circuit file is the full simulator with the JSON embedded in `<script id="ccs-circuit" type="application/json">`. **Open** reads the last such block.
