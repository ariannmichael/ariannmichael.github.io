// Pure joystick math so the touch control can be unit tested without pointer events.

export interface JoystickResult {
  /** -1..1, right is positive */
  steer: number;
  /** -1..1, forward (finger pushed up) is positive */
  throttle: number;
  /** Knob offset in px, clamped to the base radius (for rendering) */
  knobX: number;
  knobY: number;
}

/**
 * Converts a finger offset from the joystick centre (screen px, +y is down) into axes.
 * The offset is clamped to `radius`. A radial deadzone (fraction of the radius) removes jitter
 * near the centre, and the remaining range is rescaled so output still reaches ±1.
 */
export function joystickAxes(dx: number, dy: number, radius: number, deadzone = 0.15): JoystickResult {
  const dist = Math.hypot(dx, dy);
  if (radius <= 0 || dist === 0) return { steer: 0, throttle: 0, knobX: 0, knobY: 0 };

  const clamped = Math.min(dist, radius);
  const ux = dx / dist;
  const uy = dy / dist;
  const knobX = ux * clamped;
  const knobY = uy * clamped;

  const magnitude = clamped / radius;
  const dz = Math.min(Math.max(deadzone, 0), 0.99);
  if (magnitude <= dz) return { steer: 0, throttle: 0, knobX, knobY };

  const scaled = (magnitude - dz) / (1 - dz);
  return {
    steer: clampUnit(round(ux * scaled)),
    // Screen up is negative y, but forward throttle is positive.
    throttle: clampUnit(round(-uy * scaled)),
    knobX,
    knobY,
  };
}

function clampUnit(v: number): number {
  // Also normalises -0 to 0 so comparisons and snapshots stay clean.
  return Math.max(-1, Math.min(1, v)) || 0;
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
