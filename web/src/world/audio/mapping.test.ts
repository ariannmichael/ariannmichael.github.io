import { describe, expect, it } from "vitest";
import { VEHICLE } from "@/world/vehicle/constants";
import { ENGINE } from "./engineModel";
import {
  BIOME_HARDNESS,
  clunkRate,
  createEngineSoundParams,
  createRollParams,
  engineSoundParams,
  ImpactGate,
  impactParams,
  landingParams,
  PULSES_PER_REV,
  RateLimiter,
  rollParams,
  surfaceHardness,
  type RollInput,
} from "./mapping";

const roll = (o: Partial<RollInput>) =>
  rollParams({ speed: 0, grounded: true, airTime: 0, slip: 0, hardness: 0, suspensionActivity: 0, ...o }, createRollParams());

describe("engine sound mapping", () => {
  const p = (rpm: number, load: number) => ({ ...engineSoundParams(rpm, load, createEngineSoundParams()) });

  it("firing frequency follows rpm (V8: 4 pulses per rev)", () => {
    expect(p(ENGINE.idleRpm, 0).freq).toBeCloseTo((ENGINE.idleRpm / 60) * PULSES_PER_REV);
    expect(p(6000, 0).freq).toBeCloseTo(400);
  });
  it("load opens the filter, drives harder and gets louder", () => {
    const off = p(3000, 0);
    const on = p(3000, 1);
    expect(on.cutoff).toBeGreaterThan(off.cutoff * 1.5);
    expect(on.drive).toBeGreaterThan(off.drive);
    expect(on.gain).toBeGreaterThan(off.gain);
    expect(on.rasp).toBeGreaterThan(off.rasp);
  });
  it("burble is strong at idle and fades at high revs", () => {
    expect(p(ENGINE.idleRpm, 0).burble).toBeGreaterThan(0.9);
    expect(p(5000, 0).burble).toBeLessThan(0.5);
  });
  it("is monotonic in rpm for gain and cutoff", () => {
    let prev = p(ENGINE.idleRpm, 0.5);
    for (let r = 1000; r <= 6000; r += 500) {
      const cur = p(r, 0.5);
      expect(cur.gain).toBeGreaterThanOrEqual(prev.gain);
      expect(cur.cutoff).toBeGreaterThanOrEqual(prev.cutoff);
      prev = cur;
    }
  });
});

describe("roll mapping", () => {
  it("is silent at rest", () => {
    const r = roll({});
    expect(r.squeal).toBe(0);
    expect(r.gravel).toBe(0);
    expect(r.wind).toBe(0);
    expect(r.rattle).toBe(0);
  });
  it("squeals only on hard ground; dirt slides crunch instead", () => {
    const road = roll({ speed: 10, slip: 0.8, hardness: 1 });
    const dirt = roll({ speed: 10, slip: 0.8, hardness: 0 });
    expect(road.squeal).toBeGreaterThan(0.1);
    expect(dirt.squeal).toBe(0);
    expect(dirt.gravel).toBeGreaterThan(road.gravel);
  });
  it("ignores small cornering slip", () => {
    expect(roll({ speed: 10, slip: 0.1, hardness: 1 }).squeal).toBe(0);
  });
  it("gravel grows with speed and stops in the air", () => {
    expect(roll({ speed: 15 }).gravel).toBeGreaterThan(roll({ speed: 5 }).gravel);
    expect(roll({ speed: 15, grounded: false, airTime: 1 }).gravel).toBe(0);
  });
  it("wind grows with speed and more in the air", () => {
    const fast = roll({ speed: VEHICLE.maxSpeed });
    expect(fast.wind).toBeGreaterThan(roll({ speed: 10 }).wind);
    expect(roll({ speed: 15, grounded: false, airTime: 1 }).wind).toBeGreaterThan(roll({ speed: 15 }).wind);
  });
  it("rattle follows suspension activity when moving", () => {
    expect(roll({ speed: 10, suspensionActivity: 0.8 }).rattle).toBeGreaterThan(0);
    expect(roll({ speed: 0, suspensionActivity: 0.8 }).rattle).toBe(0);
  });
  it("clunk rate is zero when smooth and grows with activity", () => {
    expect(clunkRate(0)).toBe(0);
    expect(clunkRate(0.8)).toBeGreaterThan(clunkRate(0.4));
  });
});

describe("one-shot mapping", () => {
  it("world impacts get louder, longer and crunchier with strength", () => {
    const soft = impactParams(0.1, false, 0.5);
    const hard = impactParams(1, false, 0.5);
    expect(hard.gain).toBeGreaterThan(soft.gain);
    expect(hard.decay).toBeGreaterThan(soft.decay);
    expect(hard.crunch).toBeGreaterThan(0.9);
    expect(soft.crunch).toBe(0);
  });
  it("prop hits are light knocks with no crunch", () => {
    const p = impactParams(1, true, 0.5);
    expect(p.crunch).toBe(0);
    expect(p.thudFrom).toBeGreaterThan(impactParams(1, false, 0.5).thudFrom);
  });
  it("randomises pitch per hit within ±12%", () => {
    expect(impactParams(0.5, false, 0).pitch).toBeCloseTo(0.88);
    expect(impactParams(0.5, false, 1).pitch).toBeCloseTo(1.12);
  });
  it("clamps strength", () => {
    expect(impactParams(5, false, 0.5)).toEqual(impactParams(1, false, 0.5));
  });
  it("landings: creak for most, clank only when hard", () => {
    expect(landingParams(0.3).creak).toBeGreaterThan(0);
    expect(landingParams(0.3).clank).toBe(0);
    expect(landingParams(1).clank).toBe(1);
  });
});

describe("rate limiting", () => {
  it("RateLimiter enforces a per-key interval", () => {
    const r = new RateLimiter();
    expect(r.allow("a", 0, 0.1)).toBe(true);
    expect(r.allow("a", 0.05, 0.1)).toBe(false);
    expect(r.allow("b", 0.05, 0.1)).toBe(true);
    expect(r.allow("a", 0.2, 0.1)).toBe(true);
  });
  it("ImpactGate merges near-simultaneous hits, letting a much louder one through", () => {
    const g = new ImpactGate(0.12);
    expect(g.accept(0, 0.4)).toBe(0.4);
    expect(g.accept(0.05, 0.5)).toBe(0);
    expect(g.accept(0.06, 0.9)).toBe(0.9);
    expect(g.accept(0.5, 0.2)).toBe(0.2);
  });
});

describe("surface hardness", () => {
  it("is 1 on the road, falls off past the edge to the biome baseline", () => {
    expect(surfaceHardness(0, 3.2, "home")).toBe(1);
    expect(surfaceHardness(10, 3.2, "home")).toBe(0);
    expect(surfaceHardness(10, 3.2, "engineering")).toBe(BIOME_HARDNESS.engineering);
  });
});
