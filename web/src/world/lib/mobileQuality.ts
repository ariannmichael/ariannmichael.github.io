// Phone-friendly graphics defaults, as pure functions (the callers read window/matchMedia).
// The world renders into an offscreen target (CozyPass), so the cost is mostly pixels: a 3x phone
// would otherwise push 9x the pixels of its CSS size through the pixel shader for no visible gain.
import type { Quality } from "@/state/useAppStore";

export interface DisplayInfo {
  /** CSS px */
  width: number;
  height: number;
  devicePixelRatio: number;
  /** `(pointer: coarse)` */
  coarse: boolean;
}

/** Longest CSS edge below which a screen counts as a phone/small tablet even with a fine pointer */
const SMALL_SCREEN_PX = 820;

/** Touch devices and small screens start on the cheap tier; the PerformanceMonitor can still lower it later. */
export function initialQuality(d: DisplayInfo): Quality {
  return d.coarse || Math.max(d.width, d.height) <= SMALL_SCREEN_PX ? "low" : "high";
}

/** Drawing-buffer pixel budget on touch devices, by tier */
const PIXEL_BUDGET = { high: 1_300_000, low: 800_000 } as const;
const DPR_CAP = { high: 2, low: 1.5 } as const;

/**
 * Device-pixel-ratio the Canvas should use. Desktop keeps its range (HQ 1..2, Lite 1). Touch screens
 * get the device ratio capped by tier and by a pixel budget, so a tablet is not sharper than it can afford.
 */
export function pickDpr(quality: Quality, d: DisplayInfo): number | [number, number] {
  if (!d.coarse) return quality === "high" ? [1, 2] : 1;
  const area = Math.max(1, d.width * d.height);
  const byBudget = Math.sqrt(PIXEL_BUDGET[quality] / area);
  const dpr = Math.min(d.devicePixelRatio, DPR_CAP[quality], byBudget);
  return Math.max(1, Math.round(dpr * 100) / 100);
}

export function readDisplay(): DisplayInfo {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    coarse: window.matchMedia?.("(pointer: coarse)").matches ?? false,
  };
}
