// Biome layout: gamedev (Game Dev Park). Owned by biome agent C.
// A night-side theme park: one zone per itch.io game around a central gate plaza, with a looping
// coaster as the landmark. Local metres from the biome centre: north = +n, east = +e.
// Small-planet budget: every footprint within 40 m of the centre, pads (with blend) within 46 m.
// Both roads leave north (321° and 39°), so the spawn sits at the north end of the plaza, just
// outside the park gate, facing south into the park, with two 12 m lanes kept clear behind it.
//
//                 roads ↖     SPAWN (20,0)     ↗ roads
//                             park gate        giant air hockey
//   coaster loop     music stage    [plaza]  → arcade hall (Pong), drive-through W → E
//   (W side)         (Get Notes)       ↓
//    station                         dungeon mound        launch pad + speeders
//       pirate cove    graveyard   (Rat Catcher),           (Shoot 'Em All)
//                   lighthouse     drive-through N → S
//                (Lead Me To The Light)
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, FlatPad, PlanetMarker, PlanetPlacement } from "@/world/planet/types";
import { localGrid as grid, path, yawToward } from "./c/helpers";

const CENTER = BIOMES.find((b) => b.id === "gamedev")!.center;
const { at, place, marker, spawn } = grid(CENTER);

/** Spawn in local metres (also used by gamedev.test.ts for the road-lane check) */
export const GAMEDEV_SPAWN: [number, number] = [20, 0];

type Rest = Omit<PlanetPlacement, "lat" | "lon">;
const placements: PlanetPlacement[] = [];
const P = (n: number, e: number, rest: Rest) => placements.push(place(n, e, rest));
/** A piece standing on the tangent plane of a planar pad centred at `site` (walls/floors stay square) */
const onPlane = (site: { n: number; e: number }) => (n: number, e: number, rest: Rest) =>
  placements.push({ ...place(n, e, rest), plane: at(site.n, site.e) });
const pad = (n: number, e: number, radius: number, rest: Omit<FlatPad, "lat" | "lon" | "radius"> = {}): FlatPad => ({
  ...at(n, e),
  radius,
  ...rest,
});

// ---------------------------------------------------------------------------------------------
// Gate plaza + spawn (north). The park gate is a drive-through arch, so it has no collider.
// The gate's east leg stands on the arcade hall pad's blend ring, ~1.3 m below the plaza: it is sunk to
// meet it (the west leg's plinth goes into the plaza).
P(11, 0, { model: "coaster-kit/park-entrance", collider: "none", y: -1.35 });
P(21, -13, { model: "fantasy-town/stall-red", yaw: 90, y: -0.4 }); // north of the stage, off the plaza
P(-2, 5, { model: "mini-characters/character-female-a", yaw: 140, anim: "emote-yes", y: -0.15 });
P(36, 0, { model: "coaster-kit/tree-large", yaw: 30 }); // between the two road lanes

// ---------------------------------------------------------------------------------------------
// Roller coaster (west). Station at rail level (y 0); the 16 m looping has its origin one kit unit
// above the rail, hence y = 4. The looping's entry lane is 4 m east of its origin, exit lane on it.
const COASTER_E = -24;
P(3, COASTER_E, { model: "coaster-kit/station" });
P(3.5, COASTER_E, { model: "coaster-kit/coaster-train-front", y: 0.25 });
P(13, COASTER_E - 4, { model: "coaster-kit/coaster-steel-looping", y: 4 });

// ---------------------------------------------------------------------------------------------
// Arcade hall: Super Mega Ultra Pong (east). Mini-arcade walls at ×2.4 → 6 m cells, 6 m tall.
// 18 × 18 m on a planar pad, open roof. Drive-through west → east: the doorways are 9 m clear (the
// west and east wall cells either side sit at ±7.6, tucked into the corners), so the car never has to
// turn round or reverse out.
const H = { n: 5, e: 24 };
const hall = onPlane(H);
const WALL = { model: "mini-arcade/wall" as const, scale: 2.4 };
for (const e of [-6, 0, 6]) {
  hall(H.n - 9, H.e + e, { ...WALL }); // south
  hall(H.n + 9, H.e + e, { ...WALL }); // north
}
for (const n of [-7.6, 7.6]) {
  hall(H.n + n, H.e - 9, { ...WALL, yaw: 90 }); // west (9 m doorway round n = 0)
  hall(H.n + n, H.e + 9, { ...WALL, yaw: 90 }); // east (9 m doorway round n = 0)
}
for (const e of [-6, 0, 6]) for (const n of [-6, 0, 6]) hall(H.n + n, H.e + e, { model: "mini-arcade/floor", scale: 2.4 });
// A few cabinets along the north and south walls (×1.6), clear of the doorways, leaving the middle
// lane free to drive through
const CAB = 1.6;
for (const e of [-4.6, -2.8]) hall(H.n + 6.4, H.e + e, { model: "mini-arcade/arcade-machine", scale: CAB, yaw: 180 });
hall(H.n + 6.2, H.e + 3, { model: "mini-arcade/dance-machine", scale: CAB, yaw: 180 });
for (const e of [-4.6, -2.2]) hall(H.n - 6.2, H.e + e, { model: "mini-arcade/pinball", scale: CAB });
hall(H.n - 6.2, H.e + 3.5, { model: "mini-arcade/claw-machine", scale: CAB });
hall(H.n + 3.6, H.e - 5, { model: "mini-characters/character-male-c", anim: "interact-right" });
// The Pong landmark: a giant air-hockey table out front, facing the spawn
P(18.6, 27.2, { model: "mini-arcade/air-hockey", scale: 3, yaw: 158, y: -0.3 }); // along the slope, clear of the hall pad's rim

// ---------------------------------------------------------------------------------------------
// Shoot 'Em All (south-east): a space launch pad with the shmup's speeders parked, meteors around.
const S = { n: -16, e: 23 };
const launch = onPlane(S);
for (const [n, e] of [[-4, -4], [-4, 4], [4, -4], [4, 4]] as const) {
  launch(S.n + n, S.e + e, { model: "space-kit/platform_large", collider: "none" });
}
// Both speeders parked side by side on the pad's east half, 7 m+ clear of the dungeon mound
launch(S.n - 4, S.e - 1, { model: "space-kit/craft_speederA", yaw: 120, y: 0.4, scale: 0.8 });
launch(S.n + 4, S.e + 3, { model: "space-kit/craft_speederD", yaw: 200, y: 0.4, scale: 0.8 });

// ---------------------------------------------------------------------------------------------
// Rat Catcher (south): a dungeon you drive into, under an earth mound. Mini-dungeon cells at
// ×1.8 → 4.5 m cubes, 4.95 m tall. 5×5 ring of walls, grass roof. A drive-through cave with 7 m
// doorways in the north and south walls: the wall cells either side of each door are pushed out to
// ±DOOR_SIDE (tucked into the corner cells), so the car never has to reverse out. Straight down the
// plaza axis from the gate, 1 m west of it so the mound stays 7 m clear of the arcade hall's corner.
const D = { n: -23, e: -1 };
const cave = onPlane(D);
const C = 4.5;
const DS = 1.8;
const DOOR_SIDE = 5.8;
for (let i = -2; i <= 2; i++) {
  for (let j = -2; j <= 2; j++) {
    const doorRow = Math.abs(i) === 2;
    if (Math.abs(j) === 2) {
      cave(D.n + i * C, D.e + j * C, { model: "mini-dungeon/wall", scale: DS }); // side walls and corners
      continue;
    }
    cave(D.n + i * C, D.e + j * C, { model: "mini-dungeon/floor", scale: DS });
    // the door rows' cells beside the doorway, pushed out to leave a 7 m opening
    if (doorRow && j !== 0) cave(D.n + i * C, D.e + j * DOOR_SIDE, { model: "mini-dungeon/wall", scale: DS });
  }
}
// The mound: grassy earth slabs over the whole cave (lintel over the doorway too), plus a crown
for (const i of [-1, 0, 1]) {
  for (const j of [-1, 0, 1]) cave(D.n + i * 7.5, D.e + j * 7.5, { model: "platformer-kit/block-grass-low-large", scale: 0.95, y: 4.95 });
}
cave(D.n - 1, D.e + 1, { model: "platformer-kit/block-grass-low-large", scale: 0.6, y: 6.85, yaw: 20 });
cave(D.n - 5.5, D.e - 5.5, { model: "mini-dungeon/chest", scale: 1.4, yaw: 45 });
cave(D.n - 5.5, D.e + 5.5, { model: "mini-dungeon/barrel", scale: 1.2, body: "dynamic" });
cave(D.n - 1.5, D.e - 5.5, { model: "mini-characters/character-male-a", anim: "holding-right" }); // off the lane

// ---------------------------------------------------------------------------------------------
// Get Notes (west of the plaza): a little wooden music stage facing east, with drum barrels and a
// tiny crowd. Deck = 2 m wood blocks; backdrop = two storeys of wood wall.
const M = { n: 6, e: -12.8 }; // the backdrop stands flush against the coaster station
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
P(M.n + 2, M.e + 3, { model: "mini-characters/character-male-c", yaw: 90, anim: "emote-yes" });
P(M.n + 6, M.e + 1, { model: "fantasy-town/lantern" });

// ---------------------------------------------------------------------------------------------
// Lead Me To The Light (south-west): lantern trail through graveyard woods to a lighthouse on a cove.
// The trail runs between the stage and the dungeon mound.
// The trail is 7 m+ clear: lanterns on its right (north-west) side only (the dungeon mound bounds
// the left), gravestones and the crypt further out.
const trail = path([-4, -12], [-19, -21]);
// `y` sets the ones on the trail pad's sloping rim onto the ground (grounded.test.ts)
for (const [t, y] of [[0.33, 0], [0.75, -0.25]] as const) {
  const [n, e] = trail.at(t, 4.6);
  P(n, e, { model: "fantasy-town/lantern", y });
}
for (const [t, side, y] of [[0.5, 6, 0], [0.8, 6, -0.25], [0.55, -6.5, 0]] as const) {
  const [n, e] = trail.at(t, side);
  const model = Math.round(t * 10 + side) % 2 ? "graveyard-kit/gravestone-cross" : "graveyard-kit/gravestone-round";
  P(n, e, { model, yaw: trail.yaw + 90 * Math.sign(side) + t * 20, y });
}
P(-30, -13, { model: "graveyard-kit/pine", scale: 1.3, yaw: 40 });
{
  const [n, e] = trail.at(0.7, 10);
  P(n, e, { model: "graveyard-kit/crypt-small", scale: 1.2, yaw: trail.yaw - 90 });
}
{
  const [n, e] = trail.at(0.33, 5.8); // at the foot of the first lantern
  P(n, e, { model: "graveyard-kit/pumpkin", scale: 1.3, body: "dynamic" });
}
const L = { n: -23, e: -25 };
P(L.n, L.e, { model: "pirate-kit/tower-complete-large", yaw: yawToward(1, 1), y: -0.3 });
// The cove: a dug bowl west of the trail with a beached pirate ship
P(-8.5, -32.5, { model: "pirate-kit/ship-pirate-small", scale: 0.5, yaw: 30, y: -1 });
P(-12, -22, { model: "mini-characters/character-female-a", yaw: yawToward(-1, -1), anim: "idle", y: -0.35 });

// ---------------------------------------------------------------------------------------------
// The arcade and dungeon markers sit beside their doorway approach lanes, not on them: the vehicle's
// wheel raycasts currently hit the 6 × 4 × 6 m zone sensors, so a sensor in a doorway lane acts as an
// invisible 4 m block the car stalls against (wheels spinning). Keep every sensor ≥ 1.5 m clear of
// the 2.8 m-wide lane through a door (see gamedev.test.ts).
const markers: PlanetMarker[] = [
  marker(12, 10, { id: "super-mega-ultra-pong", kind: "game", label: "Mega Ultra Pong" }),
  marker(-10, 17, { id: "shoot-em-all", kind: "game", label: "Shoot 'Em All" }),
  marker(-7, 7, { id: "rat-catcher", kind: "game", label: "Rat Catcher" }),
  marker(-21, -16, { id: "lead-me-to-the-light", kind: "game", label: "Lead Me To The Light" }),
  marker(4, -4, { id: "get-notes", kind: "game", label: "Get Notes" }),
];

const pads: FlatPad[] = [
  // Wide, gentle plaza first (it holds the spawn) so the zone pads below win where they overlap it
  pad(8, 0, 13, { blend: 8 }),
  // Coaster run
  pad(6, -26, 10, { blend: 6 }),
  // Arcade hall + doorways: a true flat floor under the modular walls
  pad(H.n, H.e, 16.5, { blend: 4.5, planar: true }),
  // Launch pad
  pad(S.n, S.e, 11, { blend: 5, planar: true, height: 0.5 }),
  // Dungeon mound: a raised, planar earth pad the cave sits in
  pad(D.n, D.e, 17, { height: 1, blend: 5, planar: true }),
  // Graveyard trail and lighthouse bluff
  pad(-11, -17, 8, { blend: 6 }),
  pad(-23, -25, 5, { height: 1, blend: 6 }),
  // The cove: a shallow dug bowl the ship sits beached in
  pad(-11, -31, 5, { height: -2, blend: 5 }),
  // Music stage: last, so the whole deck and backdrop stand on its flat core (the trail pad's ring
  // would otherwise tilt its south end)
  pad(6, -16.5, 7.5, { blend: 5, height: -0.43 }),
];

export const gamedevLayout: BiomeLayout = {
  biome: "gamedev",
  spawn: spawn(GAMEDEV_SPAWN[0], GAMEDEV_SPAWN[1], 180),
  pads,
  markers,
  placements,
};
