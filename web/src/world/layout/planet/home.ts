// Biome layout: home — "Hometown Meadow" (biome agent A).
//
// Gentle green hills around a small suburban core. A paved road loop links the family house (west),
// the UFCG campus with its skate park (north) and the first office (east); the CV billboard stands
// at the south exit. Outside the core pad the meadow is left natural: woods, rocks, flowers and a few
// earthen kickers along the trails.
//
//                 N
//        trees    UFCG campus      skate
//               [hall][lab][hall]   park
//                 ufcg  ufcg-monitor
//      ┌──────────── road loop ───────────┐
//  house about   lawn + trees      proj4me  office
//      └──────────────────────────────────┘
//   contact plaza    spawn ↑      cv  [billboard]
//                 S
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { BIOMES } from "@/world/planet/biomes";
import { author } from "./a/kit";

/** Road tiles are flat squares on a curved surface: 2 % oversize hides the hairline seams. */
const ROAD_SCALE = 1.02;

const CENTER = BIOMES.find((b) => b.id === "home")!.center;
const { at, place, placeC, marker } = author(CENTER);

// --- Road loop: corners at (±16, ±16), straights between (8 m city tiles) -----------------------
const R = 16;
const road: PlanetPlacement[] = [
  // road-bend at yaw 0 joins its north and east sides
  place(-R, -R, { model: "city-roads/road-bend", yaw: 0, scale: ROAD_SCALE }),
  place(-R, R, { model: "city-roads/road-bend", yaw: 90, scale: ROAD_SCALE }),
  place(R, R, { model: "city-roads/road-bend", yaw: 180, scale: ROAD_SCALE }),
  place(R, -R, { model: "city-roads/road-bend", yaw: -90, scale: ROAD_SCALE }),
];
for (const k of [-8, 0, 8]) {
  // road-straight runs along the model's X axis, which is E-W at yaw 0
  road.push(place(-R, k, { model: "city-roads/road-straight", scale: ROAD_SCALE })); // south row (E-W)
  road.push(place(R, k, { model: "city-roads/road-straight", scale: ROAD_SCALE })); // north row
  road.push(place(k, -R, { model: "city-roads/road-straight", yaw: 90, scale: ROAD_SCALE })); // west column (N-S)
  road.push(place(k, R, { model: "city-roads/road-straight", yaw: 90, scale: ROAD_SCALE })); // east column
}

// --- The family house (About me) with its garden, west of the loop -----------------------------
const house: PlanetPlacement[] = [
  place(0, -34, { model: "city-suburban/building-type-c", yaw: -90 }), // front faces east, to the road
  place(0, -25, { model: "city-suburban/driveway-long", yaw: 90 }),
  place(0, -28.5, { model: "city-suburban/path-long", yaw: 90 }),
  // garden on the south side: low fence, planters, a big tree
  place(-10, -34, { model: "city-suburban/fence-2x3", yaw: -90 }),
  place(-9, -31, { model: "city-suburban/planter", yaw: -90 }),
  place(-11, -36, { model: "platformer-kit/flowers" }),
  place(-12, -32, { model: "platformer-kit/flowers" }),
  place(9, -36, { model: "city-suburban/tree-large", yaw: 30 }),
  place(9, -30, { model: "city-suburban/planter", yaw: -90 }),
  place(-7, -41, { model: "city-suburban/tree-small" }),
  place(6, -42, { model: "city-suburban/tree-small", yaw: 70 }),
  // the neighbours
  place(15, -38, { model: "city-suburban/building-type-h", yaw: -90 }),
  place(-24, -40, { model: "city-suburban/building-type-p", yaw: -45 }),
  place(4, -24, { model: "mini-characters/character-female-b", yaw: 90, anim: "emote-yes" }),
];

// --- Contact: a little neighbourhood plaza south of the house ----------------------------------
const plaza: PlanetPlacement[] = [
  place(-26, -27, { model: "city-commercial/detail-parasol-a" }),
  place(-29, -22, { model: "city-commercial/detail-parasol-a" }),
  place(-28, -30, { model: "mini-skate/bench", yaw: 45 }),
  place(-31, -25, { model: "mini-skate/bench", yaw: 30 }),
  place(-21.5, -28, { model: "platformer-kit/sign", yaw: 60 }),
  place(-32, -30, { model: "city-suburban/tree-large", yaw: 10 }),
  place(-27, -33, { model: "platformer-kit/flowers" }),
  place(-29, -27, { model: "mini-characters/character-male-c", yaw: 45, anim: "sit" }),
];

// --- UFCG campus (north): three commercial halls around a lawn, plus a mini skate park ---------
const campus: PlanetPlacement[] = [
  place(35, 0, { model: "city-commercial/building-k", yaw: 180 }), // main hall, front faces south
  place(33, -16, { model: "city-commercial/building-f", yaw: 180 }),
  place(33, 13, { model: "city-commercial/building-h", yaw: 180 }),
  place(30.5, -6, { model: "city-commercial/detail-awning-wide", y: 3.2, yaw: 180 }),
  // paths and the quad
  place(26, 0, { model: "city-suburban/path-long" }),
  place(22.5, 0, { model: "city-suburban/path-long" }),
  place(27, -24, { model: "city-suburban/tree-large", yaw: 15 }),
  place(23, 21, { model: "city-suburban/tree-large", yaw: 80 }),
  place(23, -26, { model: "city-suburban/tree-small" }),
  place(24, 6, { model: "mini-skate/bench", yaw: 180 }),
  place(27.5, -4, { model: "mini-characters/character-male-a", yaw: 200 }),
  place(27.5, 6.5, { model: "mini-characters/character-female-d", yaw: 160, anim: "interact-right" }),
];

// --- Campus skate park (north-east) ------------------------------------------------------------
const skate: PlanetPlacement[] = [
  place(30, 30, { model: "mini-skate/half-pipe", yaw: 90, scale: 1.6 }),
  place(30, 34, { model: "mini-skate/half-pipe", yaw: -90, scale: 1.6 }),
  place(24, 30, { model: "mini-skate/ramp", yaw: 180, scale: 1.6 }),
  place(24, 36, { model: "mini-skate/ramp", scale: 1.6 }),
  place(36, 26, { model: "mini-skate/rail-high", yaw: 90, scale: 1.4 }),
  place(36, 36, { model: "mini-skate/rail-high", yaw: 180, scale: 1.4 }),
  place(22, 26, { model: "mini-skate/character-skate-girl", yaw: 30 }),
  place(27, 38, { model: "mini-skate/character-skate-boy", yaw: -60 }),
];

// --- proj4me: the first small office, east of the loop -----------------------------------------
const office: PlanetPlacement[] = [
  place(0, 34, { model: "city-commercial/building-c", yaw: 90 }), // front faces west
  place(-7, 34, { model: "city-suburban/fence-2x3", yaw: 90 }),
  place(7, 31, { model: "city-suburban/planter", yaw: 90 }),
  place(-5, 29, { model: "mini-skate/bench", yaw: 90 }),
  place(9, 38, { model: "city-suburban/tree-small", yaw: 20 }),
  place(4, 27.5, { model: "mini-characters/character-male-a", yaw: -100 }),
];

// --- CV billboard by the south exit ------------------------------------------------------------
const billboard: PlanetPlacement[] = [
  placeC(-32, 2, { model: "racing-kit/billboard", yaw: 0 }),
  place(-27, -6, { model: "city-suburban/path-long" }),
  place(-30, 10, { model: "city-suburban/tree-small", yaw: 50 }),
];

// --- Inside the loop: a lawn with corner trees -------------------------------------------------
const lawn: PlanetPlacement[] = [
  place(7, -7, { model: "city-suburban/tree-large" }),
  place(7, 7, { model: "city-suburban/tree-small", yaw: 40 }),
  place(-7, 8, { model: "platformer-kit/flowers" }),
  place(-8, -8, { model: "platformer-kit/flowers" }),
];

// --- The wilds: woods, rocks and earthen kickers (natural terrain between) ---------------------
const wilds: PlanetPlacement[] = [
  // north-west forest
  place(52, -30, { model: "mini-forest/tree-high" }),
  place(56, -22, { model: "mini-forest/tree" }),
  place(48, -40, { model: "platformer-kit/tree" }),
  place(60, -36, { model: "mini-forest/tree-high", yaw: 50 }),
  place(44, -50, { model: "platformer-kit/tree-pine" }),
  place(54, -48, { model: "mini-forest/tree" }),
  place(62, -14, { model: "platformer-kit/tree", yaw: 120 }),
  place(50, -14, { model: "mini-forest/rocks-low", scale: 1.4 }),
  place(42, -24, { model: "mini-characters/character-female-d", yaw: -60 }),
  // west meadow
  place(10, -56, { model: "platformer-kit/tree-pine" }),
  place(-4, -58, { model: "platformer-kit/tree-pine", scale: 0.7 }),
  place(20, -60, { model: "mini-forest/tree" }),
  place(-14, -52, { model: "mini-forest/stones", scale: 1.6 }),
  place(-20, -60, { model: "platformer-kit/tree", yaw: 30 }),
  place(0, -50, { model: "platformer-kit/flowers" }),
  // south-west woods
  place(-46, -30, { model: "mini-forest/tree-high" }),
  place(-52, -20, { model: "platformer-kit/tree" }),
  place(-40, -44, { model: "mini-forest/tree", yaw: 90 }),
  place(-56, -36, { model: "platformer-kit/tree-pine" }),
  place(-48, -8, { model: "mini-forest/rocks-low", scale: 1.6, yaw: 45 }),
  place(-44, 14, { model: "platformer-kit/tree-pine", scale: 0.7 }),
  // north-east
  place(54, 18, { model: "platformer-kit/tree" }),
  place(48, 44, { model: "mini-forest/tree-high", yaw: 20 }),
  place(58, 32, { model: "platformer-kit/tree-pine" }),
  place(44, 54, { model: "mini-forest/rocks-low", scale: 1.5 }),
  // east meadow
  place(24, 54, { model: "platformer-kit/tree", yaw: 200 }),
  place(10, 58, { model: "mini-forest/tree" }),
  place(-12, 52, { model: "platformer-kit/tree-pine", scale: 0.7 }),
  place(2, 48, { model: "platformer-kit/flowers", scale: 1.5 }),
  place(16, 46, { model: "mini-forest/stones", scale: 1.5 }),
  // flags at the kickers
  place(-38, 26, { model: "mini-forest/flag", scale: 1.4 }),
  place(47, 3, { model: "mini-forest/flag", scale: 1.4, yaw: 90 }),
];

export const homeLayout: BiomeLayout = {
  biome: "home",
  // On the south road, looking north across the lawn at the campus
  spawn: { ...at(-16, -4), yaw: 0 },
  pads: [
    // the town core: road loop, house, plaza, campus, office, billboard
    { ...at(2, 0), radius: 42, blend: 12 },
    // earthen kickers out in the meadow
    { ...at(-40, 30), radius: 3, blend: 5, height: 1.4 },
    { ...at(47, 8), radius: 3, blend: 5, height: 1.2 },
    { ...at(-30, -52), radius: 3.5, blend: 6, height: 1.6 },
    { ...at(30, 52), radius: 4, blend: 6, height: 1.8 },
    // a soft bowl in the west meadow
    { ...at(14, -54), radius: 5, blend: 6, height: -1.5 },
  ],
  markers: [
    marker(0, -21, { id: "about", kind: "about", label: "About me" }),
    marker(-22, -23, { id: "contact", kind: "contact", label: "Contact" }),
    marker(-25, 2, { id: "cv", kind: "cv", label: "Download CV" }),
    marker(24, -9, { id: "ufcg", kind: "job", label: "UFCG · Computer Science" }),
    marker(23, 13, { id: "ufcg-monitor", kind: "job", label: "UFCG · Teaching assistant" }),
    marker(0, 25, { id: "proj4me", kind: "job", label: "proj4me · First office" }),
  ],
  placements: [...road, ...house, ...plaza, ...campus, ...skate, ...office, ...billboard, ...lawn, ...wilds],
};
