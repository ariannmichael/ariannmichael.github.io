import { describe, expect, it, vi } from "vitest";
import { PRIORITY, VoicePool } from "./voices";

describe("VoicePool", () => {
  it("accepts up to max voices and frees them when they end", () => {
    const p = new VoicePool(2);
    expect(p.acquire(0, 1, PRIORITY.ui)).toBe(true);
    expect(p.acquire(0, 1, PRIORITY.ui)).toBe(true);
    expect(p.acquire(0.5, 1, PRIORITY.ui)).toBe(false);
    expect(p.active(0.5)).toBe(2);
    expect(p.acquire(1.01, 1, PRIORITY.ui)).toBe(true);
  });

  it("a more important sound steals the least important (oldest first) slot and stops it", () => {
    const p = new VoicePool(2);
    const stopOld = vi.fn();
    const stopNew = vi.fn();
    p.acquire(0, 5, PRIORITY.ambient, stopOld);
    p.acquire(0.1, 5, PRIORITY.ambient, stopNew);
    expect(p.acquire(0.2, 1, PRIORITY.impact)).toBe(true);
    expect(stopOld).toHaveBeenCalledOnce();
    expect(stopNew).not.toHaveBeenCalled();
    expect(p.active(0.2)).toBe(2);
  });

  it("never steals from an equal or higher priority", () => {
    const p = new VoicePool(1);
    p.acquire(0, 5, PRIORITY.impact);
    expect(p.acquire(0.1, 1, PRIORITY.impact)).toBe(false);
    expect(p.acquire(0.1, 1, PRIORITY.hover)).toBe(false);
  });

  it("setMax shrinks the budget (lite quality)", () => {
    const p = new VoicePool(4);
    p.setMax(1);
    expect(p.acquire(0, 1, PRIORITY.ui)).toBe(true);
    expect(p.acquire(0, 1, PRIORITY.ui)).toBe(false);
  });
});
