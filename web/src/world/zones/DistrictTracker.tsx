"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { DistrictId } from "@/content/types";
import { useAppStore } from "@/state/useAppStore";
import type { DistrictLayout } from "@/world/layout/types";
import { districtAt, districtRect } from "@/world/lib/area";
import { vehicleState } from "@/world/vehicle/vehicleState";

const CHECK_INTERVAL = 0.25;

/** Marks a district visited when the car is inside its area. Writes the store only on changes. */
export function DistrictTracker({ layouts }: { layouts: readonly DistrictLayout[] }) {
  const rects = useMemo(() => layouts.map((l) => ({ id: l.id, rect: districtRect(l) })), [layouts]);
  const last = useRef<DistrictId | null>(null);
  const timer = useRef(0);

  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < CHECK_INTERVAL) return;
    timer.current = 0;
    if (vehicleState.bodyHandle < 0) return;
    const id = districtAt(rects, vehicleState.position.x, vehicleState.position.z);
    if (id && id !== last.current) {
      const { visitedDistricts, markVisited } = useAppStore.getState();
      if (!visitedDistricts.includes(id)) markVisited(id);
    }
    last.current = id;
  });
  return null;
}
