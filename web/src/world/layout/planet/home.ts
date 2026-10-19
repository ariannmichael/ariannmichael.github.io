// Biome layout: home — "Hometown Meadow" (biome agent A).
//
// A small suburban core on the 90 m planet (everything within 40 m of the centre). A paved road loop
// links the family house (west), the UFCG campus with its skate park (north) and the first office
// (east); the CV billboard stands at the south exit. The spawn sits on the lawn inside the loop and
// two lanes run out from it, south-west (to Alien Crater) and south-east (to Speed King Canyon), where
// the roads leave town: nothing taller than a kerb stands in them.
//
//                       N
//        [hall f]    [ UFCG hall k ]       skate
//             ufcg ●    quad      ● ufcg-monitor  park
//                ┌──────── road loop ────────┐
//  house  ●about │ lawn  spawn ↑             │ ● proj4me [office]
//  contact ●     └────────────────────────────┘
//    plaza    ↙ lane       ● cv        lane ↘
//                       [billboard]
//                       S
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { BIOMES } from "@/world/planet/biomes";
import { author } from "./a/kit";

/** Road tiles are flat squares on a curved surface: 2 % oversize hides the hairline seams. */
const ROAD_SCALE = 1.02;

const CENTER = BIOMES.find((b) => b.id === "home")!.center;
const { at, place, placeC, marker, spawn } = author(CENTER);

// --- Road loop: corners at (±12, ±12), straights between (8 m city tiles) -----------------------
const R = 12;
const road: PlanetPlacement[] = [
  // road-bend at yaw 0 joins its north and east sides. The two south corners are T junctions where
  // the roads to Alien Crater and Speed King Canyon leave town (layout/planet/roadHubs.ts)
  place(R, R, { model: "city-roads/road-bend", yaw: 180, scale: ROAD_SCALE }),
  place(R, -R, { model: "city-roads/road-bend", yaw: -90, scale: ROAD_SCALE }),
];
for (const k of [-4, 4]) {
  // road-straight runs along the model's X axis, which is E-W at yaw 0
  road.push(place(-R, k, { model: "city-roads/road-straight", scale: ROAD_SCALE })); // south row (E-W)
  road.push(place(R, k, { model: "city-roads/road-straight", scale: ROAD_SCALE })); // north row
  road.push(place(k, -R, { model: "city-roads/road-straight", yaw: 90, scale: ROAD_SCALE })); // west column (N-S)
  road.push(place(k, R, { model: "city-roads/road-straight", yaw: 90, scale: ROAD_SCALE })); // east column
}

// --- The family house (About me) with its garden, west of the loop -----------------------------
const house: PlanetPlacement[] = [
  place(2, -30, { model: "city-suburban/building-type-c", yaw: -90, y: -0.25 }), // front (e −25.9) faces east, to the road
  place(2, -18, { model: "city-suburban/driveway-long", yaw: 90 }),
  place(2, -22.5, { model: "city-suburban/path-long", yaw: 90 }),
  // garden trees behind the house (the open lawn in front stays clear to drive round)
  place(10, -34, { model: "city-suburban/tree-large", yaw: 30 }),
  place(-1, -37, { model: "city-suburban/tree-small", yaw: 70 }),
  place(5, -23, { model: "mini-characters/character-female-b", yaw: 90, anim: "emote-yes" }),
];

// --- Contact: a little neighbourhood plaza south-west of the house -----------------------------
// One table and one bench at the plaza's far (south-west) edge, so the marker stays an open square.
const plaza: PlanetPlacement[] = [
  place(-20, -28, { model: "city-commercial/detail-parasol-a" }),
  place(-22.5, -23.5, { model: "mini-skate/bench", yaw: 60 }),
  place(-9.5, -20.5, { model: "platformer-kit/sign", yaw: 60 }),
  place(-24, -29.5, { model: "city-suburban/tree-large", yaw: 10 }),
  place(-21.5, -25.5, { model: "mini-characters/character-male-c", yaw: 45, anim: "sit" }),
];

// --- UFCG campus (north): two commercial halls around a quad (7 m+ apart), plus a mini skate park
// The main hall is 16.7 m wide: it stands on the tangent plane of its own planar pad.
const HALL = at(30, 0);
const campus: PlanetPlacement[] = [
  place(30, 0, { model: "city-commercial/building-k", yaw: 180, plane: HALL }), // main hall, front faces south
  place(28, -19, { model: "city-commercial/building-f", yaw: 180, y: -0.3 }),
  place(27.05, -5, { model: "city-commercial/detail-awning-wide", y: 3.2, yaw: 180, plane: HALL }), // against the hall front (n 26.2)
  // paths and the quad
  place(23.5, 0, { model: "city-suburban/path-long", plane: HALL }),
  place(20, 0, { model: "city-suburban/path-long", y: -0.1 }),
  place(21.5, 5, { model: "mini-skate/bench", yaw: 180 }),
  place(22.5, -3, { model: "mini-characters/character-male-a", yaw: 200 }),
  place(23, 3, { model: "mini-characters/character-female-d", yaw: 160, anim: "interact-right" }),
];

// --- Campus skate park (north-east) ------------------------------------------------------------
const SK = 1.4;
const skate: PlanetPlacement[] = [
  place(22, 21, { model: "mini-skate/half-pipe", yaw: 90, scale: SK }),
  place(22, 25, { model: "mini-skate/half-pipe", yaw: -90, scale: SK }),
  place(17, 21, { model: "mini-skate/ramp", yaw: 180, scale: SK }),
  place(17, 26, { model: "mini-skate/ramp", scale: SK }),
  place(26.5, 22.5, { model: "mini-skate/rail-high", yaw: 90, scale: 1.3 }),
  place(15.5, 18.5, { model: "mini-skate/character-skate-girl", yaw: 30 }),
  place(20, 29, { model: "mini-skate/character-skate-boy", yaw: -60 }),
];

// --- proj4me: the first small office, east of the loop -----------------------------------------
const office: PlanetPlacement[] = [
  place(0, 28, { model: "city-commercial/building-c", yaw: 90, y: -0.2 }), // front (e 23.6) faces west
  place(-6, 25, { model: "mini-skate/bench", yaw: 90 }),
  place(7, 33, { model: "city-suburban/tree-small", yaw: 20 }),
  place(3.5, 22, { model: "mini-characters/character-male-a", yaw: -100 }),
];

// --- CV billboard by the south exit, facing north into town ------------------------------------
const billboard: PlanetPlacement[] = [
  placeC(-31, 0, { model: "racing-kit/billboard", yaw: 0, y: -0.2 }),
  place(-18, 0, { model: "city-suburban/path-long" }),
];

// --- Inside the loop: an open lawn (the spawn) with two trees on its north side -----------------
const lawn: PlanetPlacement[] = [
  place(4, -5.5, { model: "city-suburban/tree-large" }),
  place(4.5, 5.5, { model: "city-suburban/tree-small", yaw: 40 }),
];

// --- The edge of the meadow: a few trees, rocks and two earthen kickers ------------------------
const wilds: PlanetPlacement[] = [
  place(22, -30, { model: "mini-forest/tree-high" }),
  place(31, -22, { model: "mini-forest/tree", yaw: 50 }),
  place(10, -36.5, { model: "platformer-kit/tree-pine", scale: 0.7 }),
  place(14, 35, { model: "mini-forest/tree" }),
  place(33, 14, { model: "mini-forest/tree-high", yaw: 20 }),
  place(-14, 34, { model: "mini-forest/tree-high" }),
  place(3, 37, { model: "mini-forest/rocks-low", scale: 1.2 }),
  place(-23, 21, { model: "platformer-kit/flowers" }),
  // flags at the kickers
  place(21, -16, { model: "mini-forest/flag", scale: 1.4, yaw: 90 }),
  place(-19.5, 29.5, { model: "mini-forest/flag", scale: 1.4 }),
];

export const homeLayout: BiomeLayout = {
  biome: "home",
  // On the lawn inside the loop, looking north across it at the campus
  spawn: spawn(-6, 0, 0),
  pads: [
    // the town core: road loop, house, plaza, campus, office, billboard
    { ...at(0, 0), radius: 37.5, blend: 8 },
    // the main campus hall's planar floor, level with the core
    { ...HALL, radius: 9.5, blend: 5, planar: true, height: -0.37 },
    // earthen kickers at the meadow's edge, 1.3 m and 1.5 m above the core. A pad's `height` is
    // relative to the natural ground at its own centre, so these are tuned (home.test.ts pins them)
    { ...at(21, -20), radius: 2.5, blend: 5, height: 4.64 },
    { ...at(-16, 27), radius: 3, blend: 5, height: 1.96 },
  ],
  markers: [
    marker(2, -20, { id: "about", kind: "about", label: "About me" }),
    marker(-14, -22, { id: "contact", kind: "contact", label: "Contact" }),
    marker(-23, 0, { id: "cv", kind: "cv", label: "Download CV" }),
    marker(19, -8, { id: "ufcg", kind: "job", label: "UFCG · Computer Science" }),
    marker(19, 8, { id: "ufcg-monitor", kind: "job", label: "UFCG · Teaching assistant" }),
    marker(0, 19.5, { id: "proj4me", kind: "job", label: "proj4me · First office" }),
  ],
  placements: [...road, ...house, ...plaza, ...campus, ...skate, ...office, ...billboard, ...lawn, ...wilds],
};
