import { describe, expect, it } from "vitest";
import { BIOMES } from "@/world/planet/biomes";
import { AMBIENCE, AMBIENCE_LITE_EVENT_SCALE, nextEventDelay } from "./ambiencePresets";
import { BIOME_HARDNESS } from "./mapping";

describe("ambience presets", () => {
  it("covers every biome, quietly", () => {
    for (const b of BIOMES) {
      const p = AMBIENCE[b.id];
      expect(p, b.id).toBeDefined();
      expect(p.level).toBeGreaterThan(0);
      expect(p.level).toBeLessThanOrEqual(1);
      expect(p.every[0]).toBeLessThan(p.every[1]);
      expect(BIOME_HARDNESS[b.id]).toBeDefined();
    }
  });
  it("event delays span the preset range and are rarer on lite", () => {
    expect(nextEventDelay("home", 0, false)).toBe(AMBIENCE.home.every[0]);
    expect(nextEventDelay("home", 1, false)).toBe(AMBIENCE.home.every[1]);
    expect(nextEventDelay("home", 0.5, true)).toBeCloseTo(nextEventDelay("home", 0.5, false) * AMBIENCE_LITE_EVENT_SCALE);
  });
});
