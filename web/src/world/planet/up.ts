// Local "up" (the opposite of gravity) anywhere on the planet: radial, except over planar pads, where
// it turns to the pad's normal (fully inside, easing back across the blend ring). On a 90 m planet a
// flat hall floor 15 m from its tangent point is tilted ~10° from radial; with gravity along the
// pad normal the floor feels level and parked cars don't roll toward the middle.

import type { Vec3Like } from "./gravity";
import { getDefaultPads, type PreparedPad } from "./terrain";
import { PLANET_RADIUS } from "./config";

const R = PLANET_RADIUS;

let planar: PreparedPad[] | null = null;
function planarPads(): PreparedPad[] {
  if (!planar) planar = getDefaultPads().filter((p) => p.planar);
  return planar;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Unit up at world position (x, y, z), written into `out`. `pads` defaults to the layouts' planar
 * pads (inject for tests; non-planar entries are ignored).
 */
export function groundUpXYZ<T extends Vec3Like>(
  x: number,
  y: number,
  z: number,
  out: T,
  pads: readonly PreparedPad[] = planarPads(),
): T {
  const l = Math.hypot(x, y, z);
  if (l < 1e-9) {
    out.x = 0;
    out.y = 1;
    out.z = 0;
    return out;
  }
  let ux = x / l, uy = y / l, uz = z / l;
  let best = 0;
  let bx = 0, by = 0, bz = 0;
  for (let k = 0; k < pads.length; k++) {
    const p = pads[k];
    if (!p.planar) continue;
    const c = ux * p.x + uy * p.y + uz * p.z;
    if (c < p.cosOuter) continue;
    const w = 1 - smoothstep(p.radius, p.radius + p.blend, Math.acos(c > 1 ? 1 : c) * R);
    if (w > best) {
      best = w;
      bx = p.x;
      by = p.y;
      bz = p.z;
    }
  }
  if (best > 0) {
    ux += (bx - ux) * best;
    uy += (by - uy) * best;
    uz += (bz - uz) * best;
    const m = Math.hypot(ux, uy, uz);
    ux /= m;
    uy /= m;
    uz /= m;
  }
  out.x = ux;
  out.y = uy;
  out.z = uz;
  return out;
}
