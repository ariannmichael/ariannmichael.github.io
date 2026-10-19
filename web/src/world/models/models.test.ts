import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TILE } from "@/world/layout/types";
import { KITS, MODELS, footprint, getKit, getModel, hasModel, listModels, rotatedBounds } from "./index";

// vitest runs from web/, where public/ lives.
const PUBLIC = path.resolve(process.cwd(), "public");
const size = (ref: string) => {
  const { min, max } = getModel(ref);
  return max.map((v, i) => v - min[i]);
};

describe("model manifest", () => {
  it("has the hero sedan at a plausible car length", () => {
    expect(hasModel("car-kit/sedan-sports")).toBe(true);
    const [w, , l] = size("car-kit/sedan-sports");
    expect(l).toBeGreaterThanOrEqual(4);
    expect(l).toBeLessThanOrEqual(4.6);
    expect(w).toBeLessThan(TILE / 2); // fits one lane of a road tile
  });

  it("makes a city road tile one TILE wide", () => {
    const [w, , d] = size("city-roads/road-straight");
    expect(w).toBeCloseTo(TILE, 1);
    expect(d).toBeCloseTo(TILE, 1);
  });

  it("puts racing tiles on the same grid, centred on the origin", () => {
    const { min, max } = getModel("racing-kit/roadStraight");
    expect(max[0] - min[0]).toBeCloseTo(TILE, 1);
    expect(min[0]).toBeCloseTo(-TILE / 2, 1);
    expect(min[2]).toBeCloseTo(-TILE / 2, 1);
  });

  it("scales people to roughly human height", () => {
    const [, h] = size("mini-characters/character-male-a");
    expect(h).toBeGreaterThan(1.5);
    expect(h).toBeLessThan(2);
  });

  it("serves every model from /models/ and the file exists", () => {
    const refs = Object.keys(MODELS);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const m = MODELS[ref];
      expect(m.ref).toBe(ref);
      expect(m.url.startsWith(`/models/${m.kit}/`)).toBe(true);
      expect(existsSync(path.join(PUBLIC, m.url)), m.url).toBe(true);
      expect(KITS[m.kit], `kit of ${ref}`).toBeDefined();
    }
  });

  it("ships the shared palette for every textured kit, with a positive scale", () => {
    for (const kit of Object.values(KITS)) {
      expect(kit.scale).toBeGreaterThan(0);
      if (kit.texture) {
        expect(kit.texture).toBe(`/models/${kit.id}/colormap.webp`);
        expect(existsSync(path.join(PUBLIC, kit.texture)), kit.texture).toBe(true);
      }
    }
  });
});

describe("helpers", () => {
  it("throws clear errors for unknown refs and kits", () => {
    expect(hasModel("nope/nothing")).toBe(false);
    expect(() => getModel("nope/nothing")).toThrow(/Unknown model "nope\/nothing"/);
    expect(() => getKit("nope")).toThrow(/Unknown kit "nope"/);
    expect(() => listModels("nope")).toThrow(/Unknown kit/);
  });

  it("lists a kit's models sorted", () => {
    const list = listModels("car-kit");
    expect(list.length).toBeGreaterThan(10);
    expect(list.every((m) => m.kit === "car-kit")).toBe(true);
    expect(list.map((m) => m.ref)).toEqual([...list.map((m) => m.ref)].sort((a, b) => a.localeCompare(b)));
  });

  it("swaps the footprint on quarter turns", () => {
    const ref = "car-kit/sedan-sports";
    const f0 = footprint(ref, 0);
    const f1 = footprint(ref, 1);
    expect(f1.x).toBeCloseTo(f0.z, 6);
    expect(f1.z).toBeCloseTo(f0.x, 6);
    expect(footprint(ref, 2)).toEqual(f0);
  });

  it("rotates off-centre bounds counter-clockwise (+X goes to -Z)", () => {
    // racing-kit/roadCornerLarge extends from the base cell towards +X and -Z.
    const ref = "racing-kit/roadCornerLarge";
    const b0 = rotatedBounds(ref, 0);
    const b1 = rotatedBounds(ref, 1);
    expect(b1.min[2]).toBeCloseTo(-b0.max[0], 6);
    expect(b1.max[0]).toBeCloseTo(b0.max[2], 6);
    const b2 = rotatedBounds(ref, 2);
    expect(b2.min[0]).toBeCloseTo(-b0.max[0], 6);
    expect(b2.max[2]).toBeCloseTo(-b0.min[2], 6);
  });
});
