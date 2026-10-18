// Mutable, non-reactive vehicle telemetry shared by the camera, FX, lights, zones and trackers.
// Written once per rendered frame by <Vehicle> (after the physics step); read by anyone in useFrame.
// Never put this in React state. All vectors are world space, planet centre = origin.
import { Quaternion, Vector3 } from "three";

export interface WheelState {
  /** Point where the tyre meets the ground (or the hanging wheel's bottom when airborne) */
  contact: Vector3;
  inContact: boolean;
  /** 0..1: sliding / spinning intensity (drift, handbrake, burnout) */
  slip: number;
}

export const vehicleState = {
  /** Interpolated chassis origin (≈ ground level under the car; the body sits above it) */
  position: new Vector3(),
  /** Chassis orientation (car +Z forward, +Y up) */
  quaternion: new Quaternion(),
  /** Point on the terrain surface directly below the car (radial projection) */
  ground: new Vector3(),
  /** Local planet "up" at the car: normalize(position) */
  up: new Vector3(0, 1, 0),
  /** The car's own up axis (differs from `up` when tilted or flipped) */
  chassisUp: new Vector3(0, 1, 0),
  /** Car nose direction (chassis +Z) */
  forward: new Vector3(0, 0, 1),
  /** Nose direction projected onto the tangent plane (unit; stable even when the car pitches) */
  heading: new Vector3(0, 0, 1),
  /** Heading in degrees, CCW from local north (same convention as planet/frame `yaw`) */
  yawDeg: 0,
  velocity: new Vector3(),
  /** Signed speed along the nose (m/s, negative reversing) */
  forwardSpeed: 0,
  /** |velocity| (m/s) */
  speed: 0,
  /** At least one wheel touching (with a short grace period over bumps) */
  grounded: true,
  wheelsInContact: 0,
  /** Seconds since any wheel last touched */
  airTime: 0,
  /** 0..1 how hard the suspension is working (rough ground), for camera rumble */
  suspensionActivity: 0,
  /** Per wheel: 0 front-left, 1 front-right, 2 back-left, 3 back-right */
  wheels: [0, 1, 2, 3].map(
    (): WheelState => ({ contact: new Vector3(), inContact: false, slip: 0 }),
  ),
  /** Bumped on each landing after real airtime; `landingSpeed` is the vertical impact (m/s) */
  landingCount: 0,
  landingSpeed: 0,
  /** Rapier handle of the chassis body, used by sensors to recognise the car. -1 until mounted. */
  bodyHandle: -1,
  /** Bumped on every teleport/reset so the camera can snap instead of flying around the planet */
  teleportCount: 0,
  /** performance.now() / 1000 of the last teleport, for the fade */
  teleportedAt: -Infinity,
};

export type VehicleState = typeof vehicleState;
