// TEMPORARY integration sandbox (integration agent). Experience renders it only while PLANET_LAYOUTS
// is empty, so biome agents can delete this file once a real "home" layout exists.
// It doubles as a worked example of authoring on the sphere with offsetLatLon.
import { offsetLatLon } from "@/world/planet/frame";
import type { BiomeLayout, LatLon, PlanetPlacement } from "@/world/planet/types";

const CENTER: LatLon = { lat: 10, lon: 0 };

/** Point `north` metres north and `east` metres east of the sandbox centre (great-circle walk). */
function at(north: number, east: number): LatLon {
  // offsetLatLon yaw: 0 = north, 90 = west (counter-clockwise), -90 = east
  return offsetLatLon(offsetLatLon(CENTER, north, 0), east, -90);
}

const place = (north: number, east: number, rest: Omit<PlanetPlacement, "lat" | "lon">): PlanetPlacement => ({
  ...at(north, east),
  ...rest,
});

export const SANDBOX_LAYOUT: BiomeLayout = {
  biome: "home",
  spawn: { ...CENTER, yaw: 0 },
  pads: [{ ...CENTER, radius: 45, blend: 15 }],
  markers: [
    { ...at(22, 9), id: "about", kind: "about" },
    { ...at(40, -9), id: "speed-king", kind: "game" },
  ],
  placements: [
    // A road north from the spawn: flat pieces, drive-through (no collider)
    place(8, 0, { model: "city-roads/road-straight" }),
    place(16, 0, { model: "city-roads/road-straight" }),
    place(24, 0, { model: "city-roads/road-straight" }),
    place(32, 0, { model: "city-roads/road-straight" }),
    // Houses facing the road (yaw 90 = model front turned to the west, -90 = to the east)
    place(10, 16, { model: "city-suburban/building-type-a", yaw: 90 }),
    place(26, 17, { model: "city-suburban/building-type-c", yaw: 90 }),
    place(10, -16, { model: "city-suburban/building-type-f", yaw: -90 }),
    place(28, -17, { model: "city-suburban/building-type-a", yaw: -90 }),
    // Trees
    place(2, 10, { model: "city-suburban/tree-large" }),
    place(-6, -12, { model: "city-suburban/tree-large", yaw: 40 }),
    place(18, -26, { model: "city-suburban/tree-small" }),
    place(36, 24, { model: "city-suburban/tree-large", yaw: 120 }),
    place(46, -20, { model: "city-suburban/tree-small", scale: 1.3 }),
    place(-14, 20, { model: "city-suburban/tree-small" }),
    // Knock-over cones across the road end (dynamic bodies, pulled down by PlanetGravity)
    place(44, -3, { model: "car-kit/cone", body: "dynamic" }),
    place(44, -1, { model: "car-kit/cone", body: "dynamic" }),
    place(44, 1, { model: "car-kit/cone", body: "dynamic" }),
    place(44, 3, { model: "car-kit/cone", body: "dynamic" }),
    place(46, 0, { model: "car-kit/cone", body: "dynamic" }),
    // A waving local by the "About me" stop (skinned, plays its clip)
    place(24, 13, { model: "mini-characters/character-female-a", yaw: 120, anim: "idle" }),
  ],
};
