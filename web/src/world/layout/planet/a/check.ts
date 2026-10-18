// Shared layout checks for biome agent A's tests (home, engineering, raceway). Test-only module.
import { expect } from "vitest";
import { Quaternion, Vector3 } from "three";
import { games } from "@/content/games";
import { jobs } from "@/content/jobs";
import { getModel, hasModel } from "@/world/models";
import { markerSensorBox, planetColliderBox, type OrientedBox } from "@/world/lib/planetPlacement";
import { resolveCollider } from "@/world/lib/placement";
import { BIOMES } from "@/world/planet/biomes";
import { angleBetween, degToMetres, headingAt, latLonToDir, surfaceFrame, surfaceRadius } from "@/world/planet/frame";
import { biomeAt } from "@/world/planet/terrain";
import type { BiomeLayout, LatLon } from "@/world/planet/types";

export const BUDGET = { placements: 220, models: 40, characters: 8, dynamic: 12 };

/** Kind a marker id must have: job/game from content, or the special ids. */
export function expectedKind(id: string): string | undefined {
  if (id === "about" || id === "contact" || id === "cv") return id;
  if (jobs.some((j) => j.id === id)) return "job";
  if (games.some((g) => g.id === id)) return "game";
  return undefined;
}

function inside(box: OrientedBox, p: Vector3, margin = 0): boolean {
  const q = new Quaternion(...box.quaternion).invert();
  const d = p.clone().sub(new Vector3(...box.center)).applyQuaternion(q);
  return (
    Math.abs(d.x) < box.halfExtents[0] + margin &&
    Math.abs(d.y) < box.halfExtents[1] + margin &&
    Math.abs(d.z) < box.halfExtents[2] + margin
  );
}

export function solidBoxes(layout: BiomeLayout): { model: string; box: OrientedBox }[] {
  return layout.placements
    .filter((p) => p.body !== "dynamic")
    .filter((p) => resolveCollider(p, getModel(p.model)) === "box")
    .map((p) => ({ model: p.model, box: planetColliderBox(p, getModel(p.model)) }));
}

/** World point `h` metres above the terrain at lat/lon, plus `ahead` metres along `yaw`. */
function pointAt(at: LatLon, h: number, yaw = 0, ahead = 0): Vector3 {
  const dir = latLonToDir(at.lat, at.lon);
  const frame = surfaceFrame(dir);
  const p = dir.clone().multiplyScalar(surfaceRadius(dir) + h);
  if (ahead) {
    p.addScaledVector(headingAt(frame, yaw), ahead);
    // re-project onto the surface (+h) at the new direction
    const d2 = p.clone().normalize();
    return d2.multiplyScalar(surfaceRadius(d2) + h);
  }
  return p;
}

export function checkLayout(layout: BiomeLayout, ids: string[]) {
  const biome = BIOMES.find((b) => b.id === layout.biome)!;

  // Every model exists
  const missing = layout.placements.filter((p) => !hasModel(p.model)).map((p) => p.model);
  expect(missing).toEqual([]);

  // Markers: exactly the expected ids, valid kinds
  expect(layout.markers.map((m) => m.id).sort()).toEqual([...ids].sort());
  for (const m of layout.markers) {
    expect(expectedKind(m.id), m.id).toBe(m.kind);
    if (m.label) expect(m.label.length, m.id).toBeLessThanOrEqual(26);
  }

  // Biome agreement at spawn and markers; core within 0.8 × radius
  for (const p of [layout.spawn, ...layout.markers]) {
    expect(biomeAt(latLonToDir(p.lat, p.lon)), JSON.stringify(p)).toBe(layout.biome);
    expect(angleBetween(p, biome.center)).toBeLessThan(0.8 * biome.radiusDeg);
  }
  // Everything within the biome radius
  for (const p of [...layout.placements, ...layout.pads]) {
    expect(angleBetween(p, biome.center), JSON.stringify(p)).toBeLessThan(biome.radiusDeg);
  }

  // Markers at least 8 m apart
  for (let i = 0; i < layout.markers.length; i++) {
    for (let j = i + 1; j < layout.markers.length; j++) {
      const d = degToMetres(angleBetween(layout.markers[i], layout.markers[j]));
      expect(d, `${layout.markers[i].id} ↔ ${layout.markers[j].id}`).toBeGreaterThanOrEqual(8);
    }
  }

  // No marker sensor centre / spawn inside a solid collider; the way ahead of the spawn is clear
  const boxes = solidBoxes(layout);
  for (const m of layout.markers) {
    const c = new Vector3(...markerSensorBox(m, 6, 4).center);
    const hit = boxes.filter((b) => inside(b.box, c)).map((b) => b.model);
    expect(hit, `marker ${m.id}`).toEqual([]);
  }
  for (const ahead of [0, 3, 6, 9, 12]) {
    const p = pointAt(layout.spawn, 1, layout.spawn.yaw, ahead);
    const hit = boxes.filter((b) => inside(b.box, p, 1.3)).map((b) => b.model);
    expect(hit, `spawn +${ahead} m`).toEqual([]);
  }

  // Budgets
  expect(layout.placements.length).toBeLessThanOrEqual(BUDGET.placements);
  expect(new Set(layout.placements.map((p) => p.model)).size).toBeLessThanOrEqual(BUDGET.models);
  expect(layout.placements.filter((p) => p.model.startsWith("mini-characters/")).length).toBeLessThanOrEqual(
    BUDGET.characters,
  );
  expect(layout.placements.filter((p) => p.body === "dynamic").length).toBeLessThanOrEqual(BUDGET.dynamic);

  // Pads are big enough for the mesh
  for (const pad of layout.pads) expect(pad.radius).toBeGreaterThanOrEqual(2.5);
}

/** True when a point `h` m above the ground at lat/lon is inside any solid collider (for interior checks). */
export function blockedAt(layout: BiomeLayout, at: LatLon, h = 1.1, margin = 1.2): string[] {
  const p = pointAt(at, h);
  return solidBoxes(layout)
    .filter((b) => inside(b.box, p, margin))
    .map((b) => b.model);
}
