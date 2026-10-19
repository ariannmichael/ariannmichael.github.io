import { describe, expect, it } from "vitest";
import { adEnvelope, ahrEnvelope, ParamGlide, SILENT, sweep, type ParamLike } from "./envelope";

/** Records automation calls instead of producing audio */
function mockParam() {
  const calls: [string, ...number[]][] = [];
  const p: ParamLike = {
    value: 0,
    setValueAtTime: (v, t) => calls.push(["set", v, t]),
    linearRampToValueAtTime: (v, t) => calls.push(["lin", v, t]),
    exponentialRampToValueAtTime: (v, t) => calls.push(["exp", v, t]),
    setTargetAtTime: (v, t, tc) => calls.push(["target", v, t, tc]),
    cancelScheduledValues: (t) => calls.push(["cancel", t]),
  };
  return { p, calls };
}

describe("envelopes", () => {
  it("adEnvelope: silent → peak (linear) → silent (exponential), returns the end", () => {
    const { p, calls } = mockParam();
    const end = adEnvelope(p, 1, 0.5, 0.01, 0.2);
    expect(end).toBeCloseTo(1.21);
    expect(calls).toEqual([
      ["cancel", 1],
      ["set", SILENT, 1],
      ["lin", 0.5, 1.01],
      ["exp", SILENT, end],
    ]);
  });

  it("adEnvelope never ramps exponentially to 0 and enforces minimum times", () => {
    const { p, calls } = mockParam();
    const end = adEnvelope(p, 0, 0, 0, 0);
    expect(end).toBeGreaterThan(0);
    for (const c of calls) if (c[0] === "exp" || c[0] === "lin") expect(c[1]).toBeGreaterThan(0);
  });

  it("ahrEnvelope holds the peak", () => {
    const { p, calls } = mockParam();
    const end = ahrEnvelope(p, 0, 1, 0.01, 0.1, 0.2);
    expect(end).toBeCloseTo(0.31);
    expect(calls).toContainEqual(["set", 1, 0.11]);
  });

  it("sweep clamps to positive values for exponential ramps", () => {
    const { p, calls } = mockParam();
    sweep(p, 0, 100, 0, 1);
    expect(calls[1][1]).toBe(SILENT);
  });
});

describe("ParamGlide", () => {
  it("skips negligible changes but always reaches 0", () => {
    const { p, calls } = mockParam();
    const g = new ParamGlide(p, 0.05);
    g.to(0.2, 0);
    g.to(0.2005, 0.01);
    expect(calls.filter((c) => c[0] === "target")).toHaveLength(1);
    g.to(0.003, 0.02);
    g.to(0, 0.03);
    g.to(0, 0.04);
    expect(calls.filter((c) => c[0] === "target").map((c) => c[1])).toEqual([0.2, 0.003, 0]);
  });
  it("uses a relative threshold for frequencies", () => {
    const { p, calls } = mockParam();
    const g = new ParamGlide(p, 0.03);
    g.to(400, 0);
    g.to(401, 0.01);
    g.to(410, 0.02);
    expect(calls.filter((c) => c[0] === "target").map((c) => c[1])).toEqual([400, 410]);
  });
});
