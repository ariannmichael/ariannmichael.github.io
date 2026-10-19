// Biome layout: opensource — Alien Crater (biome agent B).
//
// Sketch (north up, metres from the biome centre; the town fits in 40 m for the 90 m planet):
//
//               ↖ road lane        ↗ road lane
//                    ▲ spawn (20, −6), facing the crater
//                                       exit gate ⇦ ┌corner┐
//   [GLASS HANGAR]        pass ⇐ terraces    │      │
//        ∩                 │           ╱‾‾‾‾‾‾‾‾╲    │
//    ∩  ( crater bowl )  ∩   ⇐ lasers │ LAB ROOM │ ⇐ sealed door
//        rocket ◆openmined           ╲________╱
//    ∩         ∩        ∩             corridor (causeway)
//                                     entry gate ⇧
//
// The research base sits round the dug crater bowl. The lab is the drivable interior, built from
// modular-space-kit at kit scale 2: entry gate → corridor → octagonal room → north door → corner →
// exit gate (plus a laser gate on the room's west door). The 24 m room stands on a planar pad (its own
// tangent plane, so the octagon stays flat); the 8 m corridor pieces sit on flat pads levelled to the
// room plane's height at its doors.
//
// Piece inspection (cross-sections of the .glb meshes, metres at kit scale 2):
// - corridor: runs along its local X, 8 m long, open-topped. Walls are 0.8 m thick with their inner
//   faces 3.2 m from the axis; a 0.4 m kerb narrows the floor to 4.8 m. Clear height is 8.2 m.
//   The SUV (2.55 m wide, 2.2 m tall) fits with ~1.1 m either side, so no extra scale is needed.
// - room-small: 24 m octagon, inner wall faces 11 m from the centre, 5.2 m doorways on all 4 sides.
//   (room-large is 40 m across: too big for a 40 m town on the 90 m planet, so the lab uses room-small.)
// - gate: 4.8 m wide, ~8.8 m tall opening; gate-door has a bar across it (used as a sealed door).
// Every one of these is a closed box to the default collider (it would seal the corridor), so the
// shells get `collider: "none"` and the walls get their colliders from template-wall pieces tucked
// into the shell walls: the template slab's inner face sits 0.1 m behind the shell's inner face.
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";

export const OPENSOURCE_CENTER = BIOMES.find((b) => b.id === "opensource")!.center;
const s = site(OPENSOURCE_CENTER);

/** Spawn (anchor-frame north, east): on the north side, two road lanes open NW and NE. */
export const OPENSOURCE_SPAWN: [number, number] = [20, -6];
/** Spawn heading: south-west, looking down into the crater */
const SPAWN_YAW = 158;

// Pad heights (metres relative to the natural ground at each pad centre), measured with the layout
// probe (natural: room −3.90, entry corridor −5.73, corner 2.54, exit apron 3.44, laser apron 2.41);
// opensource.test.ts re-checks the levels. The room's planar floor is at ROOM_LEVEL and rises ~0.9 m
// to its doors (the tangent plane lifts off the sphere), so the corridor, corner and apron pads are
// levelled to DOOR_LEVEL: the entry corridor runs on a causeway over the crater hollow, and the corner
// and aprons are cut into the central ridge.
export const ROOM_LEVEL = -3.0;
export const DOOR_LEVEL = -2.1;
const H = { room: 0.9, south: 3.63, corner: -4.64, exit: -5.54, laser: -4.51, bowl: -5.2 - -5.14, spawn: 2, pass: -5.5 };

// The crater sits in a natural basin (floor ≈ −7 m) whose walls rise ~0.9 m/m toward the doors and the
// spawn — far too steep to drive. Every approach is stair-stepped:
// - North, from the spawn down into the bowl: a chain of small ramp pads every 2 m (like the financial
//   mesa road) cut along a constant 0.35 grade, from the spawn ring (3.1 m) onto the crater floor.
// - West, to the laser door: one wide landing at −3.0, blending both to the crater floor below and to
//   the laser door's apron above.
// - South, round the rim to the entry gate: terraces at −5.2 → −4.2 → −2.9 → pass −1.8 → causeway −2.1.
// Heights level each pad onto its rung of the ladder (target − natural, measured with the probe).
const NORTH_RAMP: { at: [number, number]; height: number }[] = [
  { at: [11.3, -9.1], height: 3.1 - 4.52 },
  { at: [9.4, -9.8], height: 2.4 - 3.59 },
  { at: [7.1, -10.3], height: 1.7 - 2.29 },
  { at: [5.1, -10.7], height: 1.0 - 1.68 },
  { at: [3.1, -11], height: 0.3 - 0.96 },
  { at: [1.1, -11.3], height: -0.4 - -0.81 },
  { at: [-0.9, -11.6], height: -1.1 - -1.62 },
  { at: [-2.8, -11.8], height: -1.8 - -2.16 },
  { at: [-4.8, -12.1], height: -2.5 - -2.59 },
  { at: [-6.7, -12.5], height: -3.2 - -3.53 },
  { at: [-8.7, -12.9], height: -3.9 - -4.38 },
  { at: [-10.6, -13.3], height: -3.9 - -4.76 },
];
// East exit (the corner's gate, heading west): the lab floor is at DOOR_LEVEL but the ridge it was cut
// into rises 5 m within 7 m of the gate (grade ~1), which tipped the car. A chain of pads every 1.9 m now
// grades from the gate (-2.1 m) up to the crest of NORTH_RAMP (about 2.3 m on the mesh, at
// (11.3, -9.1)) at a 0.3 grade over 15 m. The chain stops 4 m short of that crest, so the spawn ramp
// keeps its own shape.
const EXIT_RAMP: { at: [number, number]; height: number }[] = [
  { at: [12.0, 8.0], height: -2.10 - 2.72 },
  { at: [11.9, 6.1], height: -1.55 - 2.97 },
  { at: [11.8, 4.2], height: -1.00 - 3.32 },
  { at: [11.8, 2.3], height: -0.40 - 3.56 },
  { at: [11.7, 0.4], height: 0.20 - 3.61 },
  { at: [11.6, -1.5], height: 0.80 - 3.69 },
  { at: [11.5, -3.4], height: 1.40 - 3.98 },
  { at: [11.5, -5.3], height: 2.00 - 4.31 },
];
const TERRACES: { at: [number, number]; radius: number; blend: number; height: number }[] = [
  { at: [-10.5, -8], radius: 6, blend: 10, height: -3.0 - -1.92 }, // west drive: one landing above the bowl, blending to the laser door
  { at: [-21, -8], radius: 4.5, blend: 8, height: -4.2 - -3.55 }, // south drive, round the rim to the pass
  { at: [-25, -3], radius: 4.5, blend: 11, height: -2.9 - 0.02 },
];

// ---------------------------------------------------------------------------------------------
// Lab: fwd = north, right = east. Room centre at (−4, 14).
export const OPENSOURCE_LAB = s.frame(-4, 14, 0);
const LAB = OPENSOURCE_LAB;
/** The room and its door gates stand on the room's tangent plane */
const ROOM = s.frame(-4, 14, 0, { planar: true });
const MSK = "modular-space-kit";
const SHELL = { collider: "none" as const, y: 0.03 };
/**
 * The corridor pieces each side of the room stand on its planar pad's rim, which holds the plane's
 * rim height while their inner ends reach over the plane itself (lower): sunk so the inner end meets
 * the room's door and the outer end is only slightly set into its pad.
 */
const RUN_Y = -0.3;
const RUN = { collider: "none" as const, y: 0.03 + RUN_Y };
const WALL_FACE = 3.3; // collider wall inner face, metres from a corridor axis

/** Hidden collider walls for a straight corridor centred at (f, r); `alongFwd` = runs along fwd. */
function corridorWalls(f: number, r: number, alongFwd: boolean): PlanetPlacement[] {
  const model = `${MSK}/template-wall`;
  return alongFwd
    ? [LAB.place(f, r + WALL_FACE, { model, yaw: 90, y: RUN_Y }), LAB.place(f, r - WALL_FACE, { model, yaw: -90, y: RUN_Y })]
    : [LAB.place(f + WALL_FACE, r, { model, yaw: 180, y: RUN_Y }), LAB.place(f - WALL_FACE, r, { model, yaw: 0, y: RUN_Y })];
}

function lab(): PlanetPlacement[] {
  const out: PlanetPlacement[] = [];
  const half = `${MSK}/template-wall-half`;

  // Entry gate and corridor from the south
  out.push(LAB.place(-20.6, 0, { model: `${MSK}/gate`, ...RUN }));
  out.push(LAB.place(-16, 0, { model: `${MSK}/corridor`, yaw: 90, ...RUN }));
  out.push(...corridorWalls(-16, 0, true));

  // Octagonal room with 4 doorways: south connects the entry corridor, north the corner, west has a
  // laser gate you can drive through, east is sealed with a barred door.
  out.push(ROOM.place(0, 0, { model: `${MSK}/room-small`, ...SHELL }));
  for (const [a, b] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    // Two straight half-walls either side of each doorway, facing the centre
    for (const side of [-5.6, 5.6]) {
      const f = a * 11.1 + b * side;
      const r = b * 11.1 + a * side;
      out.push(ROOM.place(f, r, { model: half, yaw: (Math.atan2(r, -f) * 180) / Math.PI }));
    }
  }
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    // Diagonal corners of the octagon
    const f = a * 9.8;
    const r = b * 9.8;
    out.push(ROOM.place(f, r, { model: half, yaw: (Math.atan2(r, -f) * 180) / Math.PI }));
  }
  out.push(ROOM.place(0, -12.6, { model: `${MSK}/gate-lasers`, yaw: 90, ...SHELL }));
  out.push(ROOM.place(0, 12.6, { model: `${MSK}/gate-door`, yaw: 90, y: 0.03 }));

  // North doorway straight into a corner turning west, then the exit gate
  out.push(LAB.place(16, 0, { model: `${MSK}/corridor-corner`, yaw: -90, ...RUN }));
  out.push(LAB.place(16 + WALL_FACE, -2, { model: half, yaw: 180, y: RUN_Y }));
  out.push(LAB.place(14, WALL_FACE, { model: half, yaw: 90, y: RUN_Y }));
  out.push(LAB.place(18.3, 2.3, { model: half, yaw: 135, y: RUN_Y }));
  out.push(LAB.place(16, -4.6, { model: `${MSK}/gate`, yaw: 90, ...RUN }));

  // Inside the room: the federated-learning setup. A central aggregator flush against the east wall
  // (7 m+ from the other walls, so the lanes and the loop round it stay open) and client nodes at the
  // corners.
  out.push(ROOM.place(0, 8.3, { model: "space-kit/machine_generatorLarge", yaw: 90 }));
  out.push(ROOM.place(6.5, 6.5, { model: "space-kit/desk_computerScreen", yaw: 135 }));
  out.push(ROOM.place(-6.5, 6.5, { model: "space-kit/desk_computerScreen", yaw: 45 }));
  out.push(ROOM.place(6.5, -6.5, { model: "space-kit/desk_computerScreen", yaw: -135 }));
  out.push(ROOM.place(-6.5, -6.5, { model: "space-kit/desk_computerScreen", yaw: -45 }));
  // Cables on the corridor floor (flat, drive-over)
  out.push(LAB.place(-16, 0, { model: `${MSK}/cables`, y: 0.05 + RUN_Y, collider: "none" }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Crater bowl research base

const BOWL: [number, number] = [-12, -14];
/** The dug crater bowl, on the crater floor (exported for the tests' drive routes) */
export const OPENSOURCE_BOWL: [number, number] = BOWL;
/** OpenMined HQ: the glass hangar west of the bowl, on its own tangent plane (13 m wide), 7 m+ clear
 *  of the rocket */
const HQ_AT: [number, number] = [0, -31];
const HQ = s.frame(...HQ_AT, 0, { planar: true });
const base: PlanetPlacement[] = [
  HQ.place(0, 0, { model: "space-kit/hangar_roundGlass", yaw: -110 }),
  // Stacked rocket (base 6.4 m + fuel 4 m + nose) on the bowl floor
  s.place(-18, -21, { model: "space-kit/rocket_baseA" }), // on its own launch pad (PROP_PADS)
  s.place(-18, -21, { model: "space-kit/rocket_fuelB", y: 6.4 }),
  s.place(-18, -21, { model: "space-kit/rocket_topA", y: 10.4 }),
  s.place(18, -26, { model: "space-kit/hangar_smallA", yaw: 60, y: -0.25 }), // on its own pad (PROP_PADS)
  // on the slope above the north ramp (no level spot or room for a pad here): set into it
  s.place(8, -14, { model: "space-kit/machine_wirelessCable", yaw: 160, scale: 1.4, y: -0.55 }),
  s.place(-14, -24, { model: "space-kit/alien", yaw: -60, scale: 1.2 }),
  s.place(-9, -17, { model: "space-kit/rover", yaw: 120, body: "dynamic" }), // on the bowl floor, off the ramp
  // Satellite dishes and antennas round the rim, looking up at the stars
  s.place(-32, -6, { model: "space-kit/satelliteDish_large", yaw: 210 }),
  s.place(14, -33, { model: "space-kit/chimney_detailed", y: -0.3 }),
  s.place(-28, 24, { model: "space-kit/chimney_detailed", scale: 0.8, y: -0.25 }),
];

const ROCK_MODELS = [
  "space-kit/rock_crystalsLargeA",
  "space-kit/rock_largeA",
  "space-kit/rock_crystalsLargeB",
  "space-kit/meteor_detailed",
] as const;

// Alien rocks, crystals and impact craters on the town edge (craters are flat decals), each 7 m+ clear
// of the lab and the base buildings
// Each rock's `y` sets it onto the slope under it (the meteor sits half-buried); the craters lie on
// level spots (a flat decal on a slope floats at one rim), the one on the north-east slope dug in.
const rocks: PlanetPlacement[] = [
  ...([
    [5, 33, -0.2], [-26, -11, -0.2], [24, -22, -1.2],
  ] as const).map(([n, e, y], i) =>
    s.place(n, e, {
      model: ROCK_MODELS[(i + 1) % 4],
      yaw: i * 53,
      scale: 1 + (i % 3) * 0.25,
      y,
    }),
  ),
  ...([
    [-14, 32, 0, -0.55], [-34, 10, 0, 0], [24, 22, 90, -0.35], [-34, 0, 0, 0], [24, 14, 90, 0],
  ] as const).map(([n, e, dy, y], i) =>
    s.place(n, e, { model: i % 2 ? "space-kit/craterLarge" : "space-kit/crater", yaw: i * 71 + dy, scale: 1.6, collider: "none", y }),
  ),
  s.place(-14, -27, { model: "space-kit/rocks_smallA", yaw: 40 }),
];

// Rim mounds on the bowl's far side double as jumps (the drives in from the spawn, to the lab and
// round to the entry gate stay clear)
const rim = [
  [170, 13],
  [250, 12],
].map(([deg, rad], i) => {
  const a = (deg * Math.PI) / 180;
  return s.pad(BOWL[0] + Math.cos(a) * rad, BOWL[1] + Math.sin(a) * rad, 2.5, { blend: 5, height: 1.8 + i * 0.5 });
});

// Level pads under props that stood across a slope (heights keep each at its old ground level)
const PROP_PADS = [
  s.pad(-18, -21, 6, { blend: 5, height: 2.95 }), // rocket, on the west landing's ring
  s.pad(18, -26, 7, { blend: 5 }), // small hangar
];

// Lab floors: flat pads for the entry corridor and its apron, the corner, the exit apron and the
// laser door's apron, then the room's planar pad last so its flat core wins. The room's square base
// reaches 17 m out at its corners: the plane spreads 15.5 m (radius) and holds near its rim height a
// little beyond, as far as the corridor pads allow.
export const OPENSOURCE_LAB_PADS = [
  s.pad(...LAB.ne(-22, 0), 7, { blend: 6, height: H.south }), // entry corridor, gate and apron
  s.pad(...LAB.ne(16, 0), 5.5, { blend: 5, height: H.corner }), // corner
  s.pad(...LAB.ne(16, -11), 4.5, { blend: 6, height: H.exit }), // exit apron
  s.pad(...LAB.ne(0, -17), 4, { blend: 8, height: H.laser }), // laser door apron
  s.pad(-4, 14, 15.5, { blend: 9, height: H.room, planar: true }), // room
];

export const opensourceLayout: BiomeLayout = {
  biome: "opensource",
  spawn: s.spawn(...OPENSOURCE_SPAWN, SPAWN_YAW),
  pads: [
    s.pad(...OPENSOURCE_SPAWN, 5, { blend: 6, height: H.spawn }), // spawn, raised toward the ridge
    s.pad(...BOWL, 7, { blend: 12, height: H.bowl }), // dug crater bowl: a level 7 m floor at −6.5 m
    s.pad(...HQ_AT, 9.5, { blend: 5, planar: true }), // OpenMined HQ (its 13 m hangar's corners reach 8.6 m)
    ...TERRACES.map((t) => s.pad(...t.at, t.radius, { blend: t.blend, height: t.height })),
    s.pad(-29, 1, 4, { blend: 10, height: H.pass }), // a pass cut through the central ridge, toward the entry gate
    // The ramp comes after the bowl and the terraces: their wide blend rings reach under the road,
    // so the ramp pads must be applied last to carve it at its own grade through the crater wall
    ...NORTH_RAMP.map((p) => s.pad(...p.at, 1, { blend: 5, height: p.height })),
    ...rim,
    ...PROP_PADS,
    ...OPENSOURCE_LAB_PADS,
    // After the lab pads: the exit apron's flat core and blend would otherwise flatten the ramp's start
    ...EXIT_RAMP.map((p) => s.pad(...p.at, 1, { blend: 5, height: p.height })),
  ],
  markers: [s.marker(-14, -15, { id: "openmined", kind: "job", label: "OpenMined" })],
  placements: [...lab(), ...base, ...rocks],
};
