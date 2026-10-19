// Deterministic, seeded 3D simplex noise + fBm helpers (no dependencies, no allocations per call).
// Based on Stefan Gustavson's public-domain simplex noise; the permutation table is shuffled by a
// seeded PRNG so every seed gives a different but reproducible field.

export type Noise3D = (x: number, y: number, z: number) => number;

/** Small, fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash → [0, 1). Used for per-face colour dithering (stable for a given input). */
export function hash01(n: number): number {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 12 gradient directions (cube edge midpoints), flattened as x,y,z triples.
const GRAD3 = new Float64Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

const F3 = 1 / 3;
const G3 = 1 / 6;

/**
 * Creates a seeded 3D simplex noise function. Output is in [-1, 1] (practically about ±0.95).
 * Feature size is roughly one unit: sample at `position / wavelength`.
 */
export function createNoise3D(seed = 1): Noise3D {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  // Doubled tables avoid wrapping the index; gradient index is precomputed (×3 for the flat array).
  const perm = new Uint8Array(512);
  const permGrad = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permGrad[i] = (perm[i] % 12) * 3;
  }

  return (x: number, y: number, z: number): number => {
    // Skew into simplex cell space to find which cell we're in.
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);

    // Which of the six tetrahedra of the cube are we in?
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    } else if (y0 < z0) {
      i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
    } else if (x0 < z0) {
      i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
    } else {
      i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let n = 0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const g = permGrad[ii + perm[jj + perm[kk]]];
      t0 *= t0;
      n += t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const g = permGrad[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
      t1 *= t1;
      n += t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const g = permGrad[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
      t2 *= t2;
      n += t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const g = permGrad[ii + 1 + perm[jj + 1 + perm[kk + 1]]];
      t3 *= t3;
      n += t3 * t3 * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3);
    }
    // 32 scales the sum to roughly [-1, 1]; clamp guards the rare overshoot.
    const v = 32 * n;
    return v > 1 ? 1 : v < -1 ? -1 : v;
  };
}

/**
 * Fractal Brownian motion: `octaves` layers of noise, each `lacunarity`× the frequency and `gain`×
 * the amplitude of the previous. Normalised to [-1, 1].
 */
export function fbm(
  noise: Noise3D,
  x: number,
  y: number,
  z: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    // Offset each octave so their lattices don't line up at the origin.
    sum += amp * noise(x * f + o * 17.31, y * f - o * 9.73, z * f + o * 5.19);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/**
 * Ridged fBm: sharp crests where the base noise crosses zero (ridges, canyons, mesa rims).
 * Each octave is weighted by the previous one so detail concentrates on the ridges. Range [0, 1].
 * `crest` rounds the ridge tops (smooth |n| = sqrt(n² + crest²)); 0 gives knife-edge ridges.
 */
export function ridgedFbm(
  noise: Noise3D,
  x: number,
  y: number,
  z: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
  crest = 0,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  let weight = 1;
  const c2 = crest * crest;
  const lift = crest; // keeps the rounded ridge peaking at ~1
  for (let o = 0; o < octaves; o++) {
    const n = noise(x * f + o * 17.31, y * f - o * 9.73, z * f + o * 5.19);
    let r = 1 + lift - (c2 > 0 ? Math.sqrt(n * n + c2) : Math.abs(n));
    r *= r;
    r *= weight;
    weight = r < 0 ? 0 : r > 1 ? 1 : r;
    sum += amp * r;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Hermite smoothstep, clamped. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
