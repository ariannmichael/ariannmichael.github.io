"use client";

// Development only: loaded lazily by Experience when NODE_ENV === "development", so leva never ships.
import { Leva, useControls } from "leva";
import { useEffect } from "react";
import { useDebugStore } from "./debugStore";

export default function DebugControls() {
  const { physicsDebug } = useControls("World", { physicsDebug: false });
  useEffect(() => {
    useDebugStore.getState().setPhysics(physicsDebug);
  }, [physicsDebug]);
  return <Leva collapsed />;
}
