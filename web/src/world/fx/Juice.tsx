"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAppStore } from "@/state/useAppStore";
import { createBackfireState, stepBackfire } from "@/world/audio/backfire";
import { addFovPunch, crashFovPunch, landingFovPunch } from "@/world/camera/shake";
import { onGameEvent } from "@/world/events/gameEvents";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { FxSystem } from "./fxSystem";
import { bumpBurstStrength } from "./juiceRules";
import { SkidTrails } from "./skidMarks";

/**
 * World-space game juice, mounted once inside the <Canvas> (outside <Physics>: purely visual). Two
 * draw calls: the skid-mark ribbons and one instanced particle mesh (impact sparks and prop chips,
 * landing dust rings, exhaust puffs, backfire flames, speed lines, card-open confetti). Also turns
 * landings and crashes into a camera FOV punch. Car lamps and body lean live in VehicleModel.
 *
 * Reduced motion: no speed lines, no FOV punch, no confetti, and backfires puff without flames.
 */
export function Juice() {
  const [fx] = useState(() => new FxSystem());
  const [skids] = useState(() => new SkidTrails());
  const [backfire] = useState(createBackfireState);
  const quality = useAppStore((s) => s.quality);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(
    () => () => {
      fx.dispose();
      skids.dispose();
    },
    [fx, skids],
  );

  useEffect(() => {
    fx.setQuality(quality);
    skids.setQuality(quality);
  }, [fx, skids, quality]);

  // One-shot moments from the car
  useEffect(
    () =>
      onGameEvent((e) => {
        const now = performance.now() / 1000;
        const v = vehicleState;
        switch (e.type) {
          case "crash":
            fx.impact(v, e.strength, false, now);
            if (!reducedRef.current) addFovPunch(crashFovPunch(e.strength));
            break;
          case "bump": {
            const s = bumpBurstStrength(e.strength, e.dynamic);
            if (s > 0) fx.impact(v, s, e.dynamic, now);
            break;
          }
          case "landing":
            fx.landing(v, e.strength);
            if (!reducedRef.current) addFovPunch(landingFovPunch(e.strength));
            break;
          case "reset":
          case "teleport":
            skids.breakAll();
            break;
        }
      }),
    [fx, skids],
  );

  // Card opened: confetti over the car (it is parked on the marker)
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.openCardId && s.openCardId !== prev.openCardId && !reducedRef.current) fx.confetti(vehicleState);
      }),
    [fx],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { mode, gpsOpen } = useAppStore.getState();
    const paused = mode === "card" || gpsOpen;
    const v = vehicleState;

    // Same detector and inputs as the audio pops (world/audio/backfire), so flames and bangs line up
    const pop = stepBackfire(backfire, v.throttle, v.speed, dt);
    if (pop > 0 && !paused && v.bodyHandle >= 0) fx.backfire(v, !reducedRef.current);

    fx.frame(dt, v, state.camera, paused, !reducedRef.current && mode === "drive");
    skids.frame(v, state.clock.elapsedTime, paused);
  });

  return (
    <>
      {/* Ground decals first, then the particles over them (both transparent, no depth write) */}
      <mesh geometry={skids.geometry} material={skids.material} frustumCulled={false} renderOrder={2} />
      <mesh geometry={fx.geometry} material={fx.material} frustumCulled={false} renderOrder={11} />
    </>
  );
}
