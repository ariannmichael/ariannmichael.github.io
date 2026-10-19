import "@/world/layout/planet";
import { describe, expect, it } from "vitest";
import { angleBetween, degToMetres, headingAt, latLonToDir, offsetLatLon, surfaceFrame } from "@/world/planet/frame";
import { site } from "./site";

describe("biome agent B site frame", () => {
  for (const anchor of [
    { lat: -15, lon: 140 },
    { lat: 20, lon: -75 },
    { lat: 70, lon: -20 },
  ]) {
    const s = site(anchor);

    it(`matches offsetLatLon around ${anchor.lat},${anchor.lon}`, () => {
      const a = s.at(30, 0);
      const b = offsetLatLon(anchor, 30, 0);
      expect(a.lat).toBeCloseTo(b.lat, 9);
      expect(a.lon).toBeCloseTo(b.lon, 9);
      expect(degToMetres(angleBetween(anchor, s.at(-12, 35)))).toBeCloseTo(Math.hypot(12, 35), 6);
    });

    it(`keeps far placements parallel to the anchor heading around ${anchor.lat},${anchor.lon}`, () => {
      const anchorFwd = headingAt(surfaceFrame(latLonToDir(anchor.lat, anchor.lon)), 30);
      for (const [n, e] of [
        [0, 40],
        [-30, -30],
        [25, 10],
      ]) {
        const p = s.place(n, e, { model: "kit/x", yaw: 30 });
        const up = latLonToDir(p.lat, p.lon);
        const fwd = headingAt(surfaceFrame(up), p.yaw!);
        // The anchor heading projected onto the local tangent plane is the placement's heading
        const projected = anchorFwd.clone().addScaledVector(up, -anchorFwd.dot(up)).normalize();
        expect(fwd.dot(projected)).toBeCloseTo(1, 9);
      }
    });
  }
});
