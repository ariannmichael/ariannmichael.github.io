"use client";

import { KeyboardControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { WebGLRenderer } from "three";
import type { BiomeId } from "./planet/types";
import type { DistrictId } from "@/content/types";
import { useAppStore } from "@/state/useAppStore";
import { FollowCamera } from "./camera/FollowCamera";
import { TeleportFade } from "./camera/TeleportFade";
import { KEYMAP } from "./controls";
import { WheelDust } from "./fx/WheelDust";
import { useDebugStore } from "./debug/debugStore";
import { PLANET_LAYOUTS } from "./layout/planet";
import { byDistance, districtOfBiome, layoutCap, spawnForDistrict } from "./lib/biomeMap";
import { latLonToDir } from "./planet/frame";
import { useAfterFirstPaint } from "./lib/idle";
import { PlanetGravity } from "./planet/PlanetGravity";
import { PlanetGround } from "./planet/PlanetGround";
import { PsxPipeline } from "@/world/psx";
import { Lighting } from "./scene/Lighting";
import { Sky } from "./scene/Sky";
import { loadSpawnLayout, preloadInBackground } from "./town/assets";
import { useSpawnLoad } from "./town/loadStatus";
import { PlanetTown } from "./town/Town";
import { Vehicle } from "./vehicle/Vehicle";
import { CameraCollisionBridge } from "./camera/CameraCollisionBridge";
import { DistrictTracker } from "./zones/DistrictTracker";
import { useInteraction } from "./zones/useInteraction";

const LAYOUTS = PLANET_LAYOUTS;

/** GPS teleports land on the spawn of the district's biome (biome centre when not authored yet) */
const spawnFor = (d: DistrictId) => spawnForDistrict(LAYOUTS, d);

const DebugControls =
  process.env.NODE_ENV === "development"
    ? lazy(() => import("./debug/DebugControls"))
    : null;

/** Background preloading of far biomes starts this long after the spawn biome is ready */
const BACKGROUND_DELAY_MS = 3000;
/** Background preloading starts this long after mount even if the spawn biome never reports ready */
const BACKGROUND_FALLBACK_MS = 20000;

/** Fixed physics rate; Physics runs before our useFrame callbacks (negative priority keeps auto-render) */
const PHYSICS_PRIORITY = -50;

export default function Experience({ district }: { district: DistrictId }) {
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const paused = useAppStore((s) => s.mode === "card" || s.gpsOpen);
  const physicsDebug = useDebugStore((s) => s.physics);
  const psx = useAppStore((s) => s.psx);
  const high = quality === "high";
  const [biome, setBiome] = useState<BiomeId>();
  // The planet trimesh build (~100 ms) and the car wait for the first paint, behind the loader
  const worldReady = useAfterFirstPaint();
  const spawn = useMemo(() => spawnForDistrict(LAYOUTS, district), [district]);
  const [debugStats] = useState(
    () => new URLSearchParams(window.location.search).has("debug"),
  );

  useInteraction(LAYOUTS);

  // The spawn biome downloads first at top priority (its progress drives the HTML loader). Once it is
  // on screen the rest of the planet queues up as background work, nearest first; biomes that stream
  // in near the car promote their own files (see town/Town).
  useEffect(() => {
    const first =
      LAYOUTS.find((l) => districtOfBiome(l.biome) === district) ?? LAYOUTS[0];
    if (!first) return;
    void loadSpawnLayout(first);
    const rest = () => {
      const dir = latLonToDir(spawn.lat, spawn.lon);
      const caps = LAYOUTS.map((l, id) => ({ id, cap: layoutCap(l) }));
      preloadInBackground(
        byDistance(caps, dir)
          .map((i) => LAYOUTS[i])
          .filter((l) => l !== first),
      );
    };
    let queued = false;
    const once = () => {
      if (queued) return;
      queued = true;
      rest();
    };
    // A short breather after the spawn biome appears: the first seconds of play (and the neighbours
    // streaming in around the car) get the network and main thread to themselves
    let delay = 0;
    const unsubscribe = useSpawnLoad.subscribe((s) => {
      if (s.ready && !delay) delay = window.setTimeout(once, BACKGROUND_DELAY_MS);
    });
    // Never strand the rest of the planet if the spawn biome somehow never reports ready
    const fallback = window.setTimeout(once, BACKGROUND_FALLBACK_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(delay);
      window.clearTimeout(fallback);
    };
  }, [district, spawn]);

  return (
    <>
      {DebugControls && (
        <Suspense fallback={null}>
          <DebugControls />
        </Suspense>
      )}
      <KeyboardControls map={KEYMAP}>
        <Canvas
          // PSX renders into a low-res target anyway, and swaps shadow maps for a blob shadow
          shadows={high && !psx ? "percentage" : false}
          dpr={psx ? 1 : high ? [1, 2] : 1}
          flat
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 55, near: 0.1, far: 1000, position: [0, 200, 200] }}
          data-district={district}
          // The Canvas wrapper is a <div>: aria-label is only allowed on it with a role
          role="img"
          aria-label="3D planet: drive with WASD or the arrow keys"
        >
          {debugStats && <RenderStats />}
          <PerformanceMonitor
            onDecline={() => setQuality("low")}
            flipflops={3}
          />
          {/* Tint follows the biome under the car (auto-tracks the camera until the car reports one) */}
          <Sky biome={biome} />
          <Lighting />

          <Suspense fallback={null}>
            {worldReady && (
              <Physics
                colliders={false}
                gravity={[0, 0, 0]}
                paused={paused}
                debug={physicsDebug}
                timeStep={1 / 60}
                updatePriority={PHYSICS_PRIORITY}
              >
                <PlanetGravity />
                <PlanetGround />
                <PlanetTown layouts={LAYOUTS} spawn={spawn} />
                <Vehicle spawn={spawn} spawnFor={spawnFor} />
                {/* Gives the follow camera (outside Physics) the Rapier world for wall/roof collision */}
                <CameraCollisionBridge />
              </Physics>
            )}
            {worldReady && <DistrictTracker onBiome={setBiome} />}
            {worldReady && <WheelDust />}
          </Suspense>

          <FollowCamera />
          <TeleportFade />
          {/* Reads the store's psx flag: low-res target + dither when on, normal render when off */}
          <PsxPipeline />
        </Canvas>
      </KeyboardControls>
    </>
  );
}

/** Per-frame totals of the last finished frame (all render passes summed). Only under `?debug`. */
interface FrameStats {
  calls: number;
  triangles: number;
  programs: number;
  /** Shader programs by name (material name or type), to spot needless variants */
  programNames: string[];
  geometries: number;
  textures: number;
}

declare global {
  interface Window {
    __renderInfo?: () => FrameStats;
  }
}

/**
 * `?debug` only: sums renderer.info over every pass of a frame (PSX renders the scene, the blit and
 * the labels separately, and autoReset would keep just the last one) and exposes it as
 * `window.__renderInfo()` for the perf harness.
 */
function RenderStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => startStats(gl), [gl]);
  // Runs before every render pass of the frame: snapshot the previous frame, then start counting anew
  useFrame(() => sampleStats(gl), STATS_PRIORITY);
  return null;
}

function startStats(gl: WebGLRenderer): () => void {
  gl.info.autoReset = false;
  window.__renderInfo = () => ({ ...last });
  return () => {
    gl.info.autoReset = true;
    delete window.__renderInfo;
  };
}

function sampleStats(gl: WebGLRenderer): void {
  last.calls = gl.info.render.calls;
  last.triangles = gl.info.render.triangles;
  last.programs = gl.info.programs?.length ?? 0;
  last.programNames = (gl.info.programs ?? []).map((p) => p.name);
  last.geometries = gl.info.memory.geometries;
  last.textures = gl.info.memory.textures;
  gl.info.reset();
}

const last: FrameStats = {
  calls: 0,
  triangles: 0,
  programs: 0,
  programNames: [],
  geometries: 0,
  textures: 0,
};

/** Before physics (-50) and everything else, so a frame's passes all land between two resets */
const STATS_PRIORITY = -1000;
