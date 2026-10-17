// Typed access to the generated Kenney model manifest (see scripts/prepare-models.mjs).
//
// Rendering notes for consumers:
// - Every .glb is in RAW Kenney units: scale the instance by `getKit(kit).scale`. The bounds
//   returned here are already in metres (kit scale applied).
// - Files use EXT_meshopt_compression: load them with drei's useGLTF (meshopt decoder on by default).
// - Textured kits: the per-model .glb has no texture. Give every material of that kit
//   `map = colormap.webp` (KitInfo.texture, flipY = false, sRGB colour space).
import type { Rot } from "@/world/layout/types";
import { KITS, MODELS } from "./manifest.generated";
import type { KitInfo, ModelInfo } from "./types";

export type { KitInfo, ModelInfo } from "./types";
export { KITS, MODELS };

export function hasModel(ref: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODELS, ref);
}

export function getModel(ref: string): ModelInfo {
  if (!hasModel(ref)) {
    throw new Error(`Unknown model "${ref}". Expected "<kit>/<model>" from web/src/world/models/manifest.generated.ts (run \`npm run models\`).`);
  }
  return MODELS[ref];
}

export function getKit(id: string): KitInfo {
  if (!Object.prototype.hasOwnProperty.call(KITS, id)) {
    throw new Error(`Unknown kit "${id}". Known kits: ${Object.keys(KITS).join(", ")}`);
  }
  return KITS[id];
}

/** All models of one kit, sorted by ref. */
export function listModels(kit: string): ModelInfo[] {
  getKit(kit); // throw on typos instead of silently returning []
  return Object.values(MODELS)
    .filter((m) => m.kit === kit)
    .sort((a, b) => a.ref.localeCompare(b.ref));
}

/**
 * Model bounds in metres after `rot` quarter turns around +Y (counter-clockwise seen from above,
 * i.e. three.js rotation.y = rot * PI / 2). Useful for colliders of models whose origin is not centred.
 */
export function rotatedBounds(ref: string, rot: Rot = 0): { min: [number, number, number]; max: [number, number, number] } {
  const { min, max } = getModel(ref);
  let [x0, x1, z0, z1] = [min[0], max[0], min[2], max[2]];
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
    // +90 deg around Y maps (x, z) -> (z, -x).
    [x0, x1, z0, z1] = [z0, z1, -x1, -x0];
  }
  return { min: [x0, min[1], z0], max: [x1, max[1], z1] };
}

/** Rotated XZ size of a model in metres: x = width along world X, z = depth along world Z. */
export function footprint(ref: string, rot: Rot = 0): { x: number; z: number } {
  const { min, max } = rotatedBounds(ref, rot);
  return { x: max[0] - min[0], z: max[2] - min[2] };
}
