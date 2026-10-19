"use client";

// Prioritised downloads of biome models and palettes. Everything goes through drei/R3F's own
// suspend-react cache (so useGLTF/useLoader in the renderer find it already loaded), but the queue
// decides WHEN each request starts: spawn biome first, neighbours next, the far side of the planet
// last, a couple at a time, in idle time.
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { onIdle } from "@/world/lib/idle";
import { createLoadQueue } from "@/world/lib/loadQueue";
import { lookupKit, lookupModel } from "@/world/lib/models";
import type { BiomeLayout } from "@/world/planet/types";
import { groupByModel } from "./group";
import { useSpawnLoad } from "./loadStatus";

export const PRIORITY = { spawn: 0, near: 1, far: 2 } as const;
export type LoadPriority = (typeof PRIORITY)[keyof typeof PRIORITY];

/**
 * In-flight caps per priority. Spawn assets may use 12 slots (HTTP/2 multiplexes them; HTTP/1.1
 * browsers cap at 6 per host anyway). Neighbours start once spawn work is mostly in flight, and far
 * biomes only while at most one other request is running.
 */
const queue = createLoadQueue([12, 6, 2]);

// drei/R3F loaders are suspend-react caches and work outside React too: they return the asset once
// cached, throw the in-flight promise while loading, and throw the error if the load failed. Aliased
// so the hooks linter doesn't mistake these plain calls for hook calls.
const readGltf = useGLTF;
const readTexture = useLoader;

const noop = () => {};

function isThenable(x: unknown): x is PromiseLike<unknown> {
  return typeof x === "object" && x !== null && typeof (x as PromiseLike<unknown>).then === "function";
}

/** Start (or join) a load and resolve when it settles. Failures resolve too: the renderer reports them. */
function settle(read: () => unknown): Promise<void> {
  try {
    read();
    return Promise.resolve();
  } catch (thrown) {
    return isThenable(thrown) ? Promise.resolve(thrown).then(noop, noop) : Promise.resolve();
  }
}

/** Background requests begin in an idle callback so their parse never lands mid-frame during play. */
function startAsset(url: string, isModel: boolean, priority: number): Promise<void> {
  const read = isModel ? () => readGltf(url, false) : () => readTexture(TextureLoader, url);
  if (priority < PRIORITY.far) return settle(read);
  return new Promise<void>((resolve) => onIdle(() => void settle(read).then(resolve)));
}

/** Model URLs and palette textures a layout needs (deduplicated, in placement order). */
export function layoutAssets(layout: BiomeLayout): { models: string[]; textures: string[] } {
  const models = new Set<string>();
  const textures = new Set<string>();
  for (const p of layout.placements) {
    const info = lookupModel(p.model);
    if (!info) continue;
    models.add(info.url);
    const tex = lookupKit(info.kit)?.texture;
    if (tex) textures.add(tex);
  }
  return { models: [...models], textures: [...textures] };
}

const layoutLoads = new WeakMap<BiomeLayout, Promise<void>>();
const loadedLayouts = new WeakSet<BiomeLayout>();

/**
 * Download everything a layout renders. Idempotent: asking again with a more urgent priority promotes
 * the files still waiting in the queue. `onAsset` fires as each file settles (progress bars).
 */
export function loadLayout(layout: BiomeLayout, priority: LoadPriority, onAsset?: () => void): Promise<void> {
  const { models, textures } = layoutAssets(layout);
  // Palettes first: they're shared by every model of a kit
  const jobs = [
    ...textures.map((url) => queue.request(url, (p) => startAsset(url, false, p), priority)),
    ...models.map((url) => queue.request(url, (p) => startAsset(url, true, p), priority)),
  ];
  if (onAsset) for (const j of jobs) void j.then(onAsset);
  let all = layoutLoads.get(layout);
  if (!all) {
    all = Promise.all(jobs).then(() => {
      loadedLayouts.add(layout);
    });
    layoutLoads.set(layout, all);
  }
  return all;
}

/** True once every file of the layout has settled (renders without suspending). */
export function isLayoutLoaded(layout: BiomeLayout): boolean {
  return loadedLayouts.has(layout);
}

/**
 * Load the spawn biome at top priority and publish its progress for the HTML loader. The renderer
 * reports the second half (groups instanced + shaders compiled) through `markSpawnGroupReady`.
 */
export function loadSpawnLayout(layout: BiomeLayout): Promise<void> {
  const { models, textures } = layoutAssets(layout);
  useSpawnLoad.setState({
    biome: layout.biome,
    assetsTotal: models.length + textures.length,
    assetsLoaded: 0,
    groupsTotal: groupByModel([layout]).length,
    groupsReady: 0,
    ready: false,
  });
  spawnGroups.clear();
  return loadLayout(layout, PRIORITY.spawn, () =>
    useSpawnLoad.setState((s) =>
      s.biome === layout.biome ? { assetsLoaded: Math.min(s.assetsTotal, s.assetsLoaded + 1) } : s,
    ),
  ).then(() => {
    // Nothing to instance (an empty layout): downloads were the whole job
    const s = useSpawnLoad.getState();
    if (s.biome === layout.biome && s.groupsTotal === 0) {
      useSpawnLoad.setState({ ready: true });
      performance.mark?.("spawn-ready");
    }
  });
}

const spawnGroups = new Set<string>();

/** A model group of `biome` is on screen with warm shaders (called once per group, any biome). */
export function markGroupReady(biome: string, ref: string): void {
  const s = useSpawnLoad.getState();
  if (s.ready || s.biome !== biome || spawnGroups.has(ref)) return;
  spawnGroups.add(ref);
  const groupsReady = spawnGroups.size;
  const ready = groupsReady >= s.groupsTotal;
  useSpawnLoad.setState({ groupsReady, ready });
  // Visible in DevTools / Lighthouse traces as "spawn-ready"
  if (ready) performance.mark?.("spawn-ready");
}

/** Queue every other layout for background download, nearest first. */
export function preloadInBackground(layouts: readonly BiomeLayout[]): void {
  for (const l of layouts) void loadLayout(l, PRIORITY.far);
}
