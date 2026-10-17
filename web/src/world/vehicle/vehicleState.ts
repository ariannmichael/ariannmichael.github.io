// Mutable, non-reactive vehicle telemetry shared by the camera, light rig, zones and trackers.
// Written once per frame by the vehicle; read by anyone in useFrame. Never put this in React state.
import { Vector3 } from "three";

export const vehicleState = {
  /** Interpolated ball position (world metres) */
  position: new Vector3(),
  /** Point on the ground under the car */
  ground: new Vector3(),
  yaw: 0,
  /** Signed speed along the heading (m/s) */
  forwardSpeed: 0,
  /** Rapier handle of the vehicle body, used by sensors to recognise the car. -1 until mounted. */
  bodyHandle: -1,
  /** Bumped on every teleport/reset so the camera can snap instead of flying across town */
  teleportCount: 0,
  /** performance.now() / 1000 of the last teleport, for the fade */
  teleportedAt: -Infinity,
};

export type VehicleState = typeof vehicleState;
