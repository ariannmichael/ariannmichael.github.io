"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { useAppStore } from "@/state/useAppStore";
import { districtOfBiome } from "@/world/lib/biomeMap";
import { biomeAt } from "@/world/planet/terrain";
import type { BiomeId } from "@/world/planet/types";
import { vehicleState } from "@/world/vehicle/vehicleState";

const CHECK_INTERVAL = 0.25;
const _dir = new Vector3();

/**
 * Tracks the biome under the car: marks its district visited and reports biome changes (sky tint).
 * Writes the store only on changes.
 */
export function DistrictTracker({ onBiome }: { onBiome?: (biome: BiomeId) => void }) {
  const last = useRef<BiomeId | null>(null);
  const timer = useRef(CHECK_INTERVAL);

  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < CHECK_INTERVAL) return;
    timer.current = 0;
    if (vehicleState.bodyHandle < 0 || vehicleState.position.lengthSq() < 1) return;
    const biome = biomeAt(_dir.copy(vehicleState.position).normalize());
    if (biome === last.current) return;
    last.current = biome;
    onBiome?.(biome);
    const district = districtOfBiome(biome);
    if (district) useAppStore.getState().markVisited(district);
  });
  return null;
}
