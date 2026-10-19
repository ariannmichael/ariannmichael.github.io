import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { PLANET_RADIUS } from "@/world/planet/config";
import { headingAt, latLonToDir, surfaceFrame, surfaceRadius } from "@/world/planet/frame";
import { VEHICLE } from "./constants";
import { onTeleportRequest, requestVehicleTeleport, spawnPointAt, vehicleSpawnPose, yawOfHeading } from "./spawn";

describe("spawn pose", () => {
  it("puts the car spawnHeight above the terrain, upright on the local surface", () => {
    for (const s of [{ lat: 10, lon: 0, yaw: 0 }, { lat: -65, lon: 60, yaw: 135 }, { lat: 89.9, lon: 0, yaw: 0 }]) {
      const pose = vehicleSpawnPose(s);
      const dir = latLonToDir(s.lat, s.lon);
      expect(pose.position.length()).toBeCloseTo(surfaceRadius(dir) + VEHICLE.spawnHeight, 5);
      const up = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
      expect(up.dot(dir)).toBeCloseTo(1, 5);
      const fwd = new Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
      expect(fwd.dot(headingAt(surfaceFrame(dir), s.yaw))).toBeCloseTo(1, 5);
    }
    expect(vehicleSpawnPose({ lat: 0, lon: 0, yaw: 0 }, 0).position.length()).toBeCloseTo(
      surfaceRadius(latLonToDir(0, 0)),
    );
    expect(PLANET_RADIUS).toBeGreaterThan(0);
  });

  it("yawOfHeading inverts headingAt", () => {
    const up = latLonToDir(20, -75);
    for (const yaw of [-170, -90, 0, 45, 120]) {
      expect(yawOfHeading(up, headingAt(surfaceFrame(up), yaw))).toBeCloseTo(yaw, 5);
    }
  });

  it("spawnPointAt keeps the car's place and heading (in-place reset)", () => {
    const dir = latLonToDir(-20, 35);
    const heading = headingAt(surfaceFrame(dir), 60);
    const sp = spawnPointAt(dir.clone().multiplyScalar(151), heading);
    expect(sp.lat).toBeCloseTo(-20, 5);
    expect(sp.lon).toBeCloseTo(35, 5);
    expect(sp.yaw).toBeCloseTo(60, 5);
  });

  it("teleport requests reach the registered listener only while mounted", () => {
    const got: number[] = [];
    const off = onTeleportRequest((s) => got.push(s.lat));
    requestVehicleTeleport({ lat: 5, lon: 0, yaw: 0 });
    off();
    requestVehicleTeleport({ lat: 6, lon: 0, yaw: 0 });
    expect(got).toEqual([5]);
  });
});
