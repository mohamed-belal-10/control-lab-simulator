# Parts reference

> Generated from the part definitions by `tools/generate_docs_assets.py` — do not edit by hand.

Every part is modelled on a real component. Terminal numbers are the ones printed on the real part, so a circuit
built here can be wired on the bench terminal-for-terminal.

## Contents

- [Power & protection](#power--protection)
- [Command devices](#command-devices)
- [Signalling](#signalling)
- [Relays & contactors](#relays--contactors)
- [Sensors](#sensors)
- [Loads](#loads)
- [Air supply](#air-supply)
- [Valves](#valves)
- [Actuators](#actuators)
- [Fittings](#fittings)
- [Panel & wiring](#panel--wiring)

## Power & protection

### Mains supply 230 V AC

Wall supply of a TN-S installation: L (brown), N (blue), PE (green-yellow). N is bonded to earth at the source, so touching L to PE or N trips the protection.  
The building has its own 80 A main breaker: a short circuit with no MCB in your panel trips it (reset by clicking the switch).  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | Mains |

| Terminal | Kind | Meaning |
|---|---|---|
| `L` | electrical | Line 230 V AC (brown) |
| `N` | electrical | Neutral (blue) |
| `PE` | electrical | Protective earth (green-yellow) |

### MCB 2-pole (C curve)

Miniature circuit breaker, 2-pole, C characteristic (e.g. C6/C10). Line in on 1, out on 2; neutral in 3, out 4.  
Magnetic trip: instantly above ~7× In (short circuit). Thermal trip: a few seconds to a minute at 1.5–3× In.  
Click the lever to switch ON/OFF or to reset after a trip.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | Q1 |
| Rating | 2, 4, 6, 10, 16, 20 | 6 |

| Terminal | Kind | Meaning |
|---|---|---|
| `1` | electrical | Pole 1 in (L) |
| `3` | electrical | Pole 2 in (N) |
| `2` | electrical | Pole 1 out (L) |
| `4` | electrical | Pole 2 out (N) |

### Power supply 24 V DC 50 W

Enclosed switching power supply (e.g. Mean Well LRS-50-24): input 85–264 V AC on L/N, FG to earth (PE).  
Output 24 V DC, 2.2 A; the two +V and the two −V screws are internally connected.  
Over-load protection: above ~150 % the output shuts down and retries (hiccup). AC on the output destroys it.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | G1 |
| Output (V.ADJ) | 21.6 – 28.8 | 24 |

| Terminal | Kind | Meaning |
|---|---|---|
| `L` | electrical | AC line in |
| `N` | electrical | AC neutral in |
| `FG` | electrical | Frame ground → PE |
| `-V1` | electrical | DC output −V (0 V) |
| `-V2` | electrical | DC output −V (0 V) |
| `+V1` | electrical | DC output +V (24 V) |
| `+V2` | electrical | DC output +V (24 V) |

### Bench DC supply (adjustable)

Laboratory DC supply with current limit. Handy for testing the 24 V side without mains wiring. In constant-current (CC) mode the voltage drops so that the current never exceeds the limit.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | G2 |
| Voltage (V) | 0 – 30 | 24 |
| Current limit (A) | 0.1 – 5 | 3 |

| Terminal | Kind | Meaning |
|---|---|---|
| `+` | electrical | Output + (red) |
| `-` | electrical | Output − (black) |

### DIN terminal strip + bridge

Feed-through DIN-rail terminals (e.g. UK2.5 / ST2.5 style), each with a top and a bottom wire entry that are connected inside the terminal.  
The orange plug-in bridge (jumper comb) in the middle row links neighbouring terminals, so ONE incoming wire (e.g. +24 V from the power supply) becomes many outlets: every bridged terminal gives 2 more connection points.  
Set the number of terminals and how many (from terminal 1) the bridge covers — real bridges are cut to length. Leave "Bridged" off to use the terminals as separate feed-throughs.  
A screw/spring entry takes 1–2 ferruled wires; never stack 3.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | X1 |
| Terminals | 2 – 16 | 10 |
| Bridge fitted |  | True |
| Bridge length (0 = all) | 0 – 16 | 0 |
| Colour | grey, blue, red, green-yellow | grey |

| Terminal | Kind | Meaning |
|---|---|---|
| `a1` | electrical | Terminal 1, top entry |
| `b1` | electrical | Terminal 1, bottom entry |
| `a2` | electrical | Terminal 2, top entry |
| `b2` | electrical | Terminal 2, bottom entry |
| `a3` | electrical | Terminal 3, top entry |
| `b3` | electrical | Terminal 3, bottom entry |
| `a4` | electrical | Terminal 4, top entry |
| `b4` | electrical | Terminal 4, bottom entry |
| `a5` | electrical | Terminal 5, top entry |
| `b5` | electrical | Terminal 5, bottom entry |
| `a6` | electrical | Terminal 6, top entry |
| `b6` | electrical | Terminal 6, bottom entry |
| `a7` | electrical | Terminal 7, top entry |
| `b7` | electrical | Terminal 7, bottom entry |
| `a8` | electrical | Terminal 8, top entry |
| `b8` | electrical | Terminal 8, bottom entry |
| `a9` | electrical | Terminal 9, top entry |
| `b9` | electrical | Terminal 9, bottom entry |
| `a10` | electrical | Terminal 10, top entry |
| `b10` | electrical | Terminal 10, bottom entry |


## Command devices

### Push button 22 mm

22 mm panel push button with screw-clamp contact blocks (e.g. Schneider XB2/XB5, LA38 series).  
Green NO block: 13-14 (closes when pressed). Red NC block: 11-12 or 21-22 (opens when pressed). Contacts rated ~10 A.  
Press with the mouse — momentary buttons spring back on release; latching ones toggle.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | S1 |
| Colour | green, red, black, yellow, blue, white | green |
| Contacts | NO, NC, NO+NC | NO |
| Action | momentary, latching | momentary |
| Legend |  | START |

| Terminal | Kind | Meaning |
|---|---|---|
| `13` | electrical | NO contact 13-14 |
| `14` | electrical | NO contact 13-14 |

### Emergency stop (mushroom)

Emergency-stop push button, Ø40 red mushroom on a yellow plate, latching (push to stop, twist/click again to release). Uses an NC block 11-12 so that a broken wire also stops the machine (fail-safe).  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | S0 |
| Contacts | NC, NO+NC | NC |

| Terminal | Kind | Meaning |
|---|---|---|
| `11` | electrical | NC contact 11-12 |
| `12` | electrical | NC contact 11-12 |

### Selector switch 2-position

22 mm maintained selector switch (0 – I). Contacts change when turned to I and stay there. Click the handle to turn it.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | S3 |
| Contacts | NO, NC, NO+NC | NO |
| Legend |  | AUTO |

| Terminal | Kind | Meaning |
|---|---|---|
| `13` | electrical | NO contact 13-14 |
| `14` | electrical | NO contact 13-14 |


## Signalling

### Pilot lamp 22 mm (LED)

LED indicator lamp (e.g. AD16-22DS). Terminals X1/X2, works on AC or DC of its rated voltage (~20 mA). A 24 V lamp on 230 V burns out instantly.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | H1 |
| Colour | green, red, yellow, blue, white | green |
| Rated voltage | 24V AC/DC, 230V AC | 24V AC/DC |

| Terminal | Kind | Meaning |
|---|---|---|
| `X1` | electrical | Lamp terminal X1 |
| `X2` | electrical | Lamp terminal X2 |

### Buzzer 22 mm

Panel buzzer (e.g. AD16-22SM), 24 V AC/DC, ~85 dB. Terminals X1/X2.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | H9 |

| Terminal | Kind | Meaning |
|---|---|---|
| `X1` | electrical | X1 |
| `X2` | electrical | X2 |


## Relays & contactors

### Relay MY4 14-pin + base socket

Control relay MY4 with 14-pin base socket, as sold by Derhali (GENROON MY4, coil 12 V DC / 24 V AC / 24 V DC / 220 V AC). Same pin-out as Omron MY4 on a PYF14A-type socket.  
4 change-over contacts (4PDT), ~5 A each.  
Socket terminals are numbered like the relay pins (top view: 4 3 2 1 / 8 7 6 5 / 12 11 10 9 / 14 14 13).  
Pole 1: COM 9, NC 1, NO 5 · pole 2: COM 10, NC 2, NO 6 · pole 3: COM 11, NC 3, NO 7 · pole 4: COM 12, NC 4, NO 8.  
Coil: 13 and 14 (both screws marked 14 are the same terminal).  
Pull-in ≥ 80 % of the rated coil voltage, drop-out < 30 %.  
Coil current ≈ 10 mA at 220 V AC, ≈ 37 mA at 24 V DC.  
Plain MY4 has no LED; choose MY4N for the version with an LED indicator.  
WATCH OUT: a 220 V AC coil cannot be switched by 24 V DC sensors or reed switches — for a 24 V DC control circuit order the 24 DC coil.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | K1 |
| Coil | 220VAC, 24VAC, 24VDC, 12VDC | 220VAC |
| Model | MY4 (no LED), MY4N (LED) | MY4 (no LED) |

| Terminal | Kind | Meaning |
|---|---|---|
| `1` | electrical | Pin 1 — NC contact, pole 1 (IEC 12) |
| `5` | electrical | Pin 5 — NO contact, pole 1 (IEC 14) |
| `9` | electrical | Pin 9 — COM, pole 1 (IEC 11) |
| `2` | electrical | Pin 2 — NC contact, pole 2 (IEC 22) |
| `6` | electrical | Pin 6 — NO contact, pole 2 (IEC 24) |
| `10` | electrical | Pin 10 — COM, pole 2 (IEC 21) |
| `3` | electrical | Pin 3 — NC contact, pole 3 (IEC 32) |
| `7` | electrical | Pin 7 — NO contact, pole 3 (IEC 34) |
| `11` | electrical | Pin 11 — COM, pole 3 (IEC 31) |
| `4` | electrical | Pin 4 — NC contact, pole 4 (IEC 42) |
| `8` | electrical | Pin 8 — NO contact, pole 4 (IEC 44) |
| `12` | electrical | Pin 12 — COM, pole 4 (IEC 41) |
| `14` | electrical | Pin 14 — coil (A2) |
| `14` | electrical | Pin 14 — coil (A2), second screw, internally joined |
| `13` | electrical | Pin 13 — coil (A1) |

### Timer relay (on/off delay)

Plug-in timer relay, 2 change-over timed contacts on an 8-pin socket (e.g. Omron H3Y-2 / H3CR family, socket PYF08A).  
Coil A1/A2. Timed contacts: COM 15/25 · NC 16/26 · NO 18/28 (IEC marking for time-delayed contacts).  
ON-delay: contacts change T seconds after the coil is energised, reset instantly when it drops.  
OFF-delay: contacts change instantly and return T seconds after the coil drops.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | KT1 |
| Function | ON-delay, OFF-delay | ON-delay |
| Time (s) | 0.1 – 600 | 2 |
| Coil | 24VDC, 220VAC | 24VDC |

| Terminal | Kind | Meaning |
|---|---|---|
| `18` | electrical | Timed NO, set 1 |
| `28` | electrical | Timed NO, set 2 |
| `16` | electrical | Timed NC, set 1 |
| `26` | electrical | Timed NC, set 2 |
| `15` | electrical | COM set 1 |
| `25` | electrical | COM set 2 |
| `A1` | electrical | Coil + |
| `A2` | electrical | Coil − |

### Contactor 3P + 1NO 1NC

Power contactor, 9 A AC-3 (e.g. Schneider LC1D09 / Chint NXC-09 style).  
Coil A1/A2 (typical 220–230 V AC; 24 V DC variants exist). Main poles 1/L1-2/T1, 3/L2-4/T2, 5/L3-6/T3. Auxiliary NO 13-14 and NC 21-22.  
The grey test plunger operates the contacts by hand.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | KM1 |
| Coil | 220VAC, 24VDC | 220VAC |

| Terminal | Kind | Meaning |
|---|---|---|
| `A1` | electrical | Coil A1 |
| `1` | electrical | 1/L1 main pole in |
| `3` | electrical | 3/L2 main pole in |
| `5` | electrical | 5/L3 main pole in |
| `13` | electrical | Aux NO 13 |
| `21` | electrical | Aux NC 21 |
| `A2` | electrical | Coil A2 |
| `2` | electrical | 2/T1 main pole out |
| `4` | electrical | 4/T2 main pole out |
| `6` | electrical | 6/T3 main pole out |
| `14` | electrical | Aux NO 14 |
| `22` | electrical | Aux NC 22 |


## Sensors

### Photoelectric sensor M18 (3-wire)

DC 3-wire proximity sensor, 6–36 V DC, output max 200 mA (short-circuit protected).  
BN (brown) → +24 V, BU (blue) → 0 V, BK (black) → load (relay coil, PLC input).  
PNP: output switches +V to BK (load between BK and 0 V) — the usual choice for relay circuits.  
NPN: output switches BK to 0 V (load between +V and BK).  
NO = output ON when an object is detected; NC = output ON when nothing is detected.  
Types: photoelectric diffuse (sees objects by reflected light, e.g. E3F-DS30P1 PNP NO / P2 PNP NC), inductive (metal only, a few mm, e.g. LJ12A3-4-Z/BY), capacitive (any material — plastic, wood, glass, liquids — 1–10 mm, sensitivity screw on the back, e.g. LJC18A3-H-Z/BY).  
Click the dashed zone in front of the lens to place / remove an object.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | B1 |
| Type | Photoelectric diffuse M18, Inductive M12, Capacitive M18 | Photoelectric diffuse M18 |
| Output | PNP NO, PNP NC, NPN NO, NPN NC | PNP NO |

| Terminal | Kind | Meaning |
|---|---|---|
| `BN` | electrical | Brown: +V supply (6–36 V DC) |
| `BK` | electrical | Black: switching output (max 200 mA) |
| `BU` | electrical | Blue: 0 V |

### Reed switch (cylinder)

Magnetic reed switch for slot/tie-rod mounting on a magnetic-piston cylinder (e.g. Airtac CS1-U / CS1-J), 2-wire, 5–240 V, max 100 mA, with LED.  
Drag it by its body onto a cylinder barrel to clamp it there (drop it at the end position you want). It closes when the piston magnet passes underneath.  
BN = brown (+), BU = blue (to the load). Max 100 mA: drive a relay coil, not a solenoid valve.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | a0 |
| Mounted on |  |  |
| Position (0=retracted, 1=extended) | 0 – 1 | 0 |

| Terminal | Kind | Meaning |
|---|---|---|
| `BN` | electrical | Brown (+) |
| `BU` | electrical | Blue (load side) |

### Roller limit switch

Roller-lever limit switch with a snap-action change-over contact (e.g. Omron D4MC / TZ-8108 style), 5 A.  
COM-NO closes and COM-NC opens when the roller is pushed.  
Link it to a cylinder (properties) to make the rod cam operate it at the chosen end, or click the roller to operate it by hand.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | S2 |
| Operated by |  |  |
| At cylinder end | extended, retracted | extended |

| Terminal | Kind | Meaning |
|---|---|---|
| `COM` | electrical | Common |
| `NO` | electrical | Normally open |
| `NC` | electrical | Normally closed |

### Capacitive sensor M18 (3-wire)

Palette shortcut for **Photoelectric sensor M18 (3-wire)** with a different preset type.

### Inductive sensor M12 (3-wire)

Palette shortcut for **Photoelectric sensor M18 (3-wire)** with a different preset type.


## Loads

### AC motor / fan 230 V

Single-phase 230 V AC fan motor, ~60 W (≈0.26 A). Terminals L, N and PE in the terminal box. Typically switched by a contactor's main poles, not by a 24 V relay contact directly.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | M1 |

| Terminal | Kind | Meaning |
|---|---|---|
| `L` | electrical | Line |
| `N` | electrical | Neutral |
| `PE` | electrical | Earth |


## Air supply

### Compressed air supply

Compressor / workshop air line. Click the switch to open or close the supply. Typical lab pressure is 6 bar.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 0Z1 |
| Pressure (bar) | 1 – 10 | 6 |

| Terminal | Kind | Meaning |
|---|---|---|
| `out` | air port | Air outlet |

### Service unit (filter-regulator)

Filter-regulator with gauge (e.g. Airtac AFR/AFC2000): IN on the left, regulated OUT on the right. Set the working pressure in the properties.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 0Z2 |
| Set pressure (bar) | 0 – 10 | 6 |

| Terminal | Kind | Meaning |
|---|---|---|
| `in` | air port | Air in (from supply) |
| `out` | air port | Regulated air out |


## Valves

### 5/2 valve, single solenoid

5/2 valve, single solenoid (e.g. Airtac 4V210-08 / 4V110-06), internally piloted: it needs at least 1.5 bar at port 1 to shift.  
Ports (ISO 5599): 1 = supply, 4 / 2 = to the cylinder, 5 / 3 = exhaust (fit silencers).  
Each coil has a DIN 43650 plug: terminals 1 and 2 (+ earth). Coil 24 V DC ≈ 3 W (125 mA) — too much for a reed switch or sensor output, use a relay contact.  
Spring return: the valve goes back as soon as the coil is de-energised (mono-stable).  
The yellow buttons are the manual overrides.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 1V1 |
| Coil | 24VDC, 12VDC, 220VAC | 24VDC |
| Coil names |  | Y1 |

| Terminal | Kind | Meaning |
|---|---|---|
| `c14a` | electrical | Solenoid coil 14 (pilots 1→4), pin 1 |
| `c14b` | electrical | Solenoid coil 14 (pilots 1→4), pin 2 |
| `p4` | air port | Output A — port 4 |
| `p2` | air port | Output B — port 2 |
| `p5` | air port | Exhaust — port 5 |
| `p1` | air port | Supply (P) — port 1 |
| `p3` | air port | Exhaust — port 3 |

### 5/2 valve, double solenoid

5/2 valve, double solenoid (e.g. Airtac 4V220-08 / 4V120-06), internally piloted: it needs at least 1.5 bar at port 1 to shift.  
Ports (ISO 5599): 1 = supply, 4 / 2 = to the cylinder, 5 / 3 = exhaust (fit silencers).  
Each coil has a DIN 43650 plug: terminals 1 and 2 (+ earth). Coil 24 V DC ≈ 3 W (125 mA) — too much for a reed switch or sensor output, use a relay contact.  
Double solenoid = memory (bi-stable): the valve stays where the last pulse put it. Never energise both coils together.  
The yellow buttons are the manual overrides.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 1V1 |
| Coil | 24VDC, 12VDC, 220VAC | 24VDC |
| Coil names |  | Y1,Y2 |

| Terminal | Kind | Meaning |
|---|---|---|
| `c14a` | electrical | Solenoid coil 14 (pilots 1→4), pin 1 |
| `c14b` | electrical | Solenoid coil 14 (pilots 1→4), pin 2 |
| `c12a` | electrical | Solenoid coil 12 (pilots 1→2), pin 1 |
| `c12b` | electrical | Solenoid coil 12 (pilots 1→2), pin 2 |
| `p4` | air port | Output A — port 4 |
| `p2` | air port | Output B — port 2 |
| `p5` | air port | Exhaust — port 5 |
| `p1` | air port | Supply (P) — port 1 |
| `p3` | air port | Exhaust — port 3 |

### 3/2 valve NC, single solenoid

3/2 valve NC, single solenoid (e.g. Airtac 3V210-08 NC), internally piloted: it needs at least 1.5 bar at port 1 to shift.  
Ports (ISO 5599): 1 = supply, 2 = to the cylinder, 3 = exhaust (fit silencers).  
Each coil has a DIN 43650 plug: terminals 1 and 2 (+ earth). Coil 24 V DC ≈ 3 W (125 mA) — too much for a reed switch or sensor output, use a relay contact.  
Spring return: the valve goes back as soon as the coil is de-energised (mono-stable).  
The yellow buttons are the manual overrides.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 1V2 |
| Coil | 24VDC, 12VDC, 220VAC | 24VDC |
| Coil names |  | Y1 |

| Terminal | Kind | Meaning |
|---|---|---|
| `c12a` | electrical | Solenoid coil 12 (pilots 1→2), pin 1 |
| `c12b` | electrical | Solenoid coil 12 (pilots 1→2), pin 2 |
| `p2` | air port | Output B — port 2 |
| `p1` | air port | Supply (P) — port 1 |
| `p3` | air port | Exhaust — port 3 |


## Actuators

### Double-acting cylinder (magnetic)

Double-acting pneumatic cylinder with magnetic piston (e.g. Airtac SC / MAL / SDA series). Air on the cap port extends the rod; air on the rod port retracts it.  
The magnet ring (orange) lets reed switches detect the piston. Drag reed switches onto the barrel to mount them.  
Force ≈ p × piston area (e.g. Ø32 at 6 bar ≈ 480 N extending).  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 1A1 |
| Bore (mm) | 16, 20, 25, 32, 40, 50, 63 | 32 |
| Stroke (mm) | 25, 50, 75, 100, 125, 150, 200, 250 | 100 |
| Max speed (mm/s) | 20 – 1000 | 250 |

| Terminal | Kind | Meaning |
|---|---|---|
| `cap` | air port | Cap-end port (air in → extends) |
| `rod` | air port | Rod-end port (air in → retracts) |

### Single-acting cylinder (spring return)

Single-acting cylinder, spring return (e.g. Airtac MSAL). Air on port 1 extends the rod; when the port is exhausted the spring pushes it back. Drive it with a 3/2 valve.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 2A1 |
| Bore (mm) | 16, 20, 25, 32, 40, 50, 63 | 32 |
| Stroke (mm) | 25, 50, 75, 100, 125, 150, 200, 250 | 100 |
| Max speed (mm/s) | 20 – 1000 | 250 |

| Terminal | Kind | Meaning |
|---|---|---|
| `cap` | air port | Working port (extends the rod) |


## Fittings

### T push-in fitting

Union T push-in fitting (e.g. PE-6 / PE-8). One push-in port takes exactly one tube — use a T to split a line.  

| Terminal | Kind | Meaning |
|---|---|---|
| `a` | air port | Port |
| `b` | air port | Port |
| `c` | air port | Port |

### Distribution manifold 1→4

Aluminium distribution block: IN on the left, four outlets on top. Unused outlets are assumed to be plugged.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 0Z3 |

| Terminal | Kind | Meaning |
|---|---|---|
| `in` | air port | Inlet |
| `o1` | air port | Outlet 1 |
| `o2` | air port | Outlet 2 |
| `o3` | air port | Outlet 3 |
| `o4` | air port | Outlet 4 |

### One-way flow control (speed)

Inline one-way flow control valve (e.g. Airtac ASC). Air flows freely in the arrow direction (IN→OUT) and is throttled the other way.  
For meter-out speed control (recommended) put it between valve and cylinder with the free-flow arrow pointing TO the cylinder.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | 1V3 |
| Opening (%) | 3 – 100 | 40 |

| Terminal | Kind | Meaning |
|---|---|---|
| `in` | air port | IN (free-flow inlet) |
| `out` | air port | OUT (free-flow outlet) |

### Silencer (exhaust)

Sintered-bronze exhaust silencer (e.g. BSL-1/8). Connect it to the 3 and 5 ports of a valve. Without one the valve still exhausts, only louder.  

| Terminal | Kind | Meaning |
|---|---|---|
| `p` | air port | Threaded port |

### Blanking plug

Blanking plug: closes an unused port (e.g. turns a 5/2 valve into a 3/2).  

| Terminal | Kind | Meaning |
|---|---|---|
| `p` | air port | Closed port |

### Pressure gauge

Bourdon-tube pressure gauge 0–10 bar. Connect it with a T-fitting into any line to see its pressure.  

| Terminal | Kind | Meaning |
|---|---|---|
| `p` | air port | Gauge port |


## Panel & wiring

### Wiring duct (slotted)

Slotted PVC wiring duct (trunking) with snap-on cover, e.g. 25×25, 25×40, 40×40, 40×60, 60×60 mm. Wires leave the duct through the slots between the fingers to reach each terminal.  
Set length, width and depth in cm. Rotate it (R) for vertical runs. Ducts that touch or cross form one network.  
With "Route new wires through ducts" ticked in the toolbar, every new wire is laid automatically: straight into the nearest duct, along the connected ducts, out at the duct point nearest its target — each wire in its own lane so wires do not overlap. "Route all wires" tidies existing wires.  
Cover on = wires hidden inside (finished panel). Cover off = see the wires in their lanes.  
Rule of thumb: fill a duct to at most ~60 % of its cross-section.  

| Setting | Options / range | Default |
|---|---|---|
| Tag |  | W1 |
| Length (cm) | 5 – 300 | 40 |
| Width (cm) | 1 – 15 | 2.5 |
| Depth (cm) | 1 – 15 | 4 |
| Cover fitted |  | True |
| Colour | grey, light grey | grey |

