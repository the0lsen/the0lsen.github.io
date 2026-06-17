// app.js — Main controller: wires all modules together

import { getFrequency }           from "./tuning.js"
import { startNote, stopNote, stopAllNotes } from "./audio.js"
import { init as initFourier, addNote, removeNote, clearNotes,
         setOvertones, startAnimation, resetTrail, setSpeed }  from "./fourier.js"
import { init as initWaveform, updateTrail,
         addWaveCard, removeWaveCard, clearWaveCards } from "./waveform.js"
import { initKeyboard, midiToNoteKey, getNoteInfo, setTuning as setKbTuning, clearAll as clearAllKeys } from "./keyboard.js"

let currentTuning = 'just';
let currentTimbre = 'sine';

export function initApp() {
  // ── Canvas elements ──────────────────────────
  const fourierCanvas = document.getElementById('fourier-canvas');
  const trailCanvas   = document.getElementById('trail-canvas');
  const wavesList     = document.getElementById('waves-list');
  const kbContainer   = document.getElementById('keyboard-container');

  // ── Init subsystems ───────────────────────────
  initFourier(fourierCanvas, (trailData, tipX, tipY) => {
    updateTrail(trailData, tipX, tipY);
  });

  initWaveform(trailCanvas, wavesList);

  initKeyboard(kbContainer, handleNoteOn, handleNoteOff);

  startAnimation();

  // ── Controls ──────────────────────────────────
  const tuningSelect   = document.getElementById('tuning-select');
  const timbreSelect   = document.getElementById('timbre-select');
  const overtoneToggle = document.getElementById('overtone-toggle');
  const speedSlider    = document.getElementById('speed-slider');
  const btnReset       = document.getElementById('btn-reset');

  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      setSpeed(parseFloat(speedSlider.value));
    });
  }

  tuningSelect.addEventListener('change', () => {
    currentTuning = tuningSelect.value;
    setKbTuning(currentTuning);
    // Restart all active notes with new frequencies
    retuneLiveNotes();
    resetTrail();
  });

  timbreSelect.addEventListener('change', () => {
    currentTimbre = timbreSelect.value;
    retimbreLiveNotes();
    resetTrail();
  });

  overtoneToggle.addEventListener('change', () => {
    setOvertones(overtoneToggle.checked);
    resetTrail();
  });

  btnReset.addEventListener('click', () => {
    clearAllKeys();
    resetTrail();
  });
}

// Map of active notes: noteKey -> { midi, freq }
const liveNotes = new Map();

function handleNoteOn(noteKey, midi) {
  const freq    = getFrequency(midi, currentTuning);
  const info    = getNoteInfo(midi, currentTuning);

  liveNotes.set(noteKey, { midi, freq });

  startNote(freq, noteKey, currentTimbre);
  addNote(noteKey, freq, info.pc);
  addWaveCard(noteKey, info.noteName, freq, info.color, info.cents);
}

function handleNoteOff(noteKey, midi) {
  liveNotes.delete(noteKey);
  stopNote(noteKey);
  removeNote(noteKey);
  removeWaveCard(noteKey);
}

/** Restart all live notes with updated frequencies (after tuning change) */
function retuneLiveNotes() {
  for (const [noteKey, data] of liveNotes) {
    const newFreq = getFrequency(data.midi, currentTuning);
    data.freq = newFreq;

    // Update audio
    stopNote(noteKey);
    startNote(newFreq, noteKey, currentTimbre);

    // Update fourier
    removeNote(noteKey);
    const info = getNoteInfo(data.midi, currentTuning);
    addNote(noteKey, newFreq, info.pc);

    // Update wave card: remove & re-add with new freq
    removeWaveCard(noteKey);
    addWaveCard(noteKey, info.noteName, newFreq, info.color, info.cents);
  }
}

/** Restart all live notes with new timbre (after timbre change) */
function retimbreLiveNotes() {
  for (const [noteKey, data] of liveNotes) {
    stopNote(noteKey);
    startNote(data.freq, noteKey, currentTimbre);
  }
}

