// Shared vitest checks for biome agent B's layouts (imported only from *.test.ts files).
import { expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { getContent } from "@/content";
import { markerSensorBox, planetColliderBox, type OrientedBox } from "@/world/lib/planetPlacement";
import { resolveCollider } from "@/world/lib/placement";
import { getModel, hasModel } from "@/world/models";
import { BIOMES } from "@/world/planet/biomes";
import { angleBetween, degToMetres, latLonToDir, surfacePose } from "@/world/planet/frame";
import { analyticHeightXYZ, biomeAt } from "@/world/planet/terrain";
import type { BiomeLayout, LatLon } from "@/world/planet/types";

export const BUDGET = { placements: 220, uniqueModels: 40, characters: 8, dynamic: 12 };

/** True when world point `p` lies inside the oriented box (with an optional margin). */
export function insideBox(p: Vector3, box: OrientedBox, margin = 0): boolean {
  const q = new Quaternion(...box.quaternion).invert();
  const local = p.clone().sub(new Vector3(...box.center)).applyQuaternion(q);
  return (
    Math.abs(local.x) <= box.halfExtents[0] + margin &&
    Math.abs(local.y) <= box.halfExtents[1] + margin &&
    Math.abs(local.z) <= box.halfExtents[2] + margin
  );
}

/** Static (non-dynamic) collider boxes of a layout. */
export function staticBoxes(layout: BiomeLayout): { ref: string; box: OrientedBox }[] {
  return layout.placements
    .filter((p) => p.body !== "dynamic" && hasModel(p.model))
    .filter((p) => resolveCollider({ model: p.model, collider: p.collider, scale: p.scale }, getModel(p.model)) === "box")
    .map((p) => ({ ref: p.model, box: planetColliderBox(p, getModel(p.model)) }));
}

/** Registers the brief's standard checks for one biome layout. */
export function checkLayout(layout: BiomeLayout) {
  const biome = BIOMES.find((b) => b.id === layout.biome)!;
  const dist = (p: LatLon) => degToMetres(angleBetween(p, biome.center));

  it("uses only existing models", () => {
    const missing = layout.placements.map((p) => p.model).filter((m) => !hasModel(m));
    expect(missing).toEqual([]);
  });

  it("markers are valid content ids of the matching kind and district", () => {
    for (const m of layout.markers) {
      const c = getContent(m.id);
      expect(c, m.id).toBeDefined();
      expect(c!.type).toBe(m.kind);
      if (c!.type === "job") expect(c!.item.district).toBe(layout.biome);
      expect((m.label ?? "").length).toBeLessThanOrEqual(20);
    }
  });

  it("spawn and markers are in this biome's core", () => {
    for (const p of [layout.spawn, ...layout.markers]) {
      expect(biomeAt(latLonToDir(p.lat, p.lon))).toBe(layout.biome);
      expect(dist(p)).toBeLessThan(degToMetres(biome.radiusDeg * 0.8));
    }
  });

  it("everything stays inside the biome radius", () => {
    for (const p of [...layout.placements, ...layout.pads]) {
      expect(dist(p)).toBeLessThan(degToMetres(biome.radiusDeg));
    }
  });

  it("no marker sensor or spawn sits inside a static collider", () => {
    const boxes = staticBoxes(layout);
    for (const m of layout.markers) {
      const sensor = markerSensorBox(m, 6, 4);
      const c = new Vector3(...sensor.center);
      const hits = boxes.filter((b) => insideBox(c, b.box)).map((b) => b.ref);
      expect(hits, m.id).toEqual([]);
    }
    const sp = surfacePose(layout.spawn.lat, layout.spawn.lon, layout.spawn.yaw, 1.2).position;
    expect(boxes.filter((b) => insideBox(sp, b.box, 1.5)).map((b) => b.ref)).toEqual([]);
  });

  it("markers are at least 8 m apart", () => {
    for (let i = 0; i < layout.markers.length; i++) {
      for (let j = i + 1; j < layout.markers.length; j++) {
        expect(degToMetres(angleBetween(layout.markers[i], layout.markers[j]))).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("respects the budgets", () => {
    const ps = layout.placements;
    expect(ps.length).toBeLessThanOrEqual(BUDGET.placements);
    expect(new Set(ps.map((p) => p.model)).size).toBeLessThanOrEqual(BUDGET.uniqueModels);
    expect(ps.filter((p) => p.model.startsWith("mini-characters/")).length).toBeLessThanOrEqual(BUDGET.characters);
    expect(ps.filter((p) => p.body === "dynamic").length).toBeLessThanOrEqual(BUDGET.dynamic);
  });
}

/**
 * Static colliders that block a drive path: each lat/lon sample is tested at wheel, body and roof
 * height, so a passing path is clear for the 2.2 m tall SUV.
 */
export function blockersOnPath(layout: BiomeLayout, path: LatLon[]): string[] {
  const boxes = staticBoxes(layout);
  const hits: string[] = [];
  for (const p of path) {
    for (const h of [0.5, 1.3, 2.3]) {
      const pos = surfacePose(p.lat, p.lon, 0, h).position;
      for (const b of boxes) if (insideBox(pos, b.box)) hits.push(`${b.ref} @ ${p.lat.toFixed(3)},${p.lon.toFixed(3)} h${h}`);
    }
  }
  return hits;
}

/** Steepest grade (rise over run) between consecutive samples of a path on the padded terrain. */
export function maxGrade(path: LatLon[]): number {
  let worst = 0;
  for (let i = 1; i < path.length; i++) {
    const a = latLonToDir(path[i - 1].lat, path[i - 1].lon);
    const b = latLonToDir(path[i].lat, path[i].lon);
    const rise = Math.abs(analyticHeightXYZ(b.x, b.y, b.z) - analyticHeightXYZ(a.x, a.y, a.z));
    const run = degToMetres(angleBetween(path[i - 1], path[i]));
    if (run > 1e-6) worst = Math.max(worst, rise / run);
  }
  return worst;
}
