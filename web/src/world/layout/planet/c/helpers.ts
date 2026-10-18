// Small authoring helpers shared by the gamedev and badlands layouts (biome agent C). Pure maths only.

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

// author.ts `grid` imports only planet/sphere.ts now, so it is cycle-safe at module top level.
// localGrid is kept as an alias so gamedev/badlands stay unchanged.
export { grid as localGrid } from "../author";
