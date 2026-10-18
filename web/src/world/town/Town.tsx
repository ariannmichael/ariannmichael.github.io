"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { TextureLoader, Vector3 } from "three";
import {
  biomesInRange,
  byDistance,
  layoutCap,
  type Cap,
} from "@/world/lib/biomeMap";
import { onIdle } from "@/world/lib/idle";
import { lookupKit, lookupModel } from "@/world/lib/models";
import { latLonToDir } from "@/world/planet/frame";
import type { BiomeLayout, LatLon } from "@/world/planet/types";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { BiomeZones } from "@/world/zones/Zones";
import { biomeColliderBoxes } from "./colliders";
import { groupByModel } from "./group";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ModelGroupView, Placeholders } from "./ModelGroupView";

// --- Streaming tuning (degrees of arc; 1° ≈ 2.6 m on the 150 m planet) -------------------------
// From the car the horizon is ~20–35° away (camera height + hills), so anything past ~60° from a
// layout's edge can't be seen. Load a margin earlier (≈ 4 s at top speed), unload later (hysteresis).
export const STREAM_LOAD_DEG = 70;
export const STREAM_UNLOAD_DEG = 90;
const STREAM_CHECK_INTERVAL = 0.5;
/** Model groups mounted per frame while a biome streams in (spreads instancing over frames) */
const GROUPS_PER_FRAME = 3;

/** Model URLs and palette textures a layout needs (deduplicated, in placement order). */
function layoutAssets(layout: BiomeLayout): {
  models: string[];
  textures: string[];
} {
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

/** Start downloading a layout's models and palettes now (no-op for anything already cached). */
export function preloadLayout(layout: BiomeLayout): void {
  const { models, textures } = layoutAssets(layout);
  for (const url of models) useGLTF.preload(url, false);
  for (const url of textures) useLoader.preload(TextureLoader, url);
}

/**
 * Preload the remaining layouts one model at a time in idle callbacks, so glTF parsing never lands
 * in one long task during page load. Returns a cancel function.
 */
export function preloadInIdle(layouts: readonly BiomeLayout[]): () => void {
  const queue: (() => void)[] = [];
  for (const l of layouts) {
    const { models, textures } = layoutAssets(l);
    for (const url of textures)
      queue.push(() => useLoader.preload(TextureLoader, url));
    for (const url of models) queue.push(() => useGLTF.preload(url, false));
  }
  let cancel = () => {};
  const step = () => {
    queue.shift()?.();
    if (queue.length) cancel = onIdle(step);
  };
  cancel = onIdle(step);
  return () => cancel();
}

/**
 * Every biome near the car: instanced placements, one fixed body of oriented box colliders per biome,
 * dynamic props, skinned characters, and marker zones. Biomes stream in nearest first, one per idle
 * callback, and stream out once the car is far away.
 */
export function PlanetTown({
  layouts,
  spawn,
}: {
  layouts: readonly BiomeLayout[];
  spawn: LatLon;
}) {
  const caps = useMemo(
    () => layouts.map((l, i) => ({ id: i, cap: layoutCap(l) })),
    [layouts],
  );
  const [mounted, setMounted] = useState<number[]>(() => {
    // Mount only the nearest layout synchronously; the rest follow in idle time
    const dir = latLonToDir(spawn.lat, spawn.lon);
    const near = nearest(caps, dir);
    return near === undefined ? [] : [near];
  });
  const wanted = useRef<number[]>([]);
  const timer = useRef(STREAM_CHECK_INTERVAL);
  const mountedRef = useRef(mounted);
  useEffect(() => {
    mountedRef.current = mounted;
  }, [mounted]);
  const [dirty, setDirty] = useState(0);

  // Decide what should be mounted (cheap: a few dot products every half second)
  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < STREAM_CHECK_INTERVAL) return;
    timer.current = 0;
    const p = vehicleState.position;
    const dir =
      p.lengthSq() > 1
        ? _dir.copy(p).normalize()
        : latLonToDir(spawn.lat, spawn.lon, _dir);
    const inRange = biomesInRange(
      caps,
      dir,
      new Set(mountedRef.current),
      STREAM_LOAD_DEG,
      STREAM_UNLOAD_DEG,
    );
    const order = byDistance(caps, dir).filter((i) => inRange.has(i));
    const changed =
      order.length !== wanted.current.length ||
      order.some((i, k) => wanted.current[k] !== i);
    wanted.current = order;
    const m = mountedRef.current;
    // Unload immediately; load is scheduled below
    if (m.some((i) => !inRange.has(i)))
      setMounted(m.filter((i) => inRange.has(i)));
    if (changed || order.some((i) => !m.includes(i))) setDirty((d) => d + 1);
  });

  // Add one wanted layout per idle callback, nearest first
  useEffect(() => {
    const next = wanted.current.find((i) => !mounted.includes(i));
    if (next === undefined) return;
    return onIdle(() =>
      setMounted((m) => (m.includes(next) ? m : [...m, next])),
    );
  }, [mounted, dirty]);

  return (
    <>
      {mounted.map((i) => (
        <BiomeContent key={i} layout={layouts[i]} />
      ))}
    </>
  );
}

const _dir = new Vector3();

type IdxCap = { id: number; cap: Cap };

function nearest(caps: readonly IdxCap[], dir: Vector3): number | undefined {
  return byDistance(caps, dir)[0];
}

/** One biome: model groups (mounted a few per frame), colliders and zones. */
function BiomeContent({ layout }: { layout: BiomeLayout }) {
  const groups = useMemo(() => groupByModel([layout]), [layout]);
  const count = useStaggered(groups.length, GROUPS_PER_FRAME);
  return (
    <>
      {groups.slice(0, count).map((g) => (
        <ModelErrorBoundary
          key={g.ref}
          name={g.ref}
          fallback={<Placeholders items={[...g.statics, ...g.dynamics]} />}
        >
          {/* Its own boundary: a model still downloading must never blank the rest of the world */}
          <Suspense fallback={null}>
            <ModelGroupView group={g} />
          </Suspense>
        </ModelErrorBoundary>
      ))}
      <BiomeColliders layout={layout} />
      <BiomeZones layout={layout} />
    </>
  );
}

/** Reveal `total` items `perFrame` at a time, one batch per rendered frame. */
function useStaggered(total: number, perFrame: number): number {
  const [count, setCount] = useState(Math.min(total, perFrame));
  useFrame(() => {
    if (count < total) setCount((c) => Math.min(total, c + perFrame));
  });
  return Math.min(count, total);
}

/** All static colliders of a biome live in ONE fixed rigid body: far cheaper than one body each. */
function BiomeColliders({ layout }: { layout: BiomeLayout }) {
  const boxes = useMemo(() => biomeColliderBoxes(layout), [layout]);
  if (boxes.length === 0) return null;
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      name={`colliders-${layout.biome}`}
    >
      {boxes.map((b, i) => (
        <CuboidCollider
          key={i}
          args={b.halfExtents}
          position={b.center}
          quaternion={b.quaternion}
          friction={0.2}
        />
      ))}
    </RigidBody>
  );
}
