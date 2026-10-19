import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { TILE, type Placement, type Rot } from "@/world/layout/types";
import { MODELS, rotatedBounds } from "@/world/models";
import {
  isGroundRef,
  localColliderBox,
  placementColliderBox,
  placementMatrix,
  placementPosition,
  resolveCollider,
  rotateQuarter,
  rotToYaw,
} from "./placement";

const at = (p: Partial<Placement> = {}): Placement => ({ model: "kit/thing", x: 0, z: 0, ...p });
const bounds = (min: [number, number, number], max: [number, number, number]) => ({ min, max });

describe("placement transform", () => {
  it("maps tile coordinates (origin + x/z) to metres", () => {
    expect(placementPosition({ x: 2, z: -1 }, at({ x: 1.5, z: 3, y: 0.25 }))).toEqual([3.5 * TILE, 0.25, 2 * TILE]);
  });

  it("rot is quarter turns counter-clockwise from above (+Z front turns to +X, then -Z, then -X)", () => {
    const fronts: Record<Rot, [number, number]> = { 0: [0, 1], 1: [1, 0], 2: [0, -1], 3: [-1, 0] };
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const m = placementMatrix({ x: 0, z: 0 }, at({ rot }), 1);
      const front = new Vector3(0, 0, 1).transformDirection(m);
      expect(front.x).toBeCloseTo(fronts[rot][0]);
      expect(front.z).toBeCloseTo(fronts[rot][1]);
      expect(rotToYaw(rot)).toBeCloseTo((rot * Math.PI) / 2);
    }
  });

  it("composes translate * rotate * (kitScale * scale)", () => {
    const m = placementMatrix({ x: 1, z: 0 }, at({ x: 0, z: 2, rot: 1, scale: 2, y: 1 }), 8);
    // A point 0.5 raw units in front of the model: 0.5 * 16 = 8 m, rotated to +X
    const p = new Vector3(0, 0, 0.5).applyMatrix4(m);
    expect(p.x).toBeCloseTo(1 * TILE + 8);
    expect(p.y).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(2 * TILE);
  });

  it("rotateQuarter agrees with a real rotation around +Y", () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const v = new Vector3(1.5, 0, -0.7).applyAxisAngle(new Vector3(0, 1, 0), rotToYaw(rot));
      const [x, z] = rotateQuarter(1.5, -0.7, rot);
      expect(x).toBeCloseTo(v.x);
      expect(z).toBeCloseTo(v.z);
    }
  });
});

describe("collider boxes", () => {
  it("centred box: half extents swap on odd quarter turns", () => {
    const b = bounds([-1, 0, -3], [1, 4, 3]);
    expect(placementColliderBox({ x: 0, z: 0 }, at({ rot: 0 }), b)).toEqual({ center: [0, 2, 0], halfExtents: [1, 2, 3] });
    const r1 = placementColliderBox({ x: 0, z: 0 }, at({ rot: 1 }), b);
    expect(r1.halfExtents).toEqual([3, 2, 1]);
    expect(r1.center[0]).toBeCloseTo(0);
    expect(r1.center[2]).toBeCloseTo(0);
  });

  it("off-centre box: centre rotates with the model and scale applies", () => {
    // Model extends towards +X / -Z from its origin
    const b = bounds([0, 0, -4], [4, 2, 0]);
    const box = placementColliderBox({ x: 1, z: 1 }, at({ rot: 1, scale: 0.5 }), b);
    // centre (1, 0.5, -1) rotated by +90 deg -> (-1, 0.5, -1); plus the tile at (8, 8)
    expect(box.center[0]).toBeCloseTo(TILE - 1);
    expect(box.center[1]).toBeCloseTo(0.5);
    expect(box.center[2]).toBeCloseTo(TILE - 1);
    expect(box.halfExtents).toEqual([1, 0.5, 1]);
  });

  it("matches the assets agent's rotatedBounds for real manifest models", () => {
    const refs = Object.keys(MODELS).slice(0, 40);
    for (const ref of refs) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const rb = rotatedBounds(ref, rot);
        const box = placementColliderBox({ x: 0, z: 0 }, { model: ref as Placement["model"], x: 0, z: 0, rot }, MODELS[ref]);
        for (const i of [0, 1, 2]) {
          expect(box.center[i] - box.halfExtents[i]).toBeCloseTo(rb.min[i], 5);
          expect(box.center[i] + box.halfExtents[i]).toBeCloseTo(rb.max[i], 5);
        }
      }
    }
  });

  it("local box for dynamic bodies", () => {
    expect(localColliderBox(bounds([-0.5, 0, -0.5], [0.5, 1, 0.5]), 2)).toEqual({
      center: [0, 1, 0],
      halfExtents: [1, 1, 1],
    });
  });
});

describe("collider rule", () => {
  const tall = bounds([-1, 0, -1], [1, 5, 1]);
  const flat = bounds([-4, 0, -4], [4, 0.16, 4]);

  it("explicit collider wins", () => {
    expect(resolveCollider(at({ model: "city-roads/road-straight", collider: "box" }), flat)).toBe("box");
    expect(resolveCollider(at({ model: "city-commercial/building-a", collider: "none" }), tall)).toBe("none");
  });

  it("roads and tiles are drive-through, even when tall", () => {
    expect(resolveCollider(at({ model: "city-roads/road-bend-barrier" }), tall)).toBe("none");
    expect(resolveCollider(at({ model: "platformer-kit/tile-large" }), tall)).toBe("none");
    expect(resolveCollider(at({ model: "racing-kit/roadStraight" }), tall)).toBe("none");
    expect(isGroundRef("city-roads/light-square")).toBe(false);
  });

  it("flat things are drive-through, everything else is a box", () => {
    expect(resolveCollider(at({ model: "city-suburban/path" }), flat)).toBe("none");
    expect(resolveCollider(at({ model: "city-commercial/building-a" }), tall)).toBe("box");
    // Scale counts: 0.2 m * 2 = 0.4 m is no longer flat
    expect(resolveCollider(at({ scale: 2 }), bounds([0, 0, 0], [1, 0.2, 1]))).toBe("box");
  });

  it("unknown models get no collider", () => {
    expect(resolveCollider(at(), undefined)).toBe("none");
  });
});
