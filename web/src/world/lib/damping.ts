// Frame-rate independent smoothing. `lambda` is a rate in 1/s: higher = snappier.
// lerp(a, b, 1 - exp(-lambda * dt)) converges identically at 30, 60 or 144 fps.

export function dampFactor(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * dampFactor(lambda, dt);
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = a % twoPi;
  if (r <= -Math.PI) r += twoPi;
  else if (r > Math.PI) r -= twoPi;
  return r;
}

/** Damp an angle along the shortest arc. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + wrapAngle(target - current) * dampFactor(lambda, dt);
}

/** Move `current` towards `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Smoothstep ease, 0..1 -> 0..1 */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * One semi-implicit Euler step of a damped spring pulling `x` towards `target`.
 * Returns [x, v]; used for the suspension bounce.
 */
export function springStep(
  x: number,
  v: number,
  target: number,
  stiffness: number,
  dampingRatio: number,
  dt: number,
): [number, number] {
  const c = 2 * Math.sqrt(stiffness) * dampingRatio;
  const a = -stiffness * (x - target) - c * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}
