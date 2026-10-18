import { describe, expect, it } from "vitest";
import { districts } from "@/content";
import { BIOMES } from "@/world/planet/biomes";
import { latLonToDir } from "@/world/planet/frame";
import type { BiomeLayout } from "@/world/planet/types";
import {
  angleToCap,
  biomeOfDistrict,
  biomesInRange,
  byDistance,
  districtOfBiome,
  layoutCap,
  spawnForDistrict,
} from "./biomeMap";

const layout = (over: Partial<BiomeLayout> = {}): BiomeLayout => ({
  biome: "home",
  spawn: { lat: 10, lon: 0, yaw: 45 },
  placements: [],
  markers: [],
  pads: [],
  ...over,
});

describe("biome -> district mapping", () => {
  it("every career district has exactly one biome, and the badlands have none", () => {
    for (const d of districts) {
      expect(BIOMES.filter((b) => b.district === d.id)).toHaveLength(1);
      expect(districtOfBiome(biomeOfDistrict(d.id)!.id)).toBe(d.id);
    }
    expect(districtOfBiome("badlands")).toBeNull();
  });
});

describe("spawn", () => {
  it("uses the spawn of the layout whose biome maps to the district", () => {
    const race = layout({ biome: "raceway", spawn: { lat: -20, lon: 35, yaw: 90 } });
    expect(spawnForDistrict([layout(), race], "raceway")).toEqual({ lat: -20, lon: 35, yaw: 90 });
  });

  it("falls back to the biome centre when the district has no layout yet", () => {
    const fin = BIOMES.find((b) => b.id === "financial")!;
    expect(spawnForDistrict([layout()], "financial")).toEqual({ ...fin.center, yaw: 0 });
  });
});

describe("streaming", () => {
  const home = layout({
    placements: [
      { model: "a/b", lat: 12, lon: 0 },
      { model: "a/b", lat: 8, lon: 0 },
    ],
  });

  it("a layout's cap covers all its points", () => {
    const cap = layoutCap(home);
    expect(cap.radiusDeg).toBeGreaterThanOrEqual(2 - 1e-9);
    expect(angleToCap(cap, latLonToDir(12, 0))).toBe(0);
    expect(angleToCap(cap, latLonToDir(10, 30))).toBeGreaterThan(25);
  });

  it("loads within loadDeg, keeps loaded ones until unloadDeg", () => {
    const caps = [{ id: "home", cap: layoutCap(home) }];
    const far = latLonToDir(10, 85); // ~80° from the cap edge
    expect(biomesInRange(caps, far, new Set(), 70, 90).size).toBe(0);
    expect(biomesInRange(caps, far, new Set(["home"]), 70, 90).has("home")).toBe(true);
    expect(biomesInRange(caps, latLonToDir(10, 120), new Set(["home"]), 70, 90).size).toBe(0);
  });

  it("orders nearest first", () => {
    const caps = [
      { id: 1, cap: layoutCap(layout({ spawn: { lat: -60, lon: 0, yaw: 0 } })) },
      { id: 2, cap: layoutCap(home) },
    ];
    expect(byDistance(caps, latLonToDir(10, 5))).toEqual([2, 1]);
  });
});
