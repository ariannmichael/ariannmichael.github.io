"use client";

import dynamic from "next/dynamic";

// Code-split and client-only: the HUD reads vehicleState (three.js vectors), and Overlay's chunk is on
// the critical path of the server-rendered page, so three must not be pulled into it from here.
const JuiceLayer = dynamic(() => import("./juice/JuiceLayer"), { ssr: false });

/**
 * HUD juice: speedometer, trick popups and the district-discovered stamp. Rendered by Overlay while
 * the 3D world runs; everything per-frame writes to the DOM directly (no React render per frame).
 */
export default function JuiceHud() {
  return <JuiceLayer />;
}
