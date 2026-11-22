/* =========================================================================
 * Module 99: boot + main loop
 * ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  CCS.render.init();
  CCS.ui.init();
  let loaded = false;
  const emb = document.getElementById('ccs-circuit');
  if (emb) { try { CCS.circuit.load(JSON.parse(emb.textContent)); loaded = true; } catch (e) { console.error(e); } }
  // the simulator always opens on a clear canvas; the last work can be restored from the side panel
  if (!loaded) try {
    const s = localStorage.getItem('ccs.autosave.v1');
    if (s) { const j = JSON.parse(s); if (j.parts && j.parts.length) CCS.ui.lastSession = s; }
  } catch (e) { /* no storage or bad data */ }
  CCS.history.reset();
  CCS.sim.idleCheck();
  CCS.attach.syncAll();
  setTimeout(() => CCS.view.fit(), 50);
  let last = performance.now();
  const loop = now => {
    const dt = (now - last) / 1000; last = now;
    try { CCS.sim.frame(dt); } catch (e) { console.error(e); CCS.sim.running = false; CCS.ui.hint('Simulation error: ' + e.message, 5000); }
    try { CCS.render.frame(); } catch (e) { console.error(e); }
    try { CCS.ui.frame(); } catch (e) { console.error(e); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => CCS.view.apply());
});
