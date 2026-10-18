"use client";

import { useRapier } from "@react-three/rapier";
import { useEffect } from "react";
import { ARM } from "./armMath";
import { registerCameraWorld } from "./cameraCollision";

/**
 * Hands the Rapier world to the follow camera, which is mounted outside <Physics> (so the intro orbit
 * runs before the world is built). Mount once inside <Physics>. Renders nothing.
 */
export function CameraCollisionBridge() {
  const { world, rapier } = useRapier();
  useEffect(() => registerCameraWorld(world, rapier, ARM.probeRadius), [world, rapier]);
  return null;
}
