"use client";

// Spawn-biome loading progress, read by the HTML loader (ui/Loader). Kept tiny on purpose: the
// loader bundle imports this module, so it must not pull three.js or drei in.
import { create } from "zustand";

export interface SpawnLoadStatus {
  /** Biome the car spawns in ("" until the world starts loading) */
  biome: string;
  /** Model + texture files the spawn biome needs */
  assetsTotal: number;
  assetsLoaded: number;
  /** Model groups the spawn biome renders (each is instanced, then has its shaders warmed) */
  groupsTotal: number;
  groupsReady: number;
  /** Everything above done: the spawn biome is on screen without shader stalls */
  ready: boolean;
}

export const useSpawnLoad = create<SpawnLoadStatus>(() => ({
  biome: "",
  assetsTotal: 0,
  assetsLoaded: 0,
  groupsTotal: 0,
  groupsReady: 0,
  ready: false,
}));

/** 0–100. Downloads and per-group setup weigh the same per item. */
export function spawnProgress(s: SpawnLoadStatus): number {
  const total = s.assetsTotal + s.groupsTotal;
  if (s.ready) return 100;
  if (total === 0) return 0;
  return Math.min(99, ((s.assetsLoaded + s.groupsReady) / total) * 100);
}
