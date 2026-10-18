// Pure biome <-> district mapping, spawn lookup and distance-based biome streaming.
import { Vector3 } from "three";
import type { DistrictId } from "@/content/types";
import { BIOMES } from "@/world/planet/biomes";
import { latLonToDir, metresToDeg } from "@/world/planet/frame";
import type { Biome, BiomeId, BiomeLayout, LatLon } from "@/world/planet/types";

const DEG = Math.PI / 180;

export function biomeById(id: BiomeId): Biome | undefined {
  return BIOMES.find((b) => b.id === id);
}

/** Career district a biome stands for (null for pure off-road biomes like the badlands). */
export function districtOfBiome(id: BiomeId): DistrictId | null {
  return biomeById(id)?.district ?? null;
}

/** First biome representing `district`. */
export function biomeOfDistrict(district: DistrictId): Biome | undefined {
  return BIOMES.find((b) => b.district === district);
}

export type Spawn = LatLon & { yaw: number };

/** Fallback when nothing is authored yet: the Hometown meadow centre, facing north. */
const DEFAULT_SPAWN: Spawn = { lat: 10, lon: 0, yaw: 0 };

/**
 * Where the car lands for a district: the spawn of the layout whose biome maps to that district,
 * else that biome's centre, else the first layout's spawn, else the default.
 */
export function spawnForDistrict(layouts: readonly BiomeLayout[], district: DistrictId): Spawn {
  const layout = layouts.find((l) => districtOfBiome(l.biome) === district);
  if (layout) return layout.spawn;
  const biome = biomeOfDistrict(district);
  if (biome) return { ...biome.center, yaw: 0 };
  return layouts[0]?.spawn ?? DEFAULT_SPAWN;
}

/** A spherical cap: everything a layout places lies within `radiusDeg` of `dir`. */
export interface Cap {
  dir: Vector3;
  radiusDeg: number;
}

/** Smallest-ish cap around a layout's spawn, placements and markers (centre = normalised mean). */
export function layoutCap(layout: BiomeLayout): Cap {
  const pts: LatLon[] = [layout.spawn, ...layout.placements, ...layout.markers, ...layout.pads];
  const dirs = pts.map((p) => latLonToDir(p.lat, p.lon));
  const sum = new Vector3();
  for (const d of dirs) sum.add(d);
  // Degenerate (points spread evenly around the whole planet): fall back to the spawn point
  const dir = sum.lengthSq() > 1e-6 ? sum.normalize() : dirs[0].clone();
  let radiusDeg = 0;
  for (const d of dirs) radiusDeg = Math.max(radiusDeg, dir.angleTo(d) / DEG);
  // Pads extend past their centre point
  for (const pad of layout.pads) {
    radiusDeg = Math.max(radiusDeg, dir.angleTo(latLonToDir(pad.lat, pad.lon)) / DEG + metresToDeg(pad.radius + (pad.blend ?? 0)));
  }
  return { dir, radiusDeg };
}

/** Angle (degrees) from a unit direction to the nearest edge of the cap (0 when inside it). */
export function angleToCap(cap: Cap, dir: Vector3): number {
  return Math.max(0, cap.dir.angleTo(dir) / DEG - cap.radiusDeg);
}

/**
 * Streaming with hysteresis: a biome loads when the car comes within `loadDeg` of its cap edge and
 * unloads only past `unloadDeg`, so driving along the boundary never thrashes.
 */
export function biomesInRange<K>(
  caps: readonly { id: K; cap: Cap }[],
  carDir: Vector3,
  loaded: ReadonlySet<K>,
  loadDeg: number,
  unloadDeg: number,
): Set<K> {
  const out = new Set<K>();
  for (const { id, cap } of caps) {
    const a = angleToCap(cap, carDir);
    if (a <= loadDeg || (loaded.has(id) && a <= unloadDeg)) out.add(id);
  }
  return out;
}

/** Order ids nearest first (load order). */
export function byDistance<K>(caps: readonly { id: K; cap: Cap }[], carDir: Vector3): K[] {
  return [...caps].sort((a, b) => angleToCap(a.cap, carDir) - angleToCap(b.cap, carDir)).map((c) => c.id);
}
