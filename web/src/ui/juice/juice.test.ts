import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { countTricks, createFlipTracker, wholeTurns, type TrickCounts } from "./flip";
import { describeDiscovery, newlyDiscovered } from "./discovery";
import { POPUP_RULES, crashPopup, formatAirTime, landingPopup, trickNames } from "./popups";
import { SPEED_SEGMENTS, litSegments, smoothToward, speedText, speedValue, toKmh } from "./speed";

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const NONE: TrickCounts = { flips: 0, rolls: 0, spins: 0 };

/** Feeds the tracker a rotation of `total` radians about a car axis in `steps` frames, planet up fixed. */
function spin(axis: Vector3, total: number, steps = 60, start = new Quaternion()) {
  const tracker = createFlipTracker();
  const q = start.clone();
  tracker.begin(q, Y);
  const dq = new Quaternion().setFromAxisAngle(axis, total / steps);
  for (let i = 0; i < steps; i++) {
    q.multiply(dq); // right-multiply = rotation about the car's own axis
    tracker.step(q, Y);
  }
  return tracker.totals;
}

describe("flip tracker", () => {
  it("accumulates pitch for a backflip (nose up = negative about car X)", () => {
    const t = spin(X, -2 * Math.PI);
    expect(t.pitch).toBeCloseTo(-2 * Math.PI, 5);
    expect(t.roll).toBeCloseTo(0, 5);
    expect(t.yaw).toBeCloseTo(0, 5);
    expect(countTricks(t)).toEqual({ flips: -1, rolls: 0, spins: 0 });
  });

  it("goes past ±180° without wrapping (two full turns = two flips)", () => {
    expect(countTricks(spin(X, 4 * Math.PI, 120)).flips).toBe(2);
  });

  it("measures rolls about the car's own nose even when the car faces sideways", () => {
    const facingEast = new Quaternion().setFromAxisAngle(Y, Math.PI / 2);
    const t = spin(Z, 2 * Math.PI, 60, facingEast);
    expect(t.roll).toBeCloseTo(2 * Math.PI, 5);
    expect(t.pitch).toBeCloseTo(0, 5);
    expect(countTricks(t)).toEqual({ flips: 0, rolls: 1, spins: 0 });
  });

  it("counts flat spins", () => {
    expect(countTricks(spin(Y, -2 * Math.PI)).spins).toBe(1);
  });

  it("measures pitch relative to the curving ground, not world space", () => {
    // Ballistic flight over the tiny planet: the car's world orientation stays put while local up
    // swings 60°, so relative to the ground under it the car really did pitch (well short of a flip).
    const tracker = createFlipTracker();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    tracker.begin(q, up);
    for (let i = 1; i <= 30; i++) {
      const a = (i / 30) * (Math.PI / 3);
      tracker.step(q, up.set(0, Math.cos(a), Math.sin(a)));
    }
    expect(tracker.totals.pitch).toBeCloseTo(-Math.PI / 3, 4);
    expect(countTricks(tracker.totals)).toEqual(NONE);
  });

  it("counts real spin relative to the moving ground frame", () => {
    // Car rotates together with local up (it 'follows the ground'): zero relative spin.
    const tracker = createFlipTracker();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    tracker.begin(q, up);
    for (let i = 1; i <= 30; i++) {
      const a = (i / 30) * (Math.PI / 3);
      q.setFromAxisAngle(X, a);
      tracker.step(q, up.set(0, Math.cos(a), Math.sin(a)));
    }
    expect(tracker.totals.pitch).toBeCloseTo(0, 4);
  });

  it("starts fresh after clear() and on the first step without begin()", () => {
    const tracker = createFlipTracker();
    const q = new Quaternion().setFromAxisAngle(X, 1);
    tracker.step(q, Y); // implicit begin: no jump from identity
    expect(tracker.totals.pitch).toBe(0);
    tracker.step(q.clone().multiply(new Quaternion().setFromAxisAngle(X, 0.5)), Y);
    expect(tracker.totals.pitch).toBeCloseTo(0.5, 5);
    tracker.clear();
    expect(tracker.totals).toEqual({ pitch: 0, yaw: 0, roll: 0 });
  });

  it("is generous: ~80% of a turn completes it", () => {
    expect(wholeTurns(2 * Math.PI * 0.79)).toBe(0);
    expect(wholeTurns(2 * Math.PI * 0.8)).toBe(1);
    expect(wholeTurns(-2 * Math.PI * 1.85)).toBe(2);
  });
});

describe("popup selection", () => {
  const soft = { airTime: 1.43, strength: 0.1, upright: 0.98 };

  it("names tricks, biggest move first", () => {
    expect(trickNames({ flips: -1, rolls: 0, spins: 0 })).toEqual(["BACKFLIP"]);
    expect(trickNames({ flips: 2, rolls: 1, spins: 2 })).toEqual(["DOUBLE FRONT FLIP", "BARREL ROLL", "720"]);
    expect(trickNames({ flips: 0, rolls: 5, spins: 0 })).toEqual(["5× BARREL ROLL"]);
  });

  it("trick + big air + clean landing → trick title, details below", () => {
    expect(landingPopup(soft, { flips: -1, rolls: 0, spins: 0 })).toEqual({
      title: "BACKFLIP!",
      detail: "BIG AIR 1.4s · NICE LANDING",
      tone: "trick",
    });
  });

  it("a botched landing still credits the trick, without praise", () => {
    const p = landingPopup({ airTime: 0.8, strength: 0.9, upright: -0.5 }, { flips: 0, rolls: 1, spins: 0 });
    expect(p).toEqual({ title: "BARREL ROLL!", detail: undefined, tone: "trick" });
  });

  it("long air without tricks → BIG AIR with the time", () => {
    expect(landingPopup(soft, NONE)).toEqual({ title: "BIG AIR 1.4s", detail: "NICE LANDING", tone: "air" });
    expect(landingPopup({ ...soft, strength: 0.7 }, NONE)).toEqual({
      title: "BIG AIR 1.4s",
      detail: undefined,
      tone: "air",
    });
  });

  it("short soft hop → NICE LANDING; tiny hops and hard or crooked landings → nothing", () => {
    expect(landingPopup({ airTime: 0.6, strength: 0.2, upright: 1 }, NONE)).toEqual({
      title: "NICE LANDING",
      tone: "nice",
    });
    expect(landingPopup({ airTime: 0.3, strength: 0, upright: 1 }, NONE)).toBeNull();
    expect(landingPopup({ airTime: 0.7, strength: 0.5, upright: 1 }, NONE)).toBeNull();
    expect(landingPopup({ airTime: 0.7, strength: 0.1, upright: 0.3 }, NONE)).toBeNull();
  });

  it("CRASH! only for big hits, rate-limited", () => {
    expect(crashPopup(0.9, Infinity)).toEqual({ title: "CRASH!", tone: "crash" });
    expect(crashPopup(POPUP_RULES.crashMin - 0.01, Infinity)).toBeNull();
    expect(crashPopup(1, POPUP_RULES.crashCooldown - 0.1)).toBeNull();
  });

  it("formats air time with one decimal", () => {
    expect(formatAirTime(1.43)).toBe("1.4s");
    expect(formatAirTime(2)).toBe("2.0s");
    expect(formatAirTime(-1)).toBe("0.0s");
  });
});

describe("speed formatting", () => {
  it("converts m/s to km/h, ignoring direction", () => {
    expect(toKmh(25)).toBeCloseTo(90);
    expect(toKmh(-10)).toBeCloseTo(36);
  });

  it("rounds, clamps and dead-zones the readout", () => {
    expect(speedValue(41.6)).toBe(42);
    expect(speedValue(0.7)).toBe(0);
    expect(speedValue(Number.NaN)).toBe(0);
    expect(speedValue(5000)).toBe(999);
  });

  it("splits dimmed zero padding from the value", () => {
    expect(speedText(0)).toEqual({ lead: "00", digits: "0" });
    expect(speedText(42)).toEqual({ lead: "0", digits: "42" });
    expect(speedText(105)).toEqual({ lead: "", digits: "105" });
  });

  it("lights bar segments proportionally, at least one when moving", () => {
    expect(litSegments(0, 26.5)).toBe(0);
    expect(litSegments(0.5, 26.5)).toBe(1);
    expect(litSegments(13.25, 26.5)).toBe(SPEED_SEGMENTS / 2);
    expect(litSegments(-40, 26.5)).toBe(SPEED_SEGMENTS);
  });

  it("smooths frame-rate independently", () => {
    const oneStep = smoothToward(0, 10, 1 / 30);
    const twoSteps = smoothToward(smoothToward(0, 10, 1 / 60), 10, 1 / 60);
    expect(oneStep).toBeCloseTo(twoSteps, 6);
    expect(smoothToward(5, 10, 0)).toBe(5);
  });
});

describe("district discovery", () => {
  it("skips the spawn district (first entry)", () => {
    expect(newlyDiscovered([], ["home"])).toBeNull();
  });

  it("reports a newly visited district", () => {
    expect(newlyDiscovered(["home"], ["home", "engineering"])).toBe("engineering");
  });

  it("ignores updates that add nothing", () => {
    expect(newlyDiscovered(["home", "raceway"], ["home", "raceway"])).toBeNull();
  });

  it("describes progress for the stamp and screen readers", () => {
    expect(describeDiscovery("engineering", "Downtown Plateau", 3, 7)).toEqual({
      id: "engineering",
      name: "Downtown Plateau",
      progress: "3/7",
      announcement: "District discovered: Downtown Plateau, 3 of 7",
      complete: false,
    });
    expect(describeDiscovery("raceway", "Speed King Canyon", 7, 7).complete).toBe(true);
  });
});
