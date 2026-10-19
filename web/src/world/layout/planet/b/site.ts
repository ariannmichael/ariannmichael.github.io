// Authoring frame for biome agent B (healthcare, financial, opensource).
//
// Why not author.ts `grid()`: it walks north then east, and "yaw" stays relative to the *local*
// north at each point. Near the poles (the Alien Crater sits at lat 70) meridians converge fast, so
// a building 20 m east of the anchor would be turned ~20° compared with one at the anchor, and
// straight walls would twist. Here every point is a single great-circle walk from the anchor
// (the exponential map of the anchor's tangent plane), and every yaw is given in the *anchor's*
// frame and converted to the local frame at the point. Composite pieces (halls, corridors) stay
// straight and square.
//
// Pure maths only, via planet/sphere.ts (no terrain import), so it is safe at module top level.
import { degToMetres, headingAt, latLonToDir, offsetLatLon, surfaceFrame } from "@/world/planet/sphere";
import type { FlatPad, LatLon, PlanetMarker, PlanetPlacement } from "@/world/planet/types";

const DEG = Math.PI / 180;

type PlacementRest = Omit<PlanetPlacement, "lat" | "lon">;
type MarkerRest = Omit<PlanetMarker, "lat" | "lon">;
type PadRest = Omit<FlatPad, "lat" | "lon" | "radius">;

/** A rotated sub-frame: `fwd` metres along its heading, `right` metres to the right of it. */
export interface SubFrame {
  /** Anchor-frame (north, east) of a local point */
  ne(fwd: number, right: number): [number, number];
  /** Placement at a local point; `yaw` is relative to the sub-frame heading (0 = model faces fwd) */
  place(fwd: number, right: number, rest: PlacementRest): PlanetPlacement;
  /** Heading of the sub-frame in the anchor frame, degrees */
  yaw: number;
  /** Tangent-plane anchor (the sub-frame origin) when the frame is planar; every `place` stands on it */
  plane?: LatLon;
}

export function site(anchor: LatLon) {
  const anchorFrame = surfaceFrame(latLonToDir(anchor.lat, anchor.lon));

  /** Point `north`/`east` metres from the anchor, measured in the anchor's tangent plane. */
  const at = (north: number, east: number): LatLon => {
    const d = Math.hypot(north, east);
    if (d < 1e-6) return { lat: anchor.lat, lon: anchor.lon };
    // Heading yaw for the direction (north, east): (cos y, -sin y) = (n, e) / d
    return offsetLatLon(anchor, d, Math.atan2(-east, north) / DEG);
  };

  /** Converts a yaw in the anchor frame into the local yaw at `p` (projected heading). */
  const localYaw = (p: LatLon, yaw: number): number => {
    const h = headingAt(anchorFrame, yaw);
    const f = surfaceFrame(latLonToDir(p.lat, p.lon));
    return Math.atan2(-h.dot(f.east), h.dot(f.north)) / DEG;
  };

  const place = (north: number, east: number, rest: PlacementRest): PlanetPlacement => {
    const p = at(north, east);
    return { ...p, ...rest, yaw: localYaw(p, rest.yaw ?? 0) };
  };

  const marker = (north: number, east: number, rest: MarkerRest): PlanetMarker => ({ ...at(north, east), ...rest });

  const pad = (north: number, east: number, radius: number, rest: PadRest = {}): FlatPad => ({
    ...at(north, east),
    radius,
    ...rest,
  });

  /** Inverse of `at`: anchor-frame (north, east) metres of a lat/lon. */
  const toNE = (p: LatLon): [number, number] => {
    const d = latLonToDir(p.lat, p.lon);
    const up = anchorFrame.up;
    const t = d.clone().addScaledVector(up, -d.dot(up));
    const len = t.length();
    if (len < 1e-12) return [0, 0];
    const k = degToMetres(Math.acos(Math.min(1, d.dot(up))) * (180 / Math.PI)) / len;
    return [t.dot(anchorFrame.north) * k, t.dot(anchorFrame.east) * k];
  };

  const spawn = (north: number, east: number, yaw: number) => {
    const p = at(north, east);
    return { ...p, yaw: localYaw(p, yaw) };
  };

  /**
   * Rotated sub-frame whose origin is at (north, east) and whose heading is `yaw` (anchor frame).
   * `planar`: every piece placed through it stands on the tangent plane at the origin (pair it with a
   * `planar` pad centred on the origin), so modular walls and floors stay square on the small planet.
   * `planeAt`: the plane's anchor in sub-frame (fwd, right) metres, when the pad is not centred on the origin.
   */
  const frame = (
    north: number,
    east: number,
    yaw: number,
    opts: { planar?: boolean; planeAt?: [number, number] } = {},
  ): SubFrame => {
    const c = Math.cos(yaw * DEG);
    const s = Math.sin(yaw * DEG);
    // Heading yaw → (n, e) = (cos, -sin); its right-hand side (yaw - 90) → (sin, cos)
    const ne = (fwd: number, right: number): [number, number] => [north + fwd * c + right * s, east - fwd * s + right * c];
    const plane = opts.planeAt ? at(...ne(...opts.planeAt)) : opts.planar ? at(north, east) : undefined;
    return {
      yaw,
      ne,
      plane,
      place: (fwd, right, rest) => {
        const [n, e] = ne(fwd, right);
        return place(n, e, { ...(plane ? { plane } : {}), ...rest, yaw: yaw + (rest.yaw ?? 0) });
      },
    };
  };

  return { at, toNE, place, marker, pad, spawn, frame };
}
