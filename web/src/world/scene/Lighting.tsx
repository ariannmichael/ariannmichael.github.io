"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Object3D, type DirectionalLight } from "three";
import { vehicleState } from "@/world/vehicle/vehicleState";

export const SKY_TOP = "#5fa8e8";
export const SKY_HORIZON = "#cfe7f5";
const SUN_OFFSET = { x: 18, y: 34, z: -12 };
/** Half-size of the shadow frustum (m): small, because it follows the car */
const SHADOW_EXTENT = 30;
const SHADOW_MAP = 2048;
const TEXEL = (SHADOW_EXTENT * 2) / SHADOW_MAP;

/**
 * Kenney look: soft hemisphere fill plus one warm sun. The sun and its shadow camera follow the car,
 * so a small frustum gives sharp shadows wherever you drive.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const light = useRef<DirectionalLight>(null);
  const [target] = useState(() => new Object3D());

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    // Snap to whole shadow texels so shadows don't shimmer while driving
    const x = Math.round(vehicleState.ground.x / TEXEL) * TEXEL;
    const z = Math.round(vehicleState.ground.z / TEXEL) * TEXEL;
    target.position.set(x, 0, z);
    target.updateMatrixWorld();
    l.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
  });

  return (
    <>
      <hemisphereLight args={[SKY_HORIZON, "#7aa35a", 1.35]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color="#fff1d6"
        intensity={1.9}
        castShadow={shadows}
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}
