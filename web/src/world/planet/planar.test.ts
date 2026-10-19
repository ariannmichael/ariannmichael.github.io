import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { placementPose } from "@/world/lib/planetPlacement";
import { PLANET_RADIUS } from "./config";
import { surfaceRadius } from "./frame";
import { offsetLatLon, latLonToDir } from "./sphere";
import { analyticHeightXYZ, preparePads } from "./terrain";
import { groundUpXYZ } from "./up";

const R = PLANET_RADIUS;
const C = { lat: 12, lon: 34 };

describe("planar pads", () => {
  const pads = preparePads([{ ...C, radius: 20, blend: 8, planar: true }]);
  const n = latLonToDir(C.lat, C.lon);
  const level = R + analyticHeightXYZ(n.x, n.y, n.z, pads, []);

  it("flatten to the tangent plane at the centre, not a curved shell", () => {
    for (const [m, yaw] of [[5, 0], [12, 90], [19, -135]]) {
      const p = offsetLatLon(C, m, yaw);
      const d = latLonToDir(p.lat, p.lon);
      const h = analyticHeightXYZ(d.x, d.y, d.z, pads, []);
      // on the plane: the surface point's height along the pad normal is the centre's
      expect(d.multiplyScalar(R + h).dot(n)).toBeCloseTo(level, 6);
    }
  });

  it("turn gravity's up to the pad normal inside, radial far away", () => {
    const inside = latLonToDir(offsetLatLon(C, 15, 30).lat, offsetLatLon(C, 15, 30).lon).multiplyScalar(R);
    expect(groundUpXYZ(inside.x, inside.y, inside.z, new Vector3(), pads).angleTo(n)).toBeLessThan(1e-9);
    const far = latLonToDir(offsetLatLon(C, 60, 30).lat, offsetLatLon(C, 60, 30).lon);
    expect(groundUpXYZ(far.x * R, far.y * R, far.z * R, new Vector3(), pads).angleTo(far)).toBeLessThan(1e-9);
  });
});

describe("plane placements", () => {
  it("stand on the anchor's tangent plane, upright to it, facing their heading", () => {
    const anchor = { lat: -20, lon: 100 };
    const n = latLonToDir(anchor.lat, anchor.lon);
    const at = offsetLatLon(anchor, 14, 60);
    const pose = placementPose({ ...at, model: "city-roads/road-straight", yaw: 0, y: 0.5, plane: anchor });
    expect(pose.position.dot(n)).toBeCloseTo(surfaceRadius(n) + 0.5, 6);
    expect(new Vector3(0, 1, 0).applyQuaternion(pose.quaternion).angleTo(n)).toBeLessThan(1e-6);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(pose.quaternion);
    expect(Math.abs(fwd.dot(n))).toBeLessThan(1e-6);
  });
});
