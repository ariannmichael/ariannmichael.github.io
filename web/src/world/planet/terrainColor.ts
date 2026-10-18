// PSX-style flat ground colours from the biome palettes.
// Every mesh face gets one colour (no gradients inside a triangle). Biome borders, dirt-track
// edges and the rock/grass slope threshold are *dithered* per face with a stable hash, which reads
// as the chunky mottled transitions of PS1 terrain instead of smooth blends.

import { Color, type Vector3 } from "three";
import { BIOMES } from "./biomes";
import { BIOME_COUNT, biomeWeightsXYZ, dominantBiomeIndexXYZ } from "./biomeField";
import { PLANET_RADIUS } from "./config";
import { createNoise3D, fbm, hash01, smoothstep } from "./noise";
import { trackMaskXYZ } from "./terrain";

const shadeNoise = createNoise3D(4051);

interface Palette {
  ground: Color[];
  dirt: Color;
  rock: Color;
}

// Color#set from a hex string converts sRGB → linear working space, which is what vertex colours
// must hold under three's colour management.
const PALETTES: Palette[] = BIOMES.map((b) => ({
  ground: b.palette.ground.map((c) => new Color(c)),
  dirt: new Color(b.palette.dirt),
  rock: new Color(b.palette.rock),
}));

/** Slope (degrees) where grass turns to rock; faces within ±ROCK_DITHER are dithered. */
export const ROCK_SLOPE_DEG = 33;
const ROCK_DITHER = 5;
const COS_ROCK_LO = Math.cos(((ROCK_SLOPE_DEG - ROCK_DITHER) * Math.PI) / 180);
const COS_ROCK_HI = Math.cos(((ROCK_SLOPE_DEG + ROCK_DITHER) * Math.PI) / 180);

const weights = new Float32Array(BIOME_COUNT);
/** Runner-up share (0..1) above which biome colours start to mix at a border */
const BORDER_TIE = 0.45;

/** Ground-shade index in [0, count) from low-frequency patches plus per-face jitter. */
function shadeIndex(x: number, y: number, z: number, count: number, jitter: number): number {
  const k = PLANET_RADIUS / 14; // patches ~7–14 m across
  const s = fbm(shadeNoise, x * k, y * k, z * k, 2) * 0.5 + 0.5 + jitter;
  return Math.max(0, Math.min(count - 1, Math.floor(s * count)));
}

/**
 * Colour of one mesh face. `x, y, z` = unit direction of the face centroid, `cosSlope` = dot of the
 * face normal with the radial up, `faceId` seeds the dither. Writes linear RGB into `out` at `o`.
 */
export function faceColor(
  x: number,
  y: number,
  z: number,
  cosSlope: number,
  faceId: number,
  out: Float32Array,
  o: number,
): void {
  const h1 = hash01(faceId * 3 + 1);
  const h2 = hash01(faceId * 3 + 2);
  const h3 = hash01(faceId * 3 + 3);

  // Biome: the dominant one, except near a tie with the runner-up, where blotchy noise (plus a
  // little per-face jitter) mixes the two into a mottled, chunky border a few faces wide.
  biomeWeightsXYZ(x, y, z, weights);
  let b1 = 0;
  let b2 = -1;
  for (let i = 1; i < BIOME_COUNT; i++) {
    if (weights[i] > weights[b1]) {
      b2 = b1;
      b1 = i;
    } else if (b2 < 0 || weights[i] > weights[b2]) b2 = i;
  }
  let b = b1;
  const tie = (2 * weights[b2]) / (weights[b1] + weights[b2]); // 0 = clear winner, 1 = tie
  if (tie > BORDER_TIE) {
    const k = PLANET_RADIUS / 5;
    const u = 0.5 + 0.6 * fbm(shadeNoise, x * k + 71.1, y * k, z * k, 2) + (h1 - 0.5) * 0.3;
    if (u < 0.5 * smoothstep(BORDER_TIE, 1, tie)) b = b2;
  }
  const pal = PALETTES[b];

  let c: Color;
  // Rock on steep faces (dithered band around the threshold).
  const rockT = (COS_ROCK_LO - cosSlope) / (COS_ROCK_LO - COS_ROCK_HI); // 0 = gentle, 1 = steep
  if (rockT > h2) {
    c = pal.rock;
  } else {
    const m = trackMaskXYZ(x, y, z);
    c = m > 0.25 + 0.5 * h2 ? pal.dirt : pal.ground[shadeIndex(x, y, z, pal.ground.length, (h3 - 0.5) * 0.3)];
  }
  // Tiny per-face brightness jitter: keeps big flat areas from looking like one plastic sheet.
  const j = 0.95 + 0.1 * h3;
  out[o] = c.r * j;
  out[o + 1] = c.g * j;
  out[o + 2] = c.b * j;
}

/**
 * Representative ground colour at unit direction `dir` (dominant biome; dirt on tracks; no
 * slope/rock or dither). For wheel smoke/dust tinting. Linear RGB (three working space).
 */
export function groundColorAt(dir: Vector3, out: Color = new Color()): Color {
  const b = dominantBiomeIndexXYZ(dir.x, dir.y, dir.z);
  const pal = PALETTES[b];
  if (trackMaskXYZ(dir.x, dir.y, dir.z) > 0.5) return out.copy(pal.dirt);
  return out.copy(pal.ground[shadeIndex(dir.x, dir.y, dir.z, pal.ground.length, 0)]);
}

/** The palette of a biome by index into BIOMES (parsed Colors, linear). Read-only. */
export function biomePalette(i: number): Readonly<Palette> {
  return PALETTES[i];
}
