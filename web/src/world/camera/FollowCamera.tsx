"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAppStore } from "@/state/useAppStore";
import { damp, dampFactor, smoothstep } from "@/world/lib/damping";
import { VEHICLE } from "@/world/vehicle/constants";
import { vehicleState } from "@/world/vehicle/vehicleState";
import {
  CAMERA,
  clampAboveTerrain,
  followFov,
  followLookAt,
  followPosition,
  liftForLineOfSight,
  orbitDistance,
  orbitPosition,
  projectToTangent,
} from "./cameraMath";
import { ARM, armTargetRatio, capHeight, ceilingCap, smoothArmRatio, smoothCeilingCap } from "./armMath";
import { probeRay, sweepArm } from "./cameraCollision";
import {
  SHAKE,
  decayTrauma,
  resetFovPunch,
  rumbleAmount,
  shakeAmount,
  shakeOffsets,
  shakeState,
  stepFovPunch,
  type ShakeOffsets,
} from "./shake";

/** Seconds after a teleport during which the camera keeps snapping (covers the interpolation frame) */
const SNAP_WINDOW = 0.15;

/**
 * Planet camera. Intro: a slow orbit around the spawn's up axis, far enough out to frame the whole
 * globe (looking at the planet centre), then a swoop down into the follow cam.
 * Drive/card: third-person follow whose up is the local planet up at the car, damped, kept above the
 * terrain and lifted when a hill blocks the view, with a speed FOV, an FOV punch (`addFovPunch`) and
 * trauma-based shake (`addTrauma` in ./shake). Punch and shake are off with prefers-reduced-motion;
 * shake is halved in "low" quality.
 *
 * Solid geometry: a spring arm runs from a pivot over the car's roof to the (damped, unobstructed)
 * follow position. Each frame one sphere sweep along it pulls the camera in fast when a wall, roof or
 * mound is in the way and eases it back out slowly; one ray up from the pivot finds a ceiling and caps
 * the camera's height under it (dock, pit garage, lab, dungeon). Both are Rapier queries against fixed
 * colliders only (cars, props and sensors are skipped); see ./cameraCollision and ./armMath.
 *
 * No props. Mount anywhere inside the <Canvas> (it doesn't need <Physics>); it reads `vehicleState`.
 * Collision needs <CameraCollisionBridge /> mounted inside <Physics>; without it, terrain-only.
 */
export function FollowCamera() {
  const reduced = usePrefersReducedMotion();
  // Mutable per-frame camera state (a ref: written every frame, never triggers renders)
  const cam = useRef({
    pos: new Vector3(),
    look: new Vector3(),
    up: new Vector3(0, 1, 0),
    heading: new Vector3(0, 0, 1),
    wantPos: new Vector3(),
    wantLook: new Vector3(),
    /** Spring arm: pivot over the car, unit direction to the free position, and the final position */
    pivot: new Vector3(),
    armDir: new Vector3(),
    final: new Vector3(),
    /** 0..1 of the arm in use (1 = nothing in the way), smoothed fast-in / slow-out */
    armRatio: 1,
    /** Max camera height above the car under a ceiling (Infinity in the open), smoothed */
    ceiling: Infinity,
    right: new Vector3(),
    camUp: new Vector3(),
    shake: { x: 0, y: 0, roll: 0, yaw: 0, pitch: 0 } as ShakeOffsets,
    orbitAngle: -Math.PI / 2,
    blend: 0,
    teleportSeen: -1,
    initialized: false,
    fov: CAMERA.fov as number,
  });

  // QA hook: `?debug` exposes the live camera state (arm ratio, ceiling cap) to the screenshot harness
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    const w = window as unknown as { __cameraArm?: unknown };
    w.__cameraArm = cam.current;
    return () => {
      delete w.__cameraArm;
    };
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = cam.current;
    // The default camera is a PerspectiveCamera (Canvas `camera` prop)
    const camera = state.camera as PerspectiveCamera;
    const v = vehicleState;
    const { mode, quality } = useAppStore.getState();
    const justTeleported = performance.now() / 1000 - v.teleportedAt < SNAP_WINDOW;
    const snap = !c.initialized || c.teleportSeen !== v.teleportCount || justTeleported;

    // Smoothed local frame: up follows the planet normal at the car, heading the car's nose
    if (snap) {
      c.up.copy(v.up);
      c.heading.copy(v.heading);
    } else {
      c.up.lerp(v.up, dampFactor(CAMERA.upLambda, dt)).normalize();
      c.heading.lerp(v.heading, dampFactor(CAMERA.headingLambda, dt));
    }
    projectToTangent(c.heading, c.up, v.heading);

    followPosition(v.position, c.up, c.heading, v.forwardSpeed, c.wantPos);
    followLookAt(v.position, c.up, c.heading, v.forwardSpeed, c.wantLook);
    c.pivot.copy(v.position).addScaledVector(c.up, ARM.pivotHeight);
    // Ceiling over the car (follow mode only: the intro orbit is meant to be high)
    if (mode !== "intro") {
      const cap = ceilingCap(probeRay(c.pivot, c.up, ARM.ceilingProbe));
      c.ceiling = snap ? cap : smoothCeilingCap(c.ceiling, cap, dt);
    } else {
      c.ceiling = Infinity;
    }
    clampAboveTerrain(c.wantPos, CAMERA.minClearance);
    liftForLineOfSight(c.wantLook, c.wantPos, CAMERA.losClearance);
    // Under a roof the terrain lift is moot; the ceiling wins
    capHeight(c.wantPos, v.position, c.up, c.ceiling);

    if (mode === "intro") {
      c.orbitAngle += (reduced ? CAMERA.orbitSpeedReduced : CAMERA.orbitSpeed) * dt;
      orbitPosition(v.up, c.orbitAngle, orbitDistance(CAMERA.fov, camera.aspect), c.pos);
      c.look.set(0, 0, 0);
      c.final.copy(c.pos);
      c.armRatio = 1;
      c.blend = 0;
      c.initialized = true;
      c.teleportSeen = v.teleportCount;
    } else {
      // Snap on the first frame and after teleports (the fade hides the cut)
      if (snap) {
        c.pos.copy(c.wantPos);
        c.look.copy(c.wantLook);
        c.teleportSeen = v.teleportCount;
        c.initialized = true;
        c.blend = 1;
      }
      c.blend = Math.min(1, c.blend + dt / CAMERA.introBlend);
      // Slow at first so the descent from the orbit is gentle, then the normal follow rate
      const ramp = 0.12 + 0.88 * smoothstep(c.blend);
      c.pos.lerp(c.wantPos, dampFactor(CAMERA.positionLambda * ramp, dt));
      c.look.lerp(c.wantLook, dampFactor(CAMERA.lookLambda * ramp, dt));
      // The damped position can lag into a hillside or up into a roof: hard-clamp it too
      clampAboveTerrain(c.pos, CAMERA.minClearance);
      capHeight(c.pos, v.position, c.up, c.ceiling);

      // Spring arm: sweep from the pivot to the free position, sit short of the first obstacle
      c.armDir.copy(c.pos).sub(c.pivot);
      const length = c.armDir.length();
      if (length > 1e-4) c.armDir.divideScalar(length);
      const target = armTargetRatio(sweepArm(c.pivot, c.armDir, length), length);
      c.armRatio = snap ? target : smoothArmRatio(c.armRatio, target, length, dt);
      c.final.copy(c.pivot).addScaledVector(c.armDir, length * c.armRatio);
      clampAboveTerrain(c.final, CAMERA.minClearance);
    }

    camera.position.copy(c.final);
    // During the intro blend, the up vector eases from the orbit's to the car's (same here: both local)
    camera.up.copy(c.up);
    camera.lookAt(c.look);

    // --- Shake: trauma² + speed rumble, noise-driven, applied in camera space ---
    shakeState.trauma = decayTrauma(shakeState.trauma, dt);
    if (reduced) {
      shakeState.trauma = 0;
    } else if (mode !== "intro") {
      const speedRatio = Math.abs(v.forwardSpeed) / VEHICLE.maxSpeed;
      const rumble = v.grounded ? rumbleAmount(speedRatio, v.suspensionActivity) : 0;
      const amount = shakeAmount(shakeState.trauma, rumble);
      if (amount > 0.0005) {
        const scale = quality === "low" ? SHAKE.lowQualityScale : 1;
        const o = shakeOffsets(amount, state.clock.elapsedTime, c.shake, scale);
        c.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        c.camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(c.right, o.x).addScaledVector(c.camUp, o.y);
        camera.rotateZ(o.roll);
        camera.rotateY(o.yaw);
        camera.rotateX(o.pitch);
      }
    }

    const targetFov = mode === "intro" ? CAMERA.fov : followFov(v.forwardSpeed);
    c.fov = damp(c.fov, targetFov, 3, dt);
    // FOV punch (landings, crashes; see addFovPunch) rides on top of the damped speed FOV
    const punch = reduced || mode === "intro" ? resetFovPunch() : stepFovPunch(dt);
    const fov = c.fov + punch;
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
