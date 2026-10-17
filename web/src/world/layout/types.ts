// Town layout contract. Districts are authored as data: Kenney pieces placed on a tile grid.
// World units are metres. One road tile = TILE metres.

import type { DistrictId } from "@/content/types";

export const TILE = 8;

/** "<kit>/<model>", e.g. "city-roads/road-straight". Kits and their scales: world/models/index.ts (getKit), generated from web/scripts/kits.config.mjs */
export type ModelRef = `${string}/${string}`;

/** Quarter turns around +Y (counter-clockwise seen from above). */
export type Rot = 0 | 1 | 2 | 3;

export interface Placement {
  model: ModelRef;
  /** Tile coordinates relative to the district origin (fractions allowed) */
  x: number;
  z: number;
  rot?: Rot;
  /** Metres above ground */
  y?: number;
  /** Extra uniform scale on top of the kit scale */
  scale?: number;
  /** "box" = fixed cuboid collider from the model's bounding box (default for buildings/props), "none" = drive-through (roads, decals) */
  collider?: "box" | "none";
  /** "dynamic" = physics prop that can be knocked over (cones, debris) */
  body?: "fixed" | "dynamic";
}

export type MarkerKind = "job" | "game" | "about" | "contact" | "cv";

export interface Marker {
  /** Content id (job id, game id, "about", "contact", "cv") */
  id: string;
  kind: MarkerKind;
  x: number;
  z: number;
  /** Floating label override; defaults to the content title */
  label?: string;
}

export interface DistrictLayout {
  id: DistrictId;
  /** Tile coordinates of the district origin in the town */
  origin: { x: number; z: number };
  /** Where the vehicle spawns when teleporting here (tile coords relative to origin, rot in quarter turns) */
  spawn: { x: number; z: number; rot: Rot };
  placements: Placement[];
  markers: Marker[];
}
