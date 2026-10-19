// Per-biome ambience settings (pure data). The beds themselves are built in ambience.ts; this table is
// what to tune: how loud each bed sits and how often its little events (birds, cars, plips…) happen.
import type { BiomeId } from "@/world/planet/types";

export interface AmbiencePreset {
  /** What it should sound like (docs + tests) */
  description: string;
  /** Bed level (before the ambience bus) */
  level: number;
  /** Seconds between events [min, max] */
  every: readonly [number, number];
}

export const AMBIENCE: Record<BiomeId, AmbiencePreset> = {
  home: { description: "meadow: birds and a breeze", level: 0.9, every: [1.6, 5] },
  engineering: { description: "downtown: city hum and distant traffic", level: 0.8, every: [3.5, 8] },
  healthcare: { description: "lakeside: water lapping, plips", level: 0.9, every: [1.2, 3.5] },
  financial: { description: "desert: dry whistling wind", level: 0.8, every: [5, 10] },
  opensource: { description: "crater: alien drone and blips", level: 0.85, every: [3, 7] },
  gamedev: { description: "park at dusk: crickets and a faint music box", level: 0.8, every: [7, 13] },
  raceway: { description: "canyon: distant crowd and race cars", level: 0.75, every: [6, 12] },
  badlands: { description: "badlands: low wind, a far-off hawk", level: 0.9, every: [9, 16] },
};

/** Crossfade time when driving across a border, and after a teleport (s) */
export const AMBIENCE_FADE = 3;
export const AMBIENCE_FADE_FAST = 1;
/** Lite quality: events are this much rarer */
export const AMBIENCE_LITE_EVENT_SCALE = 1.8;

/** Seconds until the next event: `r` is 0..1 (injected for tests) */
export function nextEventDelay(biome: BiomeId, r: number, lite: boolean): number {
  const [a, b] = AMBIENCE[biome].every;
  return (a + (b - a) * r) * (lite ? AMBIENCE_LITE_EVENT_SCALE : 1);
}
