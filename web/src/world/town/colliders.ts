// Static collider boxes of a district (pure: no React, no physics engine).
import type { DistrictLayout } from "@/world/layout/types";
import { lookupModel } from "@/world/lib/models";
import { placementColliderBox, resolveCollider, type ColliderBox } from "@/world/lib/placement";

export function districtColliderBoxes(layout: DistrictLayout): ColliderBox[] {
  const boxes: ColliderBox[] = [];
  for (const p of layout.placements) {
    if (p.body === "dynamic") continue;
    const info = lookupModel(p.model);
    if (!info || resolveCollider(p, info) !== "box") continue;
    boxes.push(placementColliderBox(layout.origin, p, info));
  }
  return boxes;
}
