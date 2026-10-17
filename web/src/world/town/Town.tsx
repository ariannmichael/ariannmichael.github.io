"use client";

import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import { TextureLoader } from "three";
import type { DistrictLayout } from "@/world/layout/types";
import { lookupKit, lookupModel } from "@/world/lib/models";
import { districtColliderBoxes } from "./colliders";
import { groupByModel } from "./group";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ModelGroupView, Placeholders } from "./ModelGroupView";

/** Start every model and palette download in parallel (React 19 would otherwise suspend one by one). */
export function preloadTown(layouts: readonly DistrictLayout[], extraRefs: readonly string[] = []): void {
  const refs = new Set<string>(extraRefs);
  for (const l of layouts) for (const p of l.placements) refs.add(p.model);
  const textures = new Set<string>();
  for (const ref of refs) {
    const info = lookupModel(ref);
    if (!info) continue;
    useGLTF.preload(info.url, false);
    const tex = lookupKit(info.kit)?.texture;
    if (tex) textures.add(tex);
  }
  for (const url of textures) useLoader.preload(TextureLoader, url);
}

/** Every district: instanced visuals, one fixed body of box colliders per district, dynamic props. */
export function Town({ layouts }: { layouts: readonly DistrictLayout[] }) {
  const groups = useMemo(() => groupByModel(layouts), [layouts]);
  return (
    <>
      {groups.map((g) => (
        <ModelErrorBoundary
          key={g.ref}
          name={g.ref}
          fallback={<Placeholders items={[...g.statics, ...g.dynamics]} />}
        >
          <ModelGroupView group={g} />
        </ModelErrorBoundary>
      ))}
      {layouts.map((l) => (
        <DistrictColliders key={l.id} layout={l} />
      ))}
    </>
  );
}

/** All static colliders of a district live in ONE fixed rigid body: far cheaper than one body each. */
function DistrictColliders({ layout }: { layout: DistrictLayout }) {
  const boxes = useMemo(() => districtColliderBoxes(layout), [layout]);
  if (boxes.length === 0) return null;
  return (
    <RigidBody type="fixed" colliders={false} name={`colliders-${layout.id}`}>
      {boxes.map((b, i) => (
        <CuboidCollider key={i} args={b.halfExtents} position={b.center} friction={0.2} />
      ))}
    </RigidBody>
  );
}
