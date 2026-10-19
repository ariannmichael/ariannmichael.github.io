import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { PLANET_RADIUS } from "@/world/planet/config";
import { surfaceRadius } from "@/world/planet/frame";
import { layoutObstacles } from "@/world/planet/obstacles";
import { ROAD_HALF_WIDTH, ROAD_LINKS, getRoads, nearestRoadXYZ } from "@/world/planet/roads";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { placementPose } from "@/world/lib/planetPlacement";
import { PORT_LEAD, findRoadPort, portPose } from "@/world/planet/roadPorts";
import { RIBBON_HALF_WIDTH, RIBBON_LIFT, SIGN_POST_X, SIGN_SPACING, buildRoadRibbon, roadSigns } from "./roadGeometry";

const R = PLANET_RADIUS;

/** Is unit direction `q` on road `o`'s ribbon: within its half width of a segment, beside (not past) it? */
function onRibbon(q: Vector3, o: ReturnType<typeof getRoads>[number]): boolean {
  for (let k = 0; k < o.count - 1; k++) {
    const a = new Vector3(o.p[k * 3], o.p[k * 3 + 1], o.p[k * 3 + 2]);
    const b = new Vector3(o.p[k * 3 + 3], o.p[k * 3 + 4], o.p[k * 3 + 5]);
    const ab = b.clone().sub(a);
    const t = q.clone().sub(a).dot(ab) / ab.lengthSq();
    if (t < 0 || t > 1) continue;
    const d = a.clone().addScaledVector(ab, t).distanceTo(q) * R;
    if (d < RIBBON_HALF_WIDTH - 0.05) return true;
  }
  return false;
}

describe("road ribbon", () => {
  const g = buildRoadRibbon();
  const pos = g.getAttribute("position");
  const nrm = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  const used = [...new Set(g.getIndex()!.array)];
  const LANE_V = 0.875; // lanes, gutters and the centre line: the tile's flat asphalt swatches

  it("draws the tile's flat asphalt facing up, just over the ground away from the ports", () => {
    const p = new Vector3();
    const n = new Vector3();
    let checked = 0;
    for (const i of used) {
      if (Math.abs(uv.getY(i) - LANE_V) > 1e-6) continue;
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nrm, i);
      const dir = p.clone().normalize();
      expect(n.dot(dir), `vertex ${i}`).toBeGreaterThan(0.8);
      // Away from the port leads the asphalt rides RIBBON_LIFT over the mesh
      const nearPort = getRoads().some((r) => {
        for (const [here, there, k] of [[r.from, r.to, 0], [r.to, r.from, r.count - 1]] as const) {
          const port = findRoadPort(here, there);
          if (port && portPose(port).edge.clone().normalize().angleTo(dir) * R < PORT_LEAD + RIBBON_HALF_WIDTH + 1) return true;
          void k;
        }
        return false;
      });
      if (nearPort) continue;
      expect(p.length() - surfaceRadius(dir)).toBeCloseTo(RIBBON_LIFT, 3);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("starts flush on every port: its end row is the tile's open edge, kerbs and lanes aligned", () => {
    // Each port's edge: the asphalt corners (across ±0.4 tile units, at height 0.01) must be ribbon vertices
    const verts = used.map((i) => new Vector3().fromBufferAttribute(pos, i));
    for (const l of PLANET_LAYOUTS) {
      for (const port of l.roadPorts ?? []) {
        const p = portPose(port);
        for (const [across, height] of [[0.4, 0.01], [-0.4, 0.01], [0.5, 0.02], [-0.5, 0.02], [0.01, 0.01]]) {
          const want = p.edge.clone().addScaledVector(p.left, across * p.scale).addScaledVector(p.up, height * p.scale);
          const best = Math.min(...verts.map((v) => v.distanceTo(want)));
          expect(best, `${l.biome} → ${port.to} at ${across}`).toBeLessThan(0.005);
        }
      }
    }
  });

  it("never runs over a street tile or another road (no z-fighting, no crossing kerbs)", () => {
    const tiles = PLANET_LAYOUTS.flatMap((l) => l.placements.filter((p) => p.model.startsWith("city-roads/road-")));
    const roads = getRoads();
    for (const [ri, r] of roads.entries()) {
      for (let i = 1; i < r.count - 1; i++) {
        // Across this row (both sidewalks' edges and the centre)
        const c = new Vector3(r.p[i * 3], r.p[i * 3 + 1], r.p[i * 3 + 2]);
        const fwd = new Vector3(r.p[i * 3 + 3] - r.p[i * 3 - 3], r.p[i * 3 + 4] - r.p[i * 3 - 2], r.p[i * 3 + 5] - r.p[i * 3 - 1]);
        const left = c.clone().cross(fwd).normalize();
        for (const across of [-0.98, 0, 0.98]) {
          const q = c.clone().addScaledVector(left, (across * RIBBON_HALF_WIDTH) / R).normalize();
          for (const t of tiles) {
            // The point in the tile's own frame: inside its square (less 5 cm) is an overlap
            const pose = placementPose(t);
            const local = q
              .clone()
              .multiplyScalar(pose.position.length())
              .sub(pose.position)
              .applyQuaternion(pose.quaternion.clone().invert());
            const half = 4 * (t.scale ?? 1) - 0.05;
            const on = Math.abs(local.x) < half && Math.abs(local.z) < half && Math.abs(local.y) < 2;
            expect(on, `${r.from} → ${r.to} point ${i} (${across}) on ${t.model}`).toBe(false);
          }
          for (const [rj, o] of roads.entries()) {
            if (rj !== ri) expect(onRibbon(q, o), `${r.from} → ${r.to} point ${i} on ${o.from} → ${o.to}`).toBe(false);
          }
        }
      }
    }
  });

  it("never folds: both outer edges advance from row to row", () => {
    // Rows: 22 vertices each (11 strips × 2); the outer sidewalk edges are the first and last.
    // Only rows that triangles join are consecutive (the next road starts a new run)
    const joined = new Set<number>();
    const ix = g.getIndex()!.array;
    for (let k = 0; k < ix.length; k += 3) joined.add(Math.floor(Math.max(ix[k], ix[k + 1], ix[k + 2]) / 22));
    for (const k of joined) {
      const a = (k - 1) * 22;
      const b = k * 22;
      const fa = new Vector3().fromBufferAttribute(pos, a + 1).add(new Vector3().fromBufferAttribute(pos, a + 20)).multiplyScalar(0.5);
      const fb = new Vector3().fromBufferAttribute(pos, b + 1).add(new Vector3().fromBufferAttribute(pos, b + 20)).multiplyScalar(0.5);
      const fwd = fb.clone().sub(fa).normalize();
      for (const e of [1, 20]) {
        const step = new Vector3().fromBufferAttribute(pos, b + e).sub(new Vector3().fromBufferAttribute(pos, a + e)).dot(fwd);
        expect(step, `row ${k} edge ${e}`).toBeGreaterThan(0.1);
      }
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

  it("keeps every two boards apart (no crossed signs where roads leave one hub)", () => {
    for (let i = 0; i < signs.length; i++) {
      for (let j = i + 1; j < signs.length; j++) {
        const d = signs[i].position.clone().normalize().angleTo(signs[j].position.clone().normalize()) * R;
        expect(d, `${signs[i].key} vs ${signs[j].key}`).toBeGreaterThanOrEqual(SIGN_SPACING);
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
