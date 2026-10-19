// Planet constants (coordinator-owned contract). Planet centre is the world origin.

/** Mean surface radius in metres (sea level of the terrain function). One lap is ~2πR ≈ 565 m: small on purpose, so it reads as a tiny globe. */
export const PLANET_RADIUS = 90;

/** Gravity toward the centre, m/s². A bit above Earth's for snappy arcade landings. */
export const PLANET_GRAVITY = 18;
