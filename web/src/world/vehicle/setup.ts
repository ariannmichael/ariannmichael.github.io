// Wheel layout and Rapier DynamicRayCastVehicleController configuration. Pure apart from the controller
// calls, so the same code runs in the app and in the headless physics test (setup.test.ts).
import type { DynamicRayCastVehicleController } from "@dimforge/rapier3d-compat";
import { PLANET_GRAVITY } from "@/world/planet/config";
import { VEHICLE, type VehicleTuning } from "./constants";

export const WHEEL_COUNT = 4;
/** Controller wheel indices (match VEHICLE_WHEEL_NODES) */
export const FRONT_WHEELS = [0, 1] as const;
export const REAR_WHEELS = [2, 3] as const;

export interface WheelLayout {
  /** Suspension hard point (top of the ray) in car space */
  x: number;
  y: number;
  z: number;
  front: boolean;
  /** Suspension length at static equilibrium (the wheel sits at the raised-ride hub height) */
  restingLength: number;
}

/** Fraction of the car's weight carried by the front axle (lever rule on the CoM between the axles). */
export function frontLoadShare(t: VehicleTuning = VEHICLE): number {
  return (t.centerOfMassZ - t.wheelRearZ) / (t.wheelFrontZ - t.wheelRearZ);
}

/**
 * Static sag of one wheel on an axle carrying `share` of the weight. Rapier's per-wheel spring force
 * is stiffness × compression × mass, so k·x·m = m·g·share/2 → x = g·share / (2k).
 */
export function staticSag(share: number, t: VehicleTuning = VEHICLE, gravity = PLANET_GRAVITY): number {
  return (gravity * share) / (2 * t.suspensionStiffness);
}

/**
 * Hard points chosen so that at rest every hub sits at `hubY - rideLift` (raised body), whatever the
 * axle loads. Order: front-left, front-right, back-left, back-right. Car +X is the left side.
 */
export function wheelLayout(t: VehicleTuning = VEHICLE): WheelLayout[] {
  const front = frontLoadShare(t);
  const hubRest = t.hubY - t.rideLift;
  const axle = (z: number, share: number, isFront: boolean) => {
    const resting = t.suspensionRest - staticSag(share, t);
    return [1, -1].map((side) => ({
      x: side * t.trackX,
      y: hubRest + resting,
      z,
      front: isFront,
      restingLength: resting,
    }));
  };
  return [...axle(t.wheelFrontZ, front, true), ...axle(t.wheelRearZ, 1 - front, false)];
}

/** Box inertia of the chassis (diagonal, kg·m²), scaled up for calmer rotation. */
export function chassisInertia(t: VehicleTuning = VEHICLE): { x: number; y: number; z: number } {
  const [hx, hy, hz] = t.chassisHalf;
  const w = 2 * hx;
  const h = 2 * hy;
  const d = 2 * hz;
  const k = (t.mass / 12) * t.inertiaScale;
  return { x: k * (h * h + d * d), y: k * (w * w + d * d), z: k * (w * w + h * h) };
}

/** Add the four wheels and apply suspension/tyre tuning to a fresh controller. */
export function configureVehicleController(vc: DynamicRayCastVehicleController, t: VehicleTuning = VEHICLE): void {
  // Chassis up = +Y (rays cast along chassis -Y, so they follow the car on the sphere), forward = +Z.
  // Rapier defaults forward to +X. Its setter is (oddly) named `setIndexForwardAxis`.
  vc.indexUpAxis = 1;
  vc.setIndexForwardAxis = 2;

  const down = { x: 0, y: -1, z: 0 };
  // Axle along -X: with forward +Z and up +Y, positive wheel rotation then means rolling forward
  const axle = { x: -1, y: 0, z: 0 };
  const maxForce = t.mass * PLANET_GRAVITY * t.maxSuspensionForceG;

  wheelLayout(t).forEach((w, i) => {
    vc.addWheel({ x: w.x, y: w.y, z: w.z }, down, axle, t.suspensionRest, t.wheelRadius);
    vc.setWheelMaxSuspensionTravel(i, t.suspensionTravel);
    vc.setWheelSuspensionStiffness(i, t.suspensionStiffness);
    vc.setWheelSuspensionCompression(i, t.suspensionCompression);
    vc.setWheelSuspensionRelaxation(i, t.suspensionRelaxation);
    vc.setWheelMaxSuspensionForce(i, maxForce);
    vc.setWheelFrictionSlip(i, w.front ? t.frictionSlipFront : t.frictionSlipRear);
    vc.setWheelSideFrictionStiffness(i, t.sideFrictionStiffness);
  });
}
