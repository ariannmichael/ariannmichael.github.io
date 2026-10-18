// Cross-planet checks over all biome layouts together (coordinator-owned).
import { describe, expect, it } from "vitest";
import { games, jobs } from "@/content";
import { BIOMES } from "@/world/planet/biomes";
import { PLANET_LAYOUTS } from "./index";

const allMarkers = PLANET_LAYOUTS.flatMap((l) => l.markers.map((m) => ({ ...m, biome: l.biome })));
const districtOf = (biome: string) => BIOMES.find((b) => b.id === biome)?.district ?? null;

describe("planet layouts", () => {
  it("has exactly one layout per biome", () => {
    expect(PLANET_LAYOUTS.map((l) => l.biome).sort()).toEqual(BIOMES.map((b) => b.id).sort());
  });

  it("makes every job and game reachable exactly once", () => {
    for (const { id } of [...jobs, ...games]) {
      expect(allMarkers.filter((m) => m.id === id), id).toHaveLength(1);
    }
  });

  it("has exactly one about, contact and cv marker", () => {
    for (const id of ["about", "contact", "cv"]) {
      expect(allMarkers.filter((m) => m.id === id), id).toHaveLength(1);
    }
  });

  it("places each job and game in the biome of its career district", () => {
    for (const item of [...jobs, ...games]) {
      const marker = allMarkers.find((m) => m.id === item.id)!;
      expect(districtOf(marker.biome), item.id).toBe(item.district);
    }
  });

  it("has no markers outside career biomes and no unknown ids", () => {
    const known = new Set([...jobs, ...games].map((x) => x.id).concat(["about", "contact", "cv"]));
    for (const m of allMarkers) {
      expect(districtOf(m.biome), `${m.id} in ${m.biome}`).not.toBeNull();
      expect(known.has(m.id), m.id).toBe(true);
    }
  });
});
