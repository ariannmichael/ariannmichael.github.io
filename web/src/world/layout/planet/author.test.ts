import { describe, expect, it } from "vitest";
import { headingAt, latLonToDir, surfaceFrame } from "@/world/planet/sphere";
import { grid } from "./author";

const dir = (p: { lat: number; lon: number }) => latLonToDir(p.lat, p.lon);

describe("grid", () => {
  it("keeps yaw in the grid frame, so tiles in a row line up away from the anchor", () => {
    for (const center of [{ lat: 25, lon: 75 }, { lat: -65, lon: 60 }]) {
      const g = grid(center);
      for (const [n, e] of [[0, 48], [48, 48], [-48, -48]]) {
        for (const yaw of [0, 90, -90]) {
          const p = g.place(n, e, { model: "city-roads/road-straight", yaw });
          const h = headingAt(surfaceFrame(dir(p)), p.yaw!);
          // Expected: the grid direction for `yaw`, from finite differences along the grid
          const r = (yaw * Math.PI) / 180;
          const [dn, de] = [Math.cos(r), -Math.sin(r)];
          const want = dir(g.at(n + dn * 0.01, e + de * 0.01)).sub(dir(g.at(n - dn * 0.01, e - de * 0.01))).normalize();
          expect(h.angleTo(want) * (180 / Math.PI), `${n},${e} yaw ${yaw}`).toBeLessThan(0.05);
        }
      }
    }
  });
});
