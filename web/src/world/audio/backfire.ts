// Backfire detector (pure, deterministic, allocation-free). Shared contract between the audio (pops)
// and world juice (exhaust flames): both call `stepBackfire` once per rendered frame with the same
// vehicleState inputs and the frame's dt, so they fire on the same frames without talking to each other.
//
// Rule: lifting off the throttle (from ≥ `liftFrom` to ≤ `liftTo`) while the engine is high in the
// rev range (estimated from speed, see engineModel.estimateRpm) arms a short window in which 1–3 pops
// fire at irregular gaps. Re-applying the throttle disarms it; a cooldown keeps it occasional. The
// "randomness" (pop count, gaps, strength, whether a lift arms at all) comes from a hash of a counter,
// not Math.random, so every instance with the same inputs makes the same decisions.

import { ENGINE, estimateRpm } from "./engineModel";

export const BACKFIRE = {
  /** The throttle must have been at least this high before the lift… */
  liftFrom: 0.6,
  /** …and drop to at most this */
  liftTo: 0.15,
  /** Estimated rpm needed at the lift: the top of the rev range, just under the upshift point */
  minRpm: ENGINE.shiftUpRpm - 1200,
  /** And some real speed (m/s): no pops while crawling */
  minSpeed: 6,
  /** Chance (0..1) that a qualifying lift arms at all (keeps it occasional) */
  chance: 0.75,
  /** Pops allowed for this long after the lift (s) */
  window: 0.75,
  /** Delay before the first pop, and the gap range between pops (s) */
  firstDelay: [0.04, 0.14] as const,
  gap: [0.07, 0.2] as const,
  maxPops: 3,
  /** Seconds after a window closes before another lift can arm */
  cooldown: 1.4,
} as const;

export interface BackfireState {
  /** Throttle seen on the previous step */
  prevThrottle: number;
  /** Peak throttle over the last moments (a lift is judged from this, so a 1-frame dip still counts) */
  recentThrottle: number;
  /** Seconds left in the armed window (0 = disarmed) */
  window: number;
  /** Seconds until the next pop while armed */
  nextPop: number;
  popsLeft: number;
  cooldown: number;
  /** Hash counter: advances on every decision */
  seq: number;
  /** Total pops so far (consumers can watch this edge instead of the return value) */
  pops: number;
}

export function createBackfireState(): BackfireState {
  return { prevThrottle: 0, recentThrottle: 0, window: 0, nextPop: 0, popsLeft: 0, cooldown: 0, seq: 0, pops: 0 };
}

/** Deterministic 0..1 hash of an integer (same value on every consumer) */
export function backfireHash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Advance the detector by dt. Returns the strength (0.5..1) of a pop fired on this step, or 0.
 * Call once per frame with vehicleState.throttle, vehicleState.speed.
 */
export function stepBackfire(s: BackfireState, throttle: number, speed: number, dt: number): number {
  if (dt <= 0) return 0;
  // Decaying peak of the throttle, so a lift is "from" what the driver was really holding
  s.recentThrottle = Math.max(throttle, s.recentThrottle - dt * 2.5);
  s.cooldown = Math.max(0, s.cooldown - dt);
  let fired = 0;

  if (s.window > 0) {
    if (throttle > BACKFIRE.liftTo) {
      // Back on the gas: the overrun is over
      s.window = 0;
      s.popsLeft = 0;
      s.cooldown = BACKFIRE.cooldown * 0.5;
    } else {
      s.window -= dt;
      s.nextPop -= dt;
      if (s.nextPop <= 0 && s.popsLeft > 0) {
        s.seq += 1;
        fired = 0.5 + 0.5 * backfireHash(s.seq);
        s.pops += 1;
        s.popsLeft -= 1;
        s.seq += 1;
        s.nextPop = lerp(BACKFIRE.gap[0], BACKFIRE.gap[1], backfireHash(s.seq));
      }
      if (s.window <= 0 || s.popsLeft === 0) {
        s.window = 0;
        s.popsLeft = 0;
        s.cooldown = BACKFIRE.cooldown;
      }
    }
  } else if (
    s.cooldown === 0 &&
    s.recentThrottle >= BACKFIRE.liftFrom &&
    throttle <= BACKFIRE.liftTo &&
    s.prevThrottle > BACKFIRE.liftTo &&
    speed >= BACKFIRE.minSpeed &&
    estimateRpm(speed) >= BACKFIRE.minRpm
  ) {
    s.seq += 1;
    if (backfireHash(s.seq) < BACKFIRE.chance) {
      s.window = BACKFIRE.window;
      s.seq += 1;
      s.popsLeft = 1 + Math.floor(backfireHash(s.seq) * BACKFIRE.maxPops * 0.999);
      s.seq += 1;
      s.nextPop = lerp(BACKFIRE.firstDelay[0], BACKFIRE.firstDelay[1], backfireHash(s.seq));
    } else {
      s.cooldown = BACKFIRE.cooldown * 0.5;
    }
  }

  s.prevThrottle = throttle;
  return fired;
}
