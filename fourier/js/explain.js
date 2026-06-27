// explain.js — Self-contained Canvas 2D animations for the "Explain" tab.
// Each animation is paused when its canvas scrolls out of view (IntersectionObserver).

const COL = {
  blue:  '#4a9eff',
  gold:  '#ffcb6b',
  teal:  '#67e8f9',
  pink:  '#f472b6',
  bg:    '#080b10',
  grid:  'rgba(255,255,255,0.05)',
  axis:  'rgba(255,255,255,0.12)',
  muted: '#64748b',
  text:  '#e2e8f0',
};

const TAU = Math.PI * 2;

/** Set up a high-DPI canvas; returns a context scaled to CSS pixels. */
function fitCanvas(canvas) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function drawAxis(ctx, x0, y, x1) {
  ctx.strokeStyle = COL.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function ringPath(ctx, cx, cy, r, color, alpha = 0.5) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// ── Section 1: rotating dot → sine wave ──────────────────────
function animSine(ctx, w, h, t) {
  const R = Math.min(h * 0.3, 60);
  const cx = R + 28;
  const cy = h / 2;
  const omega = 1.1;
  const ang = t * omega;
  const k = 0.045;

  drawAxis(ctx, cx, cy, w - 10);
  ringPath(ctx, cx, cy, R, COL.muted, 0.4);

  // amplitude arrow
  ctx.strokeStyle = COL.muted;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - R - 14, cy); ctx.lineTo(cx - R - 14, cy - R); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COL.muted;
  ctx.font = '10px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.save(); ctx.translate(cx - R - 22, cy - R / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('amplitude', 0, 0); ctx.restore();

  // rotating arm + dot
  const dx = cx + R * Math.cos(ang);
  const dy = cy - R * Math.sin(ang);
  ctx.strokeStyle = COL.blue; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
  dot(ctx, dx, dy, 4, COL.blue);

  // wave (history extends right)
  const x0 = cx + R + 6;
  ctx.beginPath();
  ctx.strokeStyle = COL.gold;
  ctx.lineWidth = 2;
  ctx.shadowColor = COL.gold; ctx.shadowBlur = 6;
  for (let x = x0; x < w - 8; x++) {
    const y = cy - R * Math.sin(ang - (x - x0) * k);
    if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // connector from dot to wave start
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(x0, cy - R * Math.sin(ang)); ctx.stroke();
  ctx.setLineDash([]);
}

// ── Section 2: two frequencies (1x and 2x) ───────────────────
function animFreq(ctx, w, h, t) {
  const rowH = h / 2;
  drawOne(rowH * 0.5, 1, COL.blue, 'A4  (1×)');
  drawOne(rowH * 1.5, 2, COL.gold, 'A5  (2×)');

  function drawOne(cy, mult, color, label) {
    const R = Math.min(rowH * 0.32, 34);
    const cx = R + 24;
    const ang = t * 1.1 * mult;
    const k = 0.045 * mult;

    drawAxis(ctx, cx, cy, w - 10);
    ringPath(ctx, cx, cy, R, COL.muted, 0.35);

    const dx = cx + R * Math.cos(ang);
    const dy = cy - R * Math.sin(ang);
    ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dx, dy); ctx.stroke();
    dot(ctx, dx, dy, 3.5, color);

    const x0 = cx + R + 6;
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    for (let x = x0; x < w - 8; x++) {
      const y = cy - R * Math.sin(ang - (x - x0) * k);
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // horizontal dotted connector from the dot to the wave start
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(x0, cy - R * Math.sin(ang)); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.font = '11px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, w - 86, cy - R - 2);
  }
}

// ── Section 3: adding two waves into a sum ───────────────────
function animAdd(ctx, w, h, t) {
  const cy = h / 2;
  const A = Math.min(h * 0.16, 26);
  const k1 = 0.03, k2 = 0.045;
  const x0 = 14, x1 = w - 14;

  drawAxis(ctx, x0, cy, x1);

  // component waves (faint)
  wave(k1, t, COL.blue, 0.5);
  wave(k2, t * 1.3, COL.teal, 0.5);

  // sum (gold, bold)
  ctx.beginPath();
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 2.2;
  ctx.shadowColor = COL.gold; ctx.shadowBlur = 6;
  for (let x = x0; x <= x1; x++) {
    const y = cy - (A * Math.sin((x - x0) * k1 + t) + A * Math.sin((x - x0) * k2 + t * 1.3));
    if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // moving cursor showing the sum height
  const cxn = x0 + ((t * 60) % (x1 - x0));
  const ysum = cy - (A * Math.sin((cxn - x0) * k1 + t) + A * Math.sin((cxn - x0) * k2 + t * 1.3));
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(cxn, cy); ctx.lineTo(cxn, ysum); ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, cxn, ysum, 4, '#fff');

  function wave(k, phase, color, alpha) {
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.globalAlpha = alpha;
    for (let x = x0; x <= x1; x++) {
      const y = cy - A * Math.sin((x - x0) * k + phase);
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ── Section 4 & 6: chained epicycles tracing a curve ─────────
const epiTrails = new WeakMap();
function animEpi(ctx, w, h, t, canvas) {
  const cx = w * 0.38;
  const cy = h / 2;
  // a few harmonics (freq, radius, phase)
  const base = Math.min(h * 0.22, 40);
  const circles = [
    { f: 1,  r: base,        ph: 0 },
    { f: 3,  r: base * 0.55, ph: 1.2 },
    { f: 5,  r: base * 0.33, ph: 0.4 },
    { f: 7,  r: base * 0.22, ph: 2.1 },
  ];

  let px = cx, py = cy;
  const w0 = 0.7;
  for (const c of circles) {
    const ang = t * w0 * c.f + c.ph;
    const nx = px + c.r * Math.cos(ang);
    const ny = py - c.r * Math.sin(ang);
    ringPath(ctx, px, py, c.r, COL.blue, 0.22);
    ctx.strokeStyle = 'rgba(74,158,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    dot(ctx, nx, ny, 2.5, COL.blue);
    px = nx; py = ny;
  }

  // trail buffer
  let trail = epiTrails.get(canvas);
  if (!trail) { trail = []; epiTrails.set(canvas, trail); }
  trail.push([px, py]);
  if (trail.length > 420) trail.shift();

  ctx.beginPath();
  ctx.strokeStyle = COL.gold; ctx.lineWidth = 2;
  ctx.shadowColor = COL.gold; ctx.shadowBlur = 6;
  for (let i = 0; i < trail.length; i++) {
    const [x, y] = trail[i];
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  dot(ctx, px, py, 4, '#fff');
}

// ── Section 5: square wave from N odd harmonics ──────────────
function makeSeries(captionEl) {
  const counts = [1, 2, 3, 5, 8, 15];
  return function animSeries(ctx, w, h, t) {
    const cy = h / 2;
    const A = Math.min(h * 0.3, 50);
    const x0 = 14, x1 = w - 14;
    const period = 0.6; // seconds per harmonic-count step (~5x faster)
    const idx = Math.floor(t / period) % counts.length;
    const N = counts[idx];

    if (captionEl) {
      const harmonics = 2 * N - 1; // highest harmonic number used
      captionEl.textContent = `${N} sine${N > 1 ? 's' : ''}, up to harmonic ${harmonics}`;
    }

    drawAxis(ctx, x0, cy, x1);

    // ideal square (faint reference)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = x0; x <= x1; x++) {
      const phase = (x - x0) * 0.02;
      const sq = Math.sin(phase) >= 0 ? 1 : -1;
      const y = cy - A * sq;
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // partial sum
    ctx.beginPath();
    ctx.strokeStyle = COL.gold; ctx.lineWidth = 2.2;
    ctx.shadowColor = COL.gold; ctx.shadowBlur = 6;
    for (let x = x0; x <= x1; x++) {
      const phase = (x - x0) * 0.02;
      let sum = 0;
      for (let n = 1; n <= N; n++) {
        const k = 2 * n - 1; // odd harmonics
        sum += Math.sin(k * phase) / k;
      }
      const y = cy - (4 / Math.PI) * A * sum;
      if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
}

// ── Controller: one per canvas ───────────────────────────────
function makeController(canvas, drawFn) {
  let raf = null;
  let elapsed = 0;     // virtual time, only advances while playing
  let lastNow = null;
  let dims = fitCanvas(canvas);

  const ro = new ResizeObserver(() => { dims = fitCanvas(canvas); });
  ro.observe(canvas);

  function frame(now) {
    // First frame after a (re)start has zero delta, so virtual time is
    // continuous across pauses — no position jump, no straight-line skip.
    if (lastNow === null) lastNow = now;
    elapsed += (now - lastNow) / 1000;
    lastNow = now;
    dims.ctx.clearRect(0, 0, dims.w, dims.h);
    drawFn(dims.ctx, dims.w, dims.h, elapsed, canvas);
    raf = requestAnimationFrame(frame);
  }

  return {
    play()  { if (raf === null) { lastNow = null; raf = requestAnimationFrame(frame); } },
    pause() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } },
  };
}

export function initExplainer() {
  const canvases = document.querySelectorAll('.explain-canvas');
  if (!canvases.length) return;

  const controllers = new Map();

  canvases.forEach(canvas => {
    const kind = canvas.dataset.anim;
    let drawFn;
    if (kind === 'sine')   drawFn = animSine;
    else if (kind === 'freq')   drawFn = animFreq;
    else if (kind === 'add')    drawFn = animAdd;
    else if (kind === 'epi')    drawFn = animEpi;
    else if (kind === 'series') {
      const cap = document.querySelector('[data-caption="series"]');
      drawFn = makeSeries(cap);
    } else return;
    controllers.set(canvas, makeController(canvas, drawFn));
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const ctrl = controllers.get(e.target);
      if (!ctrl) return;
      if (e.isIntersecting) ctrl.play(); else ctrl.pause();
    });
  }, { threshold: 0.15 });

  canvases.forEach(c => io.observe(c));

  // Pause everything while the explain panel is hidden; resume handled by IO.
  const panel = document.getElementById('explain-panel');
  if (panel) {
    const mo = new MutationObserver(() => {
      if (panel.hidden) controllers.forEach(c => c.pause());
    });
    mo.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  }
}
