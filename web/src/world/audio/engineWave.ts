// Engine waveforms (pure): the Fourier series of one four-stroke cycle of exhaust pulses, for
// OscillatorNode.setPeriodicWave. The oscillator runs at the *cycle* rate (rpm / 120), so its
// harmonics are the engine orders: a V8 fires 8 times per cycle, so order 8 is the firing tone.
//
// Each firing is a sharp exhaust pulse: instant rise, exponential decay (spectrum ∝ 1 / (1 + i·2πnτ),
// the natural 1/f tilt of a real exhaust). Identical, evenly spaced pulses put energy only at
// multiples of order 8 (a smooth, high-rev scream). Real cylinders are never identical: small
// differences in strength and timing leak energy into the low orders between them, which is the
// lumpy idle "burble" — heard at the true cycle rate, with no LFO wobble.

export const CYLINDERS = 8;
/** Harmonics in each wave; at the limiter (50 Hz cycle) this reaches ~4.8 kHz */
export const ENGINE_HARMONICS = 96;
/** Pulse decay as a fraction of the cycle */
const PULSE_DECAY = 0.018;

/**
 * Per-cylinder pulse strength of the lumpy idle wave: a once-per-cycle swell (order 1, the slow
 * "lope"), one bank louder than the other (order 4, the classic V8 "potato" half-order), a touch of
 * order 2, plus small irregularities so it isn't too clean. Timing offsets are fractions of a cycle.
 */
const LUMPY_AMP = Array.from(
  { length: 8 },
  (_, k) => 1 + 0.3 * Math.cos((2 * Math.PI * k) / 8) + 0.3 * Math.cos(Math.PI * k) + 0.12 * Math.cos((4 * Math.PI * k) / 8 + 1) + [0, 0.05, -0.04, 0.03, -0.05, 0.02, 0.04, -0.03][k],
);
const LUMPY_SHIFT = [0, 0.006, -0.004, 0.009, -0.002, 0.007, -0.006, 0.003];

export interface WaveCoefficients {
  real: Float32Array<ArrayBuffer>;
  imag: Float32Array<ArrayBuffer>;
}

/** Fourier coefficients of a cycle of pulses with the given strengths and timing offsets. */
export function pulseWave(amps: readonly number[], shifts: readonly number[], harmonics = ENGINE_HARMONICS): WaveCoefficients {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  const n = amps.length;
  for (let h = 1; h <= harmonics; h++) {
    // Sum of the pulses' phasors at this harmonic (pulse k fires at (k + shift) / n of the cycle)
    let re = 0;
    let im = 0;
    for (let k = 0; k < n; k++) {
      const phase = -2 * Math.PI * h * ((k + shifts[k]) / n);
      re += amps[k] * Math.cos(phase);
      im += amps[k] * Math.sin(phase);
    }
    // × pulse shape 1 / (1 + i·w), w = 2πhτ
    const w = 2 * Math.PI * h * PULSE_DECAY;
    const d = 1 + w * w;
    const cr = (re + im * w) / d;
    const ci = (im - re * w) / d;
    // x(t) = Σ real·cos + imag·sin  ⇔  c·e^{iωt} + conj
    real[h] = 2 * cr;
    imag[h] = -2 * ci;
  }
  return { real, imag };
}

/** Uneven cylinders: a lumpy, burbling idle */
export const lumpyWave = (): WaveCoefficients => pulseWave(LUMPY_AMP, LUMPY_SHIFT);
/** Even cylinders: energy only at the firing orders (smooth at high revs) */
export const smoothWave = (): WaveCoefficients => pulseWave(new Array(CYLINDERS).fill(1), new Array(CYLINDERS).fill(0));

/** Magnitude of harmonic h */
export const harmonicLevel = (w: WaveCoefficients, h: number): number => Math.hypot(w.real[h], w.imag[h]);
