// Biome layout: healthcare — Clinic Lakeside (biome agent B).
//
// Sketch (north up, metres from the biome centre; 1 char ≈ 6 m):
//
//            trees    ~~~ lake ~~~  trees
//                     ~ (22, 16) ~   benches
//     [wing]  [AFYA TOWER]  [wing]
//              plaza ◆afya-2026        [MED SCHOOL ◆afya-2021] ((antenna))
//   ┌──────── factory hall ───────┐  ▲ spawn
//   ⇦ west door   monolith → ⇉⇉⇉   east door ⇦   [clinic ◆drchrono]
//   └─────────────────────────────┘
//
// The DrChrono factory hall is the drivable interior: roll-up doors at both ends (12 m gaps),
// a single big "Django monolith" machine whose conveyor splits into three lines feeding three
// small "Rust microservice" machines.
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";

const s = site({ lat: -15, lon: 140 });

// ---------------------------------------------------------------------------------------------
// DrChrono factory hall: 24 m long (fwd), 24 m wide (right). fwd points west, so right = north.
// structure-wall (factory-kit x2) is an L piece: a 2 m floor strip, the thin wall at local z ≈ +1.1 m
// and a roof eave outside. Its default box (2 × 6 × 4 m) is kept: it sticks ~2 m into the hall, but
// the machine zones fill that band anyway, so the drive lane (right −3.5..3.5) stays clear.
export const HEALTHCARE_HALL = s.frame(-24, -38, 90);
const HALL = HEALTHCARE_HALL;
const HALF = 12;
const WALL_IN = 1.1; // wall plane offset from the piece origin (local +z)
const FLOOR_Y = 0.03; // lift floor-bearing pieces off the pad so they don't z-fight the terrain

function hall(): PlanetPlacement[] {
  const out: PlanetPlacement[] = [];
  const wall = "factory-kit/structure-wall";
  // Long walls (south = right −12, north = right +12): local +z points outward
  for (let f = -HALF + 1; f < HALF; f += 2) {
    out.push(HALL.place(f, -HALF + WALL_IN, { model: wall, yaw: 90, y: FLOOR_Y }));
    out.push(HALL.place(f, HALF - WALL_IN, { model: wall, yaw: -90, y: FLOOR_Y }));
  }
  // End walls with a 12 m doorway (right −6..6) at both ends
  for (const r of [-11, -9, -7, 7, 9, 11]) {
    out.push(HALL.place(-HALF + WALL_IN, r, { model: wall, yaw: 180, y: FLOOR_Y }));
    out.push(HALL.place(HALF - WALL_IN, r, { model: wall, yaw: 0, y: FLOOR_Y }));
  }
  // Rolled-up shutters above both doorways (decor only, bottom edge ~4.2 m up)
  for (const r of [-3.6, 0, 3.6]) {
    out.push(HALL.place(-HALF + WALL_IN, r, { model: "factory-kit/door-wide-open", yaw: 180, y: 2.6, collider: "none" }));
    out.push(HALL.place(HALF - WALL_IN, r, { model: "factory-kit/door-wide-open", yaw: 0, y: 2.6, collider: "none" }));
  }
  // Factory floor (flat, drive-through)
  for (let f = -10; f <= 10; f += 4) {
    for (let r = -10; r <= 10; r += 4) {
      out.push(HALL.place(f, r, { model: "factory-kit/floor-large", y: FLOOR_Y }));
    }
  }
  // Lane markings: hazard lines along the drive lane edges, entry pads at both doors
  for (const f of [-10, -6, -2, 2, 6, 10]) {
    out.push(HALL.place(f, 0, { model: "factory-kit/indicator-special-arrow", yaw: 90, y: FLOOR_Y + 0.01 }));
  }

  // North zone: the monolith and its conveyor, splitting into three microservice lines
  out.push(HALL.place(-8.5, 6.5, { model: "factory-kit/machine-fortified", yaw: 90, scale: 1.6 }));
  out.push(HALL.place(-4, 6.5, { model: "factory-kit/conveyor-long-stripe-sides", yaw: 90 }));
  out.push(HALL.place(0, 6.5, { model: "factory-kit/conveyor-long-stripe-sides", yaw: 90 }));
  out.push(HALL.place(3, 6.5, { model: "factory-kit/conveyor-stripe-sides", yaw: 90 }));
  out.push(HALL.place(3, 4.5, { model: "factory-kit/conveyor-stripe-corner", yaw: 0 }));
  out.push(HALL.place(3, 8.5, { model: "factory-kit/conveyor-stripe-corner", yaw: -90 }));
  for (const r of [4.5, 6.5, 8.5]) {
    out.push(HALL.place(5.5, r, { model: "factory-kit/conveyor-stripe-sides", yaw: 90 }));
    out.push(HALL.place(9, r, { model: "factory-kit/machine-window", yaw: -90, scale: 0.7 }));
    // Arrows riding on the belts read as motion from the car
    out.push(HALL.place(5.5, r, { model: "factory-kit/arrow", yaw: 90, y: 0.82, collider: "none" }));
  }
  for (const f of [-5, -1]) {
    out.push(HALL.place(f, 6.5, { model: "factory-kit/arrow", yaw: 90, y: 0.82, collider: "none" }));
  }

  // South zone: robots, hoppers and screens facing the lane
  out.push(HALL.place(-6, -6.5, { model: "factory-kit/robot-arm-a", yaw: 90 }));
  out.push(HALL.place(4, -6.5, { model: "factory-kit/robot-arm-a", yaw: -90 }));
  out.push(HALL.place(-1, -5, { model: "factory-kit/screen-panel-wide", yaw: -90 }));
  out.push(HALL.place(8.5, -7, { model: "factory-kit/hopper-high-round" }));
  out.push(HALL.place(-9.5, -7, { model: "factory-kit/hopper-high-round" }));
  // Knock-over crates at the lane edge
  out.push(HALL.place(-3, -3.6, { model: "factory-kit/box-small", body: "dynamic" }));
  out.push(HALL.place(-2, -3.8, { model: "factory-kit/box-small", body: "dynamic", yaw: 20 }));
  out.push(HALL.place(7, 3.7, { model: "factory-kit/box-small", body: "dynamic", yaw: -15 }));
  // Hazard poles flanking both doorways (outside, so they never block the lane)
  for (const f of [-HALF - 1.5, HALF + 1.5]) {
    out.push(HALL.place(f, -7, { model: "factory-kit/warning-traffic" }));
    out.push(HALL.place(f, 7, { model: "factory-kit/warning-traffic" }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Afya campus, med school, clinic, lake

const campus: PlanetPlacement[] = [
  // Afya tower: the tallest thing in the biome, facing south over its plaza
  s.place(4, -8, { model: "city-commercial/building-skyscraper-d", yaw: 180 }),
  s.place(2, -24, { model: "city-commercial/building-e", yaw: 180 }),
  s.place(3, 9, { model: "city-commercial/building-c", yaw: 180 }),
  // Plaza furniture
  s.place(-6, -18, { model: "city-commercial/detail-parasol-a" }),
  s.place(-10, -16, { model: "city-commercial/detail-parasol-a" }),
  s.place(-6, 2, { model: "city-commercial/detail-parasol-a" }),
  s.place(-12, -20, { model: "mini-skate/bench", yaw: 90 }),
  s.place(-15, -20, { model: "mini-skate/bench", yaw: 90 }),
  s.place(-12, 4, { model: "mini-skate/bench", yaw: -90 }),
  s.place(-15, 4, { model: "mini-skate/bench", yaw: -90 }),
  s.place(-3, -2, { model: "mini-forest/tree" }),
  s.place(-3, -14, { model: "mini-forest/tree" }),
  // Ambulance parked out front, with cones
  s.place(-5, 6, { model: "car-kit/ambulance", yaw: 180 }),
  s.place(-9, 7.5, { model: "car-kit/cone", body: "dynamic" }),
  s.place(-9, 5, { model: "car-kit/cone", body: "dynamic" }),
  s.place(-11, 6.2, { model: "car-kit/cone", body: "dynamic" }),
  // People
  s.place(-4, -6, { model: "mini-characters/character-female-b", yaw: 160, anim: "idle" }),
  s.place(-3, 3.5, { model: "mini-characters/character-male-c", yaw: -120, anim: "idle" }),

  // Afya Educacional medical-school hall, facing west, with its broadcast antenna
  s.place(-14, 30, { model: "city-commercial/building-k", yaw: 90 }),
  s.place(-26, 33, { model: "space-kit/machine_wirelessCable", yaw: 90, scale: 2.4 }),
  s.place(-14, 30, { model: "space-kit/machine_wireless", yaw: 90, y: 11.8, scale: 1.5, collider: "none" }),
  s.place(-22, 24, { model: "space-kit/satelliteDish_large", yaw: 120 }),
  s.place(-8, 22, { model: "mini-characters/character-female-d", yaw: 90, anim: "idle" }),
  s.place(-20, 21, { model: "mini-skate/bench", yaw: 0 }),

  // DrChrono clinic (the hall behind it is where the story continues)
  s.place(-38, -12, { model: "city-commercial/building-c", yaw: 0 }),
  s.place(-33, -6, { model: "mini-forest/tree-high" }),
  s.place(-33, -18, { model: "mini-forest/tree-high" }),
  s.place(-27, -7, { model: "mini-characters/character-male-e", yaw: 200, anim: "idle" }),
  s.place(-43, -22, { model: "car-kit/delivery", yaw: 90 }),
];

// Lake: a dug basin with a ring of trees, benches facing the water and a little footbridge
const LAKE: [number, number] = [22, 16];
const lake: PlanetPlacement[] = [];
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + 0.2;
  const rad = 17 + (i % 3) * 2;
  lake.push(
    s.place(LAKE[0] + Math.cos(a) * rad, LAKE[1] + Math.sin(a) * rad, {
      model: i % 2 ? "mini-forest/tree-high" : "mini-forest/tree",
      yaw: i * 47,
    }),
  );
}
for (const [a, deg] of [
  [-2.2, 0],
  [-1.6, 0],
  [-1.0, 0],
] as const) {
  // Benches on the south shore, looking north over the water
  lake.push(s.place(LAKE[0] + Math.cos(a) * 14, LAKE[1] + Math.sin(a) * 14, { model: "mini-skate/bench", yaw: deg }));
}
lake.push(
  s.place(LAKE[0] - 10, LAKE[1] + 5, { model: "mini-forest/rocks-low", yaw: 30 }),
  s.place(LAKE[0] + 9, LAKE[1] - 8, { model: "mini-forest/rocks-low", yaw: 200 }),
  s.place(LAKE[0] + 2, LAKE[1] + 12, { model: "mini-forest/rocks-low" }),
  s.place(LAKE[0] - 6, LAKE[1] - 10, { model: "mini-forest/tent", yaw: 30 }),
  s.place(LAKE[0] - 3, LAKE[1] - 12, { model: "mini-characters/character-male-a", yaw: 10, anim: "idle" }),
  s.place(LAKE[0] - 13, LAKE[1] + 10, { model: "mini-forest/fence", yaw: 45 }),
);

// Mini-forest groves in the open country between settlements
const groves: PlanetPlacement[] = [
  [36, -30], [40, -24], [44, -34], [30, -40], [-46, 18], [-50, 26], [-42, 34], [44, 44],
  [50, 36], [-52, -8], [16, -44], [12, 44], [-30, 46], [-50, 44], [52, 2], [26, -14],
].map(([n, e], i) =>
  s.place(n, e, { model: i % 3 === 0 ? "mini-forest/tree-high" : "mini-forest/tree", yaw: i * 61, scale: 0.9 + (i % 4) * 0.12 }),
);
groves.push(
  s.place(34, -36, { model: "mini-forest/rocks-high", y: 0.6, yaw: 20 }),
  s.place(-48, 30, { model: "mini-forest/rocks-low", yaw: 70 }),
  s.place(48, 40, { model: "mini-forest/rocks-low", yaw: 10 }),
);

export const healthcareLayout: BiomeLayout = {
  biome: "healthcare",
  spawn: s.spawn(-22, 0, 15),
  pads: [
    s.pad(-22, 0, 6, { blend: 6 }), // spawn
    s.pad(-6, -6, 17, { blend: 10 }), // Afya plaza and tower
    s.pad(-14, 28, 12, { blend: 8 }), // med school
    s.pad(-36, -12, 9, { blend: 6 }), // clinic
    s.pad(-24, -38, 18, { blend: 10, height: -2.3 }), // factory hall, cut down to plaza level (natural 2.27 m)
    s.pad(LAKE[0], LAKE[1], 11, { blend: 8, height: -1 }), // lake basin (natural hollow at −7.3 m)
    // Off-road kickers in the open country
    s.pad(-48, 12, 2.5, { blend: 4, height: 1.6 }),
    s.pad(40, -12, 2.5, { blend: 4, height: 1.8 }),
    s.pad(44, 24, 3, { blend: 5, height: 2.2 }),
  ],
  markers: [
    s.marker(-9, -8, { id: "afya-2026", kind: "job", label: "Afya · Current role" }),
    s.marker(-14, 20, { id: "afya-2021", kind: "job", label: "Afya Educacional" }),
    s.marker(-28, -12, { id: "drchrono", kind: "job", label: "DrChrono" }),
  ],
  placements: [...campus, ...hall(), ...lake, ...groves],
};
