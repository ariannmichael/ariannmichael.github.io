import { describe, expect, it } from "vitest";
import { getCountdown, releaseInstant } from "./countdown";
import { formatDateRange, formatMonth } from "./format";
import { joystickAxes } from "./joystick";

describe("countdown", () => {
  const release = releaseInstant("2026-11-10");

  it("treats the release as 18:00 UTC on the release date", () => {
    expect(new Date(release).toISOString()).toBe("2026-11-10T18:00:00.000Z");
  });

  it("counts down before the release", () => {
    const now = Date.parse("2026-11-08T16:58:30Z"); // 2d 1h 1m 30s before
    expect(getCountdown(now, release)).toEqual({
      released: false,
      days: 2,
      hours: 1,
      minutes: 1,
      seconds: 30,
    });
  });

  it("rounds partial seconds up so it never shows 0 before release", () => {
    const c = getCountdown(release - 200, release);
    expect(c.released).toBe(false);
    expect(c.seconds).toBe(1);
  });

  it("is released exactly at the release instant", () => {
    expect(getCountdown(release, release).released).toBe(true);
  });

  it("is released after the release", () => {
    expect(getCountdown(release + 86_400_000, release)).toEqual({
      released: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});

describe("date formatting", () => {
  it("formats ISO months", () => {
    expect(formatMonth("2025-05")).toBe("May 2025");
    expect(formatMonth("2026-12")).toBe("Dec 2026");
    expect(formatMonth("garbage")).toBe("garbage");
  });

  it("formats closed and open ranges", () => {
    expect(formatDateRange("2025-05", "2026-03")).toBe("May 2025 – Mar 2026");
    expect(formatDateRange("2026-04", null)).toBe("Apr 2026 – Present");
  });

  it("collapses a single-month range", () => {
    expect(formatDateRange("2024-01", "2024-01")).toBe("Jan 2024");
  });
});

describe("joystick math", () => {
  const R = 60;

  it("is zero at the centre", () => {
    expect(joystickAxes(0, 0, R)).toEqual({ steer: 0, throttle: 0, knobX: 0, knobY: 0 });
  });

  it("ignores input inside the deadzone but still moves the knob", () => {
    const r = joystickAxes(5, -5, R, 0.15); // ~0.12 of the radius
    expect(r.steer).toBe(0);
    expect(r.throttle).toBe(0);
    expect(r.knobX).toBeCloseTo(5);
  });

  it("maps up to full forward throttle and right to full steer", () => {
    expect(joystickAxes(0, -R, R).throttle).toBe(1);
    expect(joystickAxes(0, R, R).throttle).toBe(-1);
    expect(joystickAxes(R, 0, R).steer).toBe(1);
    expect(joystickAxes(-R, 0, R).steer).toBe(-1);
  });

  it("clamps beyond the radius", () => {
    const r = joystickAxes(0, -500, R);
    expect(r.throttle).toBe(1);
    expect(r.knobY).toBe(-R);
  });

  it("rescales past the deadzone so halfway is less than half", () => {
    const r = joystickAxes(R / 2, 0, R, 0.2); // (0.5 - 0.2) / 0.8
    expect(r.steer).toBeCloseTo(0.375, 3);
  });

  it("keeps diagonal output inside the unit circle", () => {
    const r = joystickAxes(100, -100, R, 0);
    expect(Math.hypot(r.steer, r.throttle)).toBeLessThanOrEqual(1.0001);
    expect(r.steer).toBeCloseTo(Math.SQRT1_2, 2);
  });
});
