// Biome layout: gamedev (Game Dev Park). Owned by biome agent C.
// A night-side theme park: one zone per itch.io game around a central gate plaza, with a looping
// coaster as the landmark. Local metres from the biome centre: north = +n, east = +e.
//
//                    N
//        coaster loop        arcade hall (Pong)
//        |  (W side)        [=====  =====]
//        |                   giant air hockey
//   station    [gate plaza]                shoot-em-all launch pad + hangar
//   music stage   spawn
//   (Get Notes)                     rat-catcher dungeon mound
//      graveyard woods + lanterns
//            lighthouse (Lead Me To The Light)
//               pirate cove with ships
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, FlatPad, PlanetMarker, PlanetPlacement } from "@/world/planet/types";
import { localGrid as grid, path, yawToward } from "./c/helpers";

const CENTER = BIOMES.find((b) => b.id === "gamedev")!.center;
const { at, place, marker } = grid(CENTER);

const placements: PlanetPlacement[] = [];
const P = (n: number, e: number, rest: Omit<PlanetPlacement, "lat" | "lon">) => placements.push(place(n, e, rest));
const pad = (n: number, e: number, radius: number, rest: Omit<FlatPad, "lat" | "lon" | "radius"> = {}): FlatPad => ({
  ...at(n, e),
  radius,
  ...rest,
});

// ---------------------------------------------------------------------------------------------
// Gate plaza + spawn (centre). The park gate is a drive-through arch, so it has no collider.
P(8, 0, { model: "coaster-kit/park-entrance", collider: "none" });
P(-2, 9, { model: "fantasy-town/stall-red", yaw: 90 });
P(-2, -9, { model: "fantasy-town/stall-red", yaw: -90 });
P(3, 6, { model: "mini-characters/character-female-a", yaw: 140, anim: "emote-yes" });
for (const [n, e] of [[-10, 10], [14, -12], [16, 12]] as const) P(n, e, { model: "coaster-kit/tree-large", yaw: n * 7 });

// ---------------------------------------------------------------------------------------------
// Roller coaster (west). Station at rail level (y 0); the 16 m pieces have their origin one kit unit
// above the rail, hence y = 4. The looping's entry lane is 4 m east of its origin, exit lane on it.
const COASTER_E = -44;
for (const n of [-12, -8, -4, 0]) P(n, COASTER_E, { model: "coaster-kit/station" });
P(-4, COASTER_E, { model: "coaster-kit/coaster-train-front", y: 0.25 });
P(2, COASTER_E, { model: "coaster-kit/coaster-steel-straight", y: 4 });
P(26, COASTER_E - 4, { model: "coaster-kit/coaster-steel-looping", y: 4 });
P(34, COASTER_E - 4, { model: "coaster-kit/coaster-steel-straight", y: 4 });
for (const [n, e] of [[-14, -34], [8, -35], [26, -34], [46, -38], [-16, -54], [16, -56], [42, -56]] as const) {
  P(n, e, { model: "coaster-kit/tree-large", yaw: e * 11 });
}

// ---------------------------------------------------------------------------------------------
// Arcade hall: Super Mega Ultra Pong (north-east). Mini-arcade walls at ×2.4 → 6 m cells, 6 m tall.
// 24 m (E–W) × 18 m (N–S), open roof; the doorway is the missing south-wall cell (6 m clear).
const H = { n: 30, e: 24 };
const WALL = { model: "mini-arcade/wall" as const, scale: 2.4 };
for (const e of [-9, 3, 9]) P(H.n - 9, H.e + e, { ...WALL }); // south (gap at e = -3)
for (const e of [-9, -3, 3, 9]) P(H.n + 9, H.e + e, { ...WALL }); // north
for (const n of [-6, 0, 6]) {
  P(H.n + n, H.e - 12, { ...WALL, yaw: 90 }); // west
  P(H.n + n, H.e + 12, { ...WALL, yaw: 90 }); // east
}
for (const e of [-9, -3, 3, 9]) for (const n of [-6, 0, 6]) P(H.n + n, H.e + e, { model: "mini-arcade/floor", scale: 2.4 });
// Cabinets along the walls (×1.6), leaving the middle free to drive around
const CAB = 1.6;
for (const e of [-9.5, -7, -4.5]) P(H.n + 7, H.e + e, { model: "mini-arcade/arcade-machine", scale: CAB, yaw: 180 });
P(H.n + 6.2, H.e + 1, { model: "mini-arcade/dance-machine", scale: CAB, yaw: 180 });
P(H.n + 6.2, H.e + 5, { model: "mini-arcade/dance-machine", scale: CAB, yaw: 180 });
for (const n of [-4, -1, 2]) P(H.n + n, H.e - 10, { model: "mini-arcade/pinball", scale: CAB, yaw: -90 });
for (const n of [-4, 0, 4]) P(H.n + n, H.e + 10, { model: "mini-arcade/claw-machine", scale: CAB, yaw: 90 });
P(H.n + 4.4, H.e - 7, { model: "mini-characters/character-male-c", anim: "interact-right" });
// The Pong landmark: a giant air-hockey table out front
P(H.n - 18, H.e + 8, { model: "mini-arcade/air-hockey", scale: 3, yaw: 8 });

// ---------------------------------------------------------------------------------------------
// Shoot 'Em All (east): a space launch pad with the shmup's speeders parked, rocks (meteors) around.
const S = { n: -6, e: 44 };
for (const [n, e] of [[-4, -4], [-4, 4], [4, -4], [4, 4]] as const) {
  P(S.n + n, S.e + e, { model: "space-kit/platform_large", collider: "none" });
}
P(S.n + 3, S.e - 2, { model: "space-kit/craft_speederA", yaw: 120, y: 0.4 });
P(S.n - 3.5, S.e + 3.5, { model: "space-kit/craft_speederD", yaw: 200, y: 0.4 });
P(S.n + 2, S.e + 15, { model: "space-kit/hangar_roundGlass", yaw: 90 });
P(S.n + 11, S.e + 9, { model: "space-kit/meteor", scale: 1.5, yaw: 30 });
P(S.n - 12, S.e + 8, { model: "space-kit/meteor", scale: 1.8, yaw: 160 });
P(S.n + 13, S.e - 6, { model: "space-kit/meteor", scale: 1.2, yaw: 75 });

// ---------------------------------------------------------------------------------------------
// Rat Catcher (south-east): a dungeon you drive into, under an earth mound. Mini-dungeon cells at
// ×1.8 → 4.5 m cubes, 4.95 m tall. 5×5 ring of walls (doorway = the north-middle cell), grass roof.
const D = { n: -36, e: 20 };
const C = 4.5;
const DS = 1.8;
for (let i = -2; i <= 2; i++) {
  for (let j = -2; j <= 2; j++) {
    const ring = Math.abs(i) === 2 || Math.abs(j) === 2;
    const door = i === 2 && j === 0;
    if (ring && !door) P(D.n + i * C, D.e + j * C, { model: "mini-dungeon/wall", scale: DS });
    else P(D.n + i * C, D.e + j * C, { model: "mini-dungeon/floor", scale: DS });
  }
}
// The mound: grassy earth slabs over the whole cave (lintel over the doorway too), plus a crown
for (const i of [-1, 0, 1]) {
  for (const j of [-1, 0, 1]) P(D.n + i * 7.5, D.e + j * 7.5, { model: "platformer-kit/block-grass-low-large", scale: 0.95, y: 4.95 });
}
P(D.n - 1, D.e + 1, { model: "platformer-kit/block-grass-low-large", scale: 0.6, y: 6.85, yaw: 20 });
P(D.n - 5.5, D.e - 5.5, { model: "mini-dungeon/chest", scale: 1.4, yaw: 45 });
P(D.n - 5.5, D.e + 5.5, { model: "mini-dungeon/barrel", scale: 1.2, body: "dynamic" });
P(D.n - 5.5, D.e + 3.8, { model: "mini-dungeon/barrel", scale: 1.2, body: "dynamic" });
P(D.n - 3.8, D.e + 5.5, { model: "mini-dungeon/barrel", scale: 1.2, body: "dynamic" });
P(D.n + 4, D.e - 5.5, { model: "mini-dungeon/barrel", scale: 1.2, body: "dynamic" });
P(D.n - 3, D.e - 1, { model: "mini-characters/character-male-a", anim: "holding-right" });

// ---------------------------------------------------------------------------------------------
// Get Notes (west of the plaza): a little wooden music stage facing east, with drum barrels and a
// tiny crowd. Deck = 2 m wood blocks; backdrop = two storeys of wood wall.
const M = { n: 4, e: -24 };
for (const n of [-4, 0, 4]) {
  for (const e of [-6, -2]) P(M.n + n, M.e + e, { model: "fantasy-town/wall-wood-block-half" });
  // wall-wood sits 1.6–2 m on its +X side (= west at yaw 0), so this lines the deck's back edge
  P(M.n + n, M.e - 6.2, { model: "fantasy-town/wall-wood" });
  P(M.n + n, M.e - 6.2, { model: "fantasy-town/wall-wood", y: 4 });
}
P(M.n - 2, M.e - 6.5, { model: "mini-dungeon/barrel", y: 2 });
P(M.n + 2, M.e - 6.5, { model: "mini-dungeon/barrel", y: 2, scale: 0.8 });
P(M.n + 2, M.e - 4, { model: "mini-characters/character-male-a", y: 2, yaw: -90, anim: "holding-both" });
P(M.n - 2, M.e - 3, { model: "mini-characters/character-female-a", y: 2, yaw: -90, anim: "jump" });
P(M.n + 4, M.e + 4, { model: "mini-characters/character-male-c", yaw: 90, anim: "emote-yes" });
P(M.n - 6, M.e + 1, { model: "fantasy-town/lantern" });
P(M.n + 6, M.e + 1, { model: "fantasy-town/lantern" });

// ---------------------------------------------------------------------------------------------
// Lead Me To The Light (south-west): lantern trail through graveyard woods to a lighthouse on a cove.
const trail = path([-12, -10], [-36, -22]);
const trailSide = (t: number, side: number) => trail.at(t, side);
[0, 0.25, 0.5, 0.75, 1].forEach((t, k) => {
  const [n, e] = trailSide(t, k % 2 ? 3 : -3);
  P(n, e, { model: "fantasy-town/lantern" });
});
[0.15, 0.35, 0.55, 0.75].forEach((t, k) => {
  for (const side of [-9, -6, 6, 9]) {
    const [n, e] = trailSide(t, side);
    const model = (k + side) % 2 ? "graveyard-kit/gravestone-cross" : "graveyard-kit/gravestone-round";
    P(n, e, { model, yaw: trail.yaw + 90 * Math.sign(side) + k * 7 });
  }
});
[0, 0.3, 0.6, 0.95].forEach((t, k) => {
  for (const side of [-14, 14]) {
    const [n, e] = trailSide(t, side + (k % 2 ? 1.5 : -1.5));
    P(n, e, { model: "graveyard-kit/pine", scale: 1.6, yaw: k * 50 + side });
  }
});
for (const t of [0.05, 0.13]) {
  for (const side of [-4.5, 4.5]) {
    const [n, e] = trailSide(t, side);
    P(n, e, { model: "graveyard-kit/iron-fence", yaw: trail.yaw + 90, scale: 1.2 });
  }
}
{
  const [n, e] = trailSide(0.45, -12);
  P(n, e, { model: "graveyard-kit/crypt-small", scale: 1.4, yaw: trail.yaw - 90 });
}
[0.2, 0.5, 0.8].forEach((t, k) => {
  const [n, e] = trailSide(t, k % 2 ? 1.5 : -1.5);
  P(n, e, { model: "graveyard-kit/pumpkin", scale: 1.3, body: "dynamic" });
});
const L = { n: -48, e: -34 };
P(L.n, L.e, { model: "pirate-kit/tower-complete-large", yaw: yawToward(1, 1) });
P(-40, -29, { model: "fantasy-town/lantern" });
// The cove: a dug bowl south of the lighthouse with beached pirate ships
P(-52, -52, { model: "pirate-kit/ship-pirate-large", yaw: 60, y: -1.2 });
P(-36, -60, { model: "pirate-kit/ship-wreck", yaw: -30, y: -1.5 });
P(-44, -44, { model: "mini-dungeon/barrel", scale: 1.3, body: "dynamic" });
P(-45.5, -42.5, { model: "mini-dungeon/barrel", scale: 1.3, body: "dynamic" });
P(-41, -39, { model: "mini-characters/character-female-a", yaw: yawToward(-1, -1), anim: "idle" });

// ---------------------------------------------------------------------------------------------
const markers: PlanetMarker[] = [
  marker(H.n - 16, H.e - 3, { id: "super-mega-ultra-pong", kind: "game", label: "Mega Ultra Pong" }),
  marker(S.n, S.e - 12, { id: "shoot-em-all", kind: "game", label: "Shoot 'Em All" }),
  marker(D.n + 18, D.e, { id: "rat-catcher", kind: "game", label: "Rat Catcher" }),
  marker(-40, -24, { id: "lead-me-to-the-light", kind: "game", label: "Lead Me To The Light" }),
  marker(M.n, M.e + 9, { id: "get-notes", kind: "game", label: "Get Notes" }),
];

const pads: FlatPad[] = [
  // Wide, gentle plaza first so the zone pads below win where they overlap it
  pad(0, 0, 14, { blend: 10 }),
  // Coaster run
  pad(-6, -45, 10),
  pad(14, -46, 10),
  pad(34, -47, 10),
  // Arcade hall + forecourt
  pad(H.n - 4, H.e, 20),
  // Launch pad and hangar
  pad(S.n, S.e + 4, 18),
  // Dungeon mound: a raised earth pad the cave sits in
  pad(D.n, D.e, 20, { height: 1, blend: 10 }),
  // Music stage
  pad(M.n - 2, M.e + 2, 13),
  // Graveyard trail
  pad(-14, -12, 10),
  pad(-24, -16, 12),
  pad(-34, -22, 10),
  // Lighthouse bluff, then the cove bowl south of it
  pad(-45, -31, 12, { height: 1.5 }),
  pad(-50, -52, 10, { height: -3, blend: 10 }),
];

export const gamedevLayout: BiomeLayout = {
  biome: "gamedev",
  spawn: { ...at(-8, 0), yaw: 0 },
  pads,
  markers,
  placements,
};
