// Engineering District (2020-2025): south of the roundabout. Office towers line the avenue, with
// the current role (Afya, 2026) in the tallest skyscraper right next to the roundabout. Until the
// Milestone 2 districts exist it also hosts their jobs and a small Game Dev corner (arcade plaza)
// for the itch.io games. Authored in town tile coordinates (see helpers.ts).
import type { DistrictLayout, Marker, Placement } from "@/world/layout/types";
import { authored, cityRun, flat, mixedRow, put, row, scatter } from "./helpers";
import { constructionPlot } from "./plots";

const ORIGIN = { x: 0, z: 8 };

const roads: Placement[] = [
  // Avenue (x = 0) from the roundabout to the bend towards the raceway
  ...cityRun("z", 0, 2, 8),
  flat("city-roads/road-intersection", 0, 9, 3),
  ...cityRun("z", 0, 10, 14, [12]),
  flat("city-roads/road-crossing", 0, 12, 1),
  flat("city-roads/road-bend", 0, 15, 2),
  ...cityRun("x", 15, 1, 5),
  // West ring road, south half, and the cross street z = 9 back to the avenue
  ...cityRun("z", -8, 2, 8),
  flat("city-roads/road-bend", -8, 9, 2),
  ...cityRun("x", 9, -7, -1),
];

const streetFurniture: Placement[] = [
  ...[2.6, 6, 11, 14].map((z) => put("city-roads/light-curved", -0.575, z, 3)),
  ...[5.2, 9, 12.2].map((z) => put("city-roads/light-curved", 0.575, z, 1)),
  ...[-6.5, -3].map((x) => put("city-roads/light-curved", x, 8.425, 2)),
  ...[2.5, 4.6].map((x) => put("city-roads/light-curved", x, 15.575, 0)),
  ...[3, 7].map((z) => put("city-roads/light-curved", -7.425, z, 1)),
  put("city-roads/traffic-light", -0.6, 8.4, 0),
  put("city-roads/traffic-light", 0.6, 9.6, 2),
  put("city-roads/traffic-light", -0.6, 2, 3),
];

// Afya (current role): the tallest skyscraper, right on the roundabout
const afya2026: Placement[] = [
  put("city-commercial/building-skyscraper-d", 2.75, 3.1, 3),
  put("city-suburban/planter", 1.6, 4.15, 1),
  put("mini-characters/character-female-c", 1.65, 4.55, 3),
];

// GoFasti (for PlanetBids): a data warehouse with a giant snowflake on the roof (the Snowflake
// analytics work) and an "AI onboarding" kiosk out front
const WAREHOUSE_ROOF = 11.76;
const gofasti: Placement[] = [
  put("city-industrial/building-a", 3, 7.3, 3),
  put("holiday-kit/snow-flat-large", 3, 6.7, 1, { y: WAREHOUSE_ROOF, collider: "none" }),
  put("holiday-kit/snow-flat-large", 3, 7.9, 1, { y: WAREHOUSE_ROOF, collider: "none" }),
  put("holiday-kit/snowflake-a", 3, 7.84, 3, { y: WAREHOUSE_ROOF, scale: 10, collider: "none" }),
  // Kiosk: a screen panel under a parasol, with someone onboarding
  put("factory-kit/screen-panel-wide", 1.55, 8.55, 3),
  put("city-commercial/detail-parasol-a", 1.85, 8.55),
  put("mini-characters/character-male-a", 1.3, 8.25, 1),
];

// DrChrono and FullStack (GoDaddy) further down the avenue, with a back row of towers
const eastBlock: Placement[] = [
  put("city-commercial/building-skyscraper-b", 2.75, 10.8, 3),
  put("city-commercial/building-l", 2.75, 13.4, 3),
  put("city-commercial/detail-awning-wide", 1.85, 13.4, 3),
  put("city-commercial/low-detail-building-b", 4.6, 2.6),
  put("city-commercial/low-detail-building-e", 4.6, 4.4),
  put("city-commercial/low-detail-building-b", 4.6, 9.6, 0),
  put("city-commercial/low-detail-building-b", 4.6, 12.1),
  put("city-commercial/low-detail-building-e", 4.6, 13.9),
  put("car-kit/delivery", 1.75, 6.05, 0),
  put("car-kit/police", 1.7, 12.1, 0),
];

// Stefanini (with a mentoring plaza), Afya Educacional and OpenMined on the west block
const westBlock: Placement[] = [
  put("city-commercial/building-f", -2.3, 3.2, 1),
  put("city-commercial/building-g", -2.3, 7.2, 1),
  put("city-commercial/building-c", -6, 5, 3),
  put("city-commercial/building-skyscraper-c", -4.15, 3.4, 1),
  put("city-commercial/building-skyscraper-e", -4.15, 6.9, 1),
  // Mentoring plaza between Stefanini and Afya Educacional
  put("mini-skate/benches", -2.3, 5.2, 1),
  put("mini-skate/bench", -1.75, 4.75, 3),
  put("mini-skate/bench", -1.75, 5.65, 3),
  put("city-commercial/detail-parasol-a", -2.85, 5.2),
  put("city-suburban/planter", -2.9, 4.5, 0),
  put("city-suburban/planter", -2.9, 5.9, 0),
  put("mini-characters/character-male-b", -2.0, 4.75, 1),
  put("mini-characters/character-female-c", -2.0, 5.65, 1),
  put("mini-characters/character-male-c", -1.45, 5.2, 3),
  // OpenMined front yard on the ring road
  put("city-suburban/tree-large", -7.1, 3.6),
  put("city-suburban/tree-large", -7.1, 6.4),
  put("car-kit/van", -6.55, 7.5, 1),
];

// Game Dev corner: an arcade storefront on a plaza along the cross street, one cabinet per game
const ARCADE_X = [-6.6, -5.25, -3.9, -2.55, -1.2];
const gameDev: Placement[] = [
  put("city-commercial/building-e", -5.5, 12.25, 2),
  put("city-commercial/building-e", -2.4, 12.25, 2),
  put("city-commercial/detail-awning-wide", -6.3, 11.65, 2),
  put("city-commercial/detail-awning-wide", -4.7, 11.65, 2),
  put("city-commercial/detail-awning-wide", -2.4, 11.65, 2),
  ...row("mini-arcade/floor", { x: -7.0, z: 10.75 }, { x: 0.3125, z: 0 }, 19, 0, { collider: "none" }),
  ...row("mini-arcade/floor", { x: -7.0, z: 11.06 }, { x: 0.3125, z: 0 }, 19, 0, { collider: "none" }),
  ...ARCADE_X.map((x) => put("mini-arcade/arcade-machine", x, 10.85, 2)),
  put("mini-arcade/claw-machine", -7.1, 11.0, 2),
  put("mini-arcade/dance-machine", -1.85, 11.0, 2),
  put("mini-arcade/pinball", -4.55, 11.05, 2),
  put("mini-arcade/vending-machine", -3.2, 11.05, 2),
  put("mini-arcade/character-gamer", -5.9, 10.9, 2),
  put("mini-arcade/character-employee", -2.95, 10.95, 2),
  ...mixedRow(["platformer-kit/tree", "mini-forest/tree-high", "city-suburban/tree-large"], { x: -7.2, z: 14.4 }, { x: 1.3, z: 0 }, 6),
];

const surroundings: Placement[] = [
  ...scatter(["mini-forest/tree", "platformer-kit/tree-pine", "city-suburban/tree-large"], { x0: -7.4, x1: -6.6, z0: 10.2, z1: 13.4 }, 3, 21),
  ...mixedRow(["city-suburban/tree-large", "platformer-kit/tree", "mini-forest/tree-high"], { x: -1.2, z: 16.4 }, { x: 1.25, z: 0 }, 5),
  put("platformer-kit/flowers-tall", -1.5, 14.6),
  put("platformer-kit/flowers", 1.5, 14.0),
  // Woods in the south-west corner, behind the building sites
  ...scatter(
    ["platformer-kit/tree-pine", "mini-forest/tree-high", "platformer-kit/tree", "mini-forest/tree"],
    { x0: -12.6, x1: -8.6, z0: 10.2, z1: 16.2 },
    12,
    22,
  ),
];

const markers: Marker[] = [
  { id: "afya-2026", kind: "job", x: 1, z: 3.1 },
  { id: "gofasti", kind: "job", x: 1, z: 7.3 },
  { id: "drchrono", kind: "job", x: 1, z: 10.8 },
  { id: "fullstack", kind: "job", x: 1, z: 13.4 },
  { id: "stefanini", kind: "job", x: -1, z: 3.2 },
  { id: "afya-2021", kind: "job", x: -1, z: 7.2 },
  { id: "openmined", kind: "job", x: -7, z: 5 },
  // Game Dev corner: one marker in front of each cabinet
  { id: "shoot-em-all", kind: "game", x: ARCADE_X[0], z: 10 },
  { id: "rat-catcher", kind: "game", x: ARCADE_X[1], z: 10 },
  { id: "lead-me-to-the-light", kind: "game", x: ARCADE_X[2], z: 10 },
  { id: "get-notes", kind: "game", x: ARCADE_X[3], z: 10 },
  { id: "super-mega-ultra-pong", kind: "game", x: ARCADE_X[4], z: 10 },
];

const town = authored(ORIGIN, {
  placements: [
    ...roads,
    ...streetFurniture,
    ...afya2026,
    ...gofasti,
    ...eastBlock,
    ...westBlock,
    ...gameDev,
    ...surroundings,
    // Milestone 2 plots on the west ring road: Financial District and Game Dev Park
    ...constructionPlot(-11, 3.5, 2),
    ...constructionPlot(-11, 7.5, 3),
  ],
  markers,
  // On the avenue just past the roundabout, facing south between the towers
  spawn: { x: 0, z: 2.4, rot: 0 },
});

export const engineering: DistrictLayout = { id: "engineering", origin: ORIGIN, ...town };
