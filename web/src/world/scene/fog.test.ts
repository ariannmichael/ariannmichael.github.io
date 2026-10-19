import { describe, expect, it } from "vitest";
import { CAMERA, orbitDistance } from "@/world/camera/cameraMath";
import { PLANET_RADIUS } from "@/world/planet/config";
import { FOG_RANGE, fogLift, horizonDistance } from "./fog";

describe("fog on the small planet", () => {
  const R = PLANET_RADIUS;
  const followHorizon = horizonDistance(4.5);

  it("starts past the follow camera's ground horizon, so the curve stays crisp", () => {
    expect(FOG_RANGE.near).toBeGreaterThan(followHorizon * 1.5);
    expect(FOG_RANGE.far).toBeGreaterThan(FOG_RANGE.near);
  });

  it("does not move while driving near the ground", () => {
    expect(fogLift(R + 5)).toBe(0);
    expect(fogLift(R + 20)).toBe(0);
    expect(fogLift(R - 30)).toBe(0); // underground interiors
  });

  it("clears the whole globe in the intro orbit (the limb gets at most a light haze)", () => {
    for (const aspect of [16 / 9, 9 / 19.5]) {
      const d = orbitDistance(CAMERA.fov, aspect);
      const limb = Math.sqrt(d * d - R * R);
      const near = FOG_RANGE.near + fogLift(d);
      const far = FOG_RANGE.far + fogLift(d);
      // The nearest ground (straight below) is unfogged; the rim is under 25 % fog
      expect(d - R).toBeLessThan(near);
      expect((limb - near) / (far - near)).toBeLessThan(0.25);
    }
  });
});
