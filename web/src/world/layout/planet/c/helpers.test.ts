// Terrain first: it pulls in every layout before frame.ts is re-entered (avoids an import cycle TDZ).
import "@/world/planet/terrain";
import { describe, expect, it } from "vitest";
import { grid } from "../author";
import { localGrid, path, yawToward } from "./helpers";

describe("biome C helpers", () => {
  it("localGrid matches author.ts grid exactly", () => {
    for (const center of [{ lat: -25, lon: -140 }, { lat: -65, lon: 60 }, { lat: 89.9, lon: 10 }]) {
      const a = grid(center);
      const b = localGrid(center);
      for (const [n, e] of [[0, 0], [30, 24], [-48, -34], [60, -60]]) {
        expect(b.at(n, e).lat).toBeCloseTo(a.at(n, e).lat, 9);
        expect(b.at(n, e).lon).toBeCloseTo(a.at(n, e).lon, 9);
      }
    }
  });

  it("yawToward and path follow the placement yaw convention (0 = north, 90 = west)", () => {
    expect(yawToward(1, 0)).toBeCloseTo(0);
    expect(yawToward(0, -1)).toBeCloseTo(90);
    expect(yawToward(0, 1)).toBeCloseTo(-90);
    const p = path([0, 0], [10, 0]);
    expect(p.at(0.5, 2)).toEqual([5, 2]); // right of a northbound path is east
  });
});
