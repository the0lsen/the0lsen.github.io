// tuning.js — Frequency tables for 8 historical tuning systems
// Base: A4 = 440 Hz. All ratios relative to C in a given octave.

// MIDI note 60 = C4. C3 = MIDI 48.
const A4_MIDI = 69;
const A4_HZ   = 440;

// Pitch class index: 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B
const TUNING_RATIOS = {

  // 12-tone Equal Temperament: 2^(n/12) for n=0..11
  equal: [0,1,2,3,4,5,6,7,8,9,10,11].map(n => Math.pow(2, n/12)),

  // 5-limit Just Intonation (relative to C)
  just: [
    1,          // C
    16/15,      // C#  (minor half-step)
    9/8,        // D
    6/5,        // D#  (minor third)
    5/4,        // E   (major third)
    4/3,        // F   (perfect fourth)
    45/32,      // F#  (augmented fourth, tritone)
    3/2,        // G   (perfect fifth)
    8/5,        // G#  (minor sixth)
    5/3,        // A   (major sixth)
    9/5,        // A#  (minor seventh)
    15/8        // B   (major seventh)
  ],

  // Pythagorean: built from stacked pure 3:2 fifths, reduced to one octave
  pythagorean: (function() {
    // circle of fifths order: C G D A E B F# C# G# D# A# F
    const fifthOrder = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
    const ratios = new Array(12);
    let r = 1;
    ratios[0] = 1; // C
    for (let i = 1; i < 12; i++) {
      r = r * (3/2);
      while (r >= 2) r /= 2;
      ratios[fifthOrder[i]] = r;
    }
    return ratios;
  })(),

  // 1/4-comma Meantone: pure major thirds (5:4), fifth = 5^(1/4)
  meantone: (function() {
    const fifth = Math.pow(5, 0.25); // ~1.4953
    const ratios = new Array(12);
    // Build from C using the fifth
    const cof = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
    ratios[0] = 1;
    let r = 1;
    for (let i = 1; i < 12; i++) {
      r = r * fifth;
      while (r >= 2) r /= 2;
      ratios[cof[i]] = r;
    }
    return ratios;
  })(),

  // Werckmeister III (1691) — key-color well temperament
  werckmeister: [
    1,                              // C
    256/243,                        // C#
    Math.sqrt(2) * 64/81,           // D
    32/27,                          // D#
    Math.pow(2, 1/4) * 4/5,         // E  (approx)
    4/3,                            // F
    1024/729,                       // F#
    3 * Math.pow(2, -1/4) / 2,      // G  (approx)
    128/81,                         // G#
    Math.pow(2, 3/4) / Math.sqrt(3),// A  (approx)
    16/9,                           // A#
    Math.pow(2, 1/4) * 128/135      // B  (approx)
  ].map((v, i) => {
    // Use precise published values (cents from C, then convert)
    const cents = [0, 90.225, 192.18, 294.135, 390.225, 498.045, 588.27, 696.09, 792.18, 888.27, 996.09, 1092.18];
    return Math.pow(2, cents[i]/1200);
  }),

  // Kirnberger III (1779)
  kirnberger: (function() {
    const cents = [0, 90.225, 203.91, 294.135, 386.314, 498.045, 590.224, 701.955, 792.18, 884.359, 996.09, 1088.27];
    return cents.map(c => Math.pow(2, c/1200));
  })(),

  // Young Well Temperament (1799, Thomas Young)
  young: (function() {
    const cents = [0, 93.9, 195.8, 297.8, 391.7, 499.9, 591.9, 697.9, 795.8, 893.8, 999.8, 1091.8];
    return cents.map(c => Math.pow(2, c/1200));
  })(),

  // French Classical (d'Alembert / Rameau circa 1722)
  french: (function() {
    const cents = [0, 76.0, 193.2, 310.3, 386.3, 503.4, 579.5, 696.6, 772.6, 889.7, 1006.8, 1082.9];
    return cents.map(c => Math.pow(2, c/1200));
  })()
};

/**
 * Get frequency in Hz for a given MIDI note number and tuning system.
 * @param {number} midiNote - MIDI note number (e.g. 60 = C4)
 * @param {string} tuning   - Tuning system name
 * @returns {number} Frequency in Hz
 */
export function getFrequency(midiNote, tuning = 'equal') {
  const ratios = TUNING_RATIOS[tuning] || TUNING_RATIOS.equal;

  const pitchClass = ((midiNote % 12) + 12) % 12;
  const octave     = Math.floor(midiNote / 12) - 1; // MIDI 12 = C0

  // Reference: A4 = MIDI 69 = 440 Hz
  // C in the same octave as the note:
  // C_midi = octave * 12 + 12 = midiNote - pitchClass (roughly)
  // We compute relative to C4 = MIDI 60
  const C4_HZ  = A4_HZ / (TUNING_RATIOS[tuning][9] || Math.pow(2, 9/12));
  const C_note_hz = C4_HZ * Math.pow(2, octave - 4);

  return C_note_hz * ratios[pitchClass];
}

/**
 * Get the deviation in cents from Equal Temperament.
 */
export function getCentsDeviation(midiNote, tuning) {
  const f_tuned = getFrequency(midiNote, tuning);
  const f_equal = getFrequency(midiNote, 'equal');
  return 1200 * Math.log2(f_tuned / f_equal);
}

/** All supported tuning names */
export const TUNING_NAMES = Object.keys(TUNING_RATIOS);
