import { describe, expect, it } from "vitest";
import { games, jobs } from "@/content";
import { TILE, type DistrictLayout } from "@/world/layout/types";
import { districtRect, type Rect } from "@/world/lib/area";
import { hasModel } from "@/world/models";
import { districtColliderBoxes } from "@/world/town/colliders";
import type { ColliderBox } from "@/world/lib/placement";
import { analyzeRoads, isRoadPiece } from "./helpers";
import { DISTRICT_LAYOUTS } from "./index";

const SPECIAL_IDS = ["about", "contact", "cv"];
const contentIds = new Set<string>([...jobs.map((j) => j.id), ...games.map((g) => g.id), ...SPECIAL_IDS]);

/** Placements in town tile coordinates. */
const townPlacements = (l: DistrictLayout) =>
  l.placements.map((p) => ({ ...p, x: p.x + l.origin.x, z: p.z + l.origin.z }));

function insideBox(b: ColliderBox, x: number, z: number): boolean {
  return (
    Math.abs(x - b.center[0]) < b.halfExtents[0] &&
    Math.abs(z - b.center[2]) < b.halfExtents[2] &&
    // Ignore boxes that float above car height (roof decorations, signs over the road)
    b.center[1] - b.halfExtents[1] < 2
  );
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
}

describe("district layouts", () => {
  it("are the three Milestone 1 districts", () => {
    expect(DISTRICT_LAYOUTS.map((l) => l.id).sort()).toEqual(["engineering", "home", "raceway"]);
  });

  it("only reference models that exist", () => {
    const missing = DISTRICT_LAYOUTS.flatMap((l) => l.placements.filter((p) => !hasModel(p.model)).map((p) => p.model));
    expect(missing).toEqual([]);
  });

  it("only use real content ids (or about/contact/cv) for markers", () => {
    for (const l of DISTRICT_LAYOUTS) for (const m of l.markers) expect(contentIds, m.id).toContain(m.id);
  });

  it("place every job and game exactly once across all districts", () => {
    const counts = new Map<string, number>();
    for (const l of DISTRICT_LAYOUTS) for (const m of l.markers) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
    for (const id of [...jobs.map((j) => j.id), ...games.map((g) => g.id), ...SPECIAL_IDS]) {
      expect(counts.get(id), id).toBe(1);
    }
  });

  it("marker kinds match the content", () => {
    for (const l of DISTRICT_LAYOUTS)
      for (const m of l.markers) {
        if (jobs.some((j) => j.id === m.id)) expect(m.kind, m.id).toBe("job");
        else if (games.some((g) => g.id === m.id)) expect(m.kind, m.id).toBe("game");
        else expect(m.kind, m.id).toBe(m.id);
      }
  });

  it("district rectangles do not overlap", () => {
    const rects = DISTRICT_LAYOUTS.map((l) => ({ id: l.id, r: districtRect(l) }));
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(overlaps(rects[i].r, rects[j].r), `${rects[i].id} vs ${rects[j].id}`).toBe(false);
  });

  it("markers are far enough apart that their 6 m sensors never overlap", () => {
    const all = DISTRICT_LAYOUTS.flatMap((l) =>
      l.markers.map((m) => ({ id: m.id, x: (l.origin.x + m.x) * TILE, z: (l.origin.z + m.z) * TILE })),
    );
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const apart = Math.abs(all[i].x - all[j].x) >= 6 || Math.abs(all[i].z - all[j].z) >= 6;
        expect(apart, `${all[i].id} vs ${all[j].id}`).toBe(true);
      }
  });

  it("no marker or spawn point sits inside a static collider", () => {
    const boxes = DISTRICT_LAYOUTS.flatMap((l) => districtColliderBoxes(l));
    for (const l of DISTRICT_LAYOUTS) {
      const points = [
        ...l.markers.map((m) => ({ id: `${l.id}/${m.id}`, x: m.x, z: m.z })),
        { id: `${l.id}/spawn`, x: l.spawn.x, z: l.spawn.z },
      ];
      for (const p of points) {
        const x = (l.origin.x + p.x) * TILE;
        const z = (l.origin.z + p.z) * TILE;
        const hit = boxes.find((b) => insideBox(b, x, z));
        expect(hit, p.id).toBeUndefined();
      }
    }
  });

  it("keeps markers and spawns inside their own district rectangle", () => {
    for (const l of DISTRICT_LAYOUTS) {
      const r = districtRect(l);
      for (const p of [...l.markers, l.spawn]) {
        const x = (l.origin.x + p.x) * TILE;
        const z = (l.origin.z + p.z) * TILE;
        expect(x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ).toBe(true);
      }
    }
  });

  it("forms one connected road network with no gaps, dead ends or overlaps", () => {
    const roads = DISTRICT_LAYOUTS.flatMap(townPlacements).filter((p) => isRoadPiece(p.model));
    const report = analyzeRoads(roads);
    expect(report.overlaps).toEqual([]);
    expect(report.danglingEnds).toEqual([]);
    expect(report.components).toBe(1);
  });

  it("stays within the performance budget", () => {
    const placements = DISTRICT_LAYOUTS.flatMap((l) => l.placements);
    const unique = new Set(placements.map((p) => p.model));
    expect(placements.length).toBeLessThanOrEqual(1500);
    expect(unique.size).toBeLessThanOrEqual(120);
    expect(placements.filter((p) => p.body === "dynamic").length).toBeLessThanOrEqual(48);
    expect(placements.filter((p) => p.model.startsWith("mini-characters/")).length).toBeLessThanOrEqual(20);
  });

  it("fits the town in about 36 x 36 tiles", () => {
    const rs = DISTRICT_LAYOUTS.map((l) => districtRect(l));
    const w = (Math.max(...rs.map((r) => r.maxX)) - Math.min(...rs.map((r) => r.minX))) / TILE;
    const d = (Math.max(...rs.map((r) => r.maxZ)) - Math.min(...rs.map((r) => r.minZ))) / TILE;
    expect(w).toBeLessThanOrEqual(36);
    expect(d).toBeLessThanOrEqual(36);
  });
});
