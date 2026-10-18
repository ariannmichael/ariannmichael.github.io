// Load the layout index first: frame → terrain → layouts is an import cycle, and layouts call
// offsetLatLon at module top level, so frame must finish initialising before any layout runs.
import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { BIOMES } from "@/world/planet/biomes";
import { grid } from "./author";
import { blockedAt, checkLayout } from "./a/check";
import { engineeringLayout } from "./engineering";

const { at } = grid(BIOMES.find((b) => b.id === "engineering")!.center);

describe("engineering layout (Downtown Plateau)", () => {
  it("passes the biome authoring checks", () => {
    checkLayout(engineeringLayout, ["stefanini", "gofasti"]);
  });

  it("the loading dock can be driven straight through, west to east", () => {
    for (let e = 46; e <= 78; e += 2) expect(blockedAt(engineeringLayout, at(6, e)), `e=${e}`).toEqual([]);
  });

  it("the dock has solid side walls", () => {
    expect(blockedAt(engineeringLayout, at(12, 62), 1.1, 0).length).toBeGreaterThan(0);
    expect(blockedAt(engineeringLayout, at(0, 62), 1.1, 0).length).toBeGreaterThan(0);
  });
});
