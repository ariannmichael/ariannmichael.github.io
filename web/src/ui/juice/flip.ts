// Air-trick detection: accumulates how far the chassis rotates about its own axes while airborne.
// Pure (three.js maths only, no React/DOM) so it is unit-tested; TrickPopups feeds it vehicleState.
//
// The planet is tiny (~90 m radius), so during a long jump the local "up" itself turns by tens of
// degrees under a car that isn't spinning at all. Each step removes that frame transport (the
// rotation taking the previous up to the current up) so only real, ground-relative spin counts.
import { Quaternion, Vector3 } from "three";

const TAU = Math.PI * 2;

/**
 * Fraction of a full turn that counts as a completed rotation. Players rarely land exactly 360°
 * (you land a backflip at ~300° and the suspension does the rest), so be generous.
 */
export const TURN_COMPLETE = 0.8;

/** Signed rotation (radians) accumulated about the car's own axes since the jump began. */
export interface SpinTotals {
  /** About car X (left/right axis). Positive = nose down = front flip */
  pitch: number;
  /** About car Y (roof axis): flat spins */
  yaw: number;
  /** About car Z (nose axis): barrel rolls */
  roll: number;
}

export interface TrickCounts {
  /** Whole flips; sign = direction (+ front flip, − backflip) */
  flips: number;
  /** Whole barrel rolls (unsigned) */
  rolls: number;
  /** Whole flat spins (unsigned) */
  spins: number;
}

// Scratch objects: step() runs every frame while airborne, so it must not allocate.
const _dW = new Quaternion();
const _transport = new Quaternion();
const _inv = new Quaternion();
const _axis = new Vector3();

export interface FlipTracker {
  /** Start a new jump from this pose (clears the totals). */
  begin(q: Quaternion, up: Vector3): void;
  /** Feed the current chassis orientation and local planet up; accumulates the spin since the last call. */
  step(q: Quaternion, up: Vector3): void;
  readonly totals: Readonly<SpinTotals>;
  clear(): void;
}

export function createFlipTracker(): FlipTracker {
  const prevQ = new Quaternion();
  const prevUp = new Vector3(0, 1, 0);
  const totals: SpinTotals = { pitch: 0, yaw: 0, roll: 0 };
  let started = false;

  function begin(q: Quaternion, up: Vector3) {
    prevQ.copy(q);
    prevUp.copy(up);
    totals.pitch = totals.yaw = totals.roll = 0;
    started = true;
  }

  return {
    totals,
    begin,
    step(q, up) {
      if (!started) {
        begin(q, up);
        return;
      }
      // World-space rotation from the previous pose to this one…
      _dW.copy(q).multiply(_inv.copy(prevQ).invert());
      // …minus the tangent frame's own rotation from travelling around the planet.
      _transport.setFromUnitVectors(prevUp, up);
      _dW.premultiply(_transport.invert());
      // Shortest-arc axis-angle (exact, so a long frame after a hitch still adds up correctly).
      if (_dW.w < 0) _dW.set(-_dW.x, -_dW.y, -_dW.z, -_dW.w);
      _axis.set(_dW.x, _dW.y, _dW.z);
      const s = _axis.length();
      if (s > 1e-9) {
        const angle = 2 * Math.atan2(s, _dW.w);
        // Into the car's own frame, so "pitch" means flip whatever way the car is facing.
        _axis.multiplyScalar(angle / s).applyQuaternion(_inv.copy(prevQ).invert());
        totals.pitch += _axis.x;
        totals.yaw += _axis.y;
        totals.roll += _axis.z;
      }
      prevQ.copy(q);
      prevUp.copy(up);
    },
    clear() {
      totals.pitch = totals.yaw = totals.roll = 0;
      started = false;
    },
  };
}

/** Whole turns in an accumulated angle, counting a turn once it is TURN_COMPLETE of the way round. */
export function wholeTurns(angle: number): number {
  return Math.floor(Math.abs(angle) / TAU + (1 - TURN_COMPLETE));
}

export function countTricks(t: Readonly<SpinTotals>): TrickCounts {
  const flips = wholeTurns(t.pitch);
  return {
    flips: flips === 0 ? 0 : Math.sign(t.pitch) * flips,
    rolls: wholeTurns(t.roll),
    spins: wholeTurns(t.yaw),
  };
}
