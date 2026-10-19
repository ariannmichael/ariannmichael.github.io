// Fog range for the small planet, plus the horizon maths it is derived from.
import { PLANET_RADIUS } from "@/world/planet/config";

/** Distance (m) to the horizon of a smooth sphere of PLANET_RADIUS, seen from `height` m above it. */
export function horizonDistance(height: number): number {
  const h = Math.max(0, height);
  return Math.sqrt(h * (2 * PLANET_RADIUS + h));
}

/**
 * The ground horizon seen from the follow camera (≈ 4.5 m up): ≈ 29 m on the 90 m planet. Fog is
 * set in multiples of it, so it scales with √R like the view does, and starts past the horizon: the
 * ground curving away against the sky stays crisp, only what pokes up beyond it is hazed.
 */
const FOLLOW_HORIZON = horizonDistance(4.5);

/** Linear fog range (metres, at ground level). */
export const FOG_RANGE = { near: 2.4 * FOLLOW_HORIZON, far: 8.6 * FOLLOW_HORIZON };

/** Below this camera height (m above PLANET_RADIUS) the fog range is used as is. */
const FOG_LIFT_FROM = 20;

/**
 * Metres to push the fog range out for a camera `cameraRadius` m from the planet centre: how much
 * further its horizon is than from FOG_LIFT_FROM. Zero while driving; in the intro's globe view it
 * moves the fog out to about the planet's limb, so the whole curve reads (with a little haze at the
 * rim), and the fog closes back in as the camera swoops down.
 */
export function fogLift(cameraRadius: number): number {
  return Math.max(0, horizonDistance(cameraRadius - PLANET_RADIUS) - horizonDistance(FOG_LIFT_FROM));
}
