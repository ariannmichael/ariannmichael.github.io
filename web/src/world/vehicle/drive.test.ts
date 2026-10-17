import { describe, expect, it } from "vitest";
import { VEHICLE } from "./constants";
import { combineAxis, driveStep, forwardOf, longitudinalStep, rightOf, steerSpeedFactor, yawRate, type DriveState } from "./drive";

const DT = 1 / 60;
const idle = { throttle: 0, steer: 0, brake: false };

function simulate(state: DriveState, input: typeof idle, seconds: number): DriveState {
  let s = state;
  for (let i = 0; i < Math.round(seconds / DT); i++) s = driveStep(s, input, DT);
  return s;
}

describe("heading frame", () => {
  it("yaw 0 faces +Z and right is -X", () => {
    expect(forwardOf(0)[0]).toBeCloseTo(0);
    expect(forwardOf(0)[1]).toBeCloseTo(1);
    expect(rightOf(0)).toEqual([-1, 0]);
  });
});

describe("steering", () => {
  it("does not turn on the spot", () => {
    expect(steerSpeedFactor(0)).toBe(0);
    expect(yawRate(1, 0)).toBeCloseTo(0);
    const s = simulate({ vx: 0, vz: 0, yaw: 0 }, { ...idle, steer: 1 }, 1);
    expect(s.yaw).toBe(0);
  });

  it("full authority at moderate speed, slightly less at top speed", () => {
    expect(steerSpeedFactor(VEHICLE.steerRampSpeed)).toBeGreaterThan(0.9);
    expect(steerSpeedFactor(VEHICLE.maxSpeed)).toBeCloseTo(1 - VEHICLE.highSpeedSteerLoss);
  });

  it("steering right moving forward turns towards -X (yaw decreases)", () => {
    const s = simulate({ vx: 0, vz: 10, yaw: 0 }, { throttle: 1, steer: 1, brake: false }, 0.5);
    expect(s.yaw).toBeLessThan(0);
    expect(s.vx).toBeLessThan(0);
  });

  it("reversing inverts the steering", () => {
    expect(Math.sign(yawRate(1, -5))).toBe(-Math.sign(yawRate(1, 5)));
  });
});

describe("speed", () => {
  it("reaches top speed (20-25 m/s) and never exceeds it", () => {
    let s: DriveState = { vx: 0, vz: 0, yaw: 0 };
    let max = 0;
    for (let i = 0; i < 60 * 15; i++) {
      s = driveStep(s, { ...idle, throttle: 1 }, DT);
      max = Math.max(max, Math.hypot(s.vx, s.vz));
    }
    expect(max).toBeLessThanOrEqual(VEHICLE.maxSpeed + 1e-9);
    expect(max).toBeGreaterThan(20);
    expect(VEHICLE.maxSpeed).toBeGreaterThanOrEqual(20);
    expect(VEHICLE.maxSpeed).toBeLessThanOrEqual(25);
  });

  it("is snappy: past 12 m/s within 1.5 s", () => {
    const s = simulate({ vx: 0, vz: 0, yaw: 0 }, { ...idle, throttle: 1 }, 1.5);
    expect(s.vz).toBeGreaterThan(12);
  });

  it("braking stops the car quickly", () => {
    const s = simulate({ vx: 0, vz: 20, yaw: 0 }, { ...idle, brake: true }, 1);
    expect(Math.abs(s.vz)).toBeLessThan(0.01);
  });

  it("pressing back while moving forward brakes, then reverses to the reverse limit", () => {
    expect(longitudinalStep(10, { ...idle, throttle: -1 }, DT)).toBeCloseTo(10 - VEHICLE.brakeDecel * DT);
    const s = simulate({ vx: 0, vz: 10, yaw: 0 }, { ...idle, throttle: -1 }, 5);
    expect(s.vz).toBeCloseTo(-VEHICLE.maxReverseSpeed, 5);
  });

  it("coasts down without input", () => {
    const s = simulate({ vx: 0, vz: 10, yaw: 0 }, idle, 1);
    expect(s.vz).toBeLessThan(10);
    expect(s.vz).toBeGreaterThan(0);
  });

  it("kills sideways sliding (grip), less so with the handbrake (drift)", () => {
    const grip = simulate({ vx: 5, vz: 0, yaw: 0 }, idle, 0.5);
    const drift = simulate({ vx: 5, vz: 0, yaw: 0 }, { ...idle, brake: true }, 0.5);
    expect(Math.abs(grip.vx)).toBeLessThan(0.1);
    expect(Math.abs(drift.vx)).toBeGreaterThan(Math.abs(grip.vx));
  });

  it("airborne: no traction", () => {
    const s = driveStep({ vx: 1, vz: 5, yaw: 0 }, { throttle: 1, steer: 0, brake: false }, DT, false);
    expect(s.vx).toBe(1);
    expect(s.vz).toBe(5);
  });
});

describe("input", () => {
  it("keyboard and touch: larger magnitude wins", () => {
    expect(combineAxis(1, 0.3)).toBe(1);
    expect(combineAxis(0, -0.6)).toBe(-0.6);
    expect(combineAxis(-1, 0.5)).toBe(-1);
  });
});
