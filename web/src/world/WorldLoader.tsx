"use client";

import dynamic from "next/dynamic";
import type { DistrictId } from "@/content/types";

// three.js, WebGL and Rapier's WASM only exist in the browser: never render the canvas on the server.
const Experience = dynamic(() => import("./Experience"), { ssr: false });

export default function WorldLoader({ district }: { district: DistrictId }) {
  return <Experience district={district} />;
}
