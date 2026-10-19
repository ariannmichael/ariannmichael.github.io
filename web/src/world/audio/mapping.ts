// Pure mappings from game state to synth parameters. No Web Audio in here: these are the numbers the
// voices in carSounds.ts / sfx.ts follow, kept separate so they can be unit-tested and tuned in one place.

import { VEHICLE } from "@/world/vehicle/constants";
import type { BiomeId } from "@/world/planet/types";
import { rpmNorm } from "./engineModel";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// --- Engine -----------------------------------------------------------------------------------------

/**
 * A big, slow-revving V8 fires 4 times per crank revolution: ~50 Hz at idle, ~330 Hz at the limiter. That low firing
 * tone, plus the uneven-cylinder orders below it (engineWave.ts), is most of what makes it sound
 * chunky rather than like a hatchback.
 */
export const PULSES_PER_REV = 4;

export const ENGINE_SOUND = {
  /** Low-pass cutoff (Hz): closed at idle, opened by rpm and much more by load (the "bark") */
  cutoffIdle: 400,
  cutoffRpm: 600,
  cutoffLoad: 1300,
  /** Pre-shaper drive: harder saturation under load */
  driveIdle: 1.4,
  driveLoad: 3.2,
  /** Output gain */
  gainIdle: 0.3,
  gainRpm: 0.2,
  gainLoad: 0.16,
  /** Lumpy (uneven-cylinder) wave share: all of it at idle, a little left at high revs */
  lumpIdle: 1,
  lumpHigh: 0.4,
  /** Combustion rasp (filtered noise) */
  raspBase: 0.025,
  raspLoad: 0.08,
} as const;

export interface EngineSoundParams {
  /** Firing frequency (Hz) */
  freq: number;
  cutoff: number;
  drive: number;
  gain: number;
  /** 0..1 crossfade from the smooth wave to the lumpy one (the idle burble) */
  burble: number;
  rasp: number;
}

export function createEngineSoundParams(): EngineSoundParams {
  return { freq: 0, cutoff: 0, drive: 0, gain: 0, burble: 0, rasp: 0 };
}

/** rpm + load → synth params (fills `out`). */
export function engineSoundParams(rpm: number, load: number, out: EngineSoundParams): EngineSoundParams {
  const E = ENGINE_SOUND;
  const n = rpmNorm(rpm);
  const l = clamp01(load);
  out.freq = (rpm / 60) * PULSES_PER_REV;
  out.cutoff = E.cutoffIdle + E.cutoffRpm * n + E.cutoffLoad * l * (0.35 + 0.65 * n);
  out.drive = lerp(E.driveIdle, E.driveLoad, l);
  out.gain = E.gainIdle + E.gainRpm * n + E.gainLoad * l;
  const lowRev = 1 - smoothstep(0, 0.45, n);
  out.burble = lerp(E.lumpHigh, E.lumpIdle, lowRev) * (1 - 0.25 * l);
  out.rasp = E.raspBase + E.raspLoad * l * (0.3 + 0.7 * n);
  return out;
}

// --- Tyres, gravel, wind, suspension ---------------------------------------------------------------

export const ROLL_SOUND = {
  /** Slip below this is silent (normal cornering micro-slip) */
  squealSlip: 0.18,
  /** Speed (m/s) needed for a squeal; a stationary burnout still squeals via wheelspin slip */
  squealMinSpeed: 1.5,
  squealGain: 0.22,
  /** Gravel crunch: full at this speed (m/s) */
  gravelFullSpeed: 18,
  gravelGain: 0.2,
  /** Sliding on dirt adds a scrabble on top of the rolling crunch */
  scrabbleGain: 0.2,
  windGain: 0.22,
  /** Extra wind while airborne (ramps in over `windAirRamp` s) */
  windAir: 0.5,
  windAirRamp: 0.4,
  rattleGain: 0.11,
} as const;

export interface RollInput {
  speed: number;
  grounded: boolean;
  airTime: number;
  /** Max slip over wheels in contact */
  slip: number;
  /** 0..1 asphalt/concrete under the car (1 = road) */
  hardness: number;
  suspensionActivity: number;
}

export interface RollParams {
  squeal: number;
  /** Squeal pitch multiplier (harder slides pitch up a touch) */
  squealPitch: number;
  gravel: number;
  /** Gravel band-pass centre (Hz) */
  gravelFreq: number;
  wind: number;
  windFreq: number;
  rattle: number;
}

export function createRollParams(): RollParams {
  return { squeal: 0, squealPitch: 1, gravel: 0, gravelFreq: 900, wind: 0, windFreq: 400, rattle: 0 };
}

export function rollParams(i: RollInput, out: RollParams): RollParams {
  const R = ROLL_SOUND;
  const speedN = clamp01(i.speed / VEHICLE.maxSpeed);
  const slipAmt = smoothstep(R.squealSlip, 0.75, i.slip);
  const ground = i.grounded ? 1 : 0;
  // Squeal needs a hard surface; on dirt the same slide is a scrabble of stones instead
  out.squeal = R.squealGain * slipAmt * i.hardness * ground * (i.speed > R.squealMinSpeed || i.slip > 0.5 ? 1 : 0);
  out.squealPitch = 0.92 + 0.18 * slipAmt;
  const roll = smoothstep(0.3, R.gravelFullSpeed, i.speed);
  const soft = 1 - 0.75 * i.hardness;
  out.gravel = ground * soft * (R.gravelGain * roll + R.scrabbleGain * slipAmt * (1 - i.hardness));
  out.gravelFreq = 650 + 1300 * speedN + 500 * slipAmt;
  const air = i.grounded ? 0 : clamp01(i.airTime / R.windAirRamp);
  out.wind = R.windGain * (speedN * speedN * 0.85 + 0.15 * speedN) * (1 + R.windAir * air);
  out.windFreq = 280 + 1100 * speedN + 300 * air;
  out.rattle = R.rattleGain * smoothstep(0.08, 0.7, i.suspensionActivity) * ground * smoothstep(0.5, 5, i.speed);
  return out;
}

/**
 * Suspension clunks: expected clunks per second from suspension activity (a Poisson rate the synth
 * samples), plus a guaranteed clunk on a sharp rise of activity.
 */
export function clunkRate(activity: number): number {
  return 7 * smoothstep(0.15, 0.9, activity);
}

// --- One-shots --------------------------------------------------------------------------------------

export interface ImpactParams {
  /** Overall gain */
  gain: number;
  /** Thud start/end pitch (Hz) */
  thudFrom: number;
  thudTo: number;
  /** Metal crunch amount 0..1 (world hits) or plastic clack (props) */
  crunch: number;
  /** Decay time (s) */
  decay: number;
  /** Pitch multiplier (random per hit) */
  pitch: number;
}

/**
 * Impact voice from an event. World hits: heavy thud + metal crunch growing with strength. Prop hits
 * (`dynamic`): a light hollow knock. `rand` is 0..1 (per-hit variation, injected for tests).
 */
export function impactParams(strength: number, dynamic: boolean, rand: number): ImpactParams {
  const s = clamp01(strength);
  const pitch = 0.88 + 0.24 * rand;
  if (dynamic) {
    return { gain: 0.2 + 0.35 * s, thudFrom: 520, thudTo: 260, crunch: 0, decay: 0.09 + 0.08 * s, pitch };
  }
  return {
    gain: 0.35 + 0.65 * s,
    thudFrom: lerp(110, 85, s),
    thudTo: 38,
    crunch: smoothstep(0.15, 0.85, s),
    decay: 0.18 + 0.35 * s,
    pitch,
  };
}

export interface LandingParams {
  gain: number;
  /** Suspension creak amount 0..1 */
  creak: number;
  /** Bottom-out clank 0..1 (only hard landings) */
  clank: number;
}

export function landingParams(strength: number): LandingParams {
  const s = clamp01(strength);
  return { gain: 0.25 + 0.6 * s, creak: smoothstep(0.05, 0.5, s), clank: smoothstep(0.55, 1, s) };
}

// --- Rate limiting ----------------------------------------------------------------------------------

/** Per-key minimum interval between triggers (impact spam from scraping walls, hover spam…). */
export class RateLimiter {
  private readonly last = new Map<string, number>();
  allow(key: string, now: number, minInterval: number): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < minInterval) return false;
    this.last.set(key, now);
    return true;
  }
}

/**
 * Impact gate: hits closer together than `window` merge, the louder one wins. Returns the strength to
 * play now (0 = swallow this hit). A crash and its contact-force bump arrive in the same step, so this
 * also stops one hit sounding twice.
 */
export class ImpactGate {
  private lastAt = -Infinity;
  private lastStrength = 0;
  constructor(private readonly window = 0.12) {}
  accept(now: number, strength: number): number {
    if (now - this.lastAt < this.window) {
      // Only a clearly louder hit may cut through the merge window
      if (strength < this.lastStrength * 1.6) return 0;
    }
    this.lastAt = now;
    this.lastStrength = strength;
    return strength;
  }
}


// --- Surface ----------------------------------------------------------------------------------------

/**
 * Baseline "hard ground" share per biome off the roads: downtown is mostly streets and plazas, the
 * crater floor is rock; everything else is dirt and grass.
 */
export const BIOME_HARDNESS: Record<BiomeId, number> = {
  home: 0,
  engineering: 0.55,
  healthcare: 0,
  financial: 0.1,
  opensource: 0.3,
  gamedev: 0,
  raceway: 0,
  badlands: 0,
};

/** 0..1 hardness under the car from the distance (m) to the nearest road centre line and the biome. */
export function surfaceHardness(roadDist: number, roadHalfWidth: number, biome: BiomeId): number {
  const asphalt = 1 - smoothstep(roadHalfWidth - 0.4, roadHalfWidth + 0.8, roadDist);
  return Math.max(asphalt, BIOME_HARDNESS[biome]);
}
