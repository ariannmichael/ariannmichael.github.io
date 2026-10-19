// The player car's body paint. Kenney car-kit models share one palette texture (a grid of colour
// swatches), and the body paint is simply the triangles whose UVs sit in one swatch. To repaint only
// the player's car we copy the palette, recolour that one swatch, and give the car its own material:
// every other car-kit model (props, debris) keeps the shared palette material untouched.
import { CanvasTexture, DoubleSide, MeshStandardMaterial, type Texture } from "three";
import { configurePalette } from "@/world/town/materials";

/** Body paint colour of the player car */
export const VEHICLE_PAINT = "#c8102e";

/**
 * The palette regions (UV rectangles, glTF convention: v grows downwards from the image top) that
 * make up the body of VEHICLE_REF, each repainted on its own so it keeps its shading gradient.
 * car-kit/suv is two-tone:
 *  - its own paint, the green gradient column at u 0.4375–0.5, v 0.25–0.5 (doors, hood, flanks);
 *  - the cabin/roof, the top of the grey column every car-kit car shares (u 0.4375–0.5,
 *    v 0.5–0.625). From the chase camera the roof and tailgate are most of the car, so they go red
 *    too. The rest of that grey column (v ≥ 0.625: bumpers, wheel arches, underbody) stays grey.
 * Windows, tyres, lamps and the remaining trim use other swatches and keep their colours. Re-check
 * this if VEHICLE_REF changes (sedan-sports, for instance, paints with u 0.8125–0.875, v 0.25–0.5).
 */
export const VEHICLE_PAINT_SWATCHES = [
  { u0: 0.4375, u1: 0.5, v0: 0.25, v1: 0.5 },
  { u0: 0.4375, u1: 0.5, v0: 0.5, v1: 0.625 },
] as const;

export interface UvRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** Pixel bounds [x0, x1) × [y0, y1) of a UV rectangle on a width × height image. */
export function swatchPixels(rect: UvRect, width: number, height: number) {
  return {
    x0: Math.round(rect.u0 * width),
    x1: Math.round(rect.u1 * width),
    y0: Math.round(rect.v0 * height),
    y1: Math.round(rect.v1 * height),
  };
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Recolour one swatch of RGBA pixel data in place: every pixel becomes `rgb` scaled by its brightness
 * relative to the swatch's average, so the swatch's built-in shading gradient survives in the new hue
 * (the average pixel comes out exactly `rgb`).
 */
export function repaintSwatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rect: UvRect,
  rgb: readonly [number, number, number],
): void {
  const { x0, x1, y0, y1 } = swatchPixels(rect, width, height);
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      sum += luma(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  const mean = n > 0 ? sum / n : 0;
  if (mean <= 0) return;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const k = luma(data[i], data[i + 1], data[i + 2]) / mean;
      data[i] = rgb[0] * k;
      data[i + 1] = rgb[1] * k;
      data[i + 2] = rgb[2] * k;
    }
}

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * A material for the player car only: the kit palette with the paint swatch repainted VEHICLE_PAINT.
 * Same settings as the shared palette material (town/materials paletteMaterial). The caller owns it
 * and disposes it (and its map). Falls back to null when the image can't be read into a canvas.
 */
export function paintedCarMaterial(palette: Texture): MeshStandardMaterial | null {
  const image = palette.image as CanvasImageSource & { width: number; height: number };
  if (typeof document === "undefined" || !image?.width || !image?.height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = hexToRgb(VEHICLE_PAINT);
  for (const rect of VEHICLE_PAINT_SWATCHES) repaintSwatch(pixels.data, canvas.width, canvas.height, rect, rgb);
  ctx.putImageData(pixels, 0, 0);

  const map = configurePalette(new CanvasTexture(canvas));
  const material = new MeshStandardMaterial({
    map,
    // A touch glossier than the town's matte palette: it reads as car paint
    roughness: 0.6,
    metalness: 0.1,
    side: DoubleSide,
  });
  material.name = "vehicle-paint";
  return material;
}
