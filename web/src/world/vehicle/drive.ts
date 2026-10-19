// Pure driving logic for the ray-cast vehicle. No three.js, no Rapier: numbers in, numbers out, so it's
// unit-testable and the component stays a thin adapter. Rapier does the tyre and suspension physics;
// this decides what to ask of it each step (engine force, brakes, steer angle, grip).
import { clamp, damp } from "@/world/lib/damping";
import { PLANET_GRAVITY } from "@/world/planet/config";
import { VEHICLE, type VehicleTuning } from "./constants";

export interface DriveInput {
  /** -1..1, forward positive */
  throttle: number;
  /** -1..1, right positive */
  steer: number;
  /** Handbrake (Space / on-screen brake): locks the rear and drops rear grip */
  handbrake: boolean;
}

/** What the controller applies this step. Forces in N, impulses in N·s, angles in rad. */
export interface DriveCommand {
  /** Front-wheel steer angle. Positive = left (Rapier steers about the chassis +Y) */
  steerAngle: number;
  engineFront: number;
  engineRear: number;
  brakeFront: number;
  brakeRear: number;
  /** Multiplier on the rear tyres' friction slip (drift / handbrake) */
  rearGrip: number;
}

/** Combine keyboard and touch axes: whichever has the larger magnitude wins. */
export function combineAxis(a: number, b: number): number {
  return Math.abs(a) >= Math.abs(b) ? a : b;
}

/**
 * Steering lock as a fraction of `maxSteer` at a given speed: full at walking pace, easing down to
 * `highSpeedSteer` at top speed so fast driving isn't twitchy.
 */
export function steerCurve(speed: number, t: VehicleTuning = VEHICLE): number {
  const x = clamp(Math.abs(speed) / t.maxSpeed, 0, 1);
  // Smooth (quadratic) fade: little loss at low speed, most of it near the top
  return 1 - (1 - t.highSpeedSteer) * x * x;
}

/** Steer angle (rad) for a steer input (-1..1, right positive) at a speed. Positive angle = left. */
export function steerAngle(steer: number, speed: number, t: VehicleTuning = VEHICLE): number {
  return -clamp(steer, -1, 1) * t.maxSteer * steerCurve(speed, t);
}

/** Smooth the digital steering input: quick to turn in, quicker to centre. */
export function smoothSteer(current: number, target: number, dt: number, t: VehicleTuning = VEHICLE): number {
  // Heading back towards centre (or across it): the faster return rate
  const returning = Math.abs(target) < Math.abs(current) || target * current < 0;
  return damp(current, target, returning ? t.steerReturn : t.steerResponse, dt);
}

/**
 * Total forward drive force for a throttle at a forward speed. The force fades out quadratically to
 * zero at `maxSpeed`, which is what caps the top speed (Rapier has no drivetrain model).
 */
export function engineCurve(throttle: number, forwardSpeed: number, t: VehicleTuning = VEHICLE): number {
  const th = clamp(throttle, -1, 1);
  if (th > 0) {
    const headroom = 1 - clamp(forwardSpeed / t.maxSpeed, 0, 1) ** 2;
    return t.engineForce * th * headroom;
  }
  if (th < 0) {
    const headroom = 1 - clamp(-forwardSpeed / t.maxReverseSpeed, 0, 1) ** 2;
    return t.reverseForce * th * headroom;
  }
  return 0;
}

/** Slip angle (rad): angle between where the car points and where it's going. 0 when nearly stopped. */
export function slipAngle(forwardSpeed: number, lateralSpeed: number): number {
  const speed = Math.hypot(forwardSpeed, lateralSpeed);
  if (speed < 2) return 0;
  return Math.atan2(Math.abs(lateralSpeed), Math.abs(forwardSpeed));
}

/**
 * Rear grip multiplier. Grip holds until the slip angle passes `slipAngleStart`, then drops towards
 * `driftGrip` (sliding friction is lower than gripping friction): once the rear steps out it stays
 * out while you hold the throttle, which is the drift. The handbrake drops it further on demand.
 */
export function rearGripFactor(slip: number, handbrake: boolean, t: VehicleTuning = VEHICLE): number {
  const k = clamp((slip - t.slipAngleStart) / (t.slipAngleFull - t.slipAngleStart), 0, 1);
  const sliding = 1 + (t.driftGrip - 1) * k * k * (3 - 2 * k);
  return handbrake ? Math.min(sliding, t.handbrakeGrip) : sliding;
}

/**
 * One step of driver intent → controller command. `forwardSpeed` is signed (Rapier's
 * currentVehicleSpeed), `lateralSpeed` the sideways speed in the chassis frame.
 */
export function driveCommand(
  input: DriveInput,
  forwardSpeed: number,
  lateralSpeed: number,
  dt: number,
  t: VehicleTuning = VEHICLE,
): DriveCommand {
  const th = clamp(input.throttle, -1, 1);
  const slip = slipAngle(forwardSpeed, lateralSpeed);
  const cmd: DriveCommand = {
    steerAngle: steerAngle(input.steer, forwardSpeed, t),
    engineFront: 0,
    engineRear: 0,
    brakeFront: 0,
    brakeRear: 0,
    rearGrip: rearGripFactor(slip, input.handbrake, t),
  };

  // Pressing against the direction of travel brakes first; below ~1 m/s it drives the other way
  const against = th !== 0 && Math.sign(th) !== Math.sign(forwardSpeed) && Math.abs(forwardSpeed) > 1;
  if (against) {
    const b = t.brakeImpulse * Math.abs(th);
    cmd.brakeFront = b;
    cmd.brakeRear = b;
  } else if (th !== 0) {
    const force = engineCurve(th, forwardSpeed, t);
    // Per wheel: two wheels per axle
    cmd.engineFront = (force * (1 - t.rearTorqueShare)) / 2;
    cmd.engineRear = (force * t.rearTorqueShare) / 2;
  } else {
    // Rolling resistance: an impulse that would remove `coastDecel` m/s² of speed, split over 4 wheels
    const b = (t.mass * t.coastDecel * dt) / 4;
    cmd.brakeFront = b;
    cmd.brakeRear = b;
  }

  if (input.handbrake) {
    cmd.brakeRear = Math.max(cmd.brakeRear, t.handbrakeImpulse);
    // Keep some drive on the front so handbrake turns still pull through
    cmd.engineRear = 0;
  }

  // Parking brake: nearly stopped with no throttle, all four wheels hold at full grip (no creeping
  // down slopes, and the handbrake's low drift grip doesn't apply to a parked car)
  if (th === 0 && Math.abs(forwardSpeed) < t.parkSpeed) {
    cmd.brakeFront = t.brakeImpulse;
    cmd.brakeRear = t.brakeImpulse;
    cmd.rearGrip = 1;
  }
  return cmd;
}

/**
 * Drift stabiliser: the new yaw rate (rad/s, + = turning left) after one step. Only yaw that grows a
 * slip angle beyond `driftMaxAngle` is damped; counter-steering and gentle drifts are untouched.
 * `lateralSpeed` > 0 = sliding towards the car's right.
 */
export function stabiliseYaw(
  yawRate: number,
  forwardSpeed: number,
  lateralSpeed: number,
  dt: number,
  t: VehicleTuning = VEHICLE,
): number {
  if (forwardSpeed < 3) return yawRate;
  const excess = slipAngle(forwardSpeed, lateralSpeed) - t.driftMaxAngle;
  // Sliding right while yawing left (or vice versa) is the rear swinging further out
  if (excess <= 0 || Math.sign(yawRate) !== Math.sign(lateralSpeed)) return yawRate;
  return yawRate * Math.exp(-t.driftYawDamping * excess * dt);
}

// ---------------------------------------------------------------------------------------------------
// Air control and recovery

export interface AirControlResult {
  /** Change of angular velocity about the chassis right (+X) axis this step (rad/s). Positive = nose down */
  pitch: number;
  /** Change of angular velocity about the chassis forward (+Z) axis this step (rad/s). Positive = roll right */
  roll: number;
}

/**
 * Over-the-Hill-style air control: throttle pitches (forward = nose down), steer rolls. The change is
 * zero once the car already spins faster than `airMaxRate` in that direction.
 * `pitchRate`/`rollRate` are the current angular speeds about the same axes.
 */
export function airControl(
  input: Pick<DriveInput, "throttle" | "steer">,
  pitchRate: number,
  rollRate: number,
  dt: number,
  t: VehicleTuning = VEHICLE,
): AirControlResult {
  const limit = (rate: number, delta: number) => {
    if (delta === 0) return 0;
    const target = rate + delta;
    if (Math.abs(target) <= t.airMaxRate) return delta;
    // Allow any change that slows the spin, never one that speeds it past the cap
    return Math.sign(delta) === Math.sign(rate) ? Math.max(0, t.airMaxRate - Math.abs(rate)) * Math.sign(delta) : delta;
  };
  return {
    pitch: limit(pitchRate, clamp(input.throttle, -1, 1) * t.airPitchAccel * dt),
    roll: limit(rollRate, clamp(input.steer, -1, 1) * t.airRollAccel * dt),
  };
}

export interface UprightState {
  /** Seconds spent flipped and stuck */
  flippedFor: number;
  /** True while the assist is turning the car back over */
  assisting: boolean;
}

/**
 * Auto-upright decision. `upDot` = chassis up · planet up (1 upright, -1 on the roof).
 * The assist starts after the car has been flipped and nearly stopped for `flippedDelay` seconds and
 * keeps going until it's back near upright. Returns the next state (pure; caller keeps it).
 */
export function uprightStep(
  state: UprightState,
  upDot: number,
  speed: number,
  dt: number,
  t: VehicleTuning = VEHICLE,
): UprightState {
  if (state.assisting) {
    return upDot >= t.uprightDoneDot ? { flippedFor: 0, assisting: false } : { flippedFor: state.flippedFor, assisting: true };
  }
  const stuck = upDot < t.flippedDot && speed < t.flippedMaxSpeed;
  const flippedFor = stuck ? state.flippedFor + dt : 0;
  return { flippedFor, assisting: flippedFor >= t.flippedDelay };
}

// ---------------------------------------------------------------------------------------------------
// Feedback

/** Camera trauma (0..1) for a touchdown at `verticalSpeed` (m/s, positive = moving into the ground). */
export function landingTrauma(verticalSpeed: number, t: VehicleTuning = VEHICLE): number {
  return clamp((verticalSpeed - t.landingShakeMin) / (t.landingShakeMax - t.landingShakeMin), 0, 1) * 0.8;
}

/** Camera trauma for losing `dv` m/s of speed in one physics step (a crash). */
export function crashTrauma(dv: number, t: VehicleTuning = VEHICLE): number {
  return clamp((dv - t.crashDvMin) / (t.crashDvMax - t.crashDvMin), 0, 1) * 0.9;
}

/** Camera trauma for a contact-force event (N) on the chassis. */
export function contactTrauma(force: number, t: VehicleTuning = VEHICLE): number {
  const weight = t.mass * PLANET_GRAVITY;
  const g = force / weight;
  return clamp((g - t.contactForceMinG) / (t.contactForceMaxG - t.contactForceMinG), 0, 1) * 0.7;
}
