// Pure juice rules: when lights glow, how much the exhaust puffs, when speed lines and impact bursts
// fire, how markers react to the car. No three.js objects here, so every rule is unit-tested and the
// renderers (fxSystem, CarLights, Zones) stay thin.
import { clamp, smoothstep } from "@/world/lib/damping";

// --- Car lights ---

export const LIGHTS = {
  /** Throttle/brake input below this magnitude counts as released */
  inputDeadzone: 0.05,
  /** Brake lights need the car rolling forward faster than this (m/s); slower, S means reverse */
  brakeMinSpeed: 0.5,
  /** Reverse lights once the car rolls backwards faster than this (m/s) */
  reverseMinSpeed: 0.3,
  /** Headlights fade in between these night amounts (skyState.night: 0 day, 1 full night) */
  headOnNight: 0.3,
  headFullNight: 0.6,
  /** Tail lights glow this much as running lights while the headlights are on */
  tailRunning: 0.35,
} as const;

/** 1 while braking: handbrake, or S held while still rolling forward (S at a standstill = reverse). */
export function brakeLightLevel(throttle: number, forwardSpeed: number, handbrake: boolean): number {
  if (handbrake) return 1;
  return throttle < -LIGHTS.inputDeadzone && forwardSpeed > LIGHTS.brakeMinSpeed ? 1 : 0;
}

/** 1 while reversing (rolling backwards, or S held once the car has stopped). */
export function reverseLightLevel(throttle: number, forwardSpeed: number): number {
  if (forwardSpeed < -LIGHTS.reverseMinSpeed) return 1;
  return throttle < -LIGHTS.inputDeadzone && forwardSpeed <= LIGHTS.brakeMinSpeed ? 1 : 0;
}

/** 0..1 headlight level from the night amount at the camera (night-side biomes only). */
export function headlightLevel(night: number): number {
  return smoothstep((night - LIGHTS.headOnNight) / (LIGHTS.headFullNight - LIGHTS.headOnNight));
}

/** Tail lamp level: full when braking, dim running lights at night. */
export function tailLevel(brake: number, head: number): number {
  return Math.max(brake, head * LIGHTS.tailRunning);
}

// --- Exhaust ---

export const EXHAUST = {
  /** Puffs per second at idle (a lazy burble) */
  idleRate: 2.5,
  /** Extra puffs per second at full throttle (fewer at speed: the airflow hides them) */
  throttleRate: 14,
} as const;

/** Exhaust puffs per second. Off in the air (the engine revs but the puffs would hang mid-air oddly). */
export function exhaustRate(throttle: number, speedRatio: number, grounded: boolean): number {
  if (!grounded) return 0;
  const load = clamp(Math.abs(throttle), 0, 1);
  return EXHAUST.idleRate + EXHAUST.throttleRate * load * (1 - 0.5 * clamp(speedRatio, 0, 1));
}

// --- Speed lines ---

export const SPEED_LINES = {
  /** Fraction of VEHICLE.maxSpeed where streaks start, and the rate (per second) at top speed */
  start: 0.7,
  rate: 40,
} as const;

/** Speed-line streaks per second for a speed ratio (0 below `start`, ramping to `rate`). */
export function speedLineRate(speedRatio: number): number {
  const t = (speedRatio - SPEED_LINES.start) / (1 - SPEED_LINES.start);
  return t <= 0 ? 0 : SPEED_LINES.rate * Math.min(1, t);
}

// --- Impacts ---

export const IMPACT = {
  /** Events weaker than this make no burst (scrapes) */
  minStrength: 0.08,
  /** Bursts closer together than this (s) are merged into the first (contact events come in volleys) */
  minInterval: 0.09,
  /** Orange sparks for world hits, coloured chips for loose props: counts at strength 0 and 1 */
  sparksMin: 6,
  sparksMax: 30,
  chipsMin: 4,
  chipsMax: 14,
  /**
   * A chassis bump against the WORLD only sparks when at least this strong: rough landings and kerb
   * scrapes also raise contact-force bumps, and they shouldn't shower sparks on every jump
   */
  worldBumpMin: 0.3,
} as const;

export interface ImpactBurst {
  sparks: number;
  chips: number;
}

/**
 * Particle counts for an impact. World hits (crash, or a bump against fixed geometry) throw sparks;
 * prop hits throw chips plus a few sparks when hard. `rate` scales for quality.
 */
export function impactBurst(strength: number, dynamic: boolean, rate: number, out: ImpactBurst): ImpactBurst {
  const s = clamp(strength, 0, 1);
  out.sparks = 0;
  out.chips = 0;
  if (s < IMPACT.minStrength) return out;
  if (dynamic) {
    out.chips = Math.round((IMPACT.chipsMin + (IMPACT.chipsMax - IMPACT.chipsMin) * s) * rate);
    out.sparks = s > 0.5 ? Math.round(IMPACT.sparksMin * rate) : 0;
  } else {
    out.sparks = Math.round((IMPACT.sparksMin + (IMPACT.sparksMax - IMPACT.sparksMin) * s) * rate);
  }
  return out;
}

/** Burst strength for a `bump` event (0 = no burst): prop hits always count, world bumps only hard ones. */
export function bumpBurstStrength(strength: number, dynamic: boolean): number {
  if (dynamic) return strength;
  return strength >= IMPACT.worldBumpMin ? strength : 0;
}

/** Rate limiter: true when a burst may fire at `now` (seconds); records it. */
export function allowBurst(limiter: { last: number }, now: number, minInterval: number = IMPACT.minInterval): boolean {
  if (now - limiter.last < minInterval) return false;
  limiter.last = now;
  return true;
}

// --- Landing ---

export const LANDING_RING = {
  /** Landings softer than this (event strength 0..1) make no ring */
  minStrength: 0.12,
  countMin: 12,
  countMax: 30,
  /** Outward speed (m/s) at strength 0 and 1 */
  speedMin: 3.5,
  speedMax: 8,
} as const;

/** Dust-ring particle count for a landing (0 = no ring). */
export function landingRingCount(strength: number, rate: number): number {
  const s = clamp(strength, 0, 1);
  if (s < LANDING_RING.minStrength) return 0;
  return Math.round((LANDING_RING.countMin + (LANDING_RING.countMax - LANDING_RING.countMin) * s) * rate);
}

// --- Markers ---

export const MARKER_FX = {
  /** The marker is fully "lit" inside this distance (m, car to marker) and calm beyond `far` */
  near: 4,
  far: 32,
  /** Marker brightness (zones/markerFx intensity) at rest, fully lit, and while it is the active zone */
  baseIntensity: 0.85,
  litIntensity: 1.25,
  activeIntensity: 1.6,
  /** Brightness pulse: always a gentle breath, stronger as the car closes in */
  idlePulse: 0.08,
  litPulse: 0.18,
  /** Ground ring scale pulse amplitude at full proximity and its speed (rad/s) */
  pulseAmp: 0.05,
  pulseSpeed: 4,
  /** Label pop on zone enter: duration (s) and overshoot (fraction of the label size) */
  popDuration: 0.45,
  popOvershoot: 0.3,
} as const;

/** 0 (far) .. 1 (parked on it) from the car-to-marker distance, eased. */
export function markerProximity(distance: number): number {
  return smoothstep((MARKER_FX.far - distance) / (MARKER_FX.far - MARKER_FX.near));
}

/** Label scale multiplier `t` seconds after the zone became active: a quick overshoot back to 1. */
export function labelPop(t: number): number {
  if (!(t >= 0) || t >= MARKER_FX.popDuration) return 1;
  const u = t / MARKER_FX.popDuration;
  return 1 + MARKER_FX.popOvershoot * Math.sin(Math.PI * u) * (1 - u);
}
