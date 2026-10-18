"use client";

import { KeyboardControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { BiomeId } from "./planet/types";
import type { DistrictId } from "@/content/types";
import { useAppStore } from "@/state/useAppStore";
import { FollowCamera } from "./camera/FollowCamera";
import { TeleportFade } from "./camera/TeleportFade";
import { KEYMAP } from "./controls";
import { WheelDust } from "./fx/WheelDust";
import { useDebugStore } from "./debug/debugStore";
import { PLANET_LAYOUTS } from "./layout/planet";
import { districtOfBiome, spawnForDistrict } from "./lib/biomeMap";
import { useAfterFirstPaint } from "./lib/idle";
import { PlanetGravity } from "./planet/PlanetGravity";
import { PlanetGround } from "./planet/PlanetGround";
import { PsxPipeline } from "@/world/psx";
import { Lighting } from "./scene/Lighting";
import { Sky } from "./scene/Sky";
import { PlanetTown, preloadInIdle, preloadLayout } from "./town/Town";
import { Vehicle } from "./vehicle/Vehicle";
import { DistrictTracker } from "./zones/DistrictTracker";
import { useInteraction } from "./zones/useInteraction";

const LAYOUTS = PLANET_LAYOUTS;

/** GPS teleports land on the spawn of the district's biome (biome centre when not authored yet) */
const spawnFor = (d: DistrictId) => spawnForDistrict(LAYOUTS, d);

const DebugControls =
  process.env.NODE_ENV === "development"
    ? lazy(() => import("./debug/DebugControls"))
    : null;

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

  useInteraction(LAYOUTS);

  // The spawn biome's models download now; everything else trickles in during idle time
  useEffect(() => {
    const first =
      LAYOUTS.find((l) => districtOfBiome(l.biome) === district) ?? LAYOUTS[0];
    if (first) preloadLayout(first);
    return preloadInIdle(LAYOUTS.filter((l) => l !== first));
  }, [district]);

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
