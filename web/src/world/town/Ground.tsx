"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import type { DistrictLayout } from "@/world/layout/types";
import { townRect } from "@/world/lib/area";

export const GRASS_COLOR = "#8fcf6a";
/** Empty tiles of drivable grass around the town before the invisible wall */
const MARGIN_TILES = 2;
/** The visible grass extends past the walls so the horizon never shows an edge */
const VISUAL_EXTRA = 400;
const WALL_HEIGHT = 6;
const WALL_THICKNESS = 1;
const GROUND_THICKNESS = 1;

/** Flat ground (top at y = 0) plus four invisible walls that keep the car in town. */
export function Ground({ layouts }: { layouts: readonly DistrictLayout[] }) {
  const r = useMemo(() => townRect(layouts, MARGIN_TILES), [layouts]);
  const cx = (r.minX + r.maxX) / 2;
  const cz = (r.minZ + r.maxZ) / 2;
  const hx = (r.maxX - r.minX) / 2;
  const hz = (r.maxZ - r.minZ) / 2;
  const t = WALL_THICKNESS / 2;
  const h = WALL_HEIGHT / 2;
  return (
    <>
      <RigidBody type="fixed" colliders={false} name="ground">
        {/* Ground slab slightly larger than the walled area so nothing can slip past a corner */}
        <CuboidCollider
          args={[hx + 4, GROUND_THICKNESS / 2, hz + 4]}
          position={[cx, -GROUND_THICKNESS / 2, cz]}
          friction={0.7}
        />
        <CuboidCollider args={[hx + 2 * t, h, t]} position={[cx, h, r.maxZ + t]} />
        <CuboidCollider args={[hx + 2 * t, h, t]} position={[cx, h, r.minZ - t]} />
        <CuboidCollider args={[t, h, hz + 2 * t]} position={[r.maxX + t, h, cz]} />
        <CuboidCollider args={[t, h, hz + 2 * t]} position={[r.minX - t, h, cz]} />
      </RigidBody>
      {/* Slightly below 0 so road tiles (which sit at y = 0) never z-fight with the grass */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, -0.02, cz]} receiveShadow>
        <planeGeometry args={[hx * 2 + VISUAL_EXTRA, hz * 2 + VISUAL_EXTRA]} />
        <meshStandardMaterial color={GRASS_COLOR} roughness={1} metalness={0} />
      </mesh>
    </>
  );
}
