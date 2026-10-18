"use client";

// Applies planet gravity (toward the origin) to every dynamic rigid body before each physics step.
// Mount inside <Physics gravity={[0, 0, 0]}>; Rapier's own uniform gravity must be off.
//
// Why impulses, not forces: Rapier user forces persist until resetForces(), so using addForce
// would mean resetting every body's forces each step, wiping forces other systems (the vehicle)
// add. An impulse of F·dt right before the step is one-shot and integrates identically
// (v += g·dt). dt = world.timestep, the fixed step the Physics component uses (1/60).
//
// Per-body opt-out / tuning: a body's gravityScale (RigidBody `gravityScale` prop) multiplies
// planet gravity, so gravityScale={0} disables it. Kinematic, fixed, disabled and sleeping bodies
// are skipped: sleepers are resting on the ground, and anything that disturbs them wakes them.

import { useBeforePhysicsStep } from "@react-three/rapier";
import { applyPlanetGravityStep } from "./gravity";

export function PlanetGravity() {
  useBeforePhysicsStep(applyPlanetGravityStep);
  return null;
}
