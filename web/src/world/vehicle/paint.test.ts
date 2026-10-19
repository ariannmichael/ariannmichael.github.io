import { describe, expect, it } from "vitest";
import { VEHICLE_PAINT, VEHICLE_PAINT_SWATCHES, hexToRgb, repaintSwatch, swatchPixels } from "./paint";

/** 8×8 RGBA image: a green vertical gradient everywhere */
function image(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) * 4;
      d.set([40, 120 + y * 10, 80, 255], i);
    }
  return d;
}

describe("vehicle paint", () => {
  it("parses the paint colour", () => {
    expect(hexToRgb(VEHICLE_PAINT)).toEqual([0xc8, 0x10, 0x2e]);
  });

  it("maps the SUV body to the green paint column and the roof part of the grey column (512 px palette)", () => {
    expect(VEHICLE_PAINT_SWATCHES.map((r) => swatchPixels(r, 512, 512))).toEqual([
      { x0: 224, x1: 256, y0: 128, y1: 256 },
      { x0: 224, x1: 256, y0: 256, y1: 320 },
    ]);
  });

  it("recolours only the swatch, keeping its shading gradient", () => {
    const d = image();
    const before = d.slice();
    const rect = { u0: 0.5, u1: 1, v0: 0, v1: 0.5 }; // x 4..7, y 0..3
    repaintSwatch(d, 8, 8, rect, [200, 16, 46]);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const i = (y * 8 + x) * 4;
        const inside = x >= 4 && y < 4;
        if (!inside) expect([...d.slice(i, i + 4)]).toEqual([...before.slice(i, i + 4)]);
        else {
          expect(d[i]).toBeGreaterThan(150); // red now
          expect(d[i + 1]).toBeLessThan(30);
          expect(d[i + 3]).toBe(255);
        }
      }
    // Darker rows stay darker
    expect(d[(0 * 8 + 4) * 4]).toBeLessThan(d[(3 * 8 + 4) * 4]);
  });
});
