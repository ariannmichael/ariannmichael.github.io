// Home & Campus (2016-2020): the north end of the avenue. Spawn at the cul-de-sac facing south
// down the avenue, past the CV billboard, the UFCG campus and Proj4me, to the town roundabout.
// Authored in town tile coordinates (see helpers.ts for the grid conventions).
import type { DistrictLayout, Marker, Placement } from "@/world/layout/types";
import { authored, cityRun, flat, mixedRow, put, row, scatter } from "./helpers";
import { constructionPlot } from "./plots";

const ORIGIN = { x: 0, z: -8 };

const roads: Placement[] = [
  // Main avenue (x = 0) from the cul-de-sac to the roundabout
  flat("city-roads/road-end-round", 0, -16, 3),
  ...cityRun("z", 0, -15, -10),
  flat("city-roads/road-intersection", 0, -9, 3),
  ...cityRun("z", 0, -8, -2, [-6]),
  flat("city-roads/road-crossing", 0, -6, 1),
  flat("city-roads/road-roundabout", 0, 0),
  // Cross street z = -9 to the west ring road
  ...cityRun("x", -9, -7, -1),
  flat("city-roads/road-bend", -8, -9, 1),
  // West ring road (x = -8), north half, and the roundabout's west arm
  ...cityRun("z", -8, -8, -1),
  flat("city-roads/road-intersection", -8, 0, 1),
  ...cityRun("z", -8, 1, 1),
  ...cityRun("x", 0, -7, -2),
  // Roundabout's east arm towards the raceway (the raceway owns the last two tiles)
  ...cityRun("x", 0, 2, 5),
];

const streetFurniture: Placement[] = [
  // Avenue lights on the verge, arms over the sidewalk (west side rot 3, east side rot 1)
  ...[-14, -11, -7, -3].map((z) => put("city-roads/light-curved", -0.575, z, 3)),
  ...[-15.5, -12, -8, -4.5].map((z) => put("city-roads/light-curved", 0.575, z, 1)),
  // Cross street and arms
  ...[-6, -3].map((x) => put("city-roads/light-curved", x, -9.575, 2)),
  ...[-6, -3.5].map((x) => put("city-roads/light-curved", x, 0.575, 0)),
  put("city-roads/light-curved", 3.5, -0.575, 2),
  // Traffic lights on the T-junction corners
  put("city-roads/traffic-light", -0.6, -9.6, 0),
  put("city-roads/traffic-light", 0.6, -8.4, 2),
  put("city-roads/traffic-light", -7.4, -0.6, 3),
  put("city-roads/traffic-light", -8.6, 0.6, 1),
];

// About me: a suburban house facing the avenue, with a driveway and a fenced back garden
const house: Placement[] = [
  put("city-suburban/building-type-c", -2, -13, 1),
  flat("city-suburban/driveway-long", -1.29, -13.4, 1),
  flat("city-suburban/driveway-long", -0.89, -13.4, 1),
  // Back garden fence (fence runs along X at rot 0)
  ...row("city-suburban/fence", { x: -3.45, z: -13.55 }, { x: 0, z: 0.475 }, 4, 1),
  ...row("city-suburban/fence", { x: -2.75, z: -13.8 }, { x: -0.475, z: 0 }, 2),
  ...row("city-suburban/fence", { x: -2.75, z: -11.8 }, { x: -0.475, z: 0 }, 2),
  put("city-suburban/tree-large", -3.05, -12.9),
  put("city-suburban/tree-small", -3.05, -13.55),
  put("city-suburban/planter", -1.4, -14.05, 1),
  put("car-kit/sedan", -2.3, -14.3, 1),
];

// Contact: a little corner plaza next to the house, where the cross street meets the avenue
const contact: Placement[] = [
  put("mini-skate/benches", -2.0, -10.55, 1),
  put("city-suburban/planter", -2.0, -11.2, 1),
  put("city-suburban/tree-small", -2.6, -10.1),
  put("mini-characters/character-female-b", -1.75, -10.95, 1),
];

// CV: a roadside billboard opposite the spawn. Drive up to it and press E to download.
const cv: Placement[] = [
  put("racing-kit/billboard", 2, -14, 3),
  put("city-suburban/tree-small", 2.4, -15.6),
  put("city-suburban/tree-large", 2.6, -12.6),
];

// UFCG campus (main hall + teaching building) with a skate courtyard between them, then Proj4me
const campus: Placement[] = [
  put("city-commercial/building-n", 3.2, -10, 3),
  put("city-commercial/building-h", 2.4, -6, 3),
  put("city-commercial/detail-awning-wide", 1.65, -6, 3),
  // Skate courtyard (Mini Skate pieces are 2.5 m)
  put("mini-skate/half-pipe", 3.9, -8.35, 1),
  put("mini-skate/half-pipe", 4.21, -8.35, 1),
  put("mini-skate/half-pipe", 3.9, -7.15, 3),
  put("mini-skate/half-pipe", 4.21, -7.15, 3),
  put("mini-skate/ramp", 2.7, -7.75, 3),
  put("mini-skate/rail-low", 3.25, -7.75, 0),
  put("mini-skate/obstacle-box", 2.25, -8.3, 0),
  put("mini-skate/benches", 4.6, -7.75, 3),
  put("mini-skate/character-skate-boy", 3.3, -8.25, 1),
  put("mini-skate/character-skate-girl", 2.9, -7.25, 3),
  put("mini-characters/character-male-c", 1.6, -8.4, 1),
  put("city-suburban/tree-large", 1.7, -11.6),
  put("city-suburban/tree-large", 1.7, -4.65),
  // Proj4me: a small office, the first stop after leaving campus
  put("city-commercial/building-d", 2.4, -3, 3),
  put("city-commercial/detail-parasol-a", 1.6, -2.1),
  put("car-kit/hatchback-sports", 4.25, -2.6, 0),
  put("city-suburban/tree-small", 4.3, -4.3),
];

// Neighbours on the cross street, a park between the avenue and the ring road, and a tree line
const neighbourhood: Placement[] = [
  put("city-suburban/building-type-a", -4.7, -11, 0),
  put("city-suburban/building-type-e", -6.45, -11, 0),
  flat("city-suburban/driveway-long", -4.2, -10.4, 0),
  put("car-kit/suv", -5.55, -10.15, 1),
  ...mixedRow(
    ["city-suburban/tree-large", "mini-forest/tree-high", "platformer-kit/tree", "city-suburban/tree-small"],
    { x: -7, z: -17.4 },
    { x: 1.15, z: 0 },
    11,
  ),
  ...mixedRow(["mini-forest/tree", "city-suburban/tree-large", "platformer-kit/tree-pine"], { x: -6.8, z: -15.4 }, { x: 1.2, z: 0.15 }, 4),
  ...mixedRow(["platformer-kit/tree", "mini-forest/tree-high"], { x: 4.5, z: -16 }, { x: 0, z: 1.5 }, 3),
  // Park
  ...scatter(
    ["mini-forest/tree", "city-suburban/tree-large", "platformer-kit/tree", "mini-forest/tree-high"],
    { x0: -6.8, x1: -4.2, z0: -7.6, z1: -1.6 },
    9,
    11,
  ),
  ...scatter(["platformer-kit/flowers", "platformer-kit/flowers-tall"], { x0: -6.5, x1: -1.6, z0: -7.5, z1: -1.6 }, 6, 12),
  put("platformer-kit/flowers", -2.4, -4.6),
  put("mini-skate/bench", -2.0, -5.5, 1),
  put("mini-skate/bench", -2.0, -3.7, 1),
  put("city-suburban/tree-large", -2.9, -6.6),
  put("city-suburban/tree-large", -3.1, -2.4),
  put("mini-characters/character-male-a", -2.4, -4.8, 3),
  put("mini-characters/character-female-d", -3.6, -3.6, 0),
  put("car-kit/taxi", -1.55, -1.5, 2),
  // Woods in the north-west corner, behind the building sites
  ...scatter(
    ["mini-forest/tree-high", "platformer-kit/tree-pine", "mini-forest/tree", "platformer-kit/tree"],
    { x0: -12.6, x1: -8.6, z0: -16.8, z1: -10.2 },
    14,
    13,
  ),
];

const markers: Marker[] = [
  { id: "about", kind: "about", x: -1, z: -13, label: "About me" },
  { id: "contact", kind: "contact", x: -1, z: -10.75, label: "Contact" },
  { id: "cv", kind: "cv", x: 1, z: -13.9, label: "Download CV" },
  { id: "ufcg", kind: "job", x: 1, z: -10, label: "UFCG · Computer Science" },
  { id: "ufcg-monitor", kind: "job", x: 1, z: -6, label: "UFCG · Teaching assistant" },
  { id: "proj4me", kind: "job", x: 1, z: -3 },
];

const town = authored(ORIGIN, {
  placements: [
    ...roads,
    ...streetFurniture,
    ...house,
    ...contact,
    ...cv,
    ...campus,
    ...neighbourhood,
    // Milestone 2 plots on the west ring road: Healthcare and Open Source Lab
    ...constructionPlot(-11, -6.5, 0),
    ...constructionPlot(-11, -2.2, 1),
  ],
  markers,
  // Cul-de-sac at the top of the avenue, facing south (+Z) down the career timeline
  spawn: { x: 0, z: -15.2, rot: 0 },
});

export const home: DistrictLayout = { id: "home", origin: ORIGIN, ...town };
