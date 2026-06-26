// fourier.js — Orbit math, circle rendering, and animation

// Note color palette by pitch class (0=C..11=B)
export const NOTE_COLORS = [
  'hsl(220,80%,65%)',  // C
  'hsl(260,75%,68%)',  // C#
  'hsl(300,65%,66%)',  // D
  'hsl(340,72%,66%)',  // D#
  'hsl(15,80%,65%)',   // E
  'hsl(45,82%,63%)',   // F
  'hsl(80,72%,60%)',   // F#
  'hsl(140,68%,60%)',  // G
  'hsl(172,75%,58%)',  // G#
  'hsl(195,80%,62%)',  // A
  'hsl(210,70%,65%)',  // A#
  'hsl(235,65%,70%)',  // B
];

// Active note entries: { noteKey, freq, pitchClass, color, amplitude }
let activeNotes   = [];
let showOvertones = false;
let currentTimbre = 'sine';

export function setTimbre(t) {
  currentTimbre = t;
}
let startTime    = null;
let animFrame    = null;
let canvas       = null;
let ctx          = null;

let currentSpeed = 1.0;
let virtualTime  = 0;
let lastTs       = null;

export function setSpeed(s) {
  currentSpeed = s;
}

export function getVirtualTime() {
  return virtualTime;
}
let trailCallback = null; // called each frame with the tip position

// Trail ring buffer
const TRAIL_LEN  = 1500;
const trailY     = new Float32Array(TRAIL_LEN);
let trailHead    = 0;
let trailFull    = false;

// 2D Trace for the canvas
let traceCanvasOffscreen = null;
let traceCtxOffscreen = null;
let lastTraceX = null;
let lastTraceY = null;

export function init(canvasEl, onTrailPoint) {
  canvas       = canvasEl;
  ctx          = canvas.getContext('2d');
  trailCallback = onTrailPoint;

  traceCanvasOffscreen = document.createElement('canvas');
  traceCtxOffscreen = traceCanvasOffscreen.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width  * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  canvas.style.width  = rect.width  + 'px';
  canvas.style.height = rect.height + 'px';

  if (traceCanvasOffscreen) {
    traceCanvasOffscreen.width = canvas.width;
    traceCanvasOffscreen.height = canvas.height;
    clearTrace();
  }
}

export function addNote(noteKey, freq, pitchClass) {
  if (activeNotes.find(n => n.noteKey === noteKey)) return;
  activeNotes.push({ noteKey, freq, pitchClass, color: NOTE_COLORS[pitchClass] });
  normalizeAmplitudes();
  clearTrace();
}

export function removeNote(noteKey) {
  activeNotes = activeNotes.filter(n => n.noteKey !== noteKey);
  normalizeAmplitudes();
  clearTrace();
}

function clearTrace() {
  if (traceCtxOffscreen && traceCanvasOffscreen) {
    traceCtxOffscreen.clearRect(0, 0, traceCanvasOffscreen.width, traceCanvasOffscreen.height);
  }
  lastTraceX = null;
  lastTraceY = null;
}

export function clearNotes() {
  activeNotes = [];
}

export function setOvertones(enabled) {
  showOvertones = enabled;
}

function normalizeAmplitudes() {
  // Equal amplitude per fundamental, max radius ~35% of min canvas dimension
  const n = activeNotes.length;
  if (n === 0) return;
  activeNotes.forEach(note => { note.amplitude = 1 / n; });
}

/** Build the ordered list of orbit circles (fundamental + overtones) */
function buildCircles(t) {
  const circles = [];
  const minDim  = Math.min(canvas.width, canvas.height) / window.devicePixelRatio;
  const maxR    = minDim * 0.35; // max combined radius in pixels

  for (const note of activeNotes) {
    const fundamentalR = note.amplitude * maxR;

    circles.push({
      freq:  note.freq,
      amp:   fundamentalR,
      phase: 0,
      color: note.color,
      isOvertone: false,
      label: null
    });

    if (showOvertones) {
      // Harmonics shown match what the audio actually synthesizes per timbre.
      // Sine: no overtones in sound, none in view.
      // Flute: fundamental + 2nd harmonic at 0.22 relative gain (mirrors audio.js).
      // Strings: sawtooth series — 2f, 3f, 4f at 1/k amplitude.
      if (currentTimbre === 'flute') {
        circles.push({
          freq:  note.freq * 2,
          amp:   fundamentalR * 0.22,
          phase: 0,
          color: note.color,
          isOvertone: true,
          label: null
        });
      } else if (currentTimbre === 'strings') {
        for (let k = 2; k <= 4; k++) {
          circles.push({
            freq:  note.freq * k,
            amp:   (fundamentalR / k) * 0.6,
            phase: 0,
            color: note.color,
            isOvertone: true,
            label: null
          });
        }
      }
      // 'sine': no overtones added — toggle is a no-op for this timbre
    }
  }

  // Sort by descending radius so largest orbits come first
  circles.sort((a, b) => b.amp - a.amp);
  return circles;
}

export function startAnimation() {
  if (animFrame) return;
  startTime = null;
  lastTs = null;
  loop(performance.now());
}

export function stopAnimation() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

function loop(ts) {
  animFrame = requestAnimationFrame(loop);
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs;
  lastTs = ts;
  
  const prevVirtualTime = virtualTime;
  virtualTime += (dt / 1000) * 0.0025 * currentSpeed;

  drawFrame(virtualTime, prevVirtualTime);
}

function drawFrame(t, prevT) {
  const W = canvas.width;
  const H = canvas.height;
  const dpr = window.devicePixelRatio;

  ctx.clearRect(0, 0, W, H);

  // Subtle grid
  drawGrid(W, H, dpr);

  // Draw infinite trace layer behind circles
  if (traceCanvasOffscreen) {
    ctx.drawImage(traceCanvasOffscreen, 0, 0);
  }

  if (activeNotes.length === 0) {
    drawIdleMessage(W, H, dpr);

    // Push zero to trail
    trailY[trailHead] = 0;
    trailHead = (trailHead + 1) % TRAIL_LEN;
    if (trailHead === 0) trailFull = true;
    if (trailCallback) trailCallback(getTrailSnapshot(), W / dpr / 2, H / dpr / 2);
    return;
  }

  const circles = buildCircles(t);
  const cx = W / 2;
  const cy = H / 2;

  // Draw orbit circles + arms
  let px = cx, py = cy;
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    const angle = 2 * Math.PI * c.freq * t + c.phase;
    const nx = px + c.amp * dpr * Math.cos(angle);
    const ny = py - c.amp * dpr * Math.sin(angle); // y-flip: screen y increases down

    // Draw orbit path (faint dashed circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, c.amp * dpr, 0, 2 * Math.PI);
    ctx.strokeStyle = c.isOvertone
      ? hexAlpha(c.color, 0.12)
      : hexAlpha(c.color, 0.22);
    ctx.lineWidth = c.isOvertone ? 0.8 : 1.2;
    ctx.setLineDash(c.isOvertone ? [3, 5] : [4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Draw arm (line from center to tip)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = c.isOvertone ? hexAlpha(c.color, 0.35) : hexAlpha(c.color, 0.65);
    ctx.lineWidth   = c.isOvertone ? 0.8 : 1.5;
    ctx.shadowColor = c.color;
    ctx.shadowBlur  = c.isOvertone ? 3 : 8;
    ctx.stroke();
    ctx.restore();

    // Draw pivot dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, c.isOvertone ? 2 : 3, 0, 2 * Math.PI);
    ctx.fillStyle = c.isOvertone ? hexAlpha(c.color, 0.5) : c.color;
    ctx.shadowColor = c.color;
    ctx.shadowBlur  = 6;
    ctx.fill();
    ctx.restore();

    px = nx; py = ny;
  }

  // Draw to offscreen trace canvas
  if (traceCtxOffscreen && activeNotes.length > 0) {
    if (lastTraceX !== null && lastTraceY !== null && prevT !== undefined) {
      traceCtxOffscreen.save();
      traceCtxOffscreen.beginPath();
      traceCtxOffscreen.moveTo(lastTraceX, lastTraceY);

      // Sub-step the drawing so it doesn't draw straight lines at high speeds
      const steps = Math.max(1, Math.ceil((t - prevT) * 50000));
      
      for (let i = 1; i <= steps; i++) {
        const subT = prevT + (t - prevT) * (i / steps);
        
        let subPx = cx;
        let subPy = cy;
        for (let j = 0; j < circles.length; j++) {
          const c = circles[j];
          const angle = 2 * Math.PI * c.freq * subT + c.phase;
          subPx += c.amp * dpr * Math.cos(angle);
          subPy -= c.amp * dpr * Math.sin(angle);
        }
        traceCtxOffscreen.lineTo(subPx, subPy);
      }
      
      traceCtxOffscreen.strokeStyle = 'rgba(255, 203, 107, 0.4)';
      traceCtxOffscreen.lineWidth = 1.5 * dpr;
      traceCtxOffscreen.stroke();
      traceCtxOffscreen.restore();
    }
    lastTraceX = px;
    lastTraceY = py;
  }

  // Draw glowing tip
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur  = 16;
  ctx.fill();
  ctx.restore();

  // Dashed horizontal line from tip to right edge (connects to trail)
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(W, py);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Record tip y (normalized -1..1 relative to center)
  const tipY = (py - cy) / (H * 0.4);
  trailY[trailHead] = tipY;
  trailHead = (trailHead + 1) % TRAIL_LEN;
  if (trailHead === 0) trailFull = true;

  if (trailCallback) {
    trailCallback(getTrailSnapshot(), (px - cx) / dpr, (py - cy) / dpr);
  }
}

function drawGrid(W, H, dpr) {
  const step = 60 * dpr;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Center axes (slightly brighter)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
  ctx.restore();
}

function drawIdleMessage(W, H, dpr) {
  ctx.save();
  ctx.fillStyle = 'rgba(100,116,139,0.4)';
  ctx.font = `${14 * dpr}px 'Space Grotesk', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Click a key to begin', W / 2, H / 2);
  ctx.restore();
}

function getTrailSnapshot() {
  const count  = trailFull ? TRAIL_LEN : trailHead;
  const result = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const idx = trailFull ? (trailHead + i) % TRAIL_LEN : i;
    result[i] = trailY[idx];
  }
  return result;
}

export function resetTrail() {
  trailY.fill(0);
  trailHead = 0;
  trailFull = false;
  clearTrace();
}

/** Converts an hsl/rgb color string to the same color with an alpha channel */
function hexAlpha(color, alpha) {
  // Create a temporary canvas to parse the color
  if (!hexAlpha._ctx) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    hexAlpha._ctx = c.getContext('2d');
  }
  hexAlpha._ctx.fillStyle = color;
  const parsed = hexAlpha._ctx.fillStyle; // '#rrggbb'
  const r = parseInt(parsed.slice(1,3),16);
  const g = parseInt(parsed.slice(3,5),16);
  const b = parseInt(parsed.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
