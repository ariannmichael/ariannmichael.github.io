import { describe, expect, it } from "vitest";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { BIOMES } from "./biomes";
import { PLANET_RADIUS } from "./config";
import { layoutObstacles } from "./obstacles";
import { ROAD_BED_SHOULDER, ROAD_HALF_WIDTH, ROAD_LINKS, applyRoadBed, getRoads, nearestRoadXYZ, prepareRoads } from "./roads";
import { ROAD_DATA } from "./roads.generated";
import { latLonToDir } from "./sphere";

const R = PLANET_RADIUS;
const roads = getRoads();

describe("road network", () => {
  it("is baked for exactly the current links (run `npm run roads` after changing them)", () => {
    expect(ROAD_DATA.map((r) => [r.from, r.to])).toEqual(ROAD_LINKS);
  });

  it("connects every biome", () => {
    const seen = new Set<string>([BIOMES[0].id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const [a, b] of ROAD_LINKS) {
        if (seen.has(a) !== seen.has(b)) {
          seen.add(a);
          seen.add(b);
          grew = true;
        }
      }
    }
    expect([...seen].sort()).toEqual(BIOMES.map((b) => b.id).sort());
  });

  it("starts and ends near each biome's spawn", () => {
    for (const r of roads) {
      for (const [id, k] of [[r.from, 0], [r.to, r.count - 1]] as const) {
        const s = PLANET_LAYOUTS.find((l) => l.biome === id)!.spawn;
        const d = latLonToDir(s.lat, s.lon);
        const gap = Math.acos(Math.min(1, d.x * r.p[k * 3] + d.y * r.p[k * 3 + 1] + d.z * r.p[k * 3 + 2])) * R;
        // The circuit's berms and grandstands wall the raceway spawn off from the north-east, so the
        // road from Downtown arrives at the far side of the track instead
        const limit = r.from === "raceway" && r.to === "engineering" && id === "raceway" ? 75 : 40;
        expect(gap, `${r.from} → ${r.to} at ${id}`).toBeLessThan(limit);
      }
    }
  });

  it("stays clear of every building, prop and parking ring (layouts changed? run `npm run roads`)", () => {
    const bed = ROAD_HALF_WIDTH + ROAD_BED_SHOULDER;
    for (const o of layoutObstacles()) {
      for (const r of roads) {
        for (let i = 0; i < r.count; i++) {
          const c = o.x * r.p[i * 3] + o.y * r.p[i * 3 + 1] + o.z * r.p[i * 3 + 2];
          const d = Math.acos(Math.min(1, c)) * R;
          expect(d, `${r.from} → ${r.to} point ${i}`).toBeGreaterThan(o.r + bed);
        }
      }
    }
  });

  it("has a smooth, drivable bed", () => {
    for (const r of roads) {
      for (let i = 1; i < r.count; i++) {
        const o = i * 3;
        const run = Math.hypot(r.p[o] - r.p[o - 3], r.p[o + 1] - r.p[o - 2], r.p[o + 2] - r.p[o - 1]) * R;
        expect(Math.abs(r.h[i] - r.h[i - 1]) / run, `${r.from} → ${r.to} point ${i}`).toBeLessThan(0.3);
      }
    }
  });
});

describe("road bed", () => {
  const road = prepareRoads([
    { from: "home", to: "raceway", points: [1, 0, 0, Math.cos(0.1), Math.sin(0.1), 0], heights: [2, 4] },
  ]);
  const left = (m: number, along = 0.05) => {
    const a = along;
    const off = m / R;
    return [Math.cos(a) * Math.cos(off), Math.sin(a) * Math.cos(off), Math.sin(off)] as const;
  };

  it("finds the nearest point and interpolates the bed height", () => {
    const [x, y, z] = left(2);
    const hit = nearestRoadXYZ(x, y, z, road, { dist: 0, target: 0, road: 0, seg: 0, t: 0 });
    expect(hit.dist).toBeCloseTo(2, 1);
    expect(hit.target).toBeCloseTo(3, 1);
  });

  it("is flat across the road, blends out, and leaves far ground alone", () => {
    expect(applyRoadBed(...left(1), 10, road)).toBeCloseTo(3, 1);
    expect(applyRoadBed(...left(ROAD_HALF_WIDTH + ROAD_BED_SHOULDER - 0.1), 10, road)).toBeCloseTo(3, 1);
    const mid = applyRoadBed(...left(ROAD_HALF_WIDTH + ROAD_BED_SHOULDER + 2), 10, road);
    expect(mid).toBeGreaterThan(3.1);
    expect(mid).toBeLessThan(9.9);
    expect(applyRoadBed(...left(30), 10, road)).toBe(10);
    expect(applyRoadBed(...left(1), 10, [])).toBe(10);
  });
});
