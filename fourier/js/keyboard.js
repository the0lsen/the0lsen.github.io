// keyboard.js — 24-key chromatic piano keyboard (C3–B4)

import { NOTE_COLORS } from "./fourier.js"
import { getCentsDeviation } from "./tuning.js"

// 24 notes: MIDI 48 (C3) to MIDI 71 (B4)
const START_MIDI = 48; // C3
const END_MIDI   = 71; // B4

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Which pitch classes are black keys
const BLACK_KEY = [false, true, false, true, false, false, true, false, true, false, true, false];

// Offset of each black key within an octave group (in units of white-key width)
// White key positions: C=0, D=1, E=2, F=3, G=4, A=5, B=6
// Black key left offsets relative to white-key left (in fractions of white key width)
const BLACK_OFFSETS = {
  1:  0.67,  // C#
  3:  1.67,  // D#
  6:  3.67,  // F#
  8:  4.67,  // G#
  10: 5.67,  // A#
};

let onNoteOn  = () => {};
let onNoteOff = () => {};
let currentTuning = 'just';

// Set of active MIDI note numbers
const activeKeys = new Set();

export function initKeyboard(containerEl, noteOnCb, noteOffCb) {
  onNoteOn  = noteOnCb;
  onNoteOff = noteOffCb;
  buildKeyboard(containerEl);
}

export function setTuning(tuning) {
  currentTuning = tuning;
}

export function clearAll() {
  for (const midi of [...activeKeys]) {
    deactivateKey(midi);
    onNoteOff(midiToNoteKey(midi), midi);
  }
}

function buildKeyboard(container) {
  container.innerHTML = '';

  const WHITE_W  = 70; // px per white key (incl margin)
  const WHITE_H  = 200;
  const BLACK_W  = 44;
  const BLACK_H  = 130;
  const MARGIN   = 2;   // gap between white keys

  // Count white keys to set container width
  let whiteCount = 0;
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const pc = midi % 12;
    if (!BLACK_KEY[pc]) whiteCount++;
  }
  const totalW = whiteCount * (WHITE_W + MARGIN);
  container.style.width  = totalW + 'px';
  container.style.height = WHITE_H + 'px';

  let whiteX = 0;

  // We need to track white-key x positions so we can place black keys
  const midiToWhiteX = {};

  // First pass: place white keys
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const pc = midi % 12;
    if (BLACK_KEY[pc]) continue;

    const key = document.createElement('div');
    key.className = 'key white';
    key.id = `key-${midi}`;
    key.style.left    = whiteX + 'px';
    key.style.width   = WHITE_W + 'px';
    key.style.height  = WHITE_H + 'px';
    key.style.position = 'absolute';

    const noteName = NOTE_NAMES[pc];
    const octave   = Math.floor(midi / 12) - 1;
    key.innerHTML = `<span class="key-label">${noteName}${octave}</span>`;

    attachKeyEvents(key, midi);
    container.appendChild(key);

    midiToWhiteX[midi] = whiteX;
    whiteX += WHITE_W + MARGIN;
  }

  // Second pass: place black keys
  // For each pair of adjacent white keys, we need to find the position
  // of the black key between them
  let currentWhiteIdx = 0;
  const whiteKeys = [];
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const pc = midi % 12;
    if (!BLACK_KEY[pc]) whiteKeys.push(midi);
  }

  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const pc = midi % 12;
    if (!BLACK_KEY[pc]) continue;

    // Find the white key immediately before this black key
    let prevWhiteMidi = midi - 1;
    while (prevWhiteMidi >= START_MIDI && BLACK_KEY[prevWhiteMidi % 12]) prevWhiteMidi--;
    if (prevWhiteMidi < START_MIDI) continue;

    const prevX = midiToWhiteX[prevWhiteMidi];
    const bx    = prevX + (WHITE_W + MARGIN) - BLACK_W / 2;

    const key = document.createElement('div');
    key.className = 'key black';
    key.id = `key-${midi}`;
    key.style.left    = bx + 'px';
    key.style.width   = BLACK_W + 'px';
    key.style.height  = BLACK_H + 'px';
    key.style.position = 'absolute';

    const noteName = NOTE_NAMES[pc];
    const octave   = Math.floor(midi / 12) - 1;
    key.innerHTML = `<span class="key-label">${noteName}${octave}</span>`;

    attachKeyEvents(key, midi);
    container.appendChild(key);
  }
}

function attachKeyEvents(keyEl, midi) {
  keyEl.addEventListener('mousedown', e => {
    e.preventDefault();
    handleKeyToggle(midi);
  });
  keyEl.addEventListener('touchstart', e => {
    e.preventDefault();
    handleKeyToggle(midi);
  }, { passive: false });
}

function handleKeyToggle(midi) {
  if (activeKeys.has(midi)) {
    // Toggle off
    deactivateKey(midi);
    onNoteOff(midiToNoteKey(midi), midi);
  } else {
    // Toggle on
    activateKey(midi);
    onNoteOn(midiToNoteKey(midi), midi);
  }
}

function activateKey(midi) {
  const pc    = midi % 12;
  const color = NOTE_COLORS[pc];
  // Derive a glowable rgba
  const key = document.getElementById(`key-${midi}`);
  if (!key) return;

  activeKeys.add(midi);
  key.classList.add('active');
  key.style.setProperty('--active-color', color);
  key.style.setProperty('--active-glow',  color + '60');
}

function deactivateKey(midi) {
  const key = document.getElementById(`key-${midi}`);
  if (!key) return;
  activeKeys.delete(midi);
  key.classList.remove('active');
  key.style.removeProperty('--active-color');
  key.style.removeProperty('--active-glow');
}

export function midiToNoteKey(midi) {
  const pc     = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}-${midi}`;
}

export function noteKeyToMidi(noteKey) {
  return parseInt(noteKey.split('-')[1]);
}

export function getNoteInfo(midi, tuning) {
  const pc     = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name   = NOTE_NAMES[pc];
  const color  = NOTE_COLORS[pc];
  const cents  = getCentsDeviation(midi, tuning);
  return { pc, octave, name, color, cents, noteName: `${name}${octave}` };
}
