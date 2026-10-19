// Road tiles overlap their neighbours by ~8 cm; overlapping tiles must never be coplanar (they sparkled).
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { getModel } from "@/world/models";
import { PLANET_RADIUS } from "@/world/planet/config";
import { latLonToDir } from "@/world/planet/sphere";
import type { PlanetPlacement } from "@/world/planet/types";
import { PLANET_LAYOUTS } from "./index";

const isStandardTile = (p: PlanetPlacement) => {
  if (!/^(city-roads\/road-|racing-kit\/road)/.test(p.model) || p.plane) return false;
  const { min, max } = getModel(p.model);
  return (Math.max(max[0] - min[0], max[2] - min[2]) / 2) * (p.scale ?? 1) <= 4.2;
};

describe("road tile stacking", () => {
  for (const layout of PLANET_LAYOUTS) {
    it(`${layout.biome}: edge-neighbouring tiles differ in height by at least 3 mm`, () => {
      const tiles = layout.placements.filter(isStandardTile);
      const dirs = tiles.map((t) => latLonToDir(t.lat, t.lon));
      let neighbours = 0;
      for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
          const c = dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y + dirs[i].z * dirs[j].z;
          if (Math.acos(Math.min(1, c)) * PLANET_RADIUS >= 9) continue;
          neighbours++;
          const dy = Math.abs((tiles[i].y ?? 0) - (tiles[j].y ?? 0));
          expect(dy, `${tiles[i].model} / ${tiles[j].model}`).toBeGreaterThanOrEqual(0.003);
        }
      }
      if (tiles.length > 1) expect(neighbours).toBeGreaterThan(0);
    });
  }
});
