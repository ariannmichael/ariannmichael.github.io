import { describe, expect, it } from "vitest";
import { BACKFIRE, backfireHash, createBackfireState, stepBackfire } from "./backfire";

const DT = 1 / 60;

/** Hold full throttle at `speed`, then lift; returns the frames (indices after the lift) that popped */
function liftAt(speed: number, s = createBackfireState(), hold = 1, after = 1.5) {
  for (let t = 0; t < hold; t += DT) stepBackfire(s, 1, speed, DT);
  const pops: number[] = [];
  let i = 0;
  for (let t = 0; t < after; t += DT, i++) if (stepBackfire(s, 0, speed, DT) > 0) pops.push(i);
  return { s, pops };
}

describe("backfire detector", () => {
  it("hash is deterministic and in 0..1", () => {
    for (let n = 0; n < 200; n++) {
      const h = backfireHash(n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(backfireHash(n)).toBe(h);
    }
  });

  it("never pops at low speed / low rpm", () => {
    for (const v of [0, 3, 5]) expect(liftAt(v).pops).toHaveLength(0);
  });

  it("never pops while the throttle stays down", () => {
    const s = createBackfireState();
    let pops = 0;
    for (let t = 0; t < 5; t += DT) pops += stepBackfire(s, 1, 20, DT) > 0 ? 1 : 0;
    expect(pops).toBe(0);
  });

  it("pops 1..maxPops times within the window after a high-rpm lift (when the lift arms)", () => {
    // Over many lifts some arm, some don't (chance), and armed ones stay within the limits
    const s = createBackfireState();
    let armed = 0;
    for (let k = 0; k < 20; k++) {
      const { pops } = liftAt(10.5, s, 1, 2);
      if (pops.length) {
        armed++;
        expect(pops.length).toBeLessThanOrEqual(BACKFIRE.maxPops);
        expect(pops[pops.length - 1] * DT).toBeLessThanOrEqual(BACKFIRE.window + DT);
      }
    }
    expect(armed).toBeGreaterThan(5);
    expect(armed).toBeLessThan(20);
  });

  it("re-applying the throttle stops the pops", () => {
    const s = createBackfireState();
    for (let t = 0; t < 1; t += DT) stepBackfire(s, 1, 10.5, DT);
    stepBackfire(s, 0, 10.5, DT);
    let pops = 0;
    for (let t = 0; t < 1; t += DT) pops += stepBackfire(s, 1, 10.5, DT) > 0 ? 1 : 0;
    expect(pops).toBe(0);
  });

  it("two independent detectors fed the same inputs fire on the same frames (audio ↔ flames sync)", () => {
    const a = createBackfireState();
    const b = createBackfireState();
    for (let i = 0; i < 2000; i++) {
      const throttle = Math.floor(i / 50) % 2 === 0 ? 1 : 0;
      const speed = 8 + (i % 300) / 20;
      expect(stepBackfire(a, throttle, speed, DT)).toBe(stepBackfire(b, throttle, speed, DT));
    }
    expect(a.pops).toBeGreaterThan(0);
    expect(a.pops).toBe(b.pops);
  });
});
