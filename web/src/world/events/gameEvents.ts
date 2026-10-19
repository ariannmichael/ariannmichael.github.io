// Game events (coordinator-owned contract): one-shot moments that sound, particles, camera and HUD
// juice react to. Continuous state (speed, throttle, slip, air time…) stays in vehicleState and is
// polled per frame; these are only the edges. Emitters never allocate per event beyond the payload.
//
// Emitted by: vehicle/Vehicle.tsx (crash, bump, landing, takeoff, reset, teleport).
// App-level moments (card open, GPS, zone enter, biome discovered, toggles) come from useAppStore:
// subscribe to the store instead of adding events for them.

import type { Vector3 } from "three";

export type GameEvent =
  /** The car lost speed suddenly (hit something solid). strength 0..1; `speedLost` m/s */
  | { type: "crash"; strength: number; speedLost: number; position: Vector3 }
  /**
   * Contact force on the chassis above a threshold (walls, props, rough landings). strength 0..1;
   * `dynamic` = the other body is a loose prop (cans, cones, crates), not the world
   */
  | { type: "bump"; strength: number; dynamic: boolean; position: Vector3 }
  /** All wheels left the ground after a real takeoff (> ~0.25 s air follows) */
  | { type: "takeoff"; speed: number; position: Vector3 }
  /** Wheels back on the ground after airtime. `impact` = vertical speed into the ground (m/s) */
  | { type: "landing"; impact: number; airTime: number; strength: number; position: Vector3 }
  /** R pressed / auto-righted after a flip */
  | { type: "reset"; position: Vector3 }
  /** GPS jump or fell out of the world: the car was moved */
  | { type: "teleport"; position: Vector3 };

export type GameEventType = GameEvent["type"];
type Listener = (e: GameEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to every game event; returns the unsubscribe function. */
export function onGameEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Emit an event to every listener (listener errors are isolated so one bad consumer can't break the car). */
export function emitGameEvent(e: GameEvent): void {
  for (const l of listeners) {
    try {
      l(e);
    } catch (err) {
      console.warn("[gameEvents] listener failed", err);
    }
  }
}
