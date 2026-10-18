// Group a biome's placements by model, split into instanced (static) and dynamic bodies.
import type { ModelRef } from "@/world/layout/types";
import type { BiomeId, BiomeLayout, PlanetPlacement } from "@/world/planet/types";

export interface PlacedItem {
  biome: BiomeId;
  placement: PlanetPlacement;
}

export interface ModelGroup {
  ref: ModelRef;
  /** Rendered with InstancedMesh */
  statics: PlacedItem[];
  /** Individual dynamic rigid bodies */
  dynamics: PlacedItem[];
}

export function groupByModel(layouts: readonly BiomeLayout[]): ModelGroup[] {
  const groups = new Map<ModelRef, ModelGroup>();
  for (const layout of layouts) {
    for (const placement of layout.placements) {
      let g = groups.get(placement.model);
      if (!g) {
        g = { ref: placement.model, statics: [], dynamics: [] };
        groups.set(placement.model, g);
      }
      const item = { biome: layout.biome, placement };
      (placement.body === "dynamic" ? g.dynamics : g.statics).push(item);
    }
  }
  return [...groups.values()];
}
