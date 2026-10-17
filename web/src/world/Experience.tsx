"use client";

import { KeyboardControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, lazy } from "react";
import type { DistrictId } from "@/content/types";
import { useAppStore } from "@/state/useAppStore";
import { FollowCamera } from "./camera/FollowCamera";
import { TeleportFade } from "./camera/TeleportFade";
import { KEYMAP } from "./controls";
import { useDebugStore } from "./debug/debugStore";
import { DISTRICT_LAYOUTS } from "./layout/districts";
import { lookupModel } from "./lib/models";
import { Lighting, SKY_HORIZON } from "./scene/Lighting";
import { Sky } from "./scene/Sky";
import { Ground } from "./town/Ground";
import { Town, preloadTown } from "./town/Town";
import { SEDAN_REF } from "./vehicle/constants";
import { Vehicle } from "./vehicle/Vehicle";
import { DistrictTracker } from "./zones/DistrictTracker";
import { useInteraction } from "./zones/useInteraction";
import { Zones } from "./zones/Zones";

// This module only loads in the browser (WorldLoader uses ssr:false), so kick off every download now,
// in parallel, before React starts suspending on them one at a time.
preloadTown(DISTRICT_LAYOUTS, lookupModel(SEDAN_REF) ? [SEDAN_REF] : []);

const DebugControls =
  process.env.NODE_ENV === "development" ? lazy(() => import("./debug/DebugControls")) : null;

/** Fixed physics rate; Physics runs before our useFrame callbacks (negative priority keeps auto-render) */
const PHYSICS_PRIORITY = -50;

export default function Experience({ district }: { district: DistrictId }) {
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const paused = useAppStore((s) => s.mode === "card" || s.gpsOpen);
  const physicsDebug = useDebugStore((s) => s.physics);
  const high = quality === "high";

  useInteraction(DISTRICT_LAYOUTS);

  return (
    <>
      {DebugControls && (
        <Suspense fallback={null}>
          <DebugControls />
        </Suspense>
      )}
      <KeyboardControls map={KEYMAP}>
        <Canvas
          // "percentage" = PCF shadows; three r186 removed PCFSoftShadowMap (what `shadows` alone asks for)
          shadows={high ? "percentage" : false}
          dpr={high ? [1, 2] : 1}
          // Kenney palettes are authored as flat colours: no tone mapping keeps them true
          flat
          gl={{ antialias: true, powerPreference: "high-performance" }}
          camera={{ fov: 55, near: 0.1, far: 1000, position: [0, 30, -40] }}
          data-district={district}
          aria-label="3D town: drive with WASD or the arrow keys"
        >
          <PerformanceMonitor onDecline={() => setQuality("low")} flipflops={3} />
          <fog attach="fog" args={[SKY_HORIZON, 90, 320]} />
          <Sky />
          <Lighting shadows={high} />

          <Suspense fallback={null}>
            <Physics
              colliders={false}
              paused={paused}
              debug={physicsDebug}
              timeStep={1 / 60}
              updatePriority={PHYSICS_PRIORITY}
            >
              <Ground layouts={DISTRICT_LAYOUTS} />
              <Town layouts={DISTRICT_LAYOUTS} />
              <Zones layouts={DISTRICT_LAYOUTS} />
              <Vehicle initialDistrict={district} layouts={DISTRICT_LAYOUTS} />
            </Physics>
            <DistrictTracker layouts={DISTRICT_LAYOUTS} />
          </Suspense>

          <FollowCamera />
          <TeleportFade />
        </Canvas>
      </KeyboardControls>
    </>
  );
}
