"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAppStore } from "@/state/useAppStore";
import { clamp, damp, dampFactor, smoothstep } from "@/world/lib/damping";
import { VEHICLE } from "@/world/vehicle/constants";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { CAMERA, followFov, followLookAt, followPosition, orbitPosition } from "./cameraMath";

/**
 * Intro: slow orbit around the car's spawn. Drive/card: third-person follow with frame-rate
 * independent damping. The switch blends smoothly (damping ramps up over CAMERA.introBlend).
 */
export function FollowCamera() {
  const reduced = usePrefersReducedMotion();
  // Mutable per-frame camera state (a ref: written every frame, never triggers renders)
  const cam = useRef({
    pos: new Vector3(),
    look: new Vector3(),
    wantPos: new Vector3(),
    wantLook: new Vector3(),
    orbitAngle: -Math.PI / 2,
    blend: 0,
    teleportSeen: -1,
    initialized: false,
    fov: CAMERA.fov as number,
  });

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = cam.current;
    // The default camera is a PerspectiveCamera (Canvas `camera` prop)
    const camera = state.camera as PerspectiveCamera;
    const v = vehicleState;
    const mode = useAppStore.getState().mode;

    followPosition(v.position, v.yaw, v.forwardSpeed, c.wantPos);
    followLookAt(v.position, v.yaw, v.forwardSpeed, c.wantLook);

    if (mode === "intro") {
      c.orbitAngle += (reduced ? CAMERA.orbitSpeedReduced : CAMERA.orbitSpeed) * dt;
      orbitPosition(v.ground, c.orbitAngle, c.pos);
      c.look.copy(v.ground);
      c.blend = 0;
      c.initialized = true;
      c.teleportSeen = v.teleportCount;
    } else {
      // Snap on first frame and after teleports (the fade hides the cut)
      if (!c.initialized || c.teleportSeen !== v.teleportCount) {
        c.pos.copy(c.wantPos);
        c.look.copy(c.wantLook);
        c.teleportSeen = v.teleportCount;
        c.initialized = true;
        c.blend = 1;
      }
      c.blend = Math.min(1, c.blend + dt / CAMERA.introBlend);
      // Slow at first so the fly-down from the orbit is gentle, then the normal follow rate
      const ramp = 0.15 + 0.85 * smoothstep(c.blend);
      c.pos.lerp(c.wantPos, dampFactor(CAMERA.positionLambda * ramp, dt));
      c.look.lerp(c.wantLook, dampFactor(CAMERA.lookLambda * ramp, dt));
    }

    camera.position.copy(c.pos);

    // A faint rumble near top speed; never with reduced motion
    if (!reduced && mode === "drive") {
      const ratio = Math.abs(v.forwardSpeed) / VEHICLE.maxSpeed;
      const amp = CAMERA.shake * clamp((ratio - 0.7) / 0.3, 0, 1);
      if (amp > 0) {
        const t = state.clock.elapsedTime;
        camera.position.x += Math.sin(t * 41) * amp;
        camera.position.y += Math.sin(t * 57 + 1.3) * amp * 0.6;
      }
    }
    camera.lookAt(c.look);

    const targetFov = mode === "intro" ? CAMERA.fov : followFov(v.forwardSpeed);
    const fov = damp(c.fov, targetFov, 3, dt);
    if (Math.abs(fov - camera.fov) > 0.01) {
      c.fov = fov;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
