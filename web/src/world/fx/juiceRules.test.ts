import { describe, expect, it } from "vitest";
import {
  IMPACT,
  LIGHTS,
  MARKER_FX,
  SPEED_LINES,
  allowBurst,
  brakeLightLevel,
  bumpBurstStrength,
  exhaustRate,
  headlightLevel,
  impactBurst,
  labelPop,
  landingRingCount,
  markerProximity,
  reverseLightLevel,
  speedLineRate,
  tailLevel,
} from "./juiceRules";

describe("car lights", () => {
  it("brake lights: S while rolling forward, or the handbrake; not S at a standstill", () => {
    expect(brakeLightLevel(-1, 10, false)).toBe(1);
    expect(brakeLightLevel(0, 0, true)).toBe(1);
    expect(brakeLightLevel(-1, 0, false)).toBe(0);
    expect(brakeLightLevel(1, 10, false)).toBe(0);
    expect(brakeLightLevel(-LIGHTS.inputDeadzone / 2, 10, false)).toBe(0);
  });

  it("reverse lights: rolling backwards, or S once stopped", () => {
    expect(reverseLightLevel(0, -2)).toBe(1);
    expect(reverseLightLevel(-1, 0)).toBe(1);
    expect(reverseLightLevel(-1, 8)).toBe(0); // that's braking
    expect(reverseLightLevel(1, 0)).toBe(0);
  });

  it("headlights only on the night side, eased; tail lamps run dim with them", () => {
    expect(headlightLevel(0)).toBe(0);
    expect(headlightLevel(LIGHTS.headOnNight)).toBe(0);
    expect(headlightLevel(LIGHTS.headFullNight)).toBe(1);
    expect(headlightLevel(0.45)).toBeGreaterThan(0);
    expect(headlightLevel(0.45)).toBeLessThan(1);
    expect(tailLevel(0, 1)).toBe(LIGHTS.tailRunning);
    expect(tailLevel(1, 1)).toBe(1);
    expect(tailLevel(0, 0)).toBe(0);
  });
});

describe("exhaust and speed lines", () => {
  it("exhaust idles, grows with throttle, stops in the air", () => {
    expect(exhaustRate(0, 0, true)).toBeGreaterThan(0);
    expect(exhaustRate(1, 0, true)).toBeGreaterThan(exhaustRate(0.3, 0, true));
    expect(exhaustRate(1, 1, true)).toBeLessThan(exhaustRate(1, 0, true));
    expect(exhaustRate(1, 0.5, false)).toBe(0);
  });

  it("speed lines start at 70% of top speed and cap at the full rate", () => {
    expect(speedLineRate(0.5)).toBe(0);
    expect(speedLineRate(SPEED_LINES.start)).toBe(0);
    expect(speedLineRate(0.85)).toBeGreaterThan(0);
    expect(speedLineRate(1)).toBe(SPEED_LINES.rate);
    expect(speedLineRate(1.3)).toBe(SPEED_LINES.rate);
  });
});

describe("impacts and landings", () => {
  const out = { sparks: 0, chips: 0 };

  it("world hits throw sparks scaled by strength; props throw chips", () => {
    expect(impactBurst(1, false, 1, out)).toEqual({ sparks: IMPACT.sparksMax, chips: 0 });
    expect(impactBurst(0.2, false, 1, out).sparks).toBeLessThan(IMPACT.sparksMax);
    const prop = impactBurst(0.3, true, 1, out);
    expect(prop.chips).toBeGreaterThan(0);
    expect(prop.sparks).toBe(0);
    expect(impactBurst(0.9, true, 1, out).sparks).toBeGreaterThan(0);
    expect(impactBurst(0.01, false, 1, out)).toEqual({ sparks: 0, chips: 0 });
    expect(impactBurst(1, false, 0.5, out).sparks).toBe(IMPACT.sparksMax / 2);
  });

  it("world bumps need to be hard to spark; prop bumps always count", () => {
    expect(bumpBurstStrength(0.2, false)).toBe(0);
    expect(bumpBurstStrength(0.5, false)).toBe(0.5);
    expect(bumpBurstStrength(0.2, true)).toBe(0.2);
  });

  it("rate limiter merges volleys of contact events", () => {
    const lim = { last: -Infinity };
    expect(allowBurst(lim, 1)).toBe(true);
    expect(allowBurst(lim, 1 + IMPACT.minInterval / 2)).toBe(false);
    expect(allowBurst(lim, 1 + IMPACT.minInterval * 1.01)).toBe(true);
  });

  it("landing rings only for real landings, bigger for harder ones", () => {
    expect(landingRingCount(0.05, 1)).toBe(0);
    expect(landingRingCount(1, 1)).toBeGreaterThan(landingRingCount(0.3, 1));
    expect(landingRingCount(1, 0.5)).toBeLessThan(landingRingCount(1, 1));
  });
});

describe("markers", () => {
  it("proximity is 0 far away, 1 when close, monotonic between", () => {
    expect(markerProximity(MARKER_FX.far + 5)).toBe(0);
    expect(markerProximity(MARKER_FX.near)).toBe(1);
    expect(markerProximity(0)).toBe(1);
    expect(markerProximity(10)).toBeGreaterThan(markerProximity(20));
  });

  it("label pop overshoots and returns to exactly 1", () => {
    expect(labelPop(0)).toBe(1);
    expect(labelPop(MARKER_FX.popDuration * 0.3)).toBeGreaterThan(1.05);
    expect(labelPop(MARKER_FX.popDuration)).toBe(1);
    expect(labelPop(Infinity)).toBe(1);
    expect(labelPop(-1)).toBe(1);
    expect(labelPop(Number.NaN)).toBe(1);
  });
});
