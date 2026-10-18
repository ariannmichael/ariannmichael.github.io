// Load the layout index first: frame → terrain → layouts is an import cycle, and layouts call
// offsetLatLon at module top level, so frame must finish initialising before any layout runs.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { BIOMES } from "@/world/planet/biomes";
import { grid } from "./author";
import { blockedAt, checkLayout } from "./a/check";
import { racewayLayout } from "./raceway";

const { at } = grid(BIOMES.find((b) => b.id === "raceway")!.center);

describe("raceway layout (Speed King Canyon)", () => {
  it("passes the biome authoring checks", () => {
    checkLayout(racewayLayout, ["speed-king"]);
  });

  it("the pit garage's west bay can be driven into from the start straight", () => {
    for (let n = -20; n <= 0; n += 1) expect(blockedAt(racewayLayout, at(n, 6.9), 1.1, 1), `n=${n}`).toEqual([]);
  });

  it("the pit garage has solid back and side walls", () => {
    expect(blockedAt(racewayLayout, at(3, 10), 1.1, 0).length).toBeGreaterThan(0);
    expect(blockedAt(racewayLayout, at(-4, 3), 1.1, 0).length).toBeGreaterThan(0);
    expect(blockedAt(racewayLayout, at(-4, 17), 1.1, 0).length).toBeGreaterThan(0);
  });

  it("the start straight and both straights' racing lines are clear", () => {
    for (let e = -26; e <= 26; e += 2) {
      expect(blockedAt(racewayLayout, at(-22, e)), `south e=${e}`).toEqual([]);
      expect(blockedAt(racewayLayout, at(22, e)), `north e=${e}`).toEqual([]);
    }
  });
});
