// Speed King Raceway: the launch centrepiece, east of the roundabout. A closed Racing Kit circuit
// (two long straights joined by large corners) with the start/finish on the west straight, facing
// the town. Two access roads join it: the roundabout's east arm (a T on the main straight) and the
// end of the avenue (a T on the south straight). Authored in town tile coordinates (see helpers.ts).
import type { DistrictLayout, Marker, Placement } from "@/world/layout/types";
import type { ModelRef } from "@/world/layout/types";
import { authored, centredAt, cityRun, flat, put, raceRun, row } from "./helpers";

const ORIGIN = { x: 12, z: 0 };

// Circuit lanes: west straight x = 8, east straight x = 16, north straight z = -13, south z = 13
const W = 8;
const E = 16;
const N = -13;
const S = 13;

const circuit: Placement[] = [
  // Corners (roadCornerLarge is 2x2 tiles: enters S at its base, leaves E one tile up and over)
  flat("racing-kit/roadCornerLarge", W, N + 1, 0),
  flat("racing-kit/roadCornerLarge", E - 1, N, 3),
  flat("racing-kit/roadCornerLarge", E, S - 1, 2),
  flat("racing-kit/roadCornerLarge", W + 1, S, 1),
  // North and south straights (along X)
  ...raceRun("x", N, W + 2, E - 2),
  ...raceRun("x", S, W + 2, E - 2, [11]),
  flat("racing-kit/roadSplitSmall", 11, S, 3),
  // East straight
  ...raceRun("z", E, N + 2, S - 2),
  // West straight: start gantry (line at z = -3.5), grid behind it, and the T from the town
  ...raceRun("z", W, N + 2, S - 2, [-4, -3, -2, -1, 0]),
  flat("racing-kit/roadStart", W, -3, 0),
  flat("racing-kit/roadStartPositions", W, -1, 0),
  flat("racing-kit/roadSplitSmall", W, 0, 2),
];

const access: Placement[] = [
  // From the roundabout's east arm
  ...cityRun("x", 0, 6, 7),
  // From the end of the avenue, along z = 15 and up into the south straight
  ...cityRun("x", 15, 6, 10),
  flat("city-roads/road-bend", 11, 15, 3),
  flat("racing-kit/roadStraight", 11, 14, 0),
];

// Start/finish: the big billboard faces the town (and the access road), flags on the line
const startFinish: Placement[] = [
  put("racing-kit/billboardDouble_exclusive", 6.8, -3, 1),
  put("racing-kit/flagCheckers", W - 0.15, -4, 0),
  put("racing-kit/flagCheckers", W + 0.15, -3, 2),
  centredAt("racing-kit/bannerTowerRed", 7.2, 1.2, 0),
  centredAt("racing-kit/bannerTowerGreen", 9.6, 1.5, 2),
  put("mini-characters/character-male-b", 6.6, -4.4, 1),
  put("mini-characters/character-female-d", 6.75, -1.7, 1),
];

// Overhead light gantries are drive-through: their bounding box spans the whole road
const overhead = (x: number, z: number): Placement =>
  put("racing-kit/overheadLights", x, z, 0, { collider: "none" });

const trackside: Placement[] = [
  // Grandstands between the town and the main straight, facing the track (+X)
  ...[-11, -10, -7, -6].map((z) => put("racing-kit/grandStand", 6.9, z, 1)),
  ...[-9, -8].map((z) => put("racing-kit/grandStandCovered", 6.9, z, 1)),
  // Grandstands along the back straight, facing west
  ...[-4, -3, 2, 3].map((z) => put("racing-kit/grandStand", 17.1, z, 3)),
  ...[-2, -1, 0, 1].map((z) => put("racing-kit/grandStandCovered", 17.1, z, 3)),
  // Pit garages in the infield along the main straight, doors facing the track
  ...row("racing-kit/pitsGarage", { x: 9.6, z: -9 }, { x: 0, z: 1 }, 4, 3),
  put("racing-kit/pitsOffice", 9.6, -10, 3),
  put("car-kit/race", 8.95, -8.6, 2),
  put("car-kit/race-future", 8.95, -7.4, 2),
  put("car-kit/race", 8.95, -6.2, 2),
  // Overhead lights over the straights
  overhead(W, 5),
  overhead(W, 9),
  overhead(E, -9),
  overhead(E, -5),
  overhead(E, 5),
  overhead(E, 9),
  // Barrier walls on the outside of the north and south straights
  ...[10, 11, 12, 13, 14].map((x) => put("racing-kit/barrierWall", x, N, 2)),
  ...[10, 12, 13, 14].map((x) => put("racing-kit/barrierWall", x, S, 0)),
  // Banner towers on the corners
  centredAt("racing-kit/bannerTowerRed", 10.6, -10.4, 0),
  centredAt("racing-kit/bannerTowerGreen", 14.4, -10.4, 0),
  centredAt("racing-kit/bannerTowerGreen", 10.6, 10.4, 0),
  centredAt("racing-kit/bannerTowerRed", 14.4, 10.4, 0),
  // Infield fan zone: tents and the second billboard facing the back straight
  put("racing-kit/tentLong", 12, -3, 3),
  put("racing-kit/tent", 12, 0.6, 3),
  put("racing-kit/tentClosed", 12, 2, 3),
  put("racing-kit/billboard", 14.6, 5.2, 1),
  centredAt("racing-kit/flagRed", 13.6, -6.5, 0),
  centredAt("racing-kit/flagGreen", 13.6, 6.5, 0),
  centredAt("racing-kit/lightPostLarge", 11, -6, 0),
  centredAt("racing-kit/lightPostLarge", 11, 6.5, 0),
  put("mini-characters/character-male-a", 11.1, -1.4, 3),
  put("mini-characters/character-female-b", 11.3, 1.4, 3),
];

// Knockable props: a slalom on the back straight, a cone wall at the avenue entrance, barrels and
// boxes stacked by the pits
const dyn = { body: "dynamic" as const };
const props: Placement[] = [
  ...[-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5].map((z, i) => put("car-kit/cone", i % 2 ? E + 0.18 : E - 0.18, z, 0, dyn)),
  ...row("car-kit/cone", { x: 11.75, z: 12.55 }, { x: 0.12, z: 0 }, 5, 0, dyn),
  ...row("car-kit/cone", { x: 6.5, z: 0.42 }, { x: 0.18, z: 0 }, 3, 0, dyn),
  put("platformer-kit/barrel", 10.45, -11.1, 0, dyn),
  put("platformer-kit/barrel", 10.75, -11.1, 0, dyn),
  put("platformer-kit/barrel", 10.6, -11.4, 0, dyn),
  put("platformer-kit/barrel", 10.6, -11.25, 0, { ...dyn, y: 1.95 }),
  put("car-kit/box", 9.15, -5.2, 0, dyn),
  put("car-kit/box", 9.3, -5.0, 0, dyn),
  put("car-kit/box", 9.22, -5.1, 0, { ...dyn, y: 1.25 }),
  put("car-kit/debris-tire", 8.95, -10.2, 0, { ...dyn, y: 0.51 }),
  put("car-kit/debris-tire", 9.05, -10.4, 1, { ...dyn, y: 0.51 }),
];

// Racing Kit trees have their origin in a tile corner, so centre them explicitly
const treeLine = (models: ModelRef[], x: number, z: number, dx: number, dz: number, count: number): Placement[] =>
  Array.from({ length: count }, (_, i) => centredAt(models[i % models.length], x + dx * i, z + dz * i));

const greenery: Placement[] = [
  ...treeLine(["racing-kit/treeLarge", "racing-kit/treeSmall"], 8.5, -14.7, 1.2, 0, 8),
  ...treeLine(["racing-kit/treeSmall", "racing-kit/treeLarge"], 18.1, -12, 0, 1.6, 5),
  ...treeLine(["racing-kit/treeLarge", "racing-kit/treeSmall"], 18.1, 5, 0, 1.6, 5),
  ...treeLine(["racing-kit/treeSmall", "racing-kit/treeLarge"], 12.6, 16.3, 1.3, 0, 4),
  ...treeLine(["platformer-kit/tree", "city-suburban/tree-large"], 6.5, 3, 0, 1.6, 6),
  centredAt("racing-kit/treeLarge", 12.4, -8.5),
  centredAt("racing-kit/treeSmall", 13.2, 8.6),
];

const markers: Marker[] = [{ id: "speed-king", kind: "game", x: 6.4, z: -3, label: "Speed King" }];

const town = authored(ORIGIN, {
  placements: [...circuit, ...access, ...startFinish, ...trackside, ...props, ...greenery],
  markers,
  // On the starting grid, facing north to the start gantry
  spawn: { x: W, z: -1.4, rot: 2 },
});

export const raceway: DistrictLayout = { id: "raceway", origin: ORIGIN, ...town };
