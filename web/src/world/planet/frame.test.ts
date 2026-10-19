import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { PLANET_RADIUS } from "./config";
import {
  angleBetween,
  dirToLatLon,
  headingAt,
  latLonToDir,
  metresToDeg,
  offsetLatLon,
  surfaceFrame,
  surfacePose,
} from "./frame";
import { terrainHeight } from "./terrain";

describe("planet frame", () => {
  it("maps lat/lon to the documented axes", () => {
    expect(latLonToDir(0, 0).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-9);
    expect(latLonToDir(90, 0).distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-9);
    expect(latLonToDir(0, 90).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-9);
  });

  it("round-trips lat/lon", () => {
    const ll = dirToLatLon(latLonToDir(-33.5, 120.25));
    expect(ll.lat).toBeCloseTo(-33.5);
    expect(ll.lon).toBeCloseTo(120.25);
  });

  it("builds an orthonormal frame, including at the poles", () => {
    for (const [lat, lon] of [
      [0, 0],
      [45, -60],
      [90, 0],
      [-90, 10],
    ]) {
      const f = surfaceFrame(latLonToDir(lat, lon));
      expect(f.up.dot(f.east)).toBeCloseTo(0);
      expect(f.up.dot(f.north)).toBeCloseTo(0);
      expect(f.east.dot(f.north)).toBeCloseTo(0);
      expect(f.east.length()).toBeCloseTo(1);
    }
  });

  it("north points to the pole and yaw turns counter-clockwise (toward west)", () => {
    const f = surfaceFrame(latLonToDir(0, 0));
    expect(f.north.y).toBeCloseTo(1);
    expect(f.east.x).toBeCloseTo(1);
    const west = headingAt(f, 90);
    expect(west.x).toBeCloseTo(-1);
  });

  it("surfacePose puts model +Y along up and +Z along the heading", () => {
    const pose = surfacePose(20, 30, 45, 2);
    const up = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
    expect(up.dot(latLonToDir(20, 30))).toBeCloseTo(1);
    expect(pose.position.length()).toBeCloseTo(PLANET_RADIUS + terrainHeight(latLonToDir(20, 30)) + 2);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
    expect(fwd.dot(headingAt(surfaceFrame(latLonToDir(20, 30)), 45))).toBeCloseTo(1);
  });

  it("offsets along a heading by the right distance", () => {
    const from = { lat: 10, lon: 0 };
    const to = offsetLatLon(from, 50, 0);
    expect(angleBetween(from, to)).toBeCloseTo(metresToDeg(50));
    expect(to.lat).toBeGreaterThan(from.lat); // heading 0 = north
  });
});
