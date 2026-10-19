// Trauma-based camera shake (after Squirrel Eiserloh's GDC talk "Juicing your cameras with math").
// Systems add trauma 0..1 on events (landings, crashes); it decays linearly, and the visible shake is
// trauma² (small knocks barely register, big ones really kick). Offsets come from smooth 1D gradient
// noise, not Math.random, so the shake reads as a physical judder rather than per-frame jitter.
// FollowCamera applies it; with prefers-reduced-motion it's skipped entirely.
import { clamp } from "@/world/lib/damping";

export const SHAKE = {
  /** Trauma lost per second (full trauma lasts ~0.7 s) */
  decay: 1.4,
  /** Positional offset at full shake (m), in the camera's right/up plane */
  maxOffset: 0.38,
  /** Roll at full shake (rad) */
  maxRoll: 0.04,
  /** Small aim wobble at full shake (rad), applied to yaw/pitch */
  maxAim: 0.018,
  /** Noise speed: how many "wobbles" per second */
  frequency: 16,
  /** Continuous rumble at top speed on rough ground, in shake units (added after squaring trauma) */
  rumbleMax: 0.07,
  /** Multiplier in "low" quality */
  lowQualityScale: 0.5,
} as const;

/** Global, mutable shake state (read by FollowCamera). */
export const shakeState = {
  trauma: 0,
};

/** Add camera trauma (0..1, clamped). Safe to call from anywhere, any time. */
export function addTrauma(amount: number): void {
  if (!(amount > 0)) return;
  shakeState.trauma = clamp(shakeState.trauma + amount, 0, 1);
}

/** Trauma after `dt` seconds of linear decay. */
export function decayTrauma(trauma: number, dt: number): number {
  return Math.max(0, trauma - SHAKE.decay * dt);
}

/**
 * Speed rumble in shake units: grows with speed and with how hard the suspension is working, so a
 * smooth road is calm and a rough trail at speed buzzes.
 */
export function rumbleAmount(speedRatio: number, suspensionActivity: number): number {
  const s = clamp(speedRatio, 0, 1);
  return SHAKE.rumbleMax * s * s * (0.25 + 0.75 * clamp(suspensionActivity, 0, 1));
}

/** Visible shake 0..1 = trauma² + rumble. */
export function shakeAmount(trauma: number, rumble = 0): number {
  const t = clamp(trauma, 0, 1);
  return clamp(t * t + rumble, 0, 1);
}

// --- 1D gradient (Perlin-style) noise in [-1, 1], deterministic, allocation-free ---

function hash(i: number): number {
  // Integer hash → [-1, 1] gradient
  let h = Math.imul(i ^ 0x27d4eb2d, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** Smooth noise: 0 at integers, continuous slope, |value| ≤ 1. */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const g0 = hash(i);
  const g1 = hash(i + 1);
  const u = f * f * (3 - 2 * f);
  // Gradients times distance; ×2 scales the typical peak (±0.5) to ±1
  return clamp(2 * (g0 * f * (1 - u) + g1 * (f - 1) * u), -1, 1);
}

export interface ShakeOffsets {
  /** Metres along camera right / up */
  x: number;
  y: number;
  /** Radians: roll about the view axis, plus small yaw/pitch */
  roll: number;
  yaw: number;
  pitch: number;
}

/** Offsets for a shake `amount` (0..1) at `time` seconds. Each channel samples its own noise lane. */
export function shakeOffsets(amount: number, time: number, out: ShakeOffsets, scale = 1): ShakeOffsets {
  const a = clamp(amount, 0, 1) * scale;
  const t = time * SHAKE.frequency;
  out.x = SHAKE.maxOffset * a * noise1(t);
  out.y = SHAKE.maxOffset * a * noise1(t + 101.3);
  out.roll = SHAKE.maxRoll * a * noise1(t + 211.7);
  out.yaw = SHAKE.maxAim * a * noise1(t + 307.1);
  out.pitch = SHAKE.maxAim * a * noise1(t + 401.9);
  return out;
}

// --- FOV punch: a short field-of-view kick on landings and crashes ---
// An underdamped spring rather than an instant offset: an impulse sets its velocity, so the FOV
// swells over a few frames, overshoots a touch and settles (an instant jump would read as a glitch).
// FollowCamera adds it on top of the speed FOV; it's off with prefers-reduced-motion.

export const FOV_PUNCH = {
  /** Spring stiffness (1/s²) and damping ratio */
  stiffness: 150,
  damping: 0.55,
  /** Velocity (deg/s) per degree of requested peak, so `addFovPunch(d)` peaks at about `d` degrees */
  impulsePerDeg: 23,
  /** The punch never exceeds this many degrees either way */
  maxDeg: 7,
  /** Landing: degrees wider at full strength (the world "whomps" outward on touchdown) */
  landingDeg: 5,
  /** Crash: degrees narrower at full strength (a punch-in on the hit) */
  crashDeg: -4,
  /** Events weaker than this don't punch */
  minStrength: 0.15,
  /** Integration substep (s) */
  maxStep: 1 / 120,
} as const;

/** Global, mutable FOV punch state (read and advanced by FollowCamera). */
export const fovPunchState = {
  /** Current offset (degrees) */
  value: 0,
  velocity: 0,
};

/** Punch the FOV by roughly `degrees` at the peak (negative narrows). */
export function addFovPunch(degrees: number, state = fovPunchState): void {
  if (!Number.isFinite(degrees) || degrees === 0) return;
  state.velocity += degrees * FOV_PUNCH.impulsePerDeg;
}

/** Punch for a landing (strength 0..1); 0 for soft ones. */
export function landingFovPunch(strength: number): number {
  return strength < FOV_PUNCH.minStrength ? 0 : FOV_PUNCH.landingDeg * clamp(strength, 0, 1);
}

/** Punch for a crash (strength 0..1); 0 for light ones. */
export function crashFovPunch(strength: number): number {
  return strength < FOV_PUNCH.minStrength ? 0 : FOV_PUNCH.crashDeg * clamp(strength, 0, 1);
}

/** Advance the punch spring by `dt` seconds; returns the offset in degrees. */
export function stepFovPunch(dt: number, state = fovPunchState): number {
  if (!(dt > 0)) return state.value;
  const k = FOV_PUNCH.stiffness;
  const c = 2 * FOV_PUNCH.damping * Math.sqrt(k);
  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(FOV_PUNCH.maxStep, left);
    left -= h;
    state.velocity += (-k * state.value - c * state.velocity) * h;
    state.value += state.velocity * h;
  }
  if (Math.abs(state.value) > FOV_PUNCH.maxDeg) {
    state.value = clamp(state.value, -FOV_PUNCH.maxDeg, FOV_PUNCH.maxDeg);
    state.velocity = 0;
  }
  // Settle to exactly 0 so FollowCamera stops touching the projection matrix
  if (Math.abs(state.value) < 1e-3 && Math.abs(state.velocity) < 1e-2) {
    state.value = 0;
    state.velocity = 0;
  }
  return state.value;
}

/** Drop any punch in flight (reduced motion, intro). */
export function resetFovPunch(state = fovPunchState): number {
  state.value = 0;
  state.velocity = 0;
  return 0;
}
