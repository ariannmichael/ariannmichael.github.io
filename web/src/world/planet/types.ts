// Planet layout contract (coordinator-owned). Biomes are authored as data on the sphere.
// Angles are degrees. lat ∈ [-90, 90] (+90 = north pole = +Y), lon ∈ (-180, 180] (lat 0, lon 0 = +Z).

import type { DistrictId } from "@/content/types";
import type { MarkerKind, ModelRef } from "@/world/layout/types";

export type BiomeId = DistrictId | "badlands";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface PlanetPlacement extends LatLon {
  model: ModelRef;
  /** Heading in degrees, counter-clockwise seen from above; 0 = model +Z faces north */
  yaw?: number;
  /** Metres above the terrain surface at this point (negative sinks into the ground) */
  y?: number;
  /** Extra uniform scale on top of the kit scale */
  scale?: number;
  collider?: "box" | "none";
  body?: "fixed" | "dynamic";
  /** Skinned mini-characters: animation clip name (default "idle") */
  anim?: string;
}

export interface PlanetMarker extends LatLon {
  /** Content id (job id, game id, "about", "contact", "cv") */
  id: string;
  kind: MarkerKind;
  label?: string;
}

/** A circular area the terrain flattens to, for buildings, plazas, interiors and tracks. */
export interface FlatPad extends LatLon {
  /** Radius of the flat area in metres; terrain blends back to natural over `blend` metres */
  radius: number;
  blend?: number;
  /** Metres relative to the natural terrain height at the pad centre (raise or dig) */
  height?: number;
}

export interface BiomeLayout {
  biome: BiomeId;
  /** Where the car lands when teleporting to this biome; yaw as in PlanetPlacement */
  spawn: LatLon & { yaw: number };
  placements: PlanetPlacement[];
  markers: PlanetMarker[];
  pads: FlatPad[];
}

export interface Biome {
  id: BiomeId;
  name: string;
  /** Career district this biome represents (null for pure off-road areas) */
  district: DistrictId | null;
  center: LatLon;
  /** Angular radius of the biome's core; outside it terrain/palette blend into neighbours */
  radiusDeg: number;
  /** Terrain shape inside the biome (metres) */
  terrain: { base: number; amplitude: number; roughness: number; ridged?: boolean };
  /** PSX-style flat palette (hex): main ground shades, dirt tracks, rock/cliffs */
  palette: { ground: string[]; dirt: string; rock: string };
  /** Sky tint while inside the biome */
  sky: { top: string; horizon: string; fog: string };
  /** One-line art direction for layout authors */
  theme: string;
  /** Kenney kits that define this biome's look */
  kits: string[];
}
