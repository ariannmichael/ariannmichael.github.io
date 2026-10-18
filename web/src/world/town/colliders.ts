// Static collider boxes of a biome layout (pure: no React, no physics engine).
import { lookupModel } from "@/world/lib/models";
import { resolveCollider } from "@/world/lib/placement";
import { planetColliderBox, type OrientedBox } from "@/world/lib/planetPlacement";
import type { BiomeLayout } from "@/world/planet/types";

/** One oriented box per solid static placement. Flat pieces, roads and dynamic props get none. */
export function biomeColliderBoxes(layout: BiomeLayout): OrientedBox[] {
  const boxes: OrientedBox[] = [];
  for (const p of layout.placements) {
    if (p.body === "dynamic") continue;
    const info = lookupModel(p.model);
    if (!info || resolveCollider(p, info) !== "box") continue;
    boxes.push(planetColliderBox(p, info));
  }
  return boxes;
}
