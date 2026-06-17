// waveform.js — Trail canvas + individual note waveform panels
import { getVirtualTime } from "./fourier.js"
let trailCanvas  = null;
let trailCtx     = null;
let wavesList    = null;
let waveCanvases = new Map(); // noteKey -> { canvas, ctx, color }
let animFrame    = null;
let lastTrail    = null;
let lastTrailTipX = 0;
let lastTrailTipY = 0;

export function init(trailCanvasEl, wavesListEl) {
  trailCanvas = trailCanvasEl;
  trailCtx    = trailCanvas.getContext('2d');
  wavesList   = wavesListEl;

  resizeTrail();
  window.addEventListener('resize', resizeTrail);

  animFrame = requestAnimationFrame(trailLoop);
}

function resizeTrail() {
  if (!trailCanvas) return;
  const rect = trailCanvas.parentElement.getBoundingClientRect();
  trailCanvas.width  = rect.width  * window.devicePixelRatio;
  trailCanvas.height = rect.height * window.devicePixelRatio;
  trailCanvas.style.width  = rect.width  + 'px';
  trailCanvas.style.height = rect.height + 'px';
}

/** Called every frame by fourier.js with new trail data */
export function updateTrail(trailData, tipX, tipY) {
  lastTrail    = trailData;
  lastTrailTipX = tipX;
  lastTrailTipY = tipY;
}

function trailLoop() {
  animFrame = requestAnimationFrame(trailLoop);
  drawTrail();
  drawIndividualWaves();
}

function drawTrail() {
  if (!trailCanvas) return;
  const W   = trailCanvas.width;
  const H   = trailCanvas.height;
  const dpr = window.devicePixelRatio;
  const ctx = trailCtx;

  ctx.clearRect(0, 0, W, H);

  // Subtle grid
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const step = 60 * dpr;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  // Center horizontal axis
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
  ctx.restore();

  if (!lastTrail || lastTrail.length < 2) return;

  const trail    = lastTrail;
  const len      = trail.length;
  const ampScale = (H * 0.42); // pixels per unit amplitude

  // Draw the gold waveform trail
  ctx.save();
  ctx.shadowColor = 'rgba(255, 203, 107, 0.6)';
  ctx.shadowBlur  = 10;
  ctx.strokeStyle = '#ffcb6b';
  ctx.lineWidth   = 2 * dpr;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  ctx.beginPath();
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * W;
    const y = H / 2 + trail[i] * ampScale;
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Bright "now" dot at the rightmost point
  const lastY = H / 2 + trail[len - 1] * ampScale;
  ctx.beginPath();
  ctx.arc(W - 4, lastY, 4 * dpr, 0, 2 * Math.PI);
  ctx.fillStyle   = '#ffffff';
  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#ffffff';
  ctx.fill();
  ctx.restore();

  // Panel label (drawn on canvas so it's always on top)
  ctx.save();
  ctx.fillStyle = 'rgba(100,116,139,0.5)';
  ctx.font = `${10 * dpr}px 'Space Grotesk', sans-serif`;
  ctx.fillText('TIME →', W - 65 * dpr, H - 10 * dpr);
  ctx.restore();
}

// ── Individual note waveform cards ──────────────────────────

/**
 * Add a waveform card for a note.
 * @param {string} noteKey
 * @param {string} noteName  - e.g. "C#4"
 * @param {number} freq
 * @param {string} color
 * @param {number} cents     - deviation from ET in cents
 */
export function addWaveCard(noteKey, noteName, freq, color, cents) {
  // Remove empty state
  const empty = document.getElementById('waves-empty');
  if (empty) empty.style.display = 'none';

  const item = document.createElement('div');
  item.className = 'wave-item';
  item.id = `wave-item-${noteKey.replace(/[^a-z0-9]/gi,'_')}`;

  const centsStr = cents === 0 ? '±0¢ ET'
    : cents > 0 ? `+${cents.toFixed(1)}¢`
    : `${cents.toFixed(1)}¢`;

  item.innerHTML = `
    <div class="wave-item-header">
      <span class="wave-note-name" style="color:${color}">${noteName}</span>
      <span class="wave-freq">${freq.toFixed(2)} Hz</span>
    </div>
    <canvas class="wave-canvas" height="36" id="wc-${noteKey.replace(/[^a-z0-9]/gi,'_')}"></canvas>
    <div class="wave-cents" style="color:${color}88">${centsStr}</div>
  `;

  wavesList.appendChild(item);

  const wc  = document.getElementById(`wc-${noteKey.replace(/[^a-z0-9]/gi,'_')}`);
  const wctx = wc.getContext('2d');
  waveCanvases.set(noteKey, { canvas: wc, ctx: wctx, color, freq });
  resizeWaveCanvas(wc);
}

function resizeWaveCanvas(wc) {
  const rect = wc.parentElement.getBoundingClientRect();
  wc.width  = (rect.width - 24) * window.devicePixelRatio;
  wc.style.width = '100%';
  wc.height = 36 * window.devicePixelRatio;
  wc.style.height = '36px';
}

export function removeWaveCard(noteKey) {
  const id  = `wave-item-${noteKey.replace(/[^a-z0-9]/gi,'_')}`;
  const el  = document.getElementById(id);
  if (el) el.remove();
  waveCanvases.delete(noteKey);

  if (wavesList.querySelectorAll('.wave-item').length === 0) {
    const empty = document.getElementById('waves-empty');
    if (empty) empty.style.display = '';
  }
}

export function clearWaveCards() {
  waveCanvases.clear();
  const items = wavesList.querySelectorAll('.wave-item');
  items.forEach(el => el.remove());
  const empty = document.getElementById('waves-empty');
  if (empty) empty.style.display = '';
}

function drawIndividualWaves() {
  const t = getVirtualTime();
  for (const [noteKey, { canvas: wc, ctx: wctx, color, freq }] of waveCanvases) {
    const W   = wc.width;
    const H   = wc.height;
    const dpr = window.devicePixelRatio;

    wctx.clearRect(0, 0, W, H);

    // Background
    wctx.fillStyle = 'rgba(15,17,23,0.5)';
    wctx.fillRect(0, 0, W, H);

    // Center line
    wctx.save();
    wctx.strokeStyle = 'rgba(255,255,255,0.06)';
    wctx.lineWidth = 1;
    wctx.beginPath();
    wctx.moveTo(0, H/2); wctx.lineTo(W, H/2);
    wctx.stroke();
    wctx.restore();

    // Sine wave — spread out for slower visualization
    const cycles = Math.max(0.75, freq / 250);

    wctx.save();
    wctx.strokeStyle = color;
    wctx.lineWidth   = 1.5 * dpr;
    wctx.shadowColor = color;
    wctx.shadowBlur  = 6;
    wctx.beginPath();

    for (let px = 0; px < W; px++) {
      // x in seconds relative to t (scrolling animation)
      const xTime = t + (px / W) * (cycles / freq);
      const y = H / 2 - (H * 0.38) * Math.sin(2 * Math.PI * freq * xTime);
      if (px === 0) wctx.moveTo(px, y);
      else          wctx.lineTo(px, y);
    }
    wctx.stroke();
    wctx.restore();
  }
}
