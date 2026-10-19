// Biome layout: healthcare — Clinic Lakeside (biome agent B).
//
// Sketch (north up, metres from the biome centre; the town fits in 40 m for the 90 m planet):
//
//                 ~~ lake ~~                       [clinic ◆drchrono]
//                  ~~~~~~      [AFYA TOWER]            ⇧ exit
//    [MED SCHOOL]       [wing]  plaza ◆afya-2026  ┌──── factory hall ────┐
//    ◆afya-2021 ((antenna))                       │ micro ⇇⇇⇇ ← monolith │
//                          ▲ spawn (−18, 0)       └───────── ⇧ ──────────┘
//                 ↙ road lane          ↘ road lane        entry
//
// The DrChrono factory hall is the drivable interior: roll-up doors at both ends (12 m gaps), a single
// big "Django monolith" machine whose conveyor splits into three lines feeding three small "Rust
// microservice" machines. It stands on a planar pad, so its modular walls and floor stay square.
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";

export const HEALTHCARE_CENTER = BIOMES.find((b) => b.id === "healthcare")!.center;
const s = site(HEALTHCARE_CENTER);

// Pad heights (metres relative to the natural ground at the pad centre), measured once with the
// layout probe: the hall floor sits at −3 m, the spawn and plaza at about −3 m and the med school at −2.8 m (cut into the hill). healthcare.test.ts re-checks
// that every route stays gentle.
const H_HALL = -3.14;
const H_MED = -4.75;

/** Spawn (anchor-frame north, east): on the plaza's south edge, two road lanes open SW and SE. */
export const HEALTHCARE_SPAWN: [number, number] = [-18, 0];

// ---------------------------------------------------------------------------------------------
// DrChrono factory hall: 20 m long (fwd = north), 24 m wide (right = east), on its own tangent plane.
// structure-wall (factory-kit x2) is an L piece: a 2 m floor strip, the thin wall at local z ≈ +1.1 m
// and a roof eave outside. Its default box (2 × 6 × 4 m) is kept: it sticks ~2 m into the hall, but
// the machine zones fill that band anyway, so the drive lane (right −3.5..3.5) stays clear.
export const HEALTHCARE_HALL = s.frame(0, 22, 0, { planar: true });
const HALL = HEALTHCARE_HALL;
const HALF_L = 10;
const HALF_W = 12;
const WALL_IN = 1.1; // wall plane offset from the piece origin (local +z)
const FLOOR_Y = 0.03; // lift floor-bearing pieces off the pad so they don't z-fight the terrain

function hall(): PlanetPlacement[] {
  const out: PlanetPlacement[] = [];
  const wall = "factory-kit/structure-wall";
  // Long walls (west = right −12, east = right +12): local +z points outward
  for (let f = -HALF_L + 1; f < HALF_L; f += 2) {
    out.push(HALL.place(f, -HALF_W + WALL_IN, { model: wall, yaw: 90, y: FLOOR_Y }));
    out.push(HALL.place(f, HALF_W - WALL_IN, { model: wall, yaw: -90, y: FLOOR_Y }));
  }
  // End walls with a 12 m doorway (right −6..6) at both ends
  for (const r of [-11, -9, -7, 7, 9, 11]) {
    out.push(HALL.place(-HALF_L + WALL_IN, r, { model: wall, yaw: 180, y: FLOOR_Y }));
    out.push(HALL.place(HALF_L - WALL_IN, r, { model: wall, yaw: 0, y: FLOOR_Y }));
  }
  // Rolled-up shutters above both doorways (decor only, bottom edge ~4.2 m up)
  for (const r of [-3.6, 0, 3.6]) {
    out.push(HALL.place(-HALF_L + WALL_IN, r, { model: "factory-kit/door-wide-open", yaw: 180, y: 2.6, collider: "none" }));
    out.push(HALL.place(HALF_L - WALL_IN, r, { model: "factory-kit/door-wide-open", yaw: 0, y: 2.6, collider: "none" }));
  }
  // Factory floor (flat, drive-through)
  for (let f = -8; f <= 8; f += 4) {
    for (let r = -10; r <= 10; r += 4) {
      out.push(HALL.place(f, r, { model: "factory-kit/floor-large", y: FLOOR_Y }));
    }
  }
  // Lane markings along the drive lane
  for (const f of [-8, -4, 0, 4, 8]) {
    out.push(HALL.place(f, 0, { model: "factory-kit/indicator-special-arrow", yaw: 90, y: FLOOR_Y + 0.01 }));
  }

  // East zone: the monolith and its conveyor, splitting into three microservice lines
  out.push(HALL.place(-6, 6.5, { model: "factory-kit/machine-fortified", yaw: 90, scale: 1.6 }));
  out.push(HALL.place(-2, 6.5, { model: "factory-kit/conveyor-long-stripe-sides", yaw: 90 }));
  out.push(HALL.place(1, 6.5, { model: "factory-kit/conveyor-stripe-sides", yaw: 90 }));
  out.push(HALL.place(1, 4.5, { model: "factory-kit/conveyor-stripe-corner", yaw: 0 }));
  out.push(HALL.place(1, 8.5, { model: "factory-kit/conveyor-stripe-corner", yaw: -90 }));
  for (const r of [4.5, 6.5, 8.5]) {
    out.push(HALL.place(3, r, { model: "factory-kit/conveyor-stripe-sides", yaw: 90 }));
    out.push(HALL.place(5.8, r, { model: "factory-kit/machine-window", yaw: -90, scale: 0.7 }));
    // Arrows riding on the belts read as motion from the car
    out.push(HALL.place(3, r, { model: "factory-kit/arrow", yaw: 90, y: 0.82, collider: "none" }));
  }
  for (const f of [-3, -1]) {
    out.push(HALL.place(f, 6.5, { model: "factory-kit/arrow", yaw: 90, y: 0.82, collider: "none" }));
  }

  // West zone: robots, hoppers and a screen facing the lane
  out.push(HALL.place(-3.5, -6.5, { model: "factory-kit/robot-arm-a", yaw: 90 }));
  out.push(HALL.place(3, -6.5, { model: "factory-kit/robot-arm-a", yaw: -90 }));
  out.push(HALL.place(0, -5, { model: "factory-kit/screen-panel-wide", yaw: -90 }));
  out.push(HALL.place(6.5, -8, { model: "factory-kit/hopper-high-round" }));
  out.push(HALL.place(-6.5, -8, { model: "factory-kit/hopper-high-round" }));
  // One hazard pole beside each doorway (outside, past the door's edge, so they never block the lane)
  out.push(HALL.place(-HALF_L - 1.5, -7, { model: "factory-kit/warning-traffic" }));
  out.push(HALL.place(HALF_L + 1.5, 7, { model: "factory-kit/warning-traffic" }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Afya campus, med school, clinic, lake

/** Afya Educacional medical-school hall: 17 m wide, so it stands on its own tangent plane */
const MED = s.frame(-4, -26, 0, { planar: true });

const campus: PlanetPlacement[] = [
  // Afya tower: the tallest thing in the biome (scaled to ~33 m for the small planet), facing the spawn.
  // It stands alone on the plaza, 7 m+ clear of the factory hall's west wall.
  s.place(10, -3.5, { model: "city-commercial/building-skyscraper-d", yaw: 180, scale: 0.75, y: -0.45 }), // its back corner is off the plaza pad
  // Plaza furniture: one table and a bench at the tower's foot; the rest of the plaza stays open
  s.place(4.5, -8.5, { model: "city-commercial/detail-parasol-a" }),
  s.place(2, -9, { model: "mini-skate/bench", yaw: 180, y: -0.2 }),
  s.place(-9, 6, { model: "mini-forest/tree", y: -0.15 }),
  // People
  s.place(3.5, -5.5, { model: "mini-characters/character-female-b", yaw: 160, anim: "idle" }),
  s.place(6.5, -11, { model: "mini-characters/character-male-c", yaw: -120, anim: "idle", y: -0.3 }),

  // Afya Educacional medical-school hall, facing east over the plaza, with its broadcast antennas
  MED.place(0, 0, { model: "city-commercial/building-k", yaw: -90 }),
  MED.place(0, 0, { model: "space-kit/machine_wireless", yaw: -90, y: 11.8, scale: 1.5, collider: "none" }),
  // the dish's relay unit shares the roof (on the ground it straddled the school pad's cut slope)
  MED.place(5.5, 0, { model: "space-kit/machine_wirelessCable", yaw: -90, y: 11.8, scale: 1.5, collider: "none" }),
  s.place(-4, -32.5, { model: "space-kit/satelliteDish_large", yaw: 60 }), // against the back wall
  // Ambulance parked tight against the school's front, by its door
  s.place(-11.5, -18.4, { model: "car-kit/ambulance", yaw: 0, y: -0.2 }), // on level ground below the school pad's cut
  s.place(-10, -20, { model: "mini-characters/character-female-d", yaw: -90, anim: "idle" }),

  // DrChrono clinic, facing the hall's north door (the factory is where the story continues), 7 m+
  // north of the hall's roof eave
  s.place(25.5, 12, { model: "city-commercial/building-c", yaw: 180, y: -0.2 }),
  s.place(16, 14, { model: "mini-characters/character-male-e", yaw: 200, anim: "idle" }),
  s.place(24, 17.5, { model: "car-kit/delivery", yaw: 0 }), // parked against the clinic
];

// Lake: a dug basin with a ring of trees, benches facing the water and a little camp
const LAKE: [number, number] = [24, -6];
/** Per-tree sink for the ones on the basin's sloping rim (grounded.test.ts measures them) */
const LAKE_TREE_Y = [-0.3, 0, 0, 0, 0, 0, 0, -0.2, -0.2, -0.25];
const lake: PlanetPlacement[] = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + 0.2;
  const rad = 8.5 + (i % 3) * 0.5;
  lake.push(
    s.place(LAKE[0] + Math.cos(a) * rad, LAKE[1] + Math.sin(a) * rad, {
      model: i % 2 ? "mini-forest/tree-high" : "mini-forest/tree",
      yaw: i * 47,
      y: LAKE_TREE_Y[i],
    }),
  );
}
for (const [a, y] of [[-2.6, -0.25], [2.6, 0]]) {
  // Benches on the south shore, looking out over the water
  lake.push(s.place(LAKE[0] + Math.cos(a) * 6.5, LAKE[1] + Math.sin(a) * 6.5, { model: "mini-skate/bench", yaw: 0, y }));
}
lake.push(
  s.place(LAKE[0] + 3, LAKE[1] - 3, { model: "mini-forest/rocks-low", yaw: 200 }), // in the basin, off its sloping rim
  s.place(LAKE[0] + 5, LAKE[1] + 3, { model: "mini-forest/tent", yaw: 30 }),
  s.place(LAKE[0] + 2.5, LAKE[1] + 5.5, { model: "mini-characters/character-male-a", yaw: 10, anim: "idle" }),
);

// Groves on the town edge, kept out of the two road lanes
// (third value: sink onto sloping ground, measured by grounded.test.ts)
const groves: PlanetPlacement[] = [
  [34, 4, 0], [30, -18, 0], [8, -36, -0.5], [-20, -32, -0.25], [-28, -22, 0], [-20, 30, -0.15], [-26, 22, 0], [32, 12, -0.5],
].map(([n, e, y], i) =>
  s.place(n, e, { model: i % 3 === 0 ? "mini-forest/tree-high" : "mini-forest/tree", yaw: i * 61, scale: 0.9 + (i % 4) * 0.12, y }),
);
groves.push(
  s.place(20, -28, { model: "mini-forest/rocks-high", y: 0.6, yaw: 20 }),
  s.place(-34, -2, { model: "mini-forest/rocks-low", yaw: 70, y: -0.45 }),
);

export const healthcareLayout: BiomeLayout = {
  biome: "healthcare",
  spawn: s.spawn(...HEALTHCARE_SPAWN, 0),
  pads: [
    s.pad(...HEALTHCARE_SPAWN, 6, { blend: 6, height: 1 }), // spawn
    s.pad(2, 0, 9, { blend: 6, height: 0.4 }), // Afya plaza and tower
    s.pad(24, 12, 7.5, { blend: 4, height: 4.5 }), // clinic, raised out of the lakeside hollow
    s.pad(LAKE[0], LAKE[1], 6, { blend: 5, height: -1.5 }), // lake basin
    // Hall approach: fills the gap between the spawn pad's ring and the hall pad's ring (≈ −3.1 m, the
    // spawn's level). The hall pad is planar, so its ring rises toward the tangent plane (~1.5 m up at
    // the south door); without this the drive in climbed a natural knoll, steepened by the road bed's
    // feather, straight into that rim. Now it is one steady ramp up to the door.
    s.pad(-16, 14, 5, { blend: 6, height: -1.2 }),
    // Planar floors last, so their flat cores win
    s.pad(-4, -26, 10, { blend: 8, height: H_MED, planar: true }), // med school
    // factory hall: the radius reaches past the floor's corners (15.6 m out), so they stay on the plane
    s.pad(0, 22, 16.5, { blend: 7, height: H_HALL, planar: true }),
  ],
  markers: [
    s.marker(0, -2, { id: "afya-2026", kind: "job", label: "Afya · Current role" }),
    s.marker(-4, -16, { id: "afya-2021", kind: "job", label: "Afya Educacional" }),
    s.marker(16, 22, { id: "drchrono", kind: "job", label: "DrChrono" }),
  ],
  placements: [...campus, ...hall(), ...lake, ...groves],
};
