import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { SKID, SkidTrails } from "./skidMarks";

const UP = new Vector3(0, 1, 0);
const at = (z: number, x = 0) => new Vector3(x, 100, z);

describe("skid trails", () => {
  it("writes one quad per segment length while sliding, lifted along local up, width across travel", () => {
    const t = new SkidTrails(8, 1);
    expect(t.addPoint(0, at(0), UP, 1, true, 1)).toBe(false); // first point only starts the ribbon
    expect(t.addPoint(0, at(SKID.segmentLength / 2), UP, 1, true, 1)).toBe(false);
    expect(t.addPoint(0, at(SKID.segmentLength * 1.1), UP, 1, true, 2)).toBe(true);
    const p = t.positions;
    // 4 verts: prev left/right, new left/right; all at y = 100 + lift; x = ±halfWidth
    for (let k = 0; k < 4; k++) expect(p[k * 3 + 1]).toBeCloseTo(100 + SKID.lift);
    expect(Math.abs(p[0])).toBeCloseTo(SKID.halfWidth);
    expect(p[0]).toBeCloseTo(-p[3]);
    expect(t.birthAlpha[0]).toBe(2);
    expect(t.birthAlpha[1]).toBeCloseTo(SKID.maxAlpha);
  });

  it("consecutive quads share edges (a continuous ribbon)", () => {
    const t = new SkidTrails(8, 1);
    t.addPoint(0, at(0), UP, 1, true, 0);
    t.addPoint(0, at(0.4), UP, 1, true, 0);
    t.addPoint(0, at(0.8), UP, 1, true, 0);
    const p = t.positions;
    // quad 1's "previous" edge = quad 0's "new" edge
    for (let k = 0; k < 6; k++) expect(p[12 + k]).toBeCloseTo(p[6 + k]);
  });

  it("stopping the slide or a big jump breaks the ribbon", () => {
    const t = new SkidTrails(8, 1);
    t.addPoint(0, at(0), UP, 1, true, 0);
    t.addPoint(0, at(0.4), UP, 1, false, 0);
    expect(t.addPoint(0, at(0.8), UP, 1, true, 0)).toBe(false);
    expect(t.addPoint(0, at(0.8 + SKID.maxSegment * 2), UP, 1, true, 0)).toBe(false);
    expect(t.nextSlot).toBe(0);
  });

  it("is a ring buffer: wraps at the limit, overwriting the oldest quad", () => {
    const t = new SkidTrails(4, 1);
    t.setLimit(2);
    for (let i = 0; i <= 3; i++) t.addPoint(0, at(i * 0.4), UP, 0.5, true, i);
    expect(t.nextSlot).toBe(1);
    expect(t.birthAlpha[0]).toBe(3); // slot 0 rewritten by the third quad
    expect(t.geometry.drawRange.count).toBe(12);
  });

  it("upload only flags the written range", () => {
    const t = new SkidTrails(8, 1);
    t.addPoint(0, at(0), UP, 1, true, 0);
    t.addPoint(0, at(0.4), UP, 1, true, 0);
    t.addPoint(0, at(0.8), UP, 1, true, 0);
    t.upload();
    const pos = t.geometry.getAttribute("position") as unknown as { updateRanges: { start: number; count: number }[] };
    expect(pos.updateRanges).toEqual([{ start: 0, count: 24 }]);
  });
});
