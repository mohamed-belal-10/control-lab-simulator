# User guide

This guide walks through every tool in Control Lab. For a 2½-minute visual tour, watch **[the tutorial video](media/tutorial.mp4)**.

- [The screen](#the-screen)
- [Placing parts](#placing-parts)
- [Groups, align and distribute](#groups-align-and-distribute)
- [Wiring and tubing](#wiring-and-tubing)
- [Setting up parts](#setting-up-parts)
- [Running the circuit](#running-the-circuit)
- [Circuit Check](#circuit-check)
- [Trace with AI](#trace-with-ai)
- [Multimeter](#multimeter)
- [Wiring ducts](#wiring-ducts)
- [Terminal strips with bridges](#terminal-strips-with-bridges)
- [Reed switches and limit switches](#reed-switches-and-limit-switches)
- [Faults and how to read them](#faults-and-how-to-read-them)
- [Saving, opening and sharing](#saving-opening-and-sharing)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Wiring conventions used](#wiring-conventions-used)
- [Worked example: start/stop latch](#worked-example-startstop-latch)

---

## The screen

| Area | Purpose |
|---|---|
| **Toolbar** (top) | New, Open, Save, Examples, Parts list, 🩺 Check · undo/redo/rotate/duplicate/delete · Edit / Multimeter tool · wire colour · ▶ Run, ■ Reset, speed, *flow* (animate current), *via ducts* (auto-route wires) · **?** help |
| **Parts library** (left) | All parts by category, with a search box. Drag a part onto the board, or click it to drop it in the middle. |
| **Board** (centre) | Left-drag on empty space to select, right-drag (or middle-drag) to pan, use the mouse wheel to zoom, and press <kbd>F</kbd> to fit everything on screen. The 🩺 chip appears top-left after **Run**. |
| **Properties** (right) | Settings for the selected part or wire, live readings, real wiring notes and a terminal list. With nothing selected, it shows the fault list and quick-start tips. |
| **Status bar** (bottom) | Simulation state, supply voltage and current, and the error/warning count. |

## Placing parts

- **Drag** a part from the library onto the board. Parts snap to a 10 px grid.
- **Search**: type e.g. `relay`, `duct` or `capacitive` to filter the library.
- **Select**: click a part. <kbd>Shift</kbd>+click adds to the selection. <kbd>Ctrl</kbd>+<kbd>A</kbd> selects everything.
- **Rectangle select**: hold the left button on empty board and drag a rectangle. Every part the rectangle touches is selected while you drag. Hold <kbd>Shift</kbd> when you start to add to the current selection.
- **Fixed selection frame**: when you release the button, the rectangle stays on the board as a dotted frame with a **fixed size**. It does not resize; it only travels with the parts when you move them.
- **Move together**: drag any selected part, or grab **anywhere inside the selection frame** (the cursor changes to ✥), and everything selected moves as one. The spacing between the parts never changes; the part you grab lands on the grid. Hold <kbd>Alt</kbd> while dragging to move freely without grid snapping. Wires that run between moved parts keep their bends. A plain click inside the frame deselects.
- **Nudge**: arrow keys move the selection one grid step (5 mm); <kbd>Shift</kbd>+arrow moves 1 mm.
- **Pan**: right-drag or middle-drag. Zoom with the mouse wheel.
- **Rotate** <kbd>R</kbd> · **Duplicate** <kbd>Ctrl</kbd>+<kbd>D</kbd> · **Delete** <kbd>Del</kbd> · **Undo / Redo** <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd>.
- Tags (K1, S1, H1 …) are numbered automatically and can be changed in the properties.

## Groups, align and distribute

- **Group** (<kbd>Ctrl</kbd>+<kbd>G</kbd> or the **▣ Group** button): the selected parts become one unit, shown with a purple *GROUP* outline. Clicking any member selects the whole group, so it moves, rotates and duplicates together. Groups are saved in the circuit file.
- **Rotate a group** (<kbd>R</kbd>): the group turns 90° about its own centre, keeping its layout.
- **Pick one member**: <kbd>Alt</kbd>+click a part inside a group to select only that part. **⬚ Leave group** in its properties takes it out of the group.
- **Ungroup** (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> or **⬚ Ungroup**).
- **Duplicate a group**: the copy becomes a new group of its own, with its internal wires copied.
- **Align** (right panel, with two or more units selected): left edges · centres · right edges · top edges · middles · bottom edges. Alignment uses the edges of the whole selection. **A group counts as one unit**, so it moves as a block and its inside layout is kept.
- **Distribute** (three or more units): equal gaps horizontally or vertically. The two outermost units stay where they are.
- Reed switches clamped on a cylinder always follow their cylinder and are never moved on their own.

## Wiring and tubing

- **Wire:** click a **screw terminal**, then another terminal. To add bends, click empty space on the way. You can also drag from one terminal and release on another. <kbd>Esc</kbd> or right-click cancels.
- **Tube:** start from a **blue push-in port**. Electrical terminals and air ports cannot be connected to each other.
- **Colour:** with **Auto** (the rainbow swatch), wires take the IEC colour from the terminal they start at (L brown, N light blue, PE green-yellow, +V red, −V dark blue). Pick a swatch to force a colour. Selecting a wire and clicking a swatch recolours it.
- **Edit a wire:** click it to see its route, current, cross-section and approximate length. Double-click the wire to add a bend, drag the white handles to move bends, and double-click a handle to remove it.
- **Limits that match the hardware:** a screw clamp takes at most **2 wires**, and a push-in fitting takes **exactly 1 tube**. Use a terminal strip or a T-fitting to branch.

## Setting up parts

Click a part to see its settings in the properties panel. For example:

| Part | Typical settings |
|---|---|
| Relay MY4 | Coil 220 V AC / 24 V AC / 24 V DC / 12 V DC, model MY4 or MY4N (LED) |
| Push button | Colour, contacts NO / NC / NO+NC, momentary or latching, legend text |
| Pilot lamp | Colour, 24 V AC/DC or 230 V AC |
| 3-wire sensor | Photoelectric / inductive / capacitive, PNP or NPN, NO or NC |
| Valves | Coil voltage, solenoid names (Y1, Y2) |
| Cylinder | Bore, stroke, maximum speed |
| Wiring duct | Length, width, depth (cm), cover, colour |

Under the settings you will find the **live readings** (coil voltage, energised, position, pressure …), the **real part and wiring notes** (what the real component is and how it is wired) and the **terminal list** with the meaning of every terminal.

## Running the circuit

- **▶ Run** or <kbd>Space</kbd> energises everything. Press it again to pause. **■ Reset** returns every part to its initial state: breakers on, cylinders retracted, burnt parts replaced.
- **Interact** while running:
  - Push buttons work while held, and latching buttons and selector switches toggle.
  - The E-stop latches; click it again to release it.
  - Click the dashed zone in front of a sensor to place or remove an object.
  - The yellow buttons on a valve are its manual overrides.
  - A contactor's grey plunger operates it by hand.
- **Flow animation:** glowing wires carry current. White dashes show its direction, and AC wires oscillate. Pressurised tubes are bright blue.
- **Speed:** 0.25× to 2×.

## Circuit Check

Runs automatically when you press **Run**, and any time from **🩺 Check**.

1. The chip on the board shows the result: **red** = errors, **orange** = warnings, **green** = the wiring is sound.
2. Open it to see each finding. Every finding names the terminals involved and gives the exact fix.
3. Click a finding: the board zooms to the part and the wrong terminals pulse.
4. Fix the wiring. The check re-runs on every edit, so you can watch the chip turn green.

The section **“What each load is waiting for”** answers the question *“it is wired correctly, why doesn't it move?”* It lists, for each coil and lamp, which contacts are still open and why: *S1 is not pressed*, *K1 is not energised*, *the piston magnet is not under reed a0*.

How it works: every load is traced back to the + and − of every supply through wires and contacts, using a shortest-path search that counts how many contacts must still close. The checks are listed in the [README](../README.md#circuit-check-finding-wiring-mistakes).

## Trace with AI

Inside the Circuit Check window, **Trace with AI** sends Claude a description of the circuit: every part and its settings, every wire and tube terminal-to-terminal, the live states, the simulator's messages and the automatic findings. You can add what the circuit is supposed to do. Claude answers with a verdict, a numbered list of problems with exact fixes (*“move the wire from K2:9 to K2:10”*) and how the circuit works after the fix.

This button needs the claude.ai environment: it works when the simulator is opened from its claude.ai artifact link. On GitHub Pages and in the offline file, the automatic Circuit Check is still available.

## Multimeter

Choose **🔧 Multimeter** (<kbd>M</kbd>). Click a terminal for the **red** probe, then another for the **black** probe.

- **V mode** shows DC with sign, and AC as RMS. The circuit must be running.
- **Ω / continuity** measures with all sources removed, like a real meter on a de-energised panel. Examples: MY4 24 V DC coil ≈ 650 Ω, a closed contact ≈ 0 Ω (beep), an open circuit shows O.L. Measuring Ω on a live circuit shows a warning.

## Wiring ducts

1. Drag **Wiring duct (slotted)** from *Panel & wiring*. Set **Length / Width / Depth in cm**. The board scale is 1 cm = 20 px; parts are drawn larger than life so they stay readable.
2. Rotate with <kbd>R</kbd> for vertical ducts. Ducts that touch, cross or butt end-to-end form one network.
3. With **via ducts** ticked in the toolbar, every new wire is laid automatically. It drops into the nearest duct, follows the shortest path through the network, and leaves at the point nearest its target terminal. Each wire gets its own lane, so wires don't overlap.
4. **Route all wires through ducts** (duct properties) tidies all existing wires. **Free all wires** releases them.
5. **Cover fitted** hides the wires inside (finished panel). Untick it to see the lanes.
6. Routed wires are re-laid automatically when you move a part or a duct. Editing a bend by hand frees that wire from the ducts.

## Terminal strips with bridges

**DIN terminal strip + bridge** is a row of feed-through terminals (2–16). Top and bottom of each terminal are connected. The orange plug-in **bridge** links neighbouring terminals, so **one incoming wire** (e.g. +24 V) gives you many outlets. Set the **bridge length** to bridge only the first N terminals, as with a real bridge cut to length. Use one strip for +24 V and one for 0 V.

## Reed switches and limit switches

- **Reed switch:** drag it **by its body onto a cylinder barrel** at the position it should detect. It clamps on and moves with the cylinder. It closes when the piston magnet passes within about 3 mm. Fine-tune the position in its properties: 0 = retracted, 1 = extended. It is rated 100 mA, so drive a relay, not a solenoid.
- **Roller limit switch:** link it to a cylinder in its properties (*Operated by*, *At cylinder end*), or click the roller to operate it by hand.

## Faults and how to read them

A **“!”** badge on a part shows a problem. Hover it to read it, or see the list in the properties panel when nothing is selected. Typical messages:

| Message | Meaning / what to do |
|---|---|
| *Q1 tripped: magnetic trip — SHORT CIRCUIT* | L and N (or PE) are joined somewhere. Fix the wiring, then click the breaker lever. |
| *OVERLOAD / SHORT on the 24 V output* | +V and −V are joined, or the load exceeds 3.3 A. |
| *Relay coil: over-voltage — coil is overheating* | The coil voltage is wrong (e.g. 24 V coil on 230 V). Fix it, then press **Repair**. |
| *Coil voltage … is below pull-in* | Less than 80 % of the rated voltage reaches the coil. |
| *Reed switch current … > 100 mA* | Use an interposing relay. |
| *Only … bar at port 1 — the pilot needs ≥ 1.5 bar* | Open the air supply or raise the regulator setting. |
| *n tubes on port …* | A push-in fitting takes one tube. Use a T-fitting. |
| *3 wires on terminal …* | Use a terminal strip instead of stacking wires. |

## Saving, opening and sharing

- **Save** (<kbd>Ctrl</kbd>+<kbd>S</kbd>): type a name, then either:
  - **Save circuit file (.ccs)**, the circuit only. Reopen it with **Open**.
  - **Save as stand-alone (.html)**, the simulator with your circuit embedded. Anyone can double-click it, with no website needed.
  - **Copy as text**, to paste into **Open → paste**.
- **Open** (<kbd>Ctrl</kbd>+<kbd>O</kbd>) accepts `.ccs`, circuit `.html` and older `.json` files.
- **Parts list** gives the parts with their specifications and tags, plus wire and tube lengths at the board scale. Copy it as CSV.
- The board is also kept in your browser. After reopening, use **Restore my last work** in the properties panel.

## Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Run / pause |
| <kbd>R</kbd> | Rotate selection |
| <kbd>Del</kbd> / <kbd>Backspace</kbd> | Delete selection or wire |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicate |
| <kbd>Ctrl</kbd>+<kbd>G</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> | Group / ungroup the selection |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | Select all |
| <kbd>Alt</kbd>+click | Select one part inside a group |
| Arrow keys | Nudge the selection 5 mm (<kbd>Shift</kbd> = 1 mm) |
| Left-drag on empty board | Rectangle select (live); the frame stays fixed after release |
| Drag inside the selection frame | Move the whole selection (<kbd>Alt</kbd> = no snapping) |
| Right-drag / middle-drag | Pan |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Undo / redo |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>O</kbd> | Save / open circuit |
| <kbd>M</kbd> / <kbd>S</kbd> | Multimeter / edit tool |
| <kbd>F</kbd> | Fit the circuit on screen |
| <kbd>Esc</kbd> | Cancel the wire being drawn, clear the selection, close dialogs |

## Wiring conventions used

- **Contacts (IEC 60947):** NO = 13-14 / 23-24, NC = 11-12 / 21-22. Timed contacts are 15-16-18 / 25-26-28. Contactor main poles are 1/L1–2/T1, 3/L2–4/T2, 5/L3–6/T3.
- **MY4 relay on PYF14A socket**, printed like the relay pins. Top view: `4 3 2 1` NC · `8 7 6 5` NO · `12 11 10 9` COM · `14 14 13` coil. Pole 1 = COM 9, NC 1, NO 5.
- **Sensors (IEC 60947-5-2):** BN brown +V, BU blue 0 V, BK black output.
- **Pneumatics (ISO 5599):** 1 supply, 2/4 outputs, 3/5 exhausts. Coil 14 pilots 1→4, coil 12 (or the spring) returns to 1→2.

## Worked example: start/stop latch

1. Place a **Bench DC supply**, two **terminal strips** (bridged, one red for +24 V and one blue for 0 V), a red **NC** push button *STOP*, a green **NO** push button *START*, a **Relay MY4** (set coil 24 V DC) and a **pilot lamp**.
2. Wire the bench `+` to the red strip and `−` to the blue strip.
3. Wire +24 V → STOP 11, STOP 12 → START 13, START 14 → K1:13, and K1:14 → 0 V.
4. Add the self-hold: STOP 12 → K1:9 (COM), K1:5 (NO) → K1:13.
5. Add the lamp: +24 V → K1:10, K1:6 → lamp X1, lamp X2 → 0 V.
6. **Run**. The chip should be green. Press START: K1 latches and the lamp lights. Press STOP to release it.

The finished circuit is *Examples → 2 · Self-holding relay*.
