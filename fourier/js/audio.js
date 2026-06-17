// audio.js — Web Audio API synthesis: Sine, Strings, Flute

let audioCtx = null;
let masterGain = null;
let compressor = null;

// Map of noteKey -> { oscillators, gains, lfo, lfoGain, noiseSource }
const activeNodes = new Map();

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Dynamics compressor to prevent clipping with many notes
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value      = 8;
    compressor.ratio.value     = 4;
    compressor.attack.value    = 0.003;
    compressor.release.value   = 0.25;
    compressor.connect(audioCtx.destination);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(compressor);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function createLFO(freq, depth) {
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = freq;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain);
  lfo.start();
  return { lfo, lfoGain };
}

function createNoiseBuffer() {
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Start a note with the given frequency and timbre.
 * @param {number} freq     - Frequency in Hz
 * @param {string} noteKey  - Unique key for this note (e.g. "C#4-48")
 * @param {string} timbre   - 'sine' | 'strings' | 'flute'
 */
export function startNote(freq, noteKey, timbre = 'sine') {
  ensureContext();
  if (activeNodes.has(noteKey)) return;

  const now = audioCtx.currentTime;
  const nodes = { oscillators: [], gains: [], lfo: null, lfoGain: null, noiseSource: null, noteGain: null };

  // Per-note gain (envelope)
  const noteGain = audioCtx.createGain();
  noteGain.gain.setValueAtTime(0, now);
  noteGain.connect(masterGain);
  nodes.noteGain = noteGain;

  if (timbre === 'sine') {
    // ── Pure Sine ──────────────────────────────────────
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(noteGain);
    osc.start(now);
    nodes.oscillators.push(osc);

    // Quick attack
    noteGain.gain.linearRampToValueAtTime(0.55, now + 0.025);

  } else if (timbre === 'strings') {
    // ── Strings: sawtooth → LPF + vibrato ─────────────
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    filter.connect(noteGain);

    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.connect(filter);
    osc.start(now);
    nodes.oscillators.push(osc);

    // Vibrato LFO — ±4 cents at 5 Hz (starts after 0.3s delay)
    const vibratoDepth = freq * (Math.pow(2, 4/1200) - 1); // 4 cents in Hz
    const { lfo, lfoGain } = createLFO(5, vibratoDepth);
    lfoGain.connect(osc.frequency);
    nodes.lfo = lfo; nodes.lfoGain = lfoGain;

    // Slow attack (1.0s)
    noteGain.gain.linearRampToValueAtTime(0.45, now + 1.0);

  } else if (timbre === 'flute') {
    // ── Flute: sine fundamental + 2nd harmonic + breathiness ──
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    const harm2Gain = audioCtx.createGain();
    harm2Gain.gain.value = 0.22;

    // High-pass filter to remove muddiness
    const hpf = audioCtx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 80;

    osc1.connect(hpf);
    osc2.connect(harm2Gain);
    harm2Gain.connect(hpf);
    hpf.connect(noteGain);
    osc1.start(now); osc2.start(now);
    nodes.oscillators.push(osc1, osc2);

    // Breathiness: band-filtered noise at very low level
    const noiseBuffer = createNoiseBuffer();
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseBPF = audioCtx.createBiquadFilter();
    noiseBPF.type = 'bandpass';
    noiseBPF.frequency.value = freq;
    noiseBPF.Q.value = 3;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.03;

    noiseSource.connect(noiseBPF);
    noiseBPF.connect(noiseGain);
    noiseGain.connect(noteGain);
    noiseSource.start(now);
    nodes.noiseSource = noiseSource;

    // Vibrato LFO — ±6 cents at 5.5 Hz
    const vibratoDepth = freq * (Math.pow(2, 6/1200) - 1);
    const { lfo, lfoGain } = createLFO(5.5, vibratoDepth);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    nodes.lfo = lfo; nodes.lfoGain = lfoGain;

    // Medium attack
    noteGain.gain.linearRampToValueAtTime(0.5, now + 0.12);
  }

  activeNodes.set(noteKey, nodes);
}

/**
 * Stop a note with a short release envelope.
 * @param {string} noteKey
 */
export function stopNote(noteKey) {
  if (!audioCtx) return;
  const nodes = activeNodes.get(noteKey);
  if (!nodes) return;

  const now = audioCtx.currentTime;
  const releaseTime = 0.35;

  nodes.noteGain.gain.cancelScheduledValues(now);
  nodes.noteGain.gain.setValueAtTime(nodes.noteGain.gain.value, now);
  nodes.noteGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

  // Disconnect all after release
  setTimeout(() => {
    try {
      nodes.oscillators.forEach(o => { o.stop(); o.disconnect(); });
      if (nodes.lfo)         { nodes.lfo.stop();        nodes.lfo.disconnect(); }
      if (nodes.lfoGain)     { nodes.lfoGain.disconnect(); }
      if (nodes.noiseSource) { nodes.noiseSource.stop(); nodes.noiseSource.disconnect(); }
      nodes.noteGain.disconnect();
    } catch(e) {}
  }, (releaseTime + 0.05) * 1000);

  // Remove from map immediately so logic treats it as off
  activeNodes.delete(noteKey);
}

/**
 * Stop all active notes immediately.
 */
export function stopAllNotes() {
  for (const key of activeNodes.keys()) stopNote(key);
}

export function isAudioReady() { return !!audioCtx; }
