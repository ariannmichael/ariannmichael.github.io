import { describe, expect, it } from "vitest";
import { loadMutedPref, MUTE_STORAGE_KEY, saveMutedPref } from "./mutePref";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("mute preference", () => {
  it("round-trips", () => {
    const s = memory();
    expect(loadMutedPref(s)).toBeNull();
    saveMutedPref(true, s);
    expect(s.m.get(MUTE_STORAGE_KEY)).toBe("1");
    expect(loadMutedPref(s)).toBe(true);
    saveMutedPref(false, s);
    expect(loadMutedPref(s)).toBe(false);
  });
  it("survives storage that throws", () => {
    const bad = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadMutedPref(bad)).toBeNull();
    expect(() => saveMutedPref(true, bad)).not.toThrow();
  });
  it("ignores garbage values", () => {
    const s = memory();
    s.m.set(MUTE_STORAGE_KEY, "yes");
    expect(loadMutedPref(s)).toBeNull();
  });
});
