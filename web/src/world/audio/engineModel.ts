// Engine model (pure, allocation-free): turns car telemetry into an RPM, a fake gear and an engine load
// that the synth (carSounds.ts) follows. The car has no real gearbox; the gears exist only so the sound
// climbs, drops on an upshift and climbs again, which is what makes a car *sound* like it accelerates.
//
// Gear rule: rpm = idle + |speed| × ratio(gear), where each gear's ratio puts `shiftUpRpm` at that
// gear's top speed. Upshifts cut the throttle for `shiftTime` (the audible "bwaaa—bwaaa" gap);
// downshifts blip the throttle to rev-match. In the air the clutch is "in": the engine free-revs with
// the throttle. Holding the throttle at the limiter bounces it (fuel cut, drop, climb, cut…).

import { VEHICLE } from "@/world/vehicle/constants";

export const ENGINE = {
  idleRpm: 750,
  /** Limiter: at this rpm (with throttle) the fuel cuts and the rpm drops by `limiterDrop` */
  limiterRpm: 4900,
  limiterDrop: 250,
  /** Fuel-cut time per limiter bounce (s) */
  limiterCutTime: 0.075,
  redlineRpm: 5200,
  /** Upshift above / downshift below (rpm, in the current gear at the current speed) */
  shiftUpRpm: 4500,
  shiftDownRpm: 1900,
  /**
   * Top speed of each forward gear at `shiftUpRpm` (m/s). The last gear reaches past VEHICLE.maxSpeed
   * so top speed sits high in 5th instead of bouncing off the limiter.
   */
  gearTopSpeeds: [6.5, 11.5, 16.5, 22, VEHICLE.maxSpeed + 1] as readonly number[],
  /** Reverse is one long gear up to a bit past the max reverse speed */
  reverseTopSpeed: VEHICLE.maxReverseSpeed + 2,
  /** Throttle cut while changing up (s) */
  shiftTime: 0.17,
  /** Rev-match blip on a downshift (s, and the load it adds) */
  blipTime: 0.12,
  blipLoad: 0.55,
  /** Clutch slip off the line: extra rpm at full throttle and standstill, fading out by `launchSpeed` */
  launchRpm: 1600,
  launchSpeed: 5,
  /** Extra rpm from wheelspin (rear slip × load) */
  spinRpm: 1100,
  /** RPM smoothing rates (1/s): rising on the ground / in the air (free rev), and falling */
  riseRate: 7,
  airRiseRate: 11,
  fallRate: 5,
  /** Load smoothing (1/s) */
  loadRate: 14,
  /** Below this |forward speed| (m/s) a negative throttle while rolling back counts as reversing */
  reverseMinSpeed: 0.4,
} as const;

export const FORWARD_GEARS = ENGINE.gearTopSpeeds.length;
/** Gear index used for reverse */
export const REVERSE_GEAR = -1;

export interface EngineInput {
  /** Signed speed along the nose (m/s) */
  forwardSpeed: number;
  /** −1..1 (negative = brake / reverse) */
  throttle: number;
  grounded: boolean;
  /** 0..1 rear-wheel slip (wheelspin adds rpm) */
  slip: number;
}

export interface EngineState {
  rpm: number;
  /** 1..FORWARD_GEARS, or REVERSE_GEAR */
  gear: number;
  /** Smoothed 0..1 throttle the engine is actually making power with (0 during cuts) */
  load: number;
  /** Seconds left of the upshift throttle cut */
  shiftTimer: number;
  /** Seconds left of the downshift blip */
  blipTimer: number;
  /** Seconds left of the limiter fuel cut */
  cutTimer: number;
  /** Bumped on every upshift / downshift (the synth and tests watch these edges) */
  upshifts: number;
  downshifts: number;
  /** Bumped on every limiter bounce */
  limiterHits: number;
}

export function createEngineState(): EngineState {
  return {
    rpm: ENGINE.idleRpm,
    gear: 1,
    load: 0,
    shiftTimer: 0,
    blipTimer: 0,
    cutTimer: 0,
    upshifts: 0,
    downshifts: 0,
    limiterHits: 0,
  };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Frame-rate independent approach factor for a rate (1/s) over dt */
const approach = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** rpm per (m/s) in a gear (forward 1..N or REVERSE_GEAR) */
export function gearRatio(gear: number): number {
  const top = gear === REVERSE_GEAR ? ENGINE.reverseTopSpeed : ENGINE.gearTopSpeeds[clamp(gear, 1, FORWARD_GEARS) - 1];
  return (ENGINE.shiftUpRpm - ENGINE.idleRpm) / top;
}

/** Engine rpm with the clutch locked in `gear` at |speed| m/s */
export function rpmForSpeed(speed: number, gear: number): number {
  return ENGINE.idleRpm + Math.abs(speed) * gearRatio(gear);
}

/**
 * The gear a car cruising at `speed` would be in, without hysteresis (the lowest gear that stays
 * under the upshift rpm). Stateless, so independent consumers (the backfire rule) agree on it.
 */
export function gearForSpeed(speed: number): number {
  const s = Math.abs(speed);
  for (let g = 1; g < FORWARD_GEARS; g++) if (s < ENGINE.gearTopSpeeds[g - 1]) return g;
  return FORWARD_GEARS;
}

/** Stateless rpm estimate from speed alone (cruising in `gearForSpeed`) */
export function estimateRpm(speed: number): number {
  return rpmForSpeed(speed, gearForSpeed(speed));
}

/** 0 at idle, 1 at the limiter */
export function rpmNorm(rpm: number): number {
  return clamp((rpm - ENGINE.idleRpm) / (ENGINE.limiterRpm - ENGINE.idleRpm), 0, 1);
}

/** Advance the engine by dt seconds. Mutates and returns `s`. */
export function stepEngine(s: EngineState, input: EngineInput, dt: number): EngineState {
  if (dt <= 0) return s;
  const speed = Math.abs(input.forwardSpeed);
  const reversing = input.forwardSpeed < -ENGINE.reverseMinSpeed || (speed < ENGINE.reverseMinSpeed && input.throttle < 0);
  // Pedal load: forward throttle, or "back" while reversing (braking while rolling forward = no power)
  let pedal = input.throttle > 0 ? input.throttle : reversing ? -input.throttle : 0;
  pedal = clamp(pedal, 0, 1);

  s.shiftTimer = Math.max(0, s.shiftTimer - dt);
  s.blipTimer = Math.max(0, s.blipTimer - dt);
  s.cutTimer = Math.max(0, s.cutTimer - dt);

  let target: number;
  if (input.grounded) {
    if (reversing) {
      s.gear = REVERSE_GEAR;
    } else {
      if (s.gear === REVERSE_GEAR) s.gear = 1;
      // At most one shift per step, and none during a shift: no gear hunting
      if (s.shiftTimer === 0) {
        if (s.gear < FORWARD_GEARS && rpmForSpeed(speed, s.gear) > ENGINE.shiftUpRpm) {
          s.gear += 1;
          s.shiftTimer = ENGINE.shiftTime;
          s.upshifts += 1;
        } else if (s.gear > 1 && rpmForSpeed(speed, s.gear) < ENGINE.shiftDownRpm) {
          s.gear -= 1;
          s.blipTimer = ENGINE.blipTime;
          s.downshifts += 1;
        }
      }
    }
    const geared = rpmForSpeed(speed, s.gear);
    // Clutch slip off the line (fades as the car gets going), plus wheelspin
    const launch = pedal * ENGINE.launchRpm * (1 - clamp(speed / ENGINE.launchSpeed, 0, 1));
    const spin = clamp(input.slip, 0, 1) * pedal * ENGINE.spinRpm;
    target = Math.max(geared, ENGINE.idleRpm + launch) + spin;
  } else {
    // Airborne: wheels unloaded, the engine revs freely with the throttle
    target = ENGINE.idleRpm + pedal * (ENGINE.limiterRpm + 300 - ENGINE.idleRpm);
  }

  // Effective load: cut during upshifts and limiter cuts, blipped on downshifts
  let load = pedal;
  if (s.shiftTimer > 0 || s.cutTimer > 0) load = 0;
  else if (s.blipTimer > 0) load = Math.max(load, ENGINE.blipLoad);

  // While the fuel is cut the engine can only fall
  if (s.cutTimer > 0 || s.shiftTimer > 0) target = Math.min(target, s.rpm);
  if (s.blipTimer > 0) target += 700 * (s.blipTimer / ENGINE.blipTime);
  // Never past the limiter by more than a hair: reaching it is what triggers the bounce
  target = Math.min(target, ENGINE.limiterRpm + 150);

  const rising = target > s.rpm;
  const rate = rising ? (input.grounded ? ENGINE.riseRate : ENGINE.airRiseRate) * (0.35 + load) : ENGINE.fallRate;
  // Upshifts drop fast: the gear change pulls the revs down hard
  const k = approach(s.shiftTimer > 0 ? 16 : rate, dt);
  s.rpm += (target - s.rpm) * k;

  // Limiter bounce
  if (s.rpm >= ENGINE.limiterRpm && pedal > 0.3 && s.cutTimer === 0) {
    s.rpm -= ENGINE.limiterDrop;
    s.cutTimer = ENGINE.limiterCutTime;
    s.limiterHits += 1;
    load = 0;
  }

  s.rpm = clamp(s.rpm, ENGINE.idleRpm * 0.9, ENGINE.redlineRpm);
  s.load += (load - s.load) * approach(ENGINE.loadRate, dt);
  return s;
}
