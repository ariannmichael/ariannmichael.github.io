// Biome layout: opensource — Alien Crater (biome agent B).
//
// Sketch (north up, metres from the biome centre; the pole is ~52 m north):
//
//                                   ┌corner┐
//                       exit gate ⇦ corridor ┘│
//                                      corridor
//          rim mound ∩              ╱‾‾‾‾‾‾‾‾╲
//     ∩          ∩      lasers ⇦  │ LAB ROOM │ ⇨ sealed door
//   ▲ spawn   ( crater bowl )      ╲________╱
//     ∩   rocket ◆openmined [GLASS HANGAR]  │corridor
//          ∩    dishes  ∩                  entry gate ⇧
//
// The research base sits on the dug crater floor. The lab is the drivable interior, built from
// modular-space-kit at kit scale 2: entry gate → corridor → octagonal room → corridor → corner →
// corridor → exit gate (plus a laser gate on the room's west door).
//
// Piece inspection (cross-sections of the .glb meshes, metres at kit scale 2):
// - corridor: runs along its local X, 8 m long, open-topped. Walls are 0.8 m thick with their inner
//   faces 3.2 m from the axis; a 0.4 m kerb narrows the floor to 4.8 m. Clear height is 8.2 m.
//   The SUV (2.55 m wide, 2.2 m tall) fits with ~1.1 m either side, so no extra scale is needed.
// - room-small: 24 m octagon, inner wall faces 11 m from the centre, 5.2 m doorways on all 4 sides.
//   (room-large is 40 m across: on a 150 m planet its edges would float ~1.3 m above the pad.)
// - gate: 4.8 m wide, ~8.8 m tall opening; gate-door has a bar across it (used as a sealed door).
// Every one of these is a closed box to the default collider (it would seal the corridor), so the
// shells get `collider: "none"` and the walls get their colliders from template-wall pieces tucked
// into the shell walls: the template slab's inner face sits 0.1 m behind the shell's inner face.
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";

const s = site({ lat: 70, lon: -20 });

// ---------------------------------------------------------------------------------------------
// Lab: fwd = north, right = east. Room centre at (−6, 34).
export const OPENSOURCE_LAB = s.frame(-6, 34, 0);
const LAB = OPENSOURCE_LAB;
const MSK = "modular-space-kit";
const SHELL = { collider: "none" as const, y: 0.03 };
const WALL_FACE = 3.3; // collider wall inner face, metres from a corridor axis

/** Hidden collider walls for a straight corridor centred at (f, r); `alongFwd` = runs along fwd. */
function corridorWalls(f: number, r: number, alongFwd: boolean): PlanetPlacement[] {
  const model = `${MSK}/template-wall`;
  return alongFwd
    ? [LAB.place(f, r + WALL_FACE, { model, yaw: 90 }), LAB.place(f, r - WALL_FACE, { model, yaw: -90 })]
    : [LAB.place(f + WALL_FACE, r, { model, yaw: 180 }), LAB.place(f - WALL_FACE, r, { model, yaw: 0 })];
}

function lab(): PlanetPlacement[] {
  const out: PlanetPlacement[] = [];
  const half = `${MSK}/template-wall-half`;

  // Entry gate and corridor from the south
  out.push(LAB.place(-20.6, 0, { model: `${MSK}/gate`, ...SHELL }));
  out.push(LAB.place(-16, 0, { model: `${MSK}/corridor`, yaw: 90, ...SHELL }));
  out.push(...corridorWalls(-16, 0, true));

  // Octagonal room with 4 doorways: south/north connect the corridors, west has a laser gate you can
  // drive through, east is sealed with a barred door.
  out.push(LAB.place(0, 0, { model: `${MSK}/room-small`, ...SHELL }));
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
      out.push(LAB.place(f, r, { model: half, yaw: (Math.atan2(r, -f) * 180) / Math.PI }));
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
    out.push(LAB.place(f, r, { model: half, yaw: (Math.atan2(r, -f) * 180) / Math.PI }));
  }
  out.push(LAB.place(0, -12.6, { model: `${MSK}/gate-lasers`, yaw: 90, ...SHELL }));
  out.push(LAB.place(0, 12.6, { model: `${MSK}/gate-door`, yaw: 90, y: 0.03 }));

  // North corridor, corner turning west, west corridor, exit gate
  out.push(LAB.place(16, 0, { model: `${MSK}/corridor`, yaw: 90, ...SHELL }));
  out.push(...corridorWalls(16, 0, true));
  out.push(LAB.place(24, 0, { model: `${MSK}/corridor-corner`, yaw: -90, ...SHELL }));
  out.push(LAB.place(24 + WALL_FACE, -2, { model: half, yaw: 180 }));
  out.push(LAB.place(22, WALL_FACE, { model: half, yaw: 90 }));
  out.push(LAB.place(26.3, 2.3, { model: half, yaw: 135 }));
  out.push(LAB.place(24, -8, { model: `${MSK}/corridor`, ...SHELL }));
  out.push(...corridorWalls(24, -8, false));
  out.push(LAB.place(24, -12.6, { model: `${MSK}/gate`, yaw: 90, ...SHELL }));

  // Inside the room: the federated-learning setup. A central aggregator off to the east side
  // (the lane through the room stays clear) and client nodes around it.
  out.push(LAB.place(2, 7, { model: "space-kit/machine_generatorLarge", yaw: 90 }));
  out.push(LAB.place(-3.5, 7.5, { model: "space-kit/machine_wireless", yaw: 60 }));
  out.push(LAB.place(6.5, 6.5, { model: "space-kit/desk_computerScreen", yaw: 135 }));
  out.push(LAB.place(-6.5, 6.5, { model: "space-kit/desk_computerScreen", yaw: 45 }));
  out.push(LAB.place(6.5, -6.5, { model: "space-kit/desk_computerScreen", yaw: -135 }));
  out.push(LAB.place(-6.5, -6.5, { model: "space-kit/desk_computerScreen", yaw: -45 }));
  out.push(LAB.place(-5, -4, { model: "space-kit/machine_barrelLarge" }));
  out.push(LAB.place(3, -5, { model: "space-kit/barrel", body: "dynamic" }));
  out.push(LAB.place(3.8, -5.6, { model: "space-kit/barrel", body: "dynamic" }));
  out.push(LAB.place(-3, 4.2, { model: "space-kit/barrel", body: "dynamic" }));
  // Cables on the corridor floors (flat, drive-over)
  out.push(LAB.place(-16, 0, { model: `${MSK}/cables`, y: 0.05, collider: "none" }));
  out.push(LAB.place(16, 0, { model: `${MSK}/cables`, y: 0.05, yaw: 90, collider: "none" }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Crater bowl research base

const BOWL: [number, number] = [-4, -6];
const base: PlanetPlacement[] = [
  // Glass hangar = OpenMined HQ, facing south over the bowl floor
  s.place(4, -6, { model: "space-kit/hangar_roundGlass", yaw: 180 }),
  // Stacked rocket (base 6.4 m + fuel 4 m + nose)
  s.place(-6, -19, { model: "space-kit/rocket_baseA" }),
  s.place(-6, -19, { model: "space-kit/rocket_fuelB", y: 6.4 }),
  s.place(-6, -19, { model: "space-kit/rocket_topA", y: 10.4 }),
  s.place(6, 8, { model: "space-kit/hangar_smallA", yaw: 200 }),
  s.place(-14, 4, { model: "space-kit/hangar_largeA", yaw: 100 }),
  s.place(-10, 8, { model: "space-kit/machine_generator", yaw: 30 }),
  s.place(8, -18, { model: "space-kit/machine_barrel", yaw: -40 }),
  s.place(-2, 8, { model: "space-kit/machine_wirelessCable", yaw: 180, scale: 1.4 }),
  s.place(-22, -20, { model: "space-kit/craft_speederA", yaw: 60 }),
  s.place(-13, -15, { model: "space-kit/alien", yaw: -60, scale: 1.2 }),
  s.place(2, -16, { model: "space-kit/rover", yaw: 120, body: "dynamic" }),
  // Satellite dishes and antennas on the rim, looking up at the stars
  s.place(18, -20, { model: "space-kit/satelliteDish_large", yaw: 210 }),
  s.place(14, 14, { model: "space-kit/satelliteDish_detailed", yaw: 160 }),
  s.place(-24, 10, { model: "space-kit/satelliteDish_large", yaw: 300 }),
  s.place(-22, -22, { model: "space-kit/satelliteDish_detailed", yaw: 20 }),
  s.place(20, 4, { model: "space-kit/chimney_detailed" }),
  s.place(-2, -32, { model: "space-kit/chimney_detailed", scale: 0.8 }),
];

const ROCK_MODELS = [
  "space-kit/rock_crystalsLargeA",
  "space-kit/rock_largeA",
  "space-kit/rock_crystalsLargeB",
  "space-kit/meteor_detailed",
] as const;

// Alien rocks, crystals and impact craters across the open ground (craters are flat decals)
const rocks: PlanetPlacement[] = [
  ...([
    [32, -10], [36, 14], [-36, 20], [-38, -30], [24, -38], [-10, -46], [40, -30], [-40, 12],
    [10, -42], [44, 2], [-46, -6], [30, 46],
  ] as const).map(([n, e], i) =>
    s.place(n, e, {
      model: ROCK_MODELS[i % 4],
      yaw: i * 53,
      scale: 1 + (i % 3) * 0.35,
    }),
  ),
  ...([
    [26, -24], [-34, -14], [16, -30], [36, 30], [-44, 14], [-20, 30], [-30, -42],
  ] as const).map(([n, e], i) =>
    s.place(n, e, { model: i % 2 ? "space-kit/craterLarge" : "space-kit/crater", yaw: i * 71, scale: 1.6, collider: "none" }),
  ),
  s.place(-16, -30, { model: "space-kit/rocks_smallA", yaw: 40 }),
  s.place(28, 0, { model: "space-kit/rocks_smallB", yaw: 140 }),
  s.place(-30, 0, { model: "space-kit/rocks_smallA", yaw: 260 }),
];

// Rim mounds around the bowl double as jumps
const rim = [0, 60, 120, 180, 240, 300].map((deg, i) => {
  const a = ((deg + 30) * Math.PI) / 180; // keeps the spawn line (due south) clear
  const rad = 27 + (i % 2) * 3;
  return s.pad(BOWL[0] + Math.cos(a) * rad, BOWL[1] + Math.sin(a) * rad, 2.5, { blend: 6, height: 2 + (i % 3) * 0.6 });
});

// Natural heights at the lab pad centres (measured once; opensource.test.ts re-checks them):
// room 0.18, south corridor 2.70, north corridor 2.89, west corridor 3.19, south apron 2.42 and
// west apron 3.69. Heights level them all to 1.0 m, so both gates open onto flat ground.
export const OPENSOURCE_LAB_PADS = [
  s.pad(-38, 34, 6, { blend: 8, height: -1.42 }),
  s.pad(18, 14, 6, { blend: 8, height: -2.69 }),
  s.pad(-6, 34, 14, { blend: 8, height: 0.82 }),
  s.pad(-24, 34, 6, { blend: 6, height: -1.7 }),
  s.pad(14, 34, 8, { blend: 6, height: -1.89 }),
  s.pad(18, 25, 6, { blend: 6, height: -2.19 }),
];

export const opensourceLayout: BiomeLayout = {
  biome: "opensource",
  spawn: s.spawn(-36, -6, 0),
  pads: [
    // Spawn ledge first, so the bowl (a later pad) shapes the slope down from it
    s.pad(-36, -6, 4, { blend: 8, height: -1.6 }),
    s.pad(BOWL[0], BOWL[1], 13, { blend: 16, height: -4 }), // crater floor, walls ~20° on average
    ...rim,
    ...OPENSOURCE_LAB_PADS,
  ],
  markers: [s.marker(-6, -6, { id: "openmined", kind: "job", label: "OpenMined" })],
  placements: [...lab(), ...base, ...rocks],
};
