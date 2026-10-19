// Biome layout: badlands. Owned by biome agent C.
// A pure off-road playground ("Over the Hill"): the terrain is the star, so most of this file is pads.
// Raised pads with a short blend make earthen kickers and tabletops; negative pads dig bowls.
// Small-planet budget: everything within 40 m of the centre, pads (with blend) within 46 m.
// Local metres from the biome centre: north = +n, east = +e. Both roads leave north (321° and 39°),
// so the spawn sits on the north edge of the jump field, facing south down the kicker line, with two
// 12 m lanes kept clear behind it.
//
//                    roads ↖   SPAWN (16,0)   ↗ roads
//     ridge (14,-18)…(4,-30)    kicker (2,0)          whoops (3,12) → (-3,33)
//       big hill (-4,-24)  crates (-5,-7)    wreck 1 (-8,12)
//   wreck 2 (-12,-12)            kicker (-10,0)
//      crater (-26,-18)          tabletop (-24,1)      bowl (-21,19)
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, FlatPad, PlanetPlacement } from "@/world/planet/types";
import { localGrid as grid } from "./c/helpers";

const CENTER = BIOMES.find((b) => b.id === "badlands")!.center;
const { at, place, spawn } = grid(CENTER);

/** Spawn in local metres (also used by badlands.test.ts for the road-lane check) */
export const BADLANDS_SPAWN: [number, number] = [16, 0];

const placements: PlanetPlacement[] = [];
const P = (n: number, e: number, rest: Omit<PlanetPlacement, "lat" | "lon">) => placements.push(place(n, e, rest));
const pad = (n: number, e: number, radius: number, rest: Omit<FlatPad, "lat" | "lon" | "radius"> = {}): FlatPad => ({
  ...at(n, e),
  radius,
  ...rest,
});

const pads: FlatPad[] = [
  // Spawn apron (flat, so the road lanes behind it stay drivable)
  pad(BADLANDS_SPAWN[0], BADLANDS_SPAWN[1], 8, { blend: 6 }),
  // Kicker line straight ahead (south) of the spawn, ending on a tabletop
  pad(2, 0, 3, { height: 2.5, blend: 6 }),
  pad(-10, 0, 3, { height: 3, blend: 6 }),
  pad(-24, 1, 5, { height: 4.5, blend: 8 }),
  // "Over the Hill": one big rounded hill to crest blind
  pad(-4, -24, 4, { height: 7, blend: 14 }),
  // A ridge of overlapping humps running north-west → south-west, behind the hill
  pad(14, -18, 3, { height: 3, blend: 5 }),
  pad(10, -25, 3, { height: 3, blend: 5 }),
  pad(4, -31, 3, { height: 3, blend: 5 }),
  // Whoops section heading south-east
  pad(3, 12, 2.5, { height: 1.6, blend: 3.5 }),
  pad(1, 19, 2.5, { height: 1.6, blend: 3.5 }),
  pad(-1, 26, 2.5, { height: 1.6, blend: 3.5 }),
  pad(-3, 33, 2.5, { height: 1.6, blend: 3.5 }),
  // Bowl and crater to drop into
  pad(-21, 19, 7, { height: -5, blend: 10 }),
  pad(-26, -18, 5, { height: -3, blend: 6 }),
];

// Wreck 1 (between the kicker line and the whoops): a broken-up car, one loose tyre knockable
P(-16, 20, { model: "car-kit/debris-drivetrain", yaw: 30 }); // down on the bowl floor (the rim is too steep)
P(-6, 10, { model: "car-kit/debris-door", yaw: 75, y: -0.25 });
P(-9, 9, { model: "car-kit/debris-tire", body: "dynamic" });
// Wreck 2 (west, at the foot of the big hill)
P(-12, -12, { model: "car-kit/debris-drivetrain", yaw: -60, y: -0.45 });
P(-14, -10, { model: "car-kit/debris-spoiler-a", yaw: 100 });

// Two crates to smash beside the kicker line (the line itself stays clear), a barrel on the bowl's rim
P(-5, -7, { model: "platformer-kit/crate", body: "dynamic" });
P(-6.5, -7.8, { model: "platformer-kit/crate", body: "dynamic", yaw: 20 });
P(-12, 25, { model: "platformer-kit/barrel", body: "dynamic" });

// Rocks: sandstone boulders (pirate-kit sand rocks suit the dusty palette), half sunk, plus flat stones.
// The badlands slopes are steep, so each sits on the gentlest patch nearby (the flat stones on the
// bowl and crater floors); `y` sinks it onto the slope under it (grounded.test.ts measures them), the
// one left on the cliff below the hill as an outcrop.
const rocks: [number, number, string, number, number, number?][] = [
  [6, -12, "pirate-kit/rocks-sand-a", 0.45, -2.9],
  [22, 26, "pirate-kit/rocks-sand-b", 0.5, -0.4],
  [-26.9, 16.2, "pirate-kit/rocks-sand-c", 0.6, -0.4],
  [-21.4, 28.1, "pirate-kit/rocks-sand-a", 0.55, -0.4, -90],
  [-35, -9, "pirate-kit/rocks-sand-b", 0.5, -0.4, 90],
  [-10.5, -32, "pirate-kit/rocks-sand-c", 0.6, -0.4],
  [3.5, 34.6, "pirate-kit/rocks-sand-a", 0.45, -1.1, 90],
  [-25, -17, "platformer-kit/stones", 1.4, 0],
  [-21, 14, "platformer-kit/stones", 1.6, 0],
];
rocks.forEach(([n, e, model, scale, y, dyaw = 0], k) =>
  P(n, e, { model: model as PlanetPlacement["model"], scale, yaw: k * 47 + dyaw, y }),
);

// Dead trees: bare trunks and stumps from the graveyard kit
// (two moved off the steepest slopes; `y` sets the others into the slope under them)
const trees: [number, number, string, number, number][] = [
  [34, 0, "graveyard-kit/trunk-long", 1.8, -1.15],
  [6, 24, "graveyard-kit/trunk-long", 1.6, -1.7],
  [-28, 24, "graveyard-kit/trunk", 1.8, 0],
  [-28, -12, "graveyard-kit/trunk-long", 2, -0.4],
  [-29.6, -14.4, "graveyard-kit/trunk", 2, 0],
  [-18, -32, "graveyard-kit/trunk-long", 1.7, -0.6],
  [20, -26, "graveyard-kit/trunk", 1.6, 0],
];
trees.forEach(([n, e, model, scale, y], k) => P(n, e, { model: model as PlanetPlacement["model"], scale, yaw: k * 73, y }));

export const badlandsLayout: BiomeLayout = {
  biome: "badlands",
  // Facing south down the kicker line. The GPS can't send you here, but the layout still needs one.
  spawn: spawn(BADLANDS_SPAWN[0], BADLANDS_SPAWN[1], 180),
  pads,
  markers: [],
  placements,
};
