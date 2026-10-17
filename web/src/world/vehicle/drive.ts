// Pure arcade driving model. Given the car's planar velocity, heading and input, returns the next
// planar velocity and heading. The physics ball supplies collisions and gravity; this supplies the feel.
//
// Frame: yaw 0 faces +Z. forward = (sin yaw, cos yaw), right = (-cos yaw, sin yaw) in (x, z).
// Steering right (steer > 0) turns clockwise seen from above, i.e. yaw decreases.
import { approach, clamp } from "@/world/lib/damping";
import { VEHICLE } from "./constants";

export type DriveTuning = typeof VEHICLE;

export interface DriveInput {
  /** -1..1, forward positive */
  throttle: number;
  /** -1..1, right positive */
  steer: number;
  /** Handbrake: strong braking plus low sideways grip (drift) */
  brake: boolean;
}

export interface DriveState {
  vx: number;
  vz: number;
  yaw: number;
}

export function forwardOf(yaw: number): [number, number] {
  return [Math.sin(yaw), Math.cos(yaw)];
}

export function rightOf(yaw: number): [number, number] {
  return [-Math.cos(yaw), Math.sin(yaw)];
}

/**
 * Steering authority as a function of forward speed: zero at standstill (no turning on the spot),
 * full at `steerRampSpeed`, then slightly reduced towards top speed for stability.
 */
export function steerSpeedFactor(forwardSpeed: number, t: DriveTuning = VEHICLE): number {
  const s = Math.abs(forwardSpeed);
  const ramp = clamp(s / t.steerRampSpeed, 0, 1);
  const highSpeed = 1 - t.highSpeedSteerLoss * clamp(s / t.maxSpeed, 0, 1);
  return ramp * highSpeed;
}

/** Yaw rate (rad/s) for a steer input at a forward speed; reversing inverts the steering. */
export function yawRate(steer: number, forwardSpeed: number, t: DriveTuning = VEHICLE): number {
  const dir = forwardSpeed < 0 ? -1 : 1;
  return -steer * t.steerRate * steerSpeedFactor(forwardSpeed, t) * dir;
}

/** New forward speed after one step of throttle / brake / coast. */
export function longitudinalStep(
  vf: number,
  input: DriveInput,
  dt: number,
  t: DriveTuning = VEHICLE,
): number {
  if (input.brake) return approach(vf, 0, t.brakeDecel * dt);
  const th = clamp(input.throttle, -1, 1);
  if (th === 0) return vf * Math.exp(-t.coastDrag * dt);
  // Pressing against the direction of travel brakes first, then reverses
  if (Math.sign(th) !== Math.sign(vf) && Math.abs(vf) > 0.5) {
    return approach(vf, 0, t.brakeDecel * Math.abs(th) * dt);
  }
  if (th > 0) {
    // Acceleration fades out quadratically towards top speed
    const headroom = 1 - clamp(vf / t.maxSpeed, 0, 1) ** 2;
    const next = vf + t.engineAccel * th * headroom * dt;
    return Math.min(next, Math.max(vf, t.maxSpeed));
  }
  const next = vf + t.reverseAccel * th * dt;
  return Math.max(next, Math.min(vf, -t.maxReverseSpeed));
}

/**
 * One fixed step of the driving model. `grounded` false gives reduced steering and no traction.
 * The velocity is re-expressed along the new heading so the car carves through turns, while the
 * sideways component decays at the grip rate (low grip while handbraking = drift).
 */
export function driveStep(
  state: DriveState,
  input: DriveInput,
  dt: number,
  grounded = true,
  t: DriveTuning = VEHICLE,
): DriveState {
  const [fx, fz] = forwardOf(state.yaw);
  const [rx, rz] = rightOf(state.yaw);
  const vf = state.vx * fx + state.vz * fz;
  const vl = state.vx * rx + state.vz * rz;

  const steer = clamp(input.steer, -1, 1);
  if (!grounded) {
    const yaw = state.yaw + yawRate(steer, vf, t) * t.airSteer * dt;
    return { vx: state.vx, vz: state.vz, yaw };
  }

  const yaw = state.yaw + yawRate(steer, vf, t) * dt;
  const nvf = longitudinalStep(vf, input, dt, t);
  const grip = input.brake ? t.driftGrip : t.grip;
  const nvl = vl * Math.exp(-grip * dt);

  const [nfx, nfz] = forwardOf(yaw);
  const [nrx, nrz] = rightOf(yaw);
  return {
    vx: nvf * nfx + nvl * nrx,
    vz: nvf * nfz + nvl * nrz,
    yaw,
  };
}

/** Combine keyboard and touch axes: whichever has the larger magnitude wins. */
export function combineAxis(a: number, b: number): number {
  return Math.abs(a) >= Math.abs(b) ? a : b;
}
