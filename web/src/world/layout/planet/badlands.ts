// Biome layout: badlands. Owned by biome agent C.
// A pure off-road playground ("Over the Hill"): the terrain is the star, so most of this file is pads.
// Raised pads with a short blend make earthen kickers and tabletops; negative pads dig bowls.
// Local metres from the biome centre: north = +n, east = +e.
//
//         tabletop (52,5)          crater (40,40)
//    big hill      kicker (34,2)
//   (25,-35)       kicker (18,0)     whoops → (0..6, 28..58)
//            wreck  SPAWN (0,0) → N   wreck 1 (12,18)
//   ridge ↙                          bowl (-25,25)
//  (-15,-25)…(-36,-49)
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, FlatPad, PlanetPlacement } from "@/world/planet/types";
import { localGrid as grid } from "./c/helpers";

const CENTER = BIOMES.find((b) => b.id === "badlands")!.center;
const { at, place } = grid(CENTER);

const placements: PlanetPlacement[] = [];
const P = (n: number, e: number, rest: Omit<PlanetPlacement, "lat" | "lon">) => placements.push(place(n, e, rest));
const pad = (n: number, e: number, radius: number, rest: Omit<FlatPad, "lat" | "lon" | "radius"> = {}): FlatPad => ({
  ...at(n, e),
  radius,
  ...rest,
});

const pads: FlatPad[] = [
  // Spawn apron
  pad(0, 0, 9, { blend: 8 }),
  // Kicker line straight ahead of the spawn, ending on a tabletop
  pad(18, 0, 3, { height: 2.5, blend: 6 }),
  pad(34, 2, 3, { height: 3, blend: 6 }),
  pad(52, 5, 5, { height: 4.5, blend: 9 }),
  // "Over the Hill": one big rounded hill to crest blind
  pad(25, -35, 5, { height: 8, blend: 18 }),
  // A ridge of overlapping humps running south-west
  pad(-15, -25, 4, { height: 3.5, blend: 6 }),
  pad(-22, -33, 4, { height: 3.5, blend: 6 }),
  pad(-29, -41, 4, { height: 3.5, blend: 6 }),
  pad(-36, -49, 4, { height: 3.5, blend: 6 }),
  // Whoops section heading east
  pad(0, 28, 3, { height: 1.8, blend: 4 }),
  pad(2, 38, 3, { height: 1.8, blend: 4 }),
  pad(4, 48, 3, { height: 1.8, blend: 4 }),
  pad(6, 58, 3, { height: 1.8, blend: 4 }),
  // Bowl and crater to drop into
  pad(-25, 25, 10, { height: -5, blend: 12 }),
  pad(40, 40, 6, { height: -3, blend: 6 }),
];

// Wreck 1 (by the whoops): a broken-up car, its loose parts knockable
P(12, 18, { model: "car-kit/debris-drivetrain", yaw: 30 });
P(14, 16, { model: "car-kit/debris-door", yaw: 75 });
P(10, 21, { model: "car-kit/debris-bumper", yaw: -20 });
P(13, 20, { model: "car-kit/debris-plate-a", yaw: 10 });
P(11, 15, { model: "car-kit/debris-tire", body: "dynamic" });
P(15, 19, { model: "car-kit/debris-tire", body: "dynamic" });
// Wreck 2 (west of the spawn)
P(-30, -5, { model: "car-kit/debris-drivetrain", yaw: -60 });
P(-28, -7, { model: "car-kit/debris-door-window", yaw: 20 });
P(-32, -3, { model: "car-kit/debris-spoiler-a", yaw: 100 });
P(-31, -8, { model: "car-kit/debris-plate-b", yaw: 45 });
P(-27, -3, { model: "car-kit/debris-tire", body: "dynamic" });

// Crates and barrels to smash: a little wall across the kicker line, between the first two kickers
for (const e of [-2.2, 0, 2.2]) P(26, e + 1, { model: "platformer-kit/crate", body: "dynamic" });
P(26, 2.1, { model: "platformer-kit/crate", body: "dynamic", y: 2.05 });
P(26, -0.1, { model: "platformer-kit/crate", body: "dynamic", y: 2.05 });
for (const [n, e] of [[-8, 12], [-6, 14], [-9, 15]] as const) P(n, e, { model: "platformer-kit/barrel", body: "dynamic" });

// Rocks: sandstone boulders (pirate-kit sand rocks suit the dusty palette), half sunk, plus flat stones
const rocks: [number, number, string, number][] = [
  [8, -14, "pirate-kit/rocks-sand-a", 0.48],
  [30, -14, "pirate-kit/rocks-sand-b", 0.54],
  [42, -20, "pirate-kit/rocks-sand-c", 0.66],
  [-12, 34, "pirate-kit/rocks-sand-a", 0.66],
  [-40, 18, "pirate-kit/rocks-sand-b", 0.54],
  [-38, 34, "pirate-kit/rocks-sand-c", 0.78],
  [20, 50, "pirate-kit/rocks-sand-a", 0.48],
  [56, 24, "pirate-kit/rocks-sand-b", 0.6],
  [-48, -20, "pirate-kit/rocks-sand-c", 0.72],
  [-8, -44, "pirate-kit/rocks-sand-a", 0.45],
  [62, -12, "pirate-kit/rocks-sand-b", 0.84],
  [-2, -10, "platformer-kit/stones", 1.4],
  [22, 26, "platformer-kit/stones", 1.6],
];
rocks.forEach(([n, e, model, scale], k) =>
  P(n, e, { model: model as PlanetPlacement["model"], scale, yaw: k * 47, y: model.includes("stones") ? 0 : -0.4 }),
);

// Dead trees: bare trunks and stumps from the graveyard kit
const trees: [number, number, string, number][] = [
  [14, -24, "graveyard-kit/trunk-long", 1.8],
  [-18, 8, "graveyard-kit/trunk-long", 1.6],
  [36, 22, "graveyard-kit/trunk", 1.8],
  [-44, -2, "graveyard-kit/trunk-long", 2],
  [48, -30, "graveyard-kit/trunk", 2],
  [-20, -50, "graveyard-kit/trunk-long", 1.7],
  [30, 60, "graveyard-kit/trunk-long", 1.8],
  [-30, 46, "graveyard-kit/trunk", 1.6],
];
trees.forEach(([n, e, model, scale], k) => P(n, e, { model: model as PlanetPlacement["model"], scale, yaw: k * 73 }));

export const badlandsLayout: BiomeLayout = {
  biome: "badlands",
  // Facing north down the kicker line. The GPS can't send you here, but the layout still needs one.
  spawn: { ...at(0, 0), yaw: 0 },
  pads,
  markers: [],
  placements,
};
