"use client";

import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import {
  biomesInRange,
  byDistance,
  layoutCap,
  type Cap,
} from "@/world/lib/biomeMap";
import { onIdle } from "@/world/lib/idle";
import { latLonToDir } from "@/world/planet/frame";
import type { BiomeLayout, LatLon } from "@/world/planet/types";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { BiomeZones } from "@/world/zones/Zones";
import { isLayoutLoaded, loadLayout, markGroupReady, PRIORITY } from "./assets";
import { biomeColliderBoxes } from "./colliders";
import { useSpawnLoad } from "./loadStatus";
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
/** Static colliders added per frame (Rapier collider creation is cheap but not free) */
const COLLIDERS_PER_FRAME = 64;
/** Neighbour biomes start streaming after this long even if the spawn biome never reports ready */
const SPAWN_GATE_TIMEOUT_MS = 12000;

/**
 * Every biome near the car: instanced placements, one fixed body of oriented box colliders per biome,
 * dynamic props, skinned characters, and marker zones. Biomes stream in nearest first, one per idle
 * callback, and stream out once the car is far away. Downloads are prioritised in ./assets.
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

  // Add one wanted layout per idle callback, nearest first. Neighbours wait for the spawn biome, so
  // their downloads, parsing and instancing never compete with what the player sees first.
  const gateOpen = useSpawnGate();
  useEffect(() => {
    if (!gateOpen && mounted.length > 0) return;
    const next = wanted.current.find((i) => !mounted.includes(i));
    if (next === undefined) return;
    return onIdle(() =>
      setMounted((m) => (m.includes(next) ? m : [...m, next])),
    );
  }, [mounted, dirty, gateOpen]);

  return (
    <>
      {mounted.map((i) => (
        <BiomeContent key={i} layout={layouts[i]} />
      ))}
    </>
  );
}

const _dir = new Vector3();

/** True once the spawn biome is ready (or after a timeout, so streaming can never stall). */
function useSpawnGate(): boolean {
  const ready = useSpawnLoad((s) => s.ready);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setTimedOut(true), SPAWN_GATE_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [ready]);
  return ready || timedOut;
}

type IdxCap = { id: number; cap: Cap };

function nearest(caps: readonly IdxCap[], dir: Vector3): number | undefined {
  return byDistance(caps, dir)[0];
}

/**
 * One biome: colliders and zones right away; model groups once every file of the biome is downloaded
 * (so nothing suspends or pops in piecemeal), then a few groups per frame.
 */
function BiomeContent({ layout }: { layout: BiomeLayout }) {
  const loaded = useLayoutLoaded(layout);
  return (
    <>
      {loaded && <BiomeModels layout={layout} />}
      <BiomeColliders layout={layout} />
      <BiomeZones layout={layout} />
    </>
  );
}

/** Asks for the layout's files (promoting them if they were queued as background work). */
function useLayoutLoaded(layout: BiomeLayout): boolean {
  const [loaded, setLoaded] = useState(() => isLayoutLoaded(layout));
  useEffect(() => {
    if (loaded) return;
    let live = true;
    void loadLayout(layout, PRIORITY.near).then(() => {
      if (live) setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [layout, loaded]);
  return loaded;
}

function BiomeModels({ layout }: { layout: BiomeLayout }) {
  const groups = useMemo(() => groupByModel([layout]), [layout]);
  const count = useStaggered(groups.length, GROUPS_PER_FRAME);
  const biome = layout.biome;
  const onReady = useCallback((ref: string) => markGroupReady(biome, ref), [biome]);
  return (
    <>
      {groups.slice(0, count).map((g) => (
        <ModelErrorBoundary
          key={g.ref}
          name={g.ref}
          fallback={
            <Placeholders items={[...g.statics, ...g.dynamics]} onMount={() => onReady(g.ref)} />
          }
        >
          {/* Its own boundary: a model that still suspends must never blank the rest of the world */}
          <Suspense fallback={null}>
            <ModelGroupView group={g} onReady={onReady} />
          </Suspense>
        </ModelErrorBoundary>
      ))}
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

/**
 * All static colliders of a biome live in ONE fixed rigid body: far cheaper than one body each.
 * They are added a batch per frame so a biome streaming in never builds hundreds in one task.
 */
function BiomeColliders({ layout }: { layout: BiomeLayout }) {
  const boxes = useMemo(() => biomeColliderBoxes(layout), [layout]);
  const count = useStaggered(boxes.length, COLLIDERS_PER_FRAME);
  if (boxes.length === 0) return null;
  return (
    <RigidBody
      type="fixed"
      colliders={false}
      name={`colliders-${layout.biome}`}
    >
      {boxes.slice(0, count).map((b, i) => (
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
