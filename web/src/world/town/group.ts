// Group every placement of every district by model, split into instanced (static) and dynamic bodies.
import type { DistrictId } from "@/content/types";
import type { DistrictLayout, ModelRef, Placement } from "@/world/layout/types";
import type { TileOrigin } from "@/world/lib/placement";

export interface PlacedItem {
  district: DistrictId;
  origin: TileOrigin;
  placement: Placement;
}

export interface ModelGroup {
  ref: ModelRef;
  /** Rendered with InstancedMesh */
  statics: PlacedItem[];
  /** Individual dynamic rigid bodies */
  dynamics: PlacedItem[];
}

export function groupByModel(layouts: readonly DistrictLayout[]): ModelGroup[] {
  const groups = new Map<ModelRef, ModelGroup>();
  for (const layout of layouts) {
    for (const placement of layout.placements) {
      let g = groups.get(placement.model);
      if (!g) {
        g = { ref: placement.model, statics: [], dynamics: [] };
        groups.set(placement.model, g);
      }
      const item = { district: layout.id, origin: layout.origin, placement };
      (placement.body === "dynamic" ? g.dynamics : g.statics).push(item);
    }
  }
  return [...groups.values()];
}
