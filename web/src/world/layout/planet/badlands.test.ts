// Terrain first: it pulls in every layout before frame.ts is re-entered (avoids an import cycle TDZ).
import { biomeAt } from "@/world/planet/terrain";
import { describe, expect, it } from "vitest";
import { hasModel } from "@/world/models";
import { angleBetween, latLonToDir } from "@/world/planet/frame";
import { BIOMES } from "@/world/planet/biomes";
import { budgetCounts, fixedBoxes, groundPoint, insideBox } from "./c/check";
import { badlandsLayout as layout } from "./badlands";

const biome = BIOMES.find((b) => b.id === "badlands")!;

describe("badlands layout", () => {
  it("only uses models that exist", () => {
    expect(layout.placements.filter((p) => !hasModel(p.model)).map((p) => p.model)).toEqual([]);
  });

  it("has no markers (badlands has no district)", () => {
    expect(biome.district).toBeNull();
    expect(layout.markers).toEqual([]);
  });

  it("spawns inside the badlands core, clear of colliders", () => {
    expect(biomeAt(latLonToDir(layout.spawn.lat, layout.spawn.lon))).toBe("badlands");
    expect(angleBetween(layout.spawn, biome.center)).toBeLessThan(biome.radiusDeg * 0.8);
    const pt = groundPoint(layout.spawn);
    expect(fixedBoxes(layout).filter(({ box }) => insideBox(pt, box, 0.5)).map((b) => b.model)).toEqual([]);
  });

  it("keeps every placement and pad within the biome radius", () => {
    for (const p of [...layout.placements, ...layout.pads]) {
      expect(angleBetween(p, biome.center)).toBeLessThan(biome.radiusDeg);
    }
  });

  it("stays light: the terrain is the star", () => {
    const c = budgetCounts(layout);
    expect(c.placements).toBeLessThanOrEqual(80);
    expect(c.unique).toBeLessThanOrEqual(40);
    expect(c.characters).toBe(0);
    expect(c.dynamic).toBeLessThanOrEqual(12);
    expect(layout.pads.some((p) => (p.height ?? 0) > 0)).toBe(true);
    expect(layout.pads.some((p) => (p.height ?? 0) < 0)).toBe(true);
  });
});
