"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { DustSystem } from "./dustSystem";

/**
 * Wheel smoke and dust: one instanced draw of camera-facing particles, pooled (no allocations after
 * mount). Emits from each wheel's contact point on slip (drift, handbrake, burnout), on landings
 * (a burst) and as light dust when driving fast. Colour comes from the ground under the wheel.
 *
 * No props. Mount anywhere inside the <Canvas> (no <Physics> needed); it reads `vehicleState`.
 */
export function WheelDust() {
  const [system] = useState(() => new DustSystem());
  const quality = useAppStore((s) => s.quality);

  useEffect(() => () => system.dispose(), [system]);
  useEffect(() => system.setQuality(quality), [system, quality]);

  useFrame((_, rawDt) => {
    const { mode, gpsOpen } = useAppStore.getState();
    system.frame(Math.min(rawDt, 0.1), vehicleState, quality, mode === "card" || gpsOpen);
  });

  return (
    <mesh geometry={system.geometry} material={system.material} frustumCulled={false} renderOrder={10} />
  );
}
