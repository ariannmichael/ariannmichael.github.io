import { describe, expect, it } from "vitest";
import { Color, Vector3 } from "three";
import { latLonToDir } from "@/world/planet/frame";
import {
  SKY_TRANSITION,
  SUN_DIR,
  advanceSky,
  lerpSkyColors,
  nightFactor,
  setSkyBiome,
  skyBasis,
  skyColorsFor,
  skyState,
  snapSkyBiome,
  starsForTop,
} from "./skyState";

const basis = () => ({ up: new Vector3(), east: new Vector3(), north: new Vector3() });

describe("biome sky colours", () => {
  it("lerp hits both ends and eases in between", () => {
    const a = skyColorsFor("home");
    const b = skyColorsFor("opensource");
    expect(lerpSkyColors(a, b, 0).top.equals(a.top)).toBe(true);
    expect(lerpSkyColors(a, b, 1).top.equals(b.top)).toBe(true);
    expect(lerpSkyColors(a, b, 2).fog.equals(b.fog)).toBe(true); // clamped
    const mid = lerpSkyColors(a, b, 0.5).horizon;
    expect(mid.r).toBeCloseTo((a.horizon.r + b.horizon.r) / 2, 6); // smoothstep(0.5) = 0.5
  });

  it("setSkyBiome blends from the current colour over SKY_TRANSITION seconds", () => {
    snapSkyBiome("home");
    const home = skyColorsFor("home");
    const gamedev = skyColorsFor("gamedev");
    setSkyBiome("gamedev", 100);
    expect(advanceSky(100).top.equals(home.top)).toBe(true);
    const half = advanceSky(100 + SKY_TRANSITION / 2).top.clone();
    expect(half.equals(home.top)).toBe(false);
    expect(half.equals(gamedev.top)).toBe(false);
    expect(advanceSky(100 + SKY_TRANSITION).top.equals(gamedev.top)).toBe(true);
    setSkyBiome("gamedev", 200); // same target: no restart
    expect(skyState.startedAt).toBe(100);
  });

  it("dark zenith skies are starry, blue ones are not", () => {
    expect(starsForTop(skyColorsFor("opensource").top)).toBeGreaterThan(0.9);
    expect(starsForTop(skyColorsFor("home").top)).toBe(0);
    expect(starsForTop(new Color(0, 0, 0))).toBe(1);
  });
});

describe("local-up sky basis", () => {
  it("up is radial and the basis is orthonormal anywhere, including the poles", () => {
    for (const p of [new Vector3(0, 150, 0), new Vector3(0, -150, 0), new Vector3(30, -40, 140), latLonToDir(-25, -140).multiplyScalar(151)]) {
      const b = skyBasis(p, basis());
      expect(b.up.distanceTo(p.clone().normalize())).toBeLessThan(1e-9);
      expect(Math.abs(b.up.dot(b.east))).toBeLessThan(1e-9);
      expect(Math.abs(b.up.dot(b.north))).toBeLessThan(1e-9);
      expect(Math.abs(b.east.dot(b.north))).toBeLessThan(1e-9);
      expect(b.east.length()).toBeCloseTo(1, 9);
    }
  });
  it("north points toward the north pole on the equator", () => {
    const b = skyBasis(new Vector3(0, 0, 150), basis());
    expect(b.north.y).toBeCloseTo(1, 9);
  });
  it("home is day, gamedev (far side) is night", () => {
    const home = skyBasis(latLonToDir(10, 0), basis()).up.clone();
    const gamedev = skyBasis(latLonToDir(-25, -140), basis()).up.clone();
    expect(nightFactor(SUN_DIR, home)).toBe(0);
    expect(nightFactor(SUN_DIR, gamedev)).toBe(1);
    expect(Math.asin(SUN_DIR.dot(home)) * (180 / Math.PI)).toBeGreaterThan(45);
  });
});
