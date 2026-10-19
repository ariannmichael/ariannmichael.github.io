"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { Color, Object3D, Vector3, type DirectionalLight, type HemisphereLight } from "three";
import { useAppStore } from "@/state/useAppStore";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { BlobShadow } from "./BlobShadow";
import { SUN_DIR, skyBasis, skyState, smoothstep, type SkyBasis } from "./skyState";

/** @deprecated v1 flat-town colours; the sky is biome-driven now (skyState). Kept so old imports compile. */
export const SKY_TOP = "#5fa8e8";
/** @deprecated see SKY_TOP */
export const SKY_HORIZON = "#cfe7f5";

/** Sun light sits this far from the car along SUN_DIR. */
const SUN_DISTANCE = 80;
/** Half-size of the shadow frustum (m): small, because it follows the car */
const SHADOW_EXTENT = 30;
const SHADOW_MAP = 2048;
const TEXEL = (SHADOW_EXTENT * 2) / SHADOW_MAP;

const DAY_SUN = new Color("#fff1d6");
const LOW_SUN = new Color("#ffb27a");
const NIGHT_FILL = new Color("#9aa6dc");
const GROUND_FILL = new Color("#7a7f5e");

// Light-space axes perpendicular to the sun, for texel snapping
const LIGHT_X = new Vector3().crossVectors(new Vector3(0, 1, 0), SUN_DIR).normalize();
const LIGHT_Y = new Vector3().crossVectors(SUN_DIR, LIGHT_X).normalize();

export interface LightingProps {
  /**
   * Real shadow maps. Default: on for quality "high"; off on "low", where a blob shadow under the car
   * stands in.
   */
  shadows?: boolean;
  /** Blob shadow under the car whenever real shadows are off. Default true. */
  blobShadow?: boolean;
}

/**
 * Planet lighting. The sun direction is fixed in world space (SUN_DIR), so one side of the planet is
 * day. A hemisphere fill whose "up" follows the local up at the camera keeps the night side readable.
 * The directional light and its small shadow frustum follow the car (target = car, light = car + sun × d).
 */
export function Lighting({ shadows, blobShadow = true }: LightingProps) {
  const quality = useAppStore((s) => s.quality);
  const castShadow = shadows ?? quality === "high";

  const light = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const [target] = useState(() => new Object3D());
  const [basis] = useState<SkyBasis>(() => ({ up: new Vector3(), east: new Vector3(), north: new Vector3() }));
  const [focus] = useState(() => new Vector3());

  useFrame(({ camera }) => {
    const l = light.current;
    const h = hemi.current;
    if (!l || !h) return;

    // Focus on the car; fall back to the camera before the car exists
    focus.copy(vehicleState.position.lengthSq() > 1 ? vehicleState.position : camera.position);
    skyBasis(camera.position, basis);

    // Snap the focus to whole shadow texels across the light's view so shadows don't shimmer
    const x = Math.round(focus.dot(LIGHT_X) / TEXEL) * TEXEL;
    const y = Math.round(focus.dot(LIGHT_Y) / TEXEL) * TEXEL;
    const z = focus.dot(SUN_DIR);
    target.position.copy(LIGHT_X).multiplyScalar(x).addScaledVector(LIGHT_Y, y).addScaledVector(SUN_DIR, z);
    target.updateMatrixWorld();
    l.position.copy(target.position).addScaledVector(SUN_DIR, SUN_DISTANCE);

    // Sun fades out past the terminator (without shadows it would otherwise light walls through the planet)
    const elevation = SUN_DIR.dot(basis.up);
    l.intensity = 1.9 * smoothstep(-0.12, 0.08, elevation);
    l.color.copy(LOW_SUN).lerp(DAY_SUN, smoothstep(0.0, 0.45, elevation));

    // Hemisphere fill oriented to the local up; brighter and bluer at night so every biome reads
    h.position.copy(basis.up);
    const night = skyState.night;
    h.color.copy(skyState.current.horizon).lerp(NIGHT_FILL, night * 0.6);
    h.intensity = 1.35 + 0.35 * night;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[SKY_HORIZON, GROUND_FILL, 1.35]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color="#fff1d6"
        intensity={1.9}
        castShadow={castShadow}
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={SUN_DISTANCE + 60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {blobShadow && !castShadow && <BlobShadow />}
    </>
  );
}
