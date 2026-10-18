// Biome layout: raceway — "Speed King Canyon" (biome agent A). The launch centrepiece.
//
// A dirt stadium circuit on a flattened red-dirt valley floor: an asphalt start/finish straight on
// the south side (gantry, banner towers, chequered flags, grandstands), then dirt all the way round,
// with two earthen kickers on the back straight and raised berms on the outside of both hairpins.
// The infield holds the pit garage you can drive into (two 4.5 m bays) and an open tent row.
// Natural canyon hills and two mesas ring the valley. Lap ≈ 240 m; flowing at 15–25 m/s.
//
//                          N
//                ▲ mesa                 ▲ mesa
//        ╭─────── back straight (kickers ⌒ ⌒) ───────╮
//  berm )                                             ( berm
//       │   [tent row]   [PIT GARAGE]                  │
//       │      ● speed-king  ↓ open                    │      [billboard]
//        ╰══ spawn → ═══ START ▥ asphalt ═══════════════╯
//             [stands] [stands] [covered] [covered]
//                          S
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { BIOMES } from "@/world/planet/biomes";
import { author, yawToward } from "./a/kit";

const CENTER = BIOMES.find((b) => b.id === "raceway")!.center;
const { at, place, placeC, marker } = author(CENTER);

// Stadium track: straights at n = ±HALF, hairpins centred on (0, ±TURN_E) with centreline radius HALF.
const HALF = 22;
const TURN_E = 26;
const DEG = Math.PI / 180;

/** Point on a circle around a hairpin centre: phi = 0 points away from the infield (east / west). */
function turnPoint(side: 1 | -1, radius: number, phiDeg: number): [number, number] {
  return [radius * Math.sin(phiDeg * DEG), side * (TURN_E + radius * Math.cos(phiDeg * DEG))];
}

// --- Start/finish straight (south, heading east): racing asphalt on the flat pad ---------------
const straight: PlanetPlacement[] = [
  place(-HALF, -20, { model: "racing-kit/roadStraight", yaw: -90 }),
  place(-HALF, -12, { model: "racing-kit/roadStraightArrow", yaw: -90 }),
  place(-HALF, -4, { model: "racing-kit/roadStraight", yaw: -90 }),
  // 16 m start piece with the gantry: local z −12..4 runs east, so its centre lands at e = 8
  place(-HALF, 12, { model: "racing-kit/roadStart", yaw: -90 }),
  place(-HALF, 20, { model: "racing-kit/roadStraight", yaw: -90 }),
  // banner towers and chequered flags framing the line
  placeC(-HALF - 7.5, -24, { model: "racing-kit/bannerTowerRed", yaw: 0 }),
  placeC(-HALF + 7.5, -24, { model: "racing-kit/bannerTowerGreen", yaw: 0 }),
  placeC(-HALF - 7.5, 28, { model: "racing-kit/bannerTowerGreen", yaw: 0 }),
  placeC(-HALF + 7.5, 28, { model: "racing-kit/bannerTowerRed", yaw: 0 }),
  placeC(-HALF - 6, 1, { model: "racing-kit/flagCheckers", yaw: 90 }),
  placeC(-HALF + 6, 1, { model: "racing-kit/flagCheckers", yaw: 90 }),
  placeC(-HALF - 6.5, -10, { model: "racing-kit/lightPostLarge", yaw: 0 }),
  placeC(-HALF - 6.5, 18, { model: "racing-kit/lightPostLarge", yaw: 0 }),
];

// --- Grandstands south of the straight, facing north (the kit's stands face their local +Z) -------------------------------------------
const stands: PlanetPlacement[] = [
  placeC(-35, -18, { model: "racing-kit/grandStand", yaw: 0 }),
  placeC(-35, -10, { model: "racing-kit/grandStand", yaw: 0 }),
  placeC(-35, -2, { model: "racing-kit/grandStandCovered", yaw: 0 }),
  placeC(-35, 6, { model: "racing-kit/grandStandCovered", yaw: 0 }),
  placeC(-35, 14, { model: "racing-kit/grandStandAwning", yaw: 0 }),
  placeC(-35, 22, { model: "racing-kit/grandStand", yaw: 0 }),
  placeC(-30, -28, { model: "racing-kit/camera_exclusive", yaw: 30 }),
];

// --- Hairpins: red/white barriers on the outside, tyre stacks on the inside apex ---------------
const turns: PlanetPlacement[] = [];
for (const side of [1, -1] as const) {
  [-80, -55, -30, -5, 20, 45, 70].forEach((phi, i) => {
    const [n, e] = turnPoint(side, HALF + 6.5, phi);
    const [rn, re] = [n, e - side * TURN_E]; // radial direction
    turns.push(
      placeC(n, e, {
        model: i % 2 ? "racing-kit/barrierWhite" : "racing-kit/barrierRed",
        yaw: yawToward(rn, re),
        scale: 1.5,
      }),
    );
  });
  for (const phi of [-40, 0, 40]) {
    const [n, e] = turnPoint(side, HALF - 7, phi);
    turns.push(place(n, e, { model: "car-kit/wheel-dark", y: 0.5, yaw: phi * side }));
    turns.push(place(n + 0.9, e, { model: "car-kit/wheel-dark", y: 0.5, yaw: phi * side }));
    turns.push(place(n + 0.45, e, { model: "car-kit/wheel-dark", y: 1.5, yaw: phi * side }));
  }
}

// --- Back straight (north): barrier wall on the outside, flags at the kickers --------------------
const back: PlanetPlacement[] = [];
for (const e of [-20, -4, 12]) {
  back.push(placeC(HALF + 7, e + 4, { model: "racing-kit/barrierWall", yaw: 180 }));
}
back.push(
  placeC(HALF - 6.5, -6, { model: "racing-kit/flagRed", yaw: 90 }),
  placeC(HALF - 6.5, 10, { model: "racing-kit/flagGreen", yaw: 90 }),
  placeC(HALF + 8.5, 26, { model: "racing-kit/treeLarge" }),
  placeC(HALF + 9, -28, { model: "racing-kit/treeSmall" }),
);

// --- Infield: pit garage (drive-in) and the open tent row ---------------------------------------
// pitsGarage at scale 1.8: 14.4 m wide, two 4.5 m bays split by a centre pillar, ceiling ≈ 6.3 m.
// The shell has no collider; three fences (back + sides) and a post inside the pillar give it walls.
const G: [number, number] = [-4, 10];
const GS = 1.8;
const pits: PlanetPlacement[] = [
  place(G[0], G[1], { model: "racing-kit/pitsGarage", yaw: 180, scale: GS, collider: "none" }),
  place(G[0], G[1], { model: "racing-kit/fenceStraight", yaw: 0, scale: GS }), // back (north)
  place(G[0], G[1], { model: "racing-kit/fenceStraight", yaw: 90, scale: GS }), // west side
  place(G[0], G[1], { model: "racing-kit/fenceStraight", yaw: -90, scale: GS }), // east side
  place(G[0] - 7, G[1], { model: "factory-kit/structure-tall" }), // collider for the centre pillar
  // inside: a spare race car parked in the east bay (the west bay stays clear), crate and tyre at the back
  place(G[0] + 1, G[1] + 3.1, { model: "car-kit/race", yaw: 180 }),
  place(G[0] + 5.2, G[1] - 6, { model: "car-kit/box" }),
  place(G[0] + 5.2, G[1] + 6, { model: "car-kit/wheel-racing", y: 0.5, yaw: 90 }),
  place(G[0] - 5, G[1] + 12.5, { model: "racing-kit/pitsOffice", yaw: 180 }),
  place(G[0] + 4, G[1] + 18, { model: "racing-kit/radarEquipment", yaw: 200 }),
  // the open tent row west of the garage (posts only, no collider: drive through it)
  placeC(-4, -12, { model: "racing-kit/tentLong", collider: "none" }),
  place(-2, -16, { model: "car-kit/kart-oobi", yaw: 160 }),
  place(-2, -8, { model: "car-kit/kart-oozi", yaw: 200 }),
  place(-7, -12.5, { model: "mini-characters/character-male-c", yaw: 180, anim: "interact-right" }),
  place(-14, 21, { model: "mini-characters/character-female-a", yaw: 180, anim: "emote-yes" }),
  place(-11.5, 4, { model: "racing-kit/billboardLower", yaw: 180 }),
];

// --- The big double billboard straight ahead of the start, beyond the east hairpin --------------
const billboard: PlanetPlacement[] = [
  placeC(-32, 50, { model: "racing-kit/billboardDouble_exclusive", yaw: 90, scale: 1.6 }),
  placeC(-30, 41, { model: "racing-kit/treeSmall" }),
];

// --- Knockables: cones at the infield chicane and loose tyres ----------------------------------
const props: PlanetPlacement[] = [
  place(HALF - 3, -14, { model: "car-kit/cone", body: "dynamic" }),
  place(HALF - 3, -12, { model: "car-kit/cone", body: "dynamic" }),
  place(HALF - 3, 2, { model: "car-kit/cone", body: "dynamic" }),
  place(HALF - 3, 4, { model: "car-kit/cone", body: "dynamic" }),
  place(-HALF + 4, 30, { model: "car-kit/cone", body: "dynamic" }),
  place(-HALF + 4, -28, { model: "car-kit/cone", body: "dynamic" }),
  place(10, 50, { model: "car-kit/debris-tire", body: "dynamic", y: 0.5 }),
  place(12, 50.5, { model: "car-kit/debris-tire", body: "dynamic", y: 0.5 }),
  place(-10, -50, { model: "car-kit/debris-tire", body: "dynamic", y: 0.5 }),
  place(-12, -49.5, { model: "car-kit/debris-tire", body: "dynamic", y: 0.5 }),
];

// --- Canyon dressing outside the circuit --------------------------------------------------------
const canyon: PlanetPlacement[] = [
  placeC(46, -18, { model: "racing-kit/treeLarge" }),
  placeC(42, 32, { model: "racing-kit/treeLarge" }),
  placeC(38, -40, { model: "racing-kit/treeSmall" }),
  placeC(-50, 26, { model: "racing-kit/treeSmall" }),
  placeC(-46, -36, { model: "racing-kit/treeLarge" }),
  place(-44, 44, { model: "car-kit/truck-flat", yaw: 120 }),
  place(-46, 38, { model: "car-kit/tractor-shovel", yaw: 70 }),
  place(34, 56, { model: "city-roads/construction-barrier", yaw: -30 }),
  place(36, 4, { model: "city-roads/sign-highway", yaw: 0 }),
];

export const racewayLayout: BiomeLayout = {
  biome: "raceway",
  // On the grid, facing east down the start straight toward the gantry and the billboard
  spawn: { ...at(-HALF, -22), yaw: -90 },
  pads: [
    // the valley floor: whole circuit, stands and infield, dug 1 m below the natural centre
    { ...at(0, 0), radius: 56, blend: 12, height: -1 },
    // two kickers on the back straight
    { ...at(HALF, -6), radius: 2.5, blend: 4, height: 1.3 },
    { ...at(HALF, 10), radius: 2.5, blend: 4, height: 1.5 },
    // berms on the outside of both hairpins (banked by their blend)
    { ...at(...turnPoint(1, HALF + 11, -20)), radius: 4, blend: 7, height: 2.2 },
    { ...at(...turnPoint(1, HALF + 11, 25)), radius: 4, blend: 7, height: 2.2 },
    { ...at(...turnPoint(-1, HALF + 11, -20)), radius: 4, blend: 7, height: 2.2 },
    { ...at(...turnPoint(-1, HALF + 11, 25)), radius: 4, blend: 7, height: 2.2 },
    // a roller in the west hairpin
    { ...at(...turnPoint(-1, HALF, 0)), radius: 2.5, blend: 4, height: 0.8 },
    // mesas closing the canyon to the north
    { ...at(48, -22), radius: 7, blend: 9, height: 5 },
    { ...at(46, 30), radius: 7, blend: 9, height: 5 },
  ],
  markers: [marker(-13, -6, { id: "speed-king", kind: "game", label: "Speed King" })],
  placements: [...straight, ...stands, ...turns, ...back, ...pits, ...billboard, ...props, ...canyon],
};
