import { describe, expect, it } from "vitest";
import { VEHICLE } from "./constants";
import {
  airControl,
  combineAxis,
  contactTrauma,
  crashTrauma,
  driveCommand,
  engineCurve,
  landingTrauma,
  rearGripFactor,
  slipAngle,
  smoothSteer,
  stabiliseYaw,
  steerAngle,
  steerCurve,
  uprightStep,
} from "./drive";
import { frontLoadShare, staticSag, wheelLayout } from "./setup";

const DT = 1 / 60;
const idle = { throttle: 0, steer: 0, handbrake: false };

describe("steering curve", () => {
  it("full lock at low speed, reduced to highSpeedSteer at top speed, monotonic", () => {
    expect(steerCurve(0)).toBe(1);
    expect(steerCurve(VEHICLE.maxSpeed)).toBeCloseTo(VEHICLE.highSpeedSteer);
    expect(steerCurve(100)).toBeCloseTo(VEHICLE.highSpeedSteer);
    let prev = 2;
    for (let v = 0; v <= VEHICLE.maxSpeed; v += 1) {
      expect(steerCurve(v)).toBeLessThanOrEqual(prev);
      prev = steerCurve(v);
    }
    expect(steerCurve(-10)).toBe(steerCurve(10));
  });

  it("steer right gives a negative (rightward) wheel angle; clamps input", () => {
    expect(steerAngle(1, 0)).toBeCloseTo(-VEHICLE.maxSteer);
    expect(steerAngle(-1, 0)).toBeCloseTo(VEHICLE.maxSteer);
    expect(steerAngle(5, 0)).toBeCloseTo(-VEHICLE.maxSteer);
    expect(Math.abs(steerAngle(1, 20))).toBeLessThan(VEHICLE.maxSteer);
  });

  it("smoothSteer turns in progressively and returns faster", () => {
    let s = 0;
    s = smoothSteer(s, 1, DT);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.3);
    // From 0.5: one step towards 1 vs one step back to 0 (same distance, the return is faster)
    const towards = smoothSteer(0.5, 1, DT) - 0.5;
    const back = 0.5 - smoothSteer(0.5, 0, DT);
    expect(back).toBeGreaterThan(towards);
    expect(smoothSteer(0.5, -1, DT)).toBeLessThan(0.5);
  });
});

describe("engine curve", () => {
  it("full force from standstill, fading to zero at top speed", () => {
    expect(engineCurve(1, 0)).toBe(VEHICLE.engineForce);
    expect(engineCurve(1, VEHICLE.maxSpeed)).toBe(0);
    expect(engineCurve(1, VEHICLE.maxSpeed + 5)).toBe(0);
    expect(engineCurve(1, VEHICLE.maxSpeed / 2)).toBeCloseTo(VEHICLE.engineForce * 0.75);
    expect(engineCurve(0.5, 0)).toBeCloseTo(VEHICLE.engineForce / 2);
  });

  it("reverse is weaker and capped at maxReverseSpeed", () => {
    expect(engineCurve(-1, 0)).toBe(-VEHICLE.reverseForce);
    expect(engineCurve(-1, -VEHICLE.maxReverseSpeed)).toBeCloseTo(0);
    expect(engineCurve(0, 10)).toBe(0);
  });
});

describe("drive command", () => {
  it("throttle drives all four wheels, rear-biased (AWD)", () => {
    const c = driveCommand({ ...idle, throttle: 1 }, 0, 0, DT);
    expect(c.engineRear).toBeGreaterThan(c.engineFront);
    expect(c.engineFront).toBeGreaterThan(0);
    expect(2 * (c.engineFront + c.engineRear)).toBeCloseTo(VEHICLE.engineForce);
    expect(c.brakeFront).toBe(0);
  });

  it("pressing back while moving forward brakes instead of reversing", () => {
    const c = driveCommand({ ...idle, throttle: -1 }, 10, 0, DT);
    expect(c.engineFront + c.engineRear).toBe(0);
    expect(c.brakeFront).toBe(VEHICLE.brakeImpulse);
    const r = driveCommand({ ...idle, throttle: -1 }, 0.5, 0, DT);
    expect(r.engineRear).toBeLessThan(0);
  });

  it("coasting applies a light rolling resistance; parked holds with full brakes", () => {
    const coast = driveCommand(idle, 10, 0, DT);
    expect(coast.brakeFront).toBeGreaterThan(0);
    expect(coast.brakeFront).toBeLessThan(VEHICLE.brakeImpulse);
    const parked = driveCommand({ ...idle, handbrake: true }, 0.2, 0, DT);
    expect(parked.brakeFront).toBe(VEHICLE.brakeImpulse);
    expect(parked.rearGrip).toBe(1);
  });

  it("handbrake locks the rear, cuts rear drive and drops rear grip", () => {
    const c = driveCommand({ throttle: 1, steer: 0.5, handbrake: true }, 18, 0, DT);
    expect(c.brakeRear).toBe(VEHICLE.handbrakeImpulse);
    expect(c.engineRear).toBe(0);
    expect(c.engineFront).toBeGreaterThan(0);
    expect(c.rearGrip).toBe(VEHICLE.handbrakeGrip);
  });
});

describe("slip-angle drift", () => {
  it("slip angle is zero when slow or straight, grows with sideways speed", () => {
    expect(slipAngle(1, 1)).toBe(0);
    expect(slipAngle(20, 0)).toBe(0);
    expect(slipAngle(10, 10)).toBeCloseTo(Math.PI / 4);
    expect(slipAngle(-10, 0)).toBe(0);
  });

  it("rear grip holds at small slip and falls to driftGrip once sliding", () => {
    expect(rearGripFactor(0, false)).toBe(1);
    expect(rearGripFactor(VEHICLE.slipAngleStart, false)).toBe(1);
    expect(rearGripFactor(VEHICLE.slipAngleFull, false)).toBeCloseTo(VEHICLE.driftGrip);
    expect(rearGripFactor(1, false)).toBeCloseTo(VEHICLE.driftGrip);
    expect(rearGripFactor(0, true)).toBe(VEHICLE.handbrakeGrip);
  });

  it("stabiliser damps only yaw that would spin the car past driftMaxAngle", () => {
    // Sliding right (lateral > 0) at 45° while yawing left (+): rear swinging out → damped
    const spun = stabiliseYaw(2, 10, 10, DT);
    expect(spun).toBeLessThan(2);
    expect(spun).toBeGreaterThan(0);
    // Counter-steer (yaw against the slide) and small slip angles are untouched
    expect(stabiliseYaw(-2, 10, 10, DT)).toBe(-2);
    expect(stabiliseYaw(2, 20, 1, DT)).toBe(2);
    expect(stabiliseYaw(2, 1, 10, DT)).toBe(2);
  });
});

describe("air control", () => {
  it("throttle pitches, steer rolls, scaled by dt", () => {
    const a = airControl({ throttle: 1, steer: -1 }, 0, 0, DT);
    expect(a.pitch).toBeCloseTo(VEHICLE.airPitchAccel * DT);
    expect(a.roll).toBeCloseTo(-VEHICLE.airRollAccel * DT);
    expect(airControl({ throttle: 0, steer: 0 }, 1, 1, DT)).toEqual({ pitch: 0, roll: 0 });
  });

  it("never spins past airMaxRate but always allows slowing a spin", () => {
    const capped = airControl({ throttle: 1, steer: 0 }, VEHICLE.airMaxRate, 0, DT);
    expect(capped.pitch).toBe(0);
    const near = airControl({ throttle: 1, steer: 0 }, VEHICLE.airMaxRate - 0.01, 0, DT);
    expect(near.pitch).toBeCloseTo(0.01);
    const slowing = airControl({ throttle: -1, steer: 0 }, VEHICLE.airMaxRate + 1, 0, DT);
    expect(slowing.pitch).toBeLessThan(0);
  });
});

describe("auto-upright decision", () => {
  const run = (upDot: number, speed: number, seconds: number) => {
    let s = { flippedFor: 0, assisting: false };
    for (let i = 0; i < Math.round(seconds / DT); i++) s = uprightStep(s, upDot, speed, DT);
    return s;
  };

  it("waits flippedDelay seconds on the roof before assisting", () => {
    expect(run(-1, 0, VEHICLE.flippedDelay - 0.1).assisting).toBe(false);
    expect(run(-1, 0, VEHICLE.flippedDelay + 0.05).assisting).toBe(true);
  });

  it("does nothing when upright, tilted a little, or still moving fast (mid-tumble)", () => {
    expect(run(1, 0, 5).assisting).toBe(false);
    expect(run(0.6, 0, 5).assisting).toBe(false);
    expect(run(-1, 10, 5).assisting).toBe(false);
  });

  it("keeps assisting until nearly upright, then resets", () => {
    let s = run(-1, 0, 2);
    s = uprightStep(s, 0.5, 0, DT);
    expect(s.assisting).toBe(true);
    s = uprightStep(s, VEHICLE.uprightDoneDot + 0.01, 0, DT);
    expect(s).toEqual({ flippedFor: 0, assisting: false });
  });

  it("a moment of being flipped then recovering resets the timer", () => {
    let s = run(-1, 0, 1);
    s = uprightStep(s, 1, 0, DT);
    expect(s.flippedFor).toBe(0);
  });
});

describe("feedback trauma", () => {
  it("landings, crashes and contact forces map to 0..1 with dead zones", () => {
    expect(landingTrauma(VEHICLE.landingShakeMin)).toBe(0);
    expect(landingTrauma(100)).toBeLessThanOrEqual(1);
    expect(landingTrauma(10)).toBeGreaterThan(landingTrauma(6));
    expect(crashTrauma(1)).toBe(0);
    expect(crashTrauma(10)).toBeGreaterThan(0);
    expect(contactTrauma(0)).toBe(0);
    expect(contactTrauma(1e7)).toBeLessThanOrEqual(1);
  });
});

describe("input", () => {
  it("keyboard and touch: larger magnitude wins", () => {
    expect(combineAxis(1, 0.3)).toBe(1);
    expect(combineAxis(0, -0.6)).toBe(-0.6);
    expect(combineAxis(-1, 0.5)).toBe(-1);
  });
});

describe("wheel layout", () => {
  it("hard points put every hub at the raised ride height at static equilibrium", () => {
    const front = frontLoadShare();
    expect(front).toBeGreaterThan(0.3);
    expect(front).toBeLessThan(0.7);
    const layout = wheelLayout();
    expect(layout.map((w) => w.front)).toEqual([true, true, false, false]);
    for (const w of layout) {
      const share = w.front ? front : 1 - front;
      expect(w.y - (VEHICLE.suspensionRest - staticSag(share))).toBeCloseTo(VEHICLE.hubY - VEHICLE.rideLift);
      expect(w.restingLength).toBeGreaterThan(VEHICLE.suspensionRest - VEHICLE.suspensionTravel);
    }
    // Front-left is on the car's +X (left) side
    expect(layout[0].x).toBeGreaterThan(0);
    expect(layout[1].x).toBeLessThan(0);
  });
});
