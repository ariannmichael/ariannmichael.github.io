// Speedometer maths. Pure so the readout rules are tested; Speedometer writes the results to the DOM.

export const MS_TO_KMH = 3.6;
/** Digits on the readout: leading zeros are drawn dimmed, like an old arcade cabinet */
export const SPEED_DIGITS = 3;
/** Below this (km/h) the readout shows 0, so a parked car's physics jitter never reads "1" */
export const SPEED_DEADZONE_KMH = 1;
/** Segments in the bar */
export const SPEED_SEGMENTS = 12;
/** Readout smoothing rate (1/s): fast enough to feel live, slow enough that digits don't flicker */
export const SPEED_SMOOTHING = 10;
/** Forward speed (m/s) below which the gear chip shows R */
export const REVERSE_THRESHOLD = -0.5;

export function toKmh(metresPerSecond: number): number {
  return Math.abs(metresPerSecond) * MS_TO_KMH;
}

/** Integer km/h to display (clamped to what the digits can show). */
export function speedValue(kmh: number): number {
  if (!(kmh >= SPEED_DEADZONE_KMH)) return 0; // also catches NaN
  return Math.min(Math.round(kmh), 10 ** SPEED_DIGITS - 1);
}

/** 42 → { lead: "0", digits: "42" }: the dimmed zero padding and the bright value. */
export function speedText(value: number): { lead: string; digits: string } {
  const digits = String(value);
  return { lead: "0".repeat(Math.max(0, SPEED_DIGITS - digits.length)), digits };
}

/** Lit bar segments for a speed (m/s) against the car's top speed. Any motion lights at least one. */
export function litSegments(speed: number, maxSpeed: number, segments = SPEED_SEGMENTS): number {
  const f = Math.abs(speed) / maxSpeed;
  if (!(f > 0.01)) return 0;
  return Math.max(1, Math.min(segments, Math.round(f * segments)));
}

/** Frame-rate independent exponential approach of `current` to `target`. */
export function smoothToward(current: number, target: number, dt: number, rate = SPEED_SMOOTHING): number {
  return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, dt)));
}
