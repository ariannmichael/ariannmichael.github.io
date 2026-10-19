// Load the layout index first: frame → terrain → layouts is an import cycle, and layouts call
// offsetLatLon at module top level, so frame must finish initialising before any layout runs.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { BIOMES } from "@/world/planet/biomes";
import type { LatLon } from "@/world/planet/types";
import { grid } from "./author";
import { blockedAt, checkLayout, checkTown, maxGrade, padTarget, unreachable } from "./a/check";
import { engineeringLayout } from "./engineering";

const { at } = grid(BIOMES.find((b) => b.id === "engineering")!.center);
const DOCK_N = -8;

describe("engineering layout (Downtown Plateau)", () => {
  it("passes the biome authoring checks", () => {
    checkLayout(engineeringLayout, ["stefanini", "gofasti"]);
  });

  it("fits the small-planet town budget, with open lanes south-west and south-east for the roads", () => {
    checkTown(engineeringLayout, [219, 141]);
  });

  it("the loading dock can be driven straight through, west to east", () => {
    for (let e = 13; e <= 40; e += 1) expect(blockedAt(engineeringLayout, at(DOCK_N, e)), `e=${e}`).toEqual([]);
  });

  it("the dock has solid side walls", () => {
    expect(blockedAt(engineeringLayout, at(DOCK_N + 5.5, 25), 1.1, 0).length).toBeGreaterThan(0);
    expect(blockedAt(engineeringLayout, at(DOCK_N - 5.5, 31), 1.1, 0).length).toBeGreaterThan(0);
  });

  it("the ramps down into the dock and back out are drivable", () => {
    const line = Array.from({ length: 41 }, (_, i) => at(DOCK_N, 4 + i));
    expect(maxGrade(line)).toBeLessThan(0.42);
  });

  it("the dock is sunk 2.5 m below the plateau, the planar building sites sit level with it", () => {
    const [plateau, dock, ...sites] = engineeringLayout.pads;
    expect(padTarget(plateau) - padTarget(dock)).toBeCloseTo(2.5, 0);
    for (const s of sites) expect(Math.abs(padTarget(s) - padTarget(plateau))).toBeLessThan(0.25);
  });

  it("every marker and the dock's far mouth can be driven to from the spawn", () => {
    const targets: { name: string; at: LatLon }[] = engineeringLayout.markers.map((m) => ({ name: m.id, at: m }));
    targets.push({ name: "dock interior", at: at(DOCK_N, 28) }, { name: "dock east mouth", at: at(DOCK_N, 38) });
    expect(unreachable(engineeringLayout, targets)).toEqual([]);
  });
});
