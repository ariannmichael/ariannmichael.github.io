// Footprints the road network keeps clear of: every placement that stands up off the ground, and
// every parking ring. Pure maths over the layouts (no terrain), shared by the router and the signs.

import { getModel } from "@/world/models";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { PLANET_RADIUS } from "./config";
import { headingAt, latLonToDir, surfaceFrame } from "./sphere";

const R = PLANET_RADIUS;

export interface Obstacle {
  x: number;
  y: number;
  z: number;
  /** footprint radius, metres */
  r: number;
}

/** Pads raised or lowered at least this much are kept clear of (flat plazas are driven across), metres */
const STEP_PAD = 1.5;
const STEP_PAD_MAX_RADIUS = 12;
/** Placements lower than this (road tiles, plaza floors, ramps) are driven over, not around, metres */
const FLAT_PIECE = 0.6;

/**
 * Footprint circles of every placement (bbox centred, kit scale + placement scale) and marker ring.
 * Flat pieces and dynamic props (cans, cones: the car just knocks them over) are not obstacles; small
 * pads that raise or sink the ground (jumps) are.
 */
export function layoutObstacles(): Obstacle[] {
  const out: Obstacle[] = [];
  for (const l of PLANET_LAYOUTS) {
    for (const p of l.placements) {
      const { min, max } = getModel(p.model);
      const s = p.scale ?? 1;
      if (p.body === "dynamic" || (max[1] - min[1]) * s < FLAT_PIECE) continue;
      const cx = ((min[0] + max[0]) / 2) * s;
      const cz = ((min[2] + max[2]) / 2) * s;
      const up = latLonToDir(p.lat, p.lon);
      const fwd = headingAt(surfaceFrame(up), p.yaw ?? 0);
      const right = up.clone().cross(fwd); // model +X (surfacePose basis)
      const c = up.clone().addScaledVector(fwd, cz / R).addScaledVector(right, cx / R).normalize();
      out.push({ x: c.x, y: c.y, z: c.z, r: (Math.hypot(max[0] - min[0], max[2] - min[2]) / 2) * s });
    }
    // Small raised or sunken pads (mounds, kickers, ramp steps) out to the middle of their blend
    // ring: a road along their flank would tilt sideways. Big ones (plateaus, cut plazas) are driven onto.
    for (const p of l.pads) {
      if (Math.abs(p.height ?? 0) < STEP_PAD || p.radius >= STEP_PAD_MAX_RADIUS) continue;
      const d = latLonToDir(p.lat, p.lon);
      out.push({ x: d.x, y: d.y, z: d.z, r: p.radius + (p.blend ?? 8) / 2 });
    }
    for (const m of l.markers) {
      const d = latLonToDir(m.lat, m.lon);
      out.push({ x: d.x, y: d.y, z: d.z, r: 4 });
    }
  }
  return out;
}

