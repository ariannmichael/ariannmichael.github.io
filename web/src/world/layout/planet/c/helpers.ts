// Small authoring helpers shared by the gamedev and badlands layouts (biome agent C). Pure maths only.
import type { LatLon, PlanetMarker, PlanetPlacement } from "@/world/planet/types";

/** Placement yaw that turns a model's +Z toward the (north, east) direction (yaw 0 = north, 90 = west). */
export function yawToward(north: number, east: number): number {
  return (Math.atan2(-east, north) * 180) / Math.PI;
}

/**
 * A straight path from `a` to `b` in local metres. `at(t, side)` walks a fraction `t` along it and
 * `side` metres to its right (negative = left), so props can line both sides of a trail.
 */
export function path(a: [number, number], b: [number, number]) {
  const dn = b[0] - a[0];
  const de = b[1] - a[1];
  const len = Math.hypot(dn, de);
  const fn = dn / len;
  const fe = de / len;
  // Right of heading (fn, fe) on a north/east map is (−fe, fn) rotated: heading north → right = east.
  const rn = -fe;
  const re = fn;
  return {
    /** Yaw of the walking direction */
    yaw: yawToward(dn, de),
    at(t: number, side = 0): [number, number] {
      return [a[0] + dn * t + rn * side, a[1] + de * t + re * side];
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Cycle-safe local grid. author.ts `grid` calls frame.ts, and frame.ts imports terrain.ts, which
// imports every layout: when frame.ts is the first module loaded, a layout calling into it at top
// level hits frame's constants before they exist (TDZ). This is the same maths (frame.ts
// latLonToDir / surfaceFrame / headingAt / offsetLatLon, R = 150) with only type imports.

const RAD = Math.PI / 180;
const R = 150; // PLANET_RADIUS (planet/config.ts); duplicated to keep this module import-free
type V = [number, number, number];

function dirOf(p: LatLon): V {
  const la = p.lat * RAD;
  const lo = p.lon * RAD;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

function walk(from: LatLon, metres: number, yawDeg: number): LatLon {
  const u = dirOf(from);
  // east = Y × up (fallback at the poles), north = up × east (as surfaceFrame)
  let east: V = [u[2], 0, -u[0]];
  let l = Math.hypot(...east);
  if (l < 1e-4) {
    east = [0, -u[2], u[1]]; // −(up × X)
    l = Math.hypot(...east);
  }
  east = [east[0] / l, east[1] / l, east[2] / l];
  const north: V = [
    u[1] * east[2] - u[2] * east[1],
    u[2] * east[0] - u[0] * east[2],
    u[0] * east[1] - u[1] * east[0],
  ];
  const y = yawDeg * RAD;
  const h: V = [0, 1, 2].map((i) => north[i] * Math.cos(y) - east[i] * Math.sin(y)) as V;
  const hl = Math.hypot(...h);
  const a = metres / R;
  const q: V = [0, 1, 2].map((i) => u[i] * Math.cos(a) + (h[i] / hl) * Math.sin(a)) as V;
  const ql = Math.hypot(...q);
  return { lat: Math.asin(Math.max(-1, Math.min(1, q[1] / ql))) / RAD, lon: Math.atan2(q[0], q[2]) / RAD };
}

/** Same contract as author.ts `grid`, but safe to call at module top level in a layout. */
export function localGrid(center: LatLon) {
  const at = (north: number, east: number): LatLon => walk(walk(center, north, 0), east, -90);
  const place = (north: number, east: number, rest: Omit<PlanetPlacement, "lat" | "lon">): PlanetPlacement => ({
    ...at(north, east),
    ...rest,
  });
  const marker = (north: number, east: number, rest: Omit<PlanetMarker, "lat" | "lon">): PlanetMarker => ({
    ...at(north, east),
    ...rest,
  });
  return { at, place, marker };
}
