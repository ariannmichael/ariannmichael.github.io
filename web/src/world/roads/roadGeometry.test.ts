import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { PLANET_RADIUS } from "@/world/planet/config";
import { surfaceRadius } from "@/world/planet/frame";
import { layoutObstacles } from "@/world/planet/obstacles";
import { ROAD_HALF_WIDTH, ROAD_LINKS, getRoads, nearestRoadXYZ } from "@/world/planet/roads";
import { RIBBON_LIFT, SIGN_POST_X, buildRoadRibbon, roadSigns } from "./roadGeometry";

const R = PLANET_RADIUS;

describe("road ribbon", () => {
  const g = buildRoadRibbon();
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");

  it("faces outward and floats just over the ground", () => {
    const p = new Vector3();
    const n = new Vector3();
    // Only vertices that are drawn (rows a hub shares with an earlier road are skipped)
    const used = [...new Set(g.getIndex()!.array)];
    for (const i of used.filter((_, k) => k % 7 === 0)) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nrm, i);
      const dir = p.clone().normalize();
      expect(n.dot(dir), `vertex ${i}`).toBeGreaterThan(0.8);
      expect(p.length() - surfaceRadius(dir)).toBeCloseTo(RIBBON_LIFT, 3);
    }
  });
});

describe("road signs", () => {
  const signs = roadSigns();

  it("finds a clear spot for a sign at (nearly) every road end", () => {
    expect(signs.length).toBeGreaterThanOrEqual(ROAD_LINKS.length * 2 - 2);
  });

  it("stands off every road, and clear of buildings and parking rings", () => {
    const hit = { dist: 0, target: 0, road: 0, seg: 0, t: 0 };
    const obstacles = layoutObstacles();
    for (const s of signs) {
      const d = s.position.clone().normalize();
      const x = new Vector3(1, 0, 0).applyQuaternion(s.quaternion);
      for (const side of [-SIGN_POST_X, SIGN_POST_X]) {
        const post = s.position.clone().normalize().multiplyScalar(R).addScaledVector(x, side).normalize();
        nearestRoadXYZ(post.x, post.y, post.z, getRoads(), hit);
        expect(hit.dist, `${s.key} post ${side}`).toBeGreaterThan(ROAD_HALF_WIDTH + 1);
      }
      for (const o of obstacles) {
        const gap = Math.acos(Math.min(1, d.x * o.x + d.y * o.y + d.z * o.z)) * R - o.r;
        expect(gap, `${s.key}`).toBeGreaterThan(1);
      }
    }
  });

  it("stands upright on the ground", () => {
    for (const s of signs) {
      const up = new Vector3(0, 1, 0).applyQuaternion(s.quaternion);
      expect(up.dot(s.position.clone().normalize())).toBeGreaterThan(0.999);
      expect(s.position.length()).toBeCloseTo(surfaceRadius(s.position.clone().normalize()), 3);
    }
  });
});
