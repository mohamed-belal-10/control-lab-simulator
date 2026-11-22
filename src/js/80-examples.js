/* =========================================================================
 * Module 80: example circuits (generic training circuits, not tied to a project)
 * ========================================================================= */
CCS.examples = (() => {
  const RED = '#d32f2f', BLU = '#1a237e', BRN = '#795548', LBL = '#4fc3f7', GY = 'gy', BLK = '#111111';
  function B() {
    const parts = [], wires = [];
    const api = {
      p(id, type, x, y, props = {}, rot = 0) { parts.push({ id, type, x, y, rot, props: Object.assign(CCS.newPart(type).props, props) }); return api; },
      w(a, at, b, bt, color = RED, pts = [], gauge = '0.75') { wires.push({ id: 'w' + wires.length, kind: 'wire', a: { c: a, t: at }, b: { c: b, t: bt }, color, gauge, pts }); return api; },
      t(a, at, b, bt, pts = []) { wires.push({ id: 't' + wires.length, kind: 'tube', a: { c: a, t: at }, b: { c: b, t: bt }, color: '#1e88e5', pts }); return api; },
      json: () => ({ app: 'ControlLab-EP-Simulator', version: 2, parts, wires }),
    };
    return api;
  }
  return [
    {
      name: '1 · Mains → MCB → 24 V power supply → lamp',
      desc: 'The complete power path of a control panel: 230 V wall supply, 2-pole C6 breaker, 24 V DC switching supply, push button and pilot lamp. Try shorting +V to −V and watch the supply protect itself.',
      build: () => B()
        .p('mains', 'mains', 40, 30).p('Q1', 'mcb', 60, 180, { tag: 'Q1', In: '6' }).p('G1', 'psu', 240, 180)
        .p('S1', 'pushbutton', 520, 40, { tag: 'S1', color: 'green', text: 'ON' }).p('H1', 'lamp', 640, 60, { tag: 'H1', color: 'green' })
        .w('mains', 'L', 'Q1', '1', BRN, [], '1.5').w('mains', 'N', 'Q1', '3', LBL, [], '1.5')
        .w('Q1', '2', 'G1', 'L', BRN, [], '1.5').w('Q1', '4', 'G1', 'N', LBL, [], '1.5').w('mains', 'PE', 'G1', 'FG', GY, [[190, 150], [190, 330], [330, 330]], '1.5')
        .w('G1', '+V2', 'S1', '13', RED).w('S1', '14', 'H1', 'X1', RED).w('H1', 'X2', 'G1', '-V2', BLU, [[686, 340], [384, 340]])
        .json(),
    },
    {
      name: '2 · Self-holding relay (START / STOP latch)',
      desc: 'Classic latching circuit: STOP (NC) in series, START (NO) in parallel with the relay\'s own NO contact 11-14. Green lamp shows RUN, red lamp shows STOP through the NC contact 31-32.',
      build: () => B()
        .p('G2', 'bench', 40, 40).p('X1', 'tblock', 40, 220, { tag: 'X1 +24V', color: 'red', bridged: true, ways: 4 }).p('X2', 'tblock', 40, 420, { tag: 'X2 0V', color: 'blue', bridged: true, ways: 4 })
        .p('S0', 'pushbutton', 240, 40, { tag: 'S0', color: 'red', contact: 'NC', text: 'STOP' }).p('S1', 'pushbutton', 340, 40, { tag: 'S1', color: 'green', contact: 'NO', text: 'START' })
        .p('K1', 'relay4', 460, 200, { tag: 'K1', coil: '24VDC' }).p('H1', 'lamp', 660, 60, { tag: 'H1', color: 'green' }).p('H2', 'lamp', 760, 60, { tag: 'H2', color: 'red' })
        .w('G2', '+', 'X1', 'a1', RED).w('G2', '-', 'X2', 'a1', BLU, [[180, 180], [180, 380], [62, 380]])
        .w('X1', 'b1', 'S0', '11', RED, [[62, 340], [210, 340], [210, 160], [269, 160]]).w('S0', '12', 'S1', '13', RED).w('S1', '14', 'K1', '13', RED)
        .w('S0', '12', 'K1', '9', RED).w('K1', '5', 'K1', '13', RED)
        .w('K1', '14', 'X2', 'b1', BLU)
        .w('X1', 'b2', 'K1', '10', RED).w('K1', '6', 'H1', 'X1', RED).w('H1', 'X2', 'X2', 'b2', BLU, [[706, 560], [90, 560]])
        .w('X1', 'b3', 'K1', '11', RED).w('K1', '3', 'H2', 'X1', RED).w('H2', 'X2', 'X2', 'b3', BLU, [[806, 580], [118, 580]])
        .json(),
    },
    {
      name: '3 · Direct cylinder control (5/2 single solenoid)',
      desc: 'Holding the push button energises solenoid Y1, the valve shifts 1→4 and the cylinder extends; releasing it lets the spring return the valve and the cylinder retracts. Close the air supply to see that a pilot valve cannot shift without air.',
      build: () => B()
        .p('G2', 'bench', 40, 40).p('S1', 'pushbutton', 240, 40, { tag: 'S1', text: 'A+' })
        .p('air', 'air', 40, 330).p('frl', 'frl', 230, 280).p('V1', 'v52s', 420, 300, { tag: '1V1', ytag: 'Y1' })
        .p('sil1', 'silencer', 470, 450).p('sil2', 'silencer', 600, 450).p('A1', 'cylDA', 420, 110, { tag: '1A1' })
        .w('G2', '+', 'S1', '13', RED).w('S1', '14', 'V1', 'c14a', RED, [[287, 250], [438, 250]]).w('V1', 'c14b', 'G2', '-', BLU, [[458, 450], [162, 450]])
        .t('air', 'out', 'frl', 'in').t('frl', 'out', 'V1', 'p1', [[360, 332], [360, 420], [554, 420]])
        .t('V1', 'p4', 'A1', 'cap', [[530, 260], [439, 260]]).t('V1', 'p2', 'A1', 'rod', [[578, 240], [561, 240]])
        .t('V1', 'p5', 'sil1', 'p').t('V1', 'p3', 'sil2', 'p')
        .json(),
    },
    {
      name: '4 · Automatic A+ A− with reed switches (relay control)',
      desc: 'START latches K1. Reed a0 (retracted) drives K2 and reed a1 (extended) drives K3 — interposing relays, because a reed switch is rated 100 mA and a solenoid needs ~125 mA. K1·K2 pulse Y1 (A+), K3 pulses Y2 (A−) on a double-solenoid (memory) valve. One-way flow controls give meter-out speed control. STOP lets the cylinder finish its return.',
      build: () => B()
        .p('G2', 'bench', 20, 20).p('X1', 'tblock', 20, 180, { tag: 'X1 +24V', color: 'red', bridged: true, ways: 4 }).p('X2', 'tblock', 20, 560, { tag: 'X2 0V', color: 'blue', bridged: true, ways: 4 })
        .p('S0', 'pushbutton', 200, 20, { tag: 'S0', color: 'red', contact: 'NC', text: 'STOP' }).p('S1', 'pushbutton', 290, 20, { tag: 'S1', color: 'green', text: 'START' })
        .p('H1', 'lamp', 390, 20, { tag: 'H1', color: 'green' })
        .p('K1', 'relay4', 200, 200, { tag: 'K1', coil: '24VDC' }).p('K2', 'relay4', 370, 200, { tag: 'K2', coil: '24VDC' }).p('K3', 'relay4', 540, 200, { tag: 'K3', coil: '24VDC' })
        .p('A1', 'cylDA', 720, 40, { tag: '1A1' })
        .p('a0', 'reed', 0, 0, { tag: 'a0', attach: 'A1', pos: 0 }).p('a1', 'reed', 0, 0, { tag: 'a1', attach: 'A1', pos: 1 })
        .p('fc1', 'flowctl', 700, 200, { tag: '1V2' }).p('fc2', 'flowctl', 850, 200, { tag: '1V3' })
        .p('V1', 'v52d', 700, 300, { tag: '1V1', ytag: 'Y1,Y2' })
        .p('sil1', 'silencer', 780, 450).p('sil2', 'silencer', 870, 450)
        .p('air', 'air', 400, 460).p('frl', 'frl', 580, 440)
        .w('G2', '+', 'X1', 'a1', RED).w('G2', '-', 'X2', 'a1', BLU, [[170, 140], [170, 540], [42, 540]])
        .w('X1', 'b1', 'S0', '11', RED, [[42, 300], [190, 300], [190, 140], [229, 140]]).w('S0', '12', 'S1', '13', RED)
        .w('S1', '14', 'K1', '13', RED).w('S0', '12', 'K1', '9', RED)
        .w('K1', '5', 'K1', '13', RED).w('K1', '14', 'X2', 'b1', BLU)
        .w('X1', 'a2', 'K1', '11', RED).w('K1', '7', 'H1', 'X1', RED).w('H1', 'X2', 'X2', 'a2', BLU, [[436, 150], [690, 150], [690, 540], [70, 540]])
        .w('X1', 'b2', 'a0', 'BN', RED, [[70, 310], [180, 310], [180, 170], [750, 170]]).w('a0', 'BU', 'K2', '13', RED).w('K2', '14', 'X2', 'b2', BLU)
        .w('X1', 'b3', 'a1', 'BN', RED, [[98, 320], [172, 320], [172, 165], [830, 165]]).w('a1', 'BU', 'K3', '13', RED).w('K3', '14', 'X2', 'b3', BLU)
        .w('X1', 'b4', 'K1', '10', RED).w('K1', '6', 'K2', '9', RED)
        .w('K2', '5', 'V1', 'c14a', RED).w('V1', 'c14b', 'X2', 'b4', BLU, [[738, 710], [126, 710]])
        .w('X1', 'a3', 'K3', '9', RED).w('K3', '5', 'V1', 'c12a', RED).w('V1', 'c12b', 'X2', 'a3', BLU, [[958, 720], [98, 720]])
        .t('air', 'out', 'frl', 'in').t('frl', 'out', 'V1', 'p1', [[710, 492], [710, 430], [838, 430]])
        .t('V1', 'p4', 'fc1', 'in', [[818, 280], [708, 280]]).t('fc1', 'out', 'A1', 'cap', [[790, 234], [790, 196], [739, 196]])
        .t('V1', 'p2', 'fc2', 'in').t('fc2', 'out', 'A1', 'rod', [[950, 234], [950, 40], [861, 40]])
        .t('V1', 'p5', 'sil1', 'p').t('V1', 'p3', 'sil2', 'p')
        .json(),
    },
    {
      name: '5 · Photoelectric sensor + ON-delay timer',
      desc: 'A PNP NO photoelectric sensor (brown +24 V, blue 0 V, black output) energises an ON-delay timer. When an object stays in front of the sensor for 2 s, the timed contact 15-18 lights the lamp. Click the dashed zone in front of the lens to place the object.',
      build: () => B()
        .p('G2', 'bench', 40, 40).p('X1', 'tblock', 40, 200, { tag: 'X1 +24V', color: 'red', bridged: true, ways: 4 }).p('X2', 'tblock', 40, 400, { tag: 'X2 0V', color: 'blue', bridged: true, ways: 4 })
        .p('B1', 'prox', 240, 40, { tag: 'B1' }).p('KT1', 'timer', 300, 180, { tag: 'KT1', T: 2 }).p('H1', 'lamp', 520, 60, { tag: 'H1', color: 'yellow' })
        .w('G2', '+', 'X1', 'a1', RED).w('G2', '-', 'X2', 'a1', BLU, [[200, 160], [200, 380], [62, 380]])
        .w('X1', 'b1', 'B1', 'BN', BRN, [[62, 330], [220, 330], [220, 120], [254, 120]]).w('B1', 'BU', 'X2', 'b1', LBL, [[298, 160], [230, 160], [230, 520], [62, 520]]).w('B1', 'BK', 'KT1', 'A1', BLK, [[276, 140], [290, 140], [290, 400], [340, 400]])
        .w('KT1', 'A2', 'X2', 'b2', BLU, [[390, 540], [90, 540]]).w('X1', 'b2', 'KT1', '15', RED, [[90, 340], [340, 340]])
        .w('KT1', '18', 'H1', 'X1', RED, [[340, 170], [540, 170]]).w('H1', 'X2', 'X2', 'b3', BLU, [[566, 560], [118, 560]])
        .json(),
    },
  ];
})();
