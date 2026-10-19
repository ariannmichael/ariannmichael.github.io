// Biome layout: raceway — "Speed King Canyon" (biome agent A). The launch centrepiece.
//
// A dirt stadium circuit on a flattened red-dirt valley floor, everything within 40 m of the centre.
// The asphalt start/finish straight runs along the north side (gantry, banner towers, chequered
// flags), with the camera tower on the infield grass past the line. Behind the straight sits the
// paddock: the drive-in pit garage (two bays) with the tent, kart and mechanic tight against its
// east wall. The whole south side reads as one spectator row — two grandstands and the big Speed
// King billboard behind the low wall, red/green flags flanking the kicker exits, trees bookending
// the row and a maintenance corner (tractor, loose tyre) behind its west end. The hairpins run out
// onto open flat dirt, red/white barriers hugging their outside; two earthen kickers sit on the
// back straight. The spawn is on the grid; the road lanes leave north-west (to Hometown) and
// north-east (to Downtown), so the north side past the straight is kept clear. Lap ≈ 130 m.
//
//                            N
//                ↖ lane                  lane ↗
//        ╭══ spawn → ══ ▥ START ════════════════════╮
//  dirt )   [PIT GARAGE][tent]  ● speed-king  [camera]
//        ╰──────── back straight (kickers ⌒ ⌒) ──────╯
//   [tractor] [tree] [stand] [BILLBOARD] [stand] [tree]
//                            S
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { BIOMES } from "@/world/planet/biomes";
import { author, yawToward } from "./a/kit";

const CENTER = BIOMES.find((b) => b.id === "raceway")!.center;
const { at, place, placeC, marker, spawn } = author(CENTER);

// Stadium track: straights at n = ±HALF, hairpins centred on (0, ±TURN_E) with centreline radius HALF.
const HALF = 13;
const TURN_E = 15;
const DEG = Math.PI / 180;

/** Point on a circle around a hairpin centre: phi = 0 points away from the infield (east / west). */
function turnPoint(side: 1 | -1, radius: number, phiDeg: number): [number, number] {
  return [radius * Math.sin(phiDeg * DEG), side * (TURN_E + radius * Math.cos(phiDeg * DEG))];
}

// --- Start/finish straight (north, heading east): racing asphalt on the flat valley floor --------
const straight: PlanetPlacement[] = [
  place(HALF, -12, { model: "racing-kit/roadStraight", yaw: -90 }),
  place(HALF, -4, { model: "racing-kit/roadStraightArrow", yaw: -90 }),
  // The start line: two plain 8 m tiles (a 16 m piece would lift its far corners ~0.9 m off the curved
  // ground; every tile now stands on the ground) under the kit's start gantry, 4 m past the arrow tile
  place(HALF, 4, { model: "racing-kit/roadStraight", yaw: -90 }),
  place(HALF, 12, { model: "racing-kit/roadStraight", yaw: -90 }),
  placeC(HALF, 8, { model: "racing-kit/overhead", yaw: -90, collider: "none" }), // its legs stand outside the 8 m road
  // banner towers on the infield side, framing the straight; chequered flags at the line
  placeC(HALF - 8.5, -20, { model: "racing-kit/bannerTowerRed", yaw: 0, y: -0.35 }), // 7 m+ clear of the pit garage
  placeC(HALF - 7.5, 18, { model: "racing-kit/bannerTowerGreen", yaw: 0, y: -0.2 }),
  placeC(HALF - 6, 1, { model: "racing-kit/flagCheckers", yaw: 90, y: -0.15 }),
  placeC(HALF + 6, 1, { model: "racing-kit/flagCheckers", yaw: 90, y: -0.2 }),
];

// --- Spectator row (south): two grandstands and the billboard behind the back straight, facing
// north across the circuit; the trees in `canyon` bookend the row's ends -------------------------
const stands: PlanetPlacement[] = [
  placeC(-23, -13.5, { model: "racing-kit/grandStandCovered", yaw: 0, y: -0.2 }),
  placeC(-23, 13.5, { model: "racing-kit/grandStand", yaw: 0, y: -0.2 }),
];

// --- Hairpins: red/white barriers hugging the outside of each turn, on the flat valley floor.
// The north-west quarter of the west hairpin stays open: the road to Hometown leaves across it.
//
// The barrier models' origin sits ~5 m from their footprint centre (a Kenney corner origin), so the
// pose's tangent plane is anchored well inside the ring and the base rides the sphere's curvature:
// every barrier floats a near-uniform ~0.4 m (the ring is only ~18 m out on the 90 m planet; the
// measured worst corners are 0.40..0.47). One constant grounds them all — the residual ±0.05 stays
// inside the grounding tolerances (grounded.test.ts), no per-barrier table needed.
const BARRIER_SINK = -0.43;
const turns: PlanetPlacement[] = [];
for (const side of [1, -1] as const) {
  const phis = side === 1 ? [-75, -50, -25, 0, 25, 50, 75] : [-75, -50, -25, 0];
  phis.forEach((phi, i) => {
    const [n, e] = turnPoint(side, HALF + 5, phi);
    const [rn, re] = [n, e - side * TURN_E]; // radial direction
    turns.push(
      placeC(n, e, {
        model: i % 2 ? "racing-kit/barrierWhite" : "racing-kit/barrierRed",
        yaw: yawToward(rn, re),
        scale: 1.5,
        y: BARRIER_SINK,
      }),
    );
  });
  const [n, e] = turnPoint(side, HALF - 7, 0);
  turns.push(place(n, e, { model: "car-kit/wheel-dark", y: 0.5 }));
  turns.push(place(n + 0.9, e, { model: "car-kit/wheel-dark", y: 0.5 }));
  turns.push(place(n + 0.45, e, { model: "car-kit/wheel-dark", y: 1.5 }));
}

// --- Back straight (south): a low wall between the kickers and the spectator row; red and green
// flags flanking the kicker exits, just past the wall's ends in front of the stands ---------------
const back: PlanetPlacement[] = [
  placeC(-HALF - 6, -4, { model: "racing-kit/barrierWall", yaw: 0 }),
  placeC(-HALF - 6, 4, { model: "racing-kit/barrierWall", yaw: 0 }),
  placeC(-HALF - 5.4, -9.2, { model: "racing-kit/flagRed", yaw: 90 }),
  placeC(-HALF - 5.4, 9.2, { model: "racing-kit/flagGreen", yaw: 90 }),
];

// --- Paddock (infield): the pit garage (drive-in, planar floor) with the tent, kart and mechanic
// tight against its east wall, and the camera tower by the start line filming the grid ------------
// pitsGarage at scale 2: 16 m wide, two ~7 m bays split by a centre pillar, ceiling ≈ 11 m,
// opening north onto the start straight. The shell has no collider; three fences (back + sides) and
// a post inside the pillar give it walls.
const G: [number, number] = [-0.5, -3];
const GS = 2;
const PIT = at(...G);
/** The 16 m shell's corners reach past the planar floor's rim, where the ground falls away: sunk to meet it */
const PIT_Y = -0.5;
const pits: PlanetPlacement[] = [
  place(G[0], G[1], { model: "racing-kit/pitsGarage", yaw: 0, scale: GS, collider: "none", y: PIT_Y, plane: PIT }),
  place(G[0], G[1], { model: "racing-kit/fenceStraight", yaw: 180, scale: GS, y: PIT_Y, plane: PIT }), // back (south)
  place(G[0], G[1], { model: "racing-kit/fenceStraight", yaw: 90, scale: GS, y: PIT_Y, plane: PIT }), // west side
  place(G[0], G[1], { model: "racing-kit/fenceStraight", yaw: -90, scale: GS, y: PIT_Y, plane: PIT }), // east side
  place(G[0] + 3.87 * GS, G[1], { model: "factory-kit/structure-tall", plane: PIT }), // collider for the centre pillar
  // inside: a spare race car in the east bay (the west bay stays clear), a tyre against the back wall
  place(G[0] - 1, G[1] + 3.8, { model: "car-kit/race", yaw: 0, plane: PIT }),
  place(G[0] - 6.5, G[1] + 5.5, { model: "car-kit/wheel-racing", y: 0.5, yaw: 90, plane: PIT }),
  // the open tent east of the garage (posts only, no collider: drive through it) with a kart
  placeC(-3.5, 10.5, { model: "racing-kit/tent", collider: "none", y: -0.2 }),
  place(-3, 10, { model: "car-kit/kart-oobi", yaw: 160 }),
  place(-6, 8.5, { model: "mini-characters/character-male-c", yaw: 180, anim: "interact-right" }),
  // the camera tower on the infield grass past the start line, a spotter beside it
  placeC(7, 6, { model: "racing-kit/camera_exclusive", yaw: 250, y: -0.2 }),
  place(5, 3.5, { model: "mini-characters/character-female-a", yaw: -50, anim: "emote-yes" }),
];

// --- The big double billboard behind the back straight, facing the grid across the infield -------
const billboard: PlanetPlacement[] = [placeC(-24, 0, { model: "racing-kit/billboardDouble_exclusive", yaw: 0, scale: 1.5, y: -0.4 })];

// --- Maintenance corner behind the spectator row's west end: the parked tractor's loose tyre -----
const props: PlanetPlacement[] = [place(-23.5, -27.5, { model: "car-kit/debris-tire", body: "dynamic", y: 0.5 })];

// --- Canyon dressing outside the circuit: trees bookending the spectator row, the tractor parked
// behind its west end and one standing north of the gantry -----------------------------------------
const canyon: PlanetPlacement[] = [
  placeC(30, 12, { model: "racing-kit/treeLarge", y: -0.15 }),
  placeC(-28, 17, { model: "racing-kit/treeSmall", y: -0.35 }),
  placeC(-26, -17, { model: "racing-kit/treeLarge" }),
  place(-20, -30, { model: "car-kit/tractor-shovel", yaw: 70, y: -0.35 }),
];

export const racewayLayout: BiomeLayout = {
  biome: "raceway",
  // On the grid, facing east down the start straight toward the gantry
  // (e −16: far enough west that the road lanes clear the wide pit garage)
  spawn: spawn(HALF, -16, -90),
  pads: [
    // the valley floor: circuit, stands and infield, dug 1 m below the natural centre
    { ...at(0, 0), radius: 34, blend: 10, height: -1 },
    // A pad's `height` is relative to the natural ground at ITS centre, which rolls by several metres
    // across the valley; these are tuned so each sits at the level noted, relative to the floor
    // (raceway.test.ts pins those levels).
    // the pit garage's planar floor: 0.25 m below the valley floor, so its rim meets the curved floor
    { ...PIT, radius: 9.5, blend: 3, planar: true, height: -1.74 },
    // two kickers on the back straight: floor + 1.3 m and + 1.5 m
    { ...at(-HALF, -6), radius: 2.5, blend: 4, height: 0.33 },
    { ...at(-HALF, 6), radius: 2.5, blend: 4, height: -2.63 },
  ],
  markers: [marker(4, 9.5, { id: "speed-king", kind: "game", label: "Speed King" })],
  placements: [...straight, ...stands, ...turns, ...back, ...pits, ...billboard, ...props, ...canyon],
};
