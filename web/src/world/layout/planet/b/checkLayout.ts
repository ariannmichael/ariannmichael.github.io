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
import { site } from "./site";

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

/** Small-planet town budget (see budget.test.ts): footprints and markers within this of the centre */
export const TOWN_RADIUS = 40;

/**
 * Things blocking a road lane: a strip `halfWidth` either side of the ray from `from` along compass
 * `bearing` (degrees clockwise from north, in the biome centre's frame), out to TOWN_RADIUS.
 * Blockers are placements taller than 0.6 m whose footprint circle reaches into the strip, markers in
 * the strip, and small raised or sunken pads whose core reaches into it.
 */
export function laneBlockers(layout: BiomeLayout, from: LatLon, bearing: number, halfWidth = 6): string[] {
  const biome = BIOMES.find((b) => b.id === layout.biome)!;
  const s = site(biome.center);
  const [n0, e0] = s.toNE(from);
  const dn = Math.cos((bearing * Math.PI) / 180);
  const de = Math.sin((bearing * Math.PI) / 180);
  // Lane length: from the spawn to the TOWN_RADIUS circle
  const b = n0 * dn + e0 * de;
  const len = -b + Math.sqrt(b * b - (n0 * n0 + e0 * e0 - TOWN_RADIUS * TOWN_RADIUS));
  const distToLane = (p: LatLon) => {
    const [n, e] = s.toNE(p);
    const t = Math.max(0, Math.min(len, (n - n0) * dn + (e - e0) * de));
    return Math.hypot(n - (n0 + t * dn), e - (e0 + t * de));
  };
  const hits: string[] = [];
  for (const p of layout.placements) {
    const { min, max } = getModel(p.model);
    const sc = p.scale ?? 1;
    if ((p.y ?? 0) + max[1] * sc <= 0.6) continue;
    const r = (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * sc;
    if (distToLane(p) < halfWidth + r) hits.push(p.model);
  }
  for (const m of layout.markers) if (distToLane(m) < halfWidth) hits.push(`marker ${m.id}`);
  for (const p of layout.pads) {
    if (p.radius > 8 || Math.abs(p.height ?? 0) < 0.5) continue;
    if (degToMetres(angleBetween(p, from)) < p.radius) continue; // the spawn's own pad
    if (distToLane(p) < halfWidth + p.radius) hits.push(`pad r=${p.radius} h=${p.height}`);
  }
  return hits;
}

/** Samples a polyline of anchor-frame (north, east) waypoints every `step` metres, as lat/lon. */
export function polyline(s: ReturnType<typeof site>, pts: [number, number][], step = 1): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [n0, e0] = pts[i - 1];
    const [n1, e1] = pts[i];
    const k = Math.max(1, Math.ceil(Math.hypot(n1 - n0, e1 - e0) / step));
    for (let j = i === 1 ? 0 : 1; j <= k; j++) out.push(s.at(n0 + ((n1 - n0) * j) / k, e0 + ((e1 - e0) * j) / k));
  }
  return out;
}

/** Placement top above its base (metres), for "tallest landmark" checks. */
export function topOf(p: { model: string; y?: number; scale?: number }): number {
  return (p.y ?? 0) + getModel(p.model).max[1] * (p.scale ?? 1);
}
