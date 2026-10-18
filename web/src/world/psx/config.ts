// PSX look: tunables plus the pure maths the shaders use (mirrored in TS so it can be unit-tested).

export interface PsxConfig {
  /** Internal render height (px) on desktop / "high" quality. Width follows the viewport aspect. */
  heightDesktop: number;
  /** Internal render height (px) on phones, small viewports and "low" quality. */
  heightMobile: number;
  /** Vertex snapping grid height (px); width follows the aspect. Lower = more PS1 wobble. */
  snapHeight: number;
  /** Bits per colour channel after quantisation (5 = PS1 15-bit colour). */
  colorBits: number;
  /** Ordered dither amplitude in quantisation steps (0 = off, 1 = classic). */
  dither: number;
  /** Affine texture warp: 0 = perspective-correct, 1 = full PS1 affine. Subtle keeps Kenney palettes clean. */
  affine: number;
  /** Darken every other internal row. Off by default (a sharp, CRT-free look). */
  scanlines: boolean;
  scanlineStrength: number;
}

export const PSX_DEFAULTS: PsxConfig = {
  heightDesktop: 360,
  heightMobile: 270,
  snapHeight: 240,
  colorBits: 5,
  dither: 1,
  affine: 0.35,
  scanlines: false,
  scanlineStrength: 0.18,
};

/**
 * three.js layer for world-space UI (marker labels). The PSX pipeline leaves this layer out of the
 * low-res pass and draws it at full screen resolution afterwards, depth-tested against the upscaled
 * scene depth, so text stays legible but still hides behind buildings. Smooth mode renders it normally.
 */
export const LABEL_LAYER = 1;

/** PSX fog (metres): linear and close, like the PS1 draw-distance fog. Smooth mode sees further. */
export const PSX_FOG = { near: 60, far: 180 };
export const SMOOTH_FOG = { near: 90, far: 320 };

/** Classic 4×4 Bayer matrix (row-major, values 0..15). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/**
 * Bayer index for pixel (x, y) using the bit-interleave formula the post shader uses
 * (no array lookup in GLSL). Equals BAYER4[(y % 4) * 4 + (x % 4)].
 */
export function bayerIndex(x: number, y: number): number {
  const xi = ((Math.floor(x) % 4) + 4) % 4;
  const yi = ((Math.floor(y) % 4) + 4) % 4;
  const xy = xi ^ yi;
  return ((xy & 1) << 3) | ((yi & 1) << 2) | (((xy >> 1) & 1) << 1) | ((yi >> 1) & 1);
}

/** Dither threshold in (-0.5, 0.5) for a pixel: centred so the average brightness is unchanged. */
export function bayerThreshold(x: number, y: number): number {
  return (bayerIndex(x, y) + 0.5) / 16 - 0.5;
}

/**
 * Mirror of the post shader: add the ordered-dither offset (in quantisation steps), then round to
 * `2^bits - 1` levels. Input/output are display (sRGB-encoded) values in [0, 1].
 */
export function quantise(value: number, bits: number, ditherOffset = 0, ditherStrength = 1): number {
  const levels = Math.pow(2, bits) - 1;
  const v = value + (ditherOffset * ditherStrength) / levels;
  return Math.min(1, Math.max(0, Math.floor(v * levels + 0.5) / levels));
}

/** "Phone-ish" viewport: the small side is under 600 CSS px. */
export function isCompactViewport(width: number, height: number): boolean {
  return Math.min(width, height) < 600;
}

/** Internal height for the current viewport and quality. */
export function targetHeight(
  width: number,
  height: number,
  quality: "high" | "low",
  config: Pick<PsxConfig, "heightDesktop" | "heightMobile"> = PSX_DEFAULTS,
): number {
  return quality === "low" || isCompactViewport(width, height) ? config.heightMobile : config.heightDesktop;
}

/**
 * Low-res render size: a fixed height (never more than the viewport itself) and a width from the
 * aspect ratio. DPR is deliberately ignored: the internal resolution is the same on a 1× or 3× screen.
 */
export function internalResolution(
  viewWidth: number,
  viewHeight: number,
  height: number,
): { width: number; height: number } {
  const vw = Math.max(1, viewWidth);
  const vh = Math.max(1, viewHeight);
  const h = Math.max(1, Math.round(Math.min(height, vh)));
  const w = Math.max(1, Math.round((h * vw) / vh));
  return { width: w, height: h };
}

/** Vertex-snap grid for an internal resolution (same aspect, `snapHeight` rows, capped at the render height). */
export function snapGrid(width: number, height: number, snapHeight: number): { x: number; y: number } {
  const y = Math.max(1, Math.min(snapHeight, height));
  return { x: Math.max(1, Math.round((y * width) / height)), y };
}
