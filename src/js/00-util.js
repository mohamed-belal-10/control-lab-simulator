'use strict';
/* =========================================================================
 * Control Lab — real-parts electro-pneumatic circuit simulator
 * Module 00: namespace + small utilities
 * ========================================================================= */
const CCS = (window.CCS = {});

CCS.util = (() => {
  let seq = 1;
  const U = {
    uid(prefix = 'p') { return prefix + (Date.now() % 1e6).toString(36) + (seq++).toString(36); },
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    /** rotate point (x,y) about (cx,cy) by deg (multiples of 90 are exact) */
    rot(x, y, cx, cy, deg) {
      const d = ((deg % 360) + 360) % 360;
      const dx = x - cx, dy = y - cy;
      if (d === 0) return [x, y];
      if (d === 90) return [cx - dy, cy + dx];
      if (d === 180) return [cx - dx, cy - dy];
      if (d === 270) return [cx + dy, cy - dx];
      const r = d * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      return [cx + dx * c - dy * s, cy + dx * s + dy * c];
    },
    fmt(v, unit, digits = 3) {
      if (v === undefined || v === null || !isFinite(v)) return '—';
      const a = Math.abs(v);
      let s, u = unit;
      if (a !== 0 && a < 1e-3) { s = (v * 1e6).toPrecision(digits); u = 'µ' + unit; }
      else if (a !== 0 && a < 1) { s = (v * 1e3).toPrecision(digits); u = 'm' + unit; }
      else if (a >= 1e6) { s = (v / 1e6).toPrecision(digits); u = 'M' + unit; }
      else if (a >= 1e4) { s = (v / 1e3).toPrecision(digits); u = 'k' + unit; }
      else s = v.toPrecision(digits);
      return (+s).toString() + ' ' + u;
    },
    deep: o => JSON.parse(JSON.stringify(o)),
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]),
  };
  return U;
})();

/* ---------- tiny modal dialog (alert/confirm/prompt are blocked in sandboxes) ---------- */
CCS.dialog = (() => {
  const $ = id => document.getElementById(id);
  function close() { $('modal').classList.add('hidden'); $('modalBody').innerHTML = ''; }
  function open({ title, html, buttons = [{ label: 'Close', primary: true }], onOpen }) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    const bw = $('modalBtns'); bw.innerHTML = '';
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'mbtn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      el.onclick = () => { const keep = b.onClick && b.onClick() === false; if (!keep) close(); };
      bw.appendChild(el);
    });
    $('modal').classList.remove('hidden');
    if (onOpen) onOpen($('modalBody'));
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('modalX').onclick = close;
    $('modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') close(); });
  });
  return { open, close,
    confirm(title, msg, onYes) { open({ title, html: `<p>${msg}</p>`, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: onYes }] }); },
  };
})();
