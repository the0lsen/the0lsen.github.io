// app.js — Main controller: wires all modules together

import { getFrequency }           from "./tuning.js"
import { startNote, stopNote, stopAllNotes } from "./audio.js"
import { init as initFourier, addNote, removeNote, clearNotes,
         setOvertones, startAnimation, resetTrail, setSpeed, setTimbre } from "./fourier.js"
import { init as initWaveform, updateTrail,
         addWaveCard, removeWaveCard, clearWaveCards,
         renderOvertoneSection, clearOvertoneSection } from "./waveform.js"
import { initKeyboard, midiToNoteKey, getNoteInfo, setTuning as setKbTuning, clearAll as clearAllKeys } from "./keyboard.js"

let currentTuning = 'just';
let currentTimbre = 'sine';
let _refreshOvertones = () => {};

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

  setTimbre(currentTimbre);

  _refreshOvertones = function refreshOvertones() {
    if (!overtoneToggle.checked || liveNotes.size === 0) {
      clearOvertoneSection();
      return;
    }
    const overtones = [];
    for (const [noteKey, { midi, freq }] of liveNotes) {
      const info = getNoteInfo(midi, currentTuning);
      if (currentTimbre === 'flute') {
        overtones.push({ key: `${noteKey}-ov2`, label: `${info.noteName} ×2`, freq: freq * 2, color: info.color });
      } else if (currentTimbre === 'strings') {
        for (let k = 2; k <= 4; k++) {
          overtones.push({ key: `${noteKey}-ov${k}`, label: `${info.noteName} ×${k}`, freq: freq * k, color: info.color });
        }
      }
    }
    renderOvertoneSection(overtones);
  };

  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      setSpeed(parseFloat(speedSlider.value));
    });
  }

  tuningSelect.addEventListener('change', () => {
    currentTuning = tuningSelect.value;
    setKbTuning(currentTuning);
    retuneLiveNotes();
    _refreshOvertones();
    resetTrail();
  });

  overtoneToggle.addEventListener('change', () => {
    setOvertones(overtoneToggle.checked);
    refreshOvertones();
    resetTrail();
  });

  timbreSelect.addEventListener('change', () => {
    currentTimbre = timbreSelect.value;
    setTimbre(currentTimbre);
    refreshOvertones();
    retimbreLiveNotes();
    resetTrail();
  });

  btnReset.addEventListener('click', () => {
    clearAllKeys();
    clearOvertoneSection();
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
  _refreshOvertones();
}

function handleNoteOff(noteKey, midi) {
  liveNotes.delete(noteKey);
  stopNote(noteKey);
  removeNote(noteKey);
  removeWaveCard(noteKey);
  _refreshOvertones();
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

