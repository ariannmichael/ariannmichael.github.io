import { describe, expect, it } from "vitest";
import { CYLINDERS, ENGINE_HARMONICS, harmonicLevel, lumpyWave, smoothWave } from "./engineWave";

describe("engine waves", () => {
  it("even cylinders only sound at the firing orders", () => {
    const w = smoothWave();
    expect(harmonicLevel(w, CYLINDERS)).toBeGreaterThan(0.1);
    for (let h = 1; h <= ENGINE_HARMONICS; h++) {
      if (h % CYLINDERS !== 0) expect(harmonicLevel(w, h)).toBeLessThan(1e-4);
    }
  });

  it("uneven cylinders leak energy into the low orders (the burble)", () => {
    const w = lumpyWave();
    const firing = harmonicLevel(w, CYLINDERS);
    expect(harmonicLevel(w, 1)).toBeGreaterThan(firing * 0.15);
    expect(harmonicLevel(w, 4)).toBeGreaterThan(firing * 0.15);
    // ...but the firing tone still dominates
    for (let h = 1; h < CYLINDERS; h++) expect(harmonicLevel(w, h)).toBeLessThan(firing);
  });

  it("rolls off towards the top harmonics", () => {
    const w = smoothWave();
    expect(harmonicLevel(w, CYLINDERS * 8)).toBeLessThan(harmonicLevel(w, CYLINDERS) * 0.5);
    expect(w.real[0]).toBe(0);
  });
});
