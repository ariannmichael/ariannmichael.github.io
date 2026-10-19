// Load the layout index first: frame → terrain → layouts is an import cycle, and layouts call
// offsetLatLon at module top level, so frame must finish initialising before any layout runs.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { BIOMES } from "@/world/planet/biomes";
import { grid } from "./author";
import { blockedAt, checkLayout, checkTown, padTarget, unreachable } from "./a/check";
import { racewayLayout } from "./raceway";

const { at } = grid(BIOMES.find((b) => b.id === "raceway")!.center);
/** Pit garage centre (n, e), its wall half-width and its bay centres' offset from the pillar (scale 2) */
const G = [-0.5, -3] as const;
const HALF_W = 7.74;
const BAY = 3.7;

describe("raceway layout (Speed King Canyon)", () => {
  it("passes the biome authoring checks", () => {
    checkLayout(racewayLayout, ["speed-king"]);
  });

  it("fits the small-planet town budget, with open lanes north-west and north-east for the roads", () => {
    checkTown(racewayLayout, [321, 39]);
  });

  it("the pit garage's west bay can be driven into from the start straight", () => {
    for (let n = 13; n >= G[0] - 3; n -= 1) expect(blockedAt(racewayLayout, at(n, G[1] - BAY), 1.1, 1), `n=${n}`).toEqual([]);
  });

  it("the pit garage has solid back and side walls", () => {
    expect(blockedAt(racewayLayout, at(G[0] - HALF_W, G[1]), 1.1, 0).length).toBeGreaterThan(0);
    expect(blockedAt(racewayLayout, at(G[0], G[1] - HALF_W), 1.1, 0).length).toBeGreaterThan(0);
    expect(blockedAt(racewayLayout, at(G[0], G[1] + HALF_W), 1.1, 0).length).toBeGreaterThan(0);
  });

  it("the start straight and the back straight's racing lines are clear", () => {
    for (let e = -16; e <= 16; e += 2) {
      expect(blockedAt(racewayLayout, at(13, e)), `start e=${e}`).toEqual([]);
      expect(blockedAt(racewayLayout, at(-13, e)), `back e=${e}`).toEqual([]);
    }
  });

  it("pads sit at their intended levels above the valley floor", () => {
    const [floor, pit, ...rest] = racewayLayout.pads.map(padTarget);
    const want = [1.3, 1.5]; // kickers
    expect(pit - floor).toBeCloseTo(-0.25, 1);
    rest.forEach((t, i) => expect(t - floor, `pad ${i + 2}`).toBeCloseTo(want[i], 1));
  });

  it("the marker, the pit garage bays and the whole lap can be driven to from the spawn", () => {
    const targets = [
      { name: "speed-king", at: racewayLayout.markers[0] },
      { name: "west bay", at: at(G[0] - 3, G[1] - BAY) },
      { name: "east hairpin", at: at(0, 28) },
      { name: "back straight", at: at(-13, 0) },
      { name: "west hairpin", at: at(0, -28) },
    ];
    expect(unreachable(racewayLayout, targets)).toEqual([]);
  });
});
