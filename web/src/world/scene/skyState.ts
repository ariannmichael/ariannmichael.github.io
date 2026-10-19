// Sky/biome tint state: a tiny mutable store (no React re-renders) shared by Sky, the fog and Lighting.
// Set the biome with setSkyBiome()/useSkyBiome(); Sky also auto-tracks biomeAt(camera) when not controlled.
import { useEffect } from "react";
import { Color, Vector3 } from "three";
import { BIOMES } from "@/world/planet/biomes";
import { latLonToDir } from "@/world/planet/frame";
import type { BiomeId } from "@/world/planet/types";

/** Seconds for a full biome-to-biome sky blend. */
export const SKY_TRANSITION = 1.5;

/**
 * World-space sun direction (unit, planet centre → sun). Fixed: one hemisphere is day.
 * lat 40 / lon 25 puts the sun ~53° up over Home (lat 10, lon 0), slightly east, so spawn is lit from
 * the front-right. Elevations: home 53°, opensource 52°, engineering 46°, raceway 29°, financial 5°
 * (golden-hour desert), badlands -19°, healthcare -29°, gamedev -70° (night side, starry dusk).
 */
export const SUN_LATLON = { lat: 40, lon: 25 } as const;
export const SUN_DIR = latLonToDir(SUN_LATLON.lat, SUN_LATLON.lon).normalize();

/** Night palette mixed in on the dark side (partially, so each biome keeps its identity). */
export const NIGHT = { top: "#0a0e2a", horizon: "#2a2c5c", fog: "#262850" } as const;
/** Max share of the night palette at full night. */
export const NIGHT_MIX = 0.65;

export interface SkyColors {
  top: Color;
  horizon: Color;
  fog: Color;
}

const makeColors = (): SkyColors => ({ top: new Color(), horizon: new Color(), fog: new Color() });

export function skyColorsFor(id: BiomeId, out: SkyColors = makeColors()): SkyColors {
  const biome = BIOMES.find((b) => b.id === id) ?? BIOMES[0];
  out.top.set(biome.sky.top);
  out.horizon.set(biome.sky.horizon);
  out.fog.set(biome.sky.fog);
  return out;
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Blend two palettes (`t` 0..1 is eased with smoothstep). */
export function lerpSkyColors(a: SkyColors, b: SkyColors, t: number, out: SkyColors = makeColors()): SkyColors {
  const k = smoothstep(0, 1, t);
  if (k >= 1) {
    // Land exactly on the target (lerp at 1 can be off by a float ulp)
    out.top.copy(b.top);
    out.horizon.copy(b.horizon);
    out.fog.copy(b.fog);
    return out;
  }
  out.top.copy(a.top).lerp(b.top, k);
  out.horizon.copy(a.horizon).lerp(b.horizon, k);
  out.fog.copy(a.fog).lerp(b.fog, k);
  return out;
}

/** 0..1 "starriness" from how dark the zenith is (the opensource purple sky is starry by day too). */
export function starsForTop(top: Color): number {
  const lum = 0.2126 * top.r + 0.7152 * top.g + 0.0722 * top.b; // linear
  return 1 - smoothstep(0.01, 0.08, lum);
}

/** 0 = day, 1 = full night, from the sun's elevation sine at the viewer (dot(sunDir, up)). */
export function nightFactor(sunDir: Vector3, up: Vector3): number {
  return smoothstep(0.12, -0.22, sunDir.dot(up));
}

export interface SkyBasis {
  up: Vector3;
  east: Vector3;
  north: Vector3;
}

const WORLD_Y = new Vector3(0, 1, 0);
const WORLD_X = new Vector3(1, 0, 0);

/**
 * Local sky basis at a world position: up = radial (planet centre → camera), east/north tangent,
 * same convention as planet/frame.ts but allocation-free. Falls back to world Y at the centre.
 */
export function skyBasis(position: Vector3, out: SkyBasis): SkyBasis {
  if (position.lengthSq() < 1e-8) out.up.copy(WORLD_Y);
  else out.up.copy(position).normalize();
  out.east.crossVectors(WORLD_Y, out.up);
  if (out.east.lengthSq() < 1e-8) out.east.crossVectors(out.up, WORLD_X).negate();
  out.east.normalize();
  out.north.crossVectors(out.up, out.east).normalize();
  return out;
}

const initial = skyColorsFor("home");

/** The live sky state. Read anywhere in useFrame; mutate only through the functions below. */
export const skyState = {
  biome: "home" as BiomeId,
  from: skyColorsFor("home"),
  to: skyColorsFor("home"),
  /** Current blended biome palette (no night applied) */
  current: { top: initial.top.clone(), horizon: initial.horizon.clone(), fog: initial.fog.clone() } as SkyColors,
  startedAt: -Infinity,
  /** Set by Sky each frame: night amount at the camera, stars amount */
  night: 0,
  stars: 0,
};

/** Start blending toward `id`'s sky (no-op if already the target). `now` in seconds. */
export function setSkyBiome(id: BiomeId, now = performance.now() / 1000): void {
  if (skyState.biome === id) return;
  skyState.biome = id;
  skyState.from.top.copy(skyState.current.top);
  skyState.from.horizon.copy(skyState.current.horizon);
  skyState.from.fog.copy(skyState.current.fog);
  skyColorsFor(id, skyState.to);
  skyState.startedAt = now;
}

/** Jump straight to a biome's sky (teleports). */
export function snapSkyBiome(id: BiomeId): void {
  skyState.biome = id;
  skyColorsFor(id, skyState.to);
  skyColorsFor(id, skyState.from);
  skyColorsFor(id, skyState.current);
  skyState.startedAt = -Infinity;
}

/** Advance the blend; returns the current biome palette. */
export function advanceSky(now = performance.now() / 1000): SkyColors {
  const t = (now - skyState.startedAt) / SKY_TRANSITION;
  return lerpSkyColors(skyState.from, skyState.to, t, skyState.current);
}

/** Controlled biome tint from React: `useSkyBiome(currentBiomeId)`. Pass null to leave it alone. */
export function useSkyBiome(id: BiomeId | null | undefined): void {
  useEffect(() => {
    if (id) setSkyBiome(id);
  }, [id]);
}
