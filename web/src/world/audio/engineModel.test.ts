import { describe, expect, it } from "vitest";
import {
  createEngineState,
  ENGINE,
  estimateRpm,
  FORWARD_GEARS,
  gearForSpeed,
  REVERSE_GEAR,
  rpmForSpeed,
  rpmNorm,
  stepEngine,
  type EngineInput,
} from "./engineModel";

const DT = 1 / 60;
const input = (o: Partial<EngineInput> = {}): EngineInput => ({ forwardSpeed: 0, throttle: 0, grounded: true, slip: 0, ...o });

function run(s = createEngineState(), seconds: number, inp: (t: number) => EngineInput) {
  const trace: number[] = [];
  for (let t = 0; t < seconds; t += DT) {
    stepEngine(s, inp(t), DT);
    trace.push(s.rpm);
  }
  return trace;
}

describe("gear mapping", () => {
  it("each gear reaches the upshift rpm at its top speed", () => {
    ENGINE.gearTopSpeeds.forEach((top, i) => expect(rpmForSpeed(top, i + 1)).toBeCloseTo(ENGINE.shiftUpRpm));
  });
  it("idles at standstill in any gear", () => {
    expect(rpmForSpeed(0, 3)).toBe(ENGINE.idleRpm);
  });
  it("gearForSpeed picks the lowest gear under the upshift point", () => {
    expect(gearForSpeed(0)).toBe(1);
    expect(gearForSpeed(ENGINE.gearTopSpeeds[0] + 0.1)).toBe(2);
    expect(gearForSpeed(100)).toBe(FORWARD_GEARS);
    for (let v = 0; v < 26; v += 0.5) expect(estimateRpm(v)).toBeLessThanOrEqual(ENGINE.shiftUpRpm + 1);
  });
  it("downshift point leaves room (hysteresis): after an upshift the rpm is above shiftDown", () => {
    for (let g = 1; g < FORWARD_GEARS; g++) {
      expect(rpmForSpeed(ENGINE.gearTopSpeeds[g - 1], g + 1)).toBeGreaterThan(ENGINE.shiftDownRpm);
    }
  });
  it("rpmNorm is 0 at idle and 1 at the limiter", () => {
    expect(rpmNorm(ENGINE.idleRpm)).toBe(0);
    expect(rpmNorm(ENGINE.limiterRpm)).toBe(1);
  });
});

describe("stepEngine", () => {
  it("settles at idle with no input", () => {
    const s = createEngineState();
    s.rpm = 3000;
    run(s, 3, () => input());
    expect(s.rpm).toBeCloseTo(ENGINE.idleRpm, -1);
    expect(s.load).toBeLessThan(0.01);
  });

  it("climbs through the gears under acceleration, with an rpm drop at each upshift", () => {
    const s = createEngineState();
    let drops = 0;
    let prev = s.rpm;
    // Accelerate 0 → 25 m/s over 10 s
    for (let t = 0; t < 10; t += DT) {
      stepEngine(s, input({ forwardSpeed: 2.5 * t, throttle: 1 }), DT);
      if (s.rpm < prev - 150) drops++;
      prev = s.rpm;
    }
    expect(s.gear).toBe(FORWARD_GEARS);
    expect(s.upshifts).toBe(FORWARD_GEARS - 1);
    expect(drops).toBeGreaterThanOrEqual(FORWARD_GEARS - 1);
  });

  it("cuts the load during an upshift", () => {
    const s = createEngineState();
    const top = ENGINE.gearTopSpeeds[0];
    run(s, 1, () => input({ forwardSpeed: top - 0.5, throttle: 1 }));
    expect(s.load).toBeGreaterThan(0.8);
    stepEngine(s, input({ forwardSpeed: top + 0.5, throttle: 1 }), DT);
    expect(s.gear).toBe(2);
    expect(s.shiftTimer).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) stepEngine(s, input({ forwardSpeed: top + 0.5, throttle: 1 }), DT);
    expect(s.load).toBeLessThan(0.5);
  });

  it("downshifts with a blip when slowing", () => {
    const s = createEngineState();
    for (let t = 0; t < 10; t += DT) stepEngine(s, input({ forwardSpeed: 2.5 * t, throttle: 1 }), DT);
    for (let t = 0; t < 10; t += DT) stepEngine(s, input({ forwardSpeed: Math.max(1, 25 - 3 * t), throttle: -1 }), DT);
    expect(s.downshifts).toBeGreaterThan(0);
    expect(s.gear).toBe(1);
  });

  it("free-revs in the air and bounces off the limiter", () => {
    const s = createEngineState();
    const trace = run(s, 2, () => input({ forwardSpeed: 15, throttle: 1, grounded: false }));
    expect(Math.max(...trace)).toBeGreaterThan(ENGINE.limiterRpm - ENGINE.limiterDrop);
    expect(s.limiterHits).toBeGreaterThan(2);
    expect(Math.max(...trace)).toBeLessThanOrEqual(ENGINE.redlineRpm);
  });

  it("drops back toward idle in the air off-throttle", () => {
    const s = createEngineState();
    s.rpm = 5000;
    run(s, 2, () => input({ forwardSpeed: 15, grounded: false }));
    expect(s.rpm).toBeLessThan(1200);
  });

  it("selects reverse when backing up", () => {
    const s = createEngineState();
    run(s, 0.5, () => input({ forwardSpeed: -4, throttle: -1 }));
    expect(s.gear).toBe(REVERSE_GEAR);
    expect(s.load).toBeGreaterThan(0.5);
    expect(s.rpm).toBeGreaterThan(ENGINE.idleRpm + 500);
  });

  it("braking while rolling forward makes no power", () => {
    const s = createEngineState();
    run(s, 0.5, () => input({ forwardSpeed: 10, throttle: -1 }));
    expect(s.gear).not.toBe(REVERSE_GEAR);
    expect(s.load).toBeLessThan(0.05);
  });

  it("revs off the line (clutch slip) and with wheelspin", () => {
    const a = createEngineState();
    run(a, 0.5, () => input({ throttle: 1 }));
    expect(a.rpm).toBeGreaterThan(ENGINE.idleRpm + 1000);
    const b = createEngineState();
    run(b, 0.5, () => input({ forwardSpeed: 8, throttle: 1, slip: 1 }));
    const c = createEngineState();
    run(c, 0.5, () => input({ forwardSpeed: 8, throttle: 1 }));
    expect(b.rpm).toBeGreaterThan(c.rpm + 500);
  });

  it("is frame-rate independent (roughly)", () => {
    const a = createEngineState();
    const b = createEngineState();
    for (let t = 0; t < 1; t += 1 / 30) stepEngine(a, input({ forwardSpeed: 5, throttle: 0.7 }), 1 / 30);
    for (let t = 0; t < 1; t += 1 / 120) stepEngine(b, input({ forwardSpeed: 5, throttle: 0.7 }), 1 / 120);
    expect(Math.abs(a.rpm - b.rpm)).toBeLessThan(150);
  });
});
