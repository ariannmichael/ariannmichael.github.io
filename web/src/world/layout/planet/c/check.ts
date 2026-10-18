// Test-side layout checks for the gamedev and badlands layouts (biome agent C).
// Imports terrain via planetPlacement, so only use it from tests (never from layout modules).
import { Quaternion, Vector3 } from "three";
import { planetColliderBox, markerSensorBox, type OrientedBox } from "@/world/lib/planetPlacement";
import { resolveCollider } from "@/world/lib/placement";
import { getModel, hasModel } from "@/world/models";
import { surfacePose } from "@/world/planet/frame";
import type { BiomeLayout, LatLon } from "@/world/planet/types";

/** Marker sensor size used by Zones.tsx (6 × 4 × 6 m). */
export const SENSOR = { size: 6, height: 4 };

/** Fixed (non-dynamic) collider boxes of a layout, with the placement index for messages. */
export function fixedBoxes(layout: BiomeLayout): { index: number; model: string; box: OrientedBox }[] {
  const out: { index: number; model: string; box: OrientedBox }[] = [];
  layout.placements.forEach((p, index) => {
    if (p.body === "dynamic" || !hasModel(p.model)) return;
    const bounds = getModel(p.model);
    if (resolveCollider(p, bounds) !== "box") return;
    out.push({ index, model: p.model, box: planetColliderBox(p, bounds) });
  });
  return out;
}

/** True when world point `pt` lies inside the oriented box (with an optional margin in metres). */
export function insideBox(pt: Vector3, box: OrientedBox, margin = 0): boolean {
  const inv = new Quaternion(...box.quaternion).invert();
  const local = pt.clone().sub(new Vector3(...box.center)).applyQuaternion(inv);
  return (
    Math.abs(local.x) <= box.halfExtents[0] + margin &&
    Math.abs(local.y) <= box.halfExtents[1] + margin &&
    Math.abs(local.z) <= box.halfExtents[2] + margin
  );
}

/** World point a little above the ground at lat/lon (where the car body would be). */
export function groundPoint(p: LatLon, height = 1): Vector3 {
  return surfacePose(p.lat, p.lon, 0, height).position;
}

export function sensorCenter(m: BiomeLayout["markers"][number]): Vector3 {
  return new Vector3(...markerSensorBox(m, SENSOR.size, SENSOR.height).center);
}

/** Budget counts for a layout. Skinned characters are counted by kit (each is its own clone). */
export function budgetCounts(layout: BiomeLayout) {
  const unique = new Set(layout.placements.map((p) => p.model));
  const characters = layout.placements.filter((p) => p.model.startsWith("mini-characters/character-")).length;
  const dynamic = layout.placements.filter((p) => p.body === "dynamic").length;
  return { placements: layout.placements.length, unique: unique.size, characters, dynamic };
}
