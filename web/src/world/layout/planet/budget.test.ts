// Small-planet town budget (coordinator-owned): every town fits in TOWN_RADIUS of its biome centre,
// leaving road corridors between towns (centres are ~118 m apart on the 90 m planet).
import { describe, expect, it } from "vitest";
import { getModel } from "@/world/models";
import { BIOMES } from "@/world/planet/biomes";
import { PLANET_RADIUS } from "@/world/planet/config";
import { latLonToDir } from "@/world/planet/sphere";
import { PLANET_LAYOUTS } from "./index";

/** Footprints and markers stay within this many metres of the biome centre */
export const TOWN_RADIUS = 40;
/** Pads, including their blend ring, stay within this */
export const TOWN_PAD_REACH = 46;

const R = PLANET_RADIUS;

describe("small-planet town budget", () => {
  for (const layout of PLANET_LAYOUTS) {
    const biome = BIOMES.find((b) => b.id === layout.biome)!;
    const c = latLonToDir(biome.center.lat, biome.center.lon);
    const dist = (p: { lat: number; lon: number }) => c.angleTo(latLonToDir(p.lat, p.lon)) * R;

    it(`${layout.biome}: footprints and markers within ${TOWN_RADIUS} m`, () => {
      for (const p of layout.placements) {
        const { min, max } = getModel(p.model);
        const r = (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * (p.scale ?? 1);
        expect(dist(p) + r, `${p.model}`).toBeLessThan(TOWN_RADIUS + 0.01);
      }
      for (const m of layout.markers) expect(dist(m), m.id).toBeLessThan(TOWN_RADIUS);
      expect(dist(layout.spawn), "spawn").toBeLessThan(TOWN_RADIUS);
    });

    it(`${layout.biome}: pads (with blend) within ${TOWN_PAD_REACH} m`, () => {
      for (const p of layout.pads) {
        expect(dist(p) + p.radius + (p.blend ?? 8), `pad r=${p.radius}`).toBeLessThan(TOWN_PAD_REACH + 0.01);
      }
    });
  }
});
