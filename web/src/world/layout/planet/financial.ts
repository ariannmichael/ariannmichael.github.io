// Biome layout: financial — Desert Mesa (biome agent B).
//
// Sketch (north up, metres from the biome centre; the town fits in 40 m for the 90 m planet). The
// main road runs from the spawn north-east through the drive-thru and up a ramp onto the mesa:
//
//        windmill   water tower          ▓▓▓ MESA ▓▓▓
//                        solar        [FINANCE TOWER] ◆fullstack
//                                         ramp pads ⇗   fries · hot dog
//                 ┌ market ┐ ⇗ drive-thru lane ⇗         ice cream
//                 └────────┘ ⇗   burger               canyon jumps · containers
//                    ▲ spawn (−18, −8), facing up the road
//              ↙ road lane      ↘ road lane
//
// The drive-thru hall is the drivable interior: mini-market walls (scaled 1.6 → 4 m tall) form an
// 8 m lane with service windows on the left, a market counter with cash registers behind them. It
// and the mesa top stand on planar pads, so the modular walls and the tower stay square.
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";

export const FINANCIAL_CENTER = BIOMES.find((b) => b.id === "financial")!.center;
const s = site(FINANCIAL_CENTER);

/** Spawn (anchor-frame north, east): the foot of the main road; road lanes open SW and SE. */
export const FINANCIAL_SPAWN: [number, number] = [-18, -8];

/** Main road: from the spawn north-east, through the drive-thru, up to the tower on the mesa. */
const ROAD_YAW = -40;
export const FINANCIAL_ROAD = s.frame(...FINANCIAL_SPAWN, ROAD_YAW);
const ROAD = FINANCIAL_ROAD;

// Pad heights (metres relative to the natural ground at each pad centre), measured once with the
// layout probe (natural: spawn 5.6, hall 0.32, mesa 4.63). The road runs along a raised spine across
// the canyon: spawn 6.4 m, drive-thru floor 5.5 m, then ramp pads every 2 m climbing 6.3 → 8.3 m onto
// the mesa top at 8.6 m, whose cliffs drop ~4 m to the canyon floor. financial.test.ts re-checks the
// climb and the road grade.
const H_SPAWN = 0.8;
const H_HALL = 5.18;
const H_MESA = 3.6;
export const FINANCIAL_RAMP: { t: number; height: number }[] = [
  { t: 26.5, height: 6.14 },
  { t: 28.5, height: 6.16 },
  { t: 30.5, height: 6.15 },
  { t: 32.5, height: 6.02 },
  { t: 34.5, height: 5.61 },
];
/**
 * The ramp's last pad, where it meets the plateau's rim. The mesa is a shallow bowl (its planar ring
 * holds the rim at ~0.5 m above the centre), so with the ramp ending short the last 2 m were a lip the
 * car tipped over (about 42° at 20 km/h). Kept out of FINANCIAL_RAMP: the climb test compares those pads
 * with the mesa centre. The mesh is 3.8 m between vertices, so the radius must be about 2.5 m or it
 * isn't resolved at all.
 */
const RAMP_LIP = { t: 36, height: 4.5, radius: 2.6, blend: 2 };
const RAMP_PAD = { radius: 2.2, blend: 3 };
/** Mesa-top centre along the road (t, r) */
const MESA_AT: [number, number] = [47.5, -3];

// ---------------------------------------------------------------------------------------------
// Drive-thru payments hall, 16 m along the road at t = 16. Its planar pad is centred 3.6 m to the
// left of the lane, under the lane and the market behind the windows.
const HALL_PAD: [number, number] = [0, -3.6];
export const FINANCIAL_HALL = s.frame(...ROAD.ne(16, 0), ROAD_YAW, { planeAt: HALL_PAD });
const HALL = FINANCIAL_HALL;
const MM = 1.6; // mini-market extra scale: 4 m wall modules, 4 m tall
const SIDE = 5.2; // wall centre line; walls are 2.4 m thick, so the lane is 8 m wide

function driveThru(): PlanetPlacement[] {
  const out: PlanetPlacement[] = [];
  const along = [-6, -2, 2, 6];
  // Left (service) side: solid ends, two service windows in the middle
  along.forEach((f, i) => {
    const model = i === 1 || i === 2 ? "mini-market/wall-window" : "mini-market/wall";
    out.push(HALL.place(f, -SIDE, { model, yaw: 90, scale: MM }));
    out.push(HALL.place(f, SIDE, { model: "mini-market/wall", yaw: -90, scale: MM }));
    // Lane floor (two tiles across) and the market floor behind the windows
    out.push(HALL.place(f, -2, { model: "mini-market/floor", scale: MM, y: 0.02 }));
    out.push(HALL.place(f, 2, { model: "mini-market/floor", scale: MM, y: 0.02 }));
    out.push(HALL.place(f, -8.4, { model: "mini-market/floor", scale: MM, y: 0.02 }));
    // Back wall of the market
    out.push(HALL.place(f, -12.4, { model: "mini-market/wall", yaw: 90, scale: MM }));
  });
  // Columns framing the entry and exit
  for (const f of [-8.6, 8.6]) {
    for (const r of [-SIDE, SIDE]) out.push(HALL.place(f, r, { model: "mini-market/column", scale: MM }));
  }
  // Behind the service windows: registers facing the lane, staff, shelves
  out.push(HALL.place(-2, -7.6, { model: "mini-market/cash-register", yaw: -90, scale: MM }));
  out.push(HALL.place(2, -7.6, { model: "mini-market/cash-register", yaw: -90, scale: MM }));
  out.push(HALL.place(-2, -9.6, { model: "mini-market/character-employee", yaw: -90, scale: 1.3 }));
  out.push(HALL.place(2, -9.6, { model: "mini-characters/character-female-c", yaw: -90, anim: "idle" }));
  out.push(HALL.place(-6, -10.6, { model: "mini-market/shelf-boxes", yaw: -90, scale: MM }));
  out.push(HALL.place(6, -10.6, { model: "mini-market/shelf-bags", yaw: -90, scale: MM }));
  out.push(HALL.place(6, -7.6, { model: "mini-market/freezer", yaw: -90, scale: MM }));
  // Rooftop signage: a giant donut over the windows
  out.push(HALL.place(0, -SIDE, { model: "food-kit/donut-sprinkles", y: 4, yaw: 90, scale: 1.4, collider: "none" }));
  out.push(HALL.place(0, SIDE, { model: "food-kit/burger", y: 4, yaw: -90, collider: "none" }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Mesa top: the finance tower and its kiosks, on the mesa's tangent plane

const MESA = s.frame(...ROAD.ne(...MESA_AT), ROAD_YAW, { planar: true });
const mesa: PlanetPlacement[] = [
  // FullStack · GoDaddy tower (scaled to ~26 m for the small planet), facing back down the road
  MESA.place(1, -5, { model: "city-commercial/building-skyscraper-c", yaw: 180, scale: 0.8, y: -0.3 }), // back corner at the rim
  // One payment kiosk (a register under a parasol) against the tower's foot; the mesa top stays open
  MESA.place(-5, -3, { model: "mini-market/cash-register", yaw: 180, scale: 1.2 }),
  MESA.place(-5.5, -6, { model: "city-commercial/detail-parasol-b", yaw: 50 }),
  MESA.place(-4.5, -8.5, { model: "mini-characters/character-male-d", yaw: 180, anim: "idle", y: -0.2 }),
  MESA.place(2, 6, { model: "food-kit/cupcake", yaw: 20 }),
];

// ---------------------------------------------------------------------------------------------
// Roadside giants, the industrial yard, a solar farm and canyon junk

// Giant food on the right shoulder: the burger tight against the hall wall, the fries and the hot dog
// tight against the exit column, so the shoulder never turns into a row of narrow slots
const roadside: PlanetPlacement[] = [
  ROAD.place(9.5, 10, { model: "food-kit/burger-double", scale: 1.3 }),
  // the fries and the hot dog stand down on the canyon's level patches, where the spine's slopes ease
  s.place(-4.7, 19.1, { model: "food-kit/fries", yaw: 160, scale: 1.4 }),
  s.place(5.5, 24.9, { model: "food-kit/hot-dog", yaw: 85, scale: 1.3 }),
  ROAD.place(25, -9, { model: "food-kit/ice-cream", yaw: 10 }),
  // A giant soda can to knock over on the ramp's shoulder
  ROAD.place(25, 6.5, { model: "food-kit/soda-can", body: "dynamic", yaw: 40 }),
  ROAD.place(22, 5, { model: "mini-characters/character-male-b", yaw: 200, anim: "idle" }),

  // Industrial yard on the high ground north-west: water tower, tank, windmill, solar farm (7 m+ apart)
  s.place(16, -16, { model: "city-industrial/water-tower", yaw: 15 }),
  s.place(26, -4, { model: "city-industrial/detail-tank", yaw: 30 }),
  s.place(6, -28, { model: "city-industrial/windmill", yaw: -30 }),
  s.place(-12, -29, { model: "city-industrial/solar-panel-portrait-group", y: -0.2 }),

  // Canyon junk around the jumps, south-east of the road
  // (each on the flattest patch near its jump, set into the sand where the ground still tilts)
  s.place(-7, 32, { model: "city-industrial/shipping-container-a", yaw: 20 + 90, y: -0.65 }),
  s.place(14, 30, { model: "city-industrial/shipping-container-b", yaw: 75, y: -0.3 }),
  s.place(-22, 20, { model: "city-industrial/shipping-container-c", yaw: -30, y: -0.3 }),
  // A giant pizza dropped in the sand by the spawn (flat: drive over it), half sunk into the slope
  s.place(-13, -12, { model: "food-kit/pizza", yaw: 0, y: -0.15, scale: 0.6 }),
];

const pads = [
  s.pad(...FINANCIAL_SPAWN, 5, { blend: 6, height: H_SPAWN }), // spawn
  // Level yards for the industrial pieces on the north-west slope (natural height at each centre)
  s.pad(16, -16, 6, { blend: 6 }), // water tower
  s.pad(26, -4, 5, { blend: 5 }), // tank
  s.pad(6, -28, 5, { blend: 5 }), // windmill
  s.pad(-12, -29, 6.5, { blend: 5 }), // solar farm
  // Canyon jumps
  s.pad(2, 24, 2.5, { blend: 4, height: 1.8 }),
  s.pad(-8, 34, 2.5, { blend: 4, height: 2.1 }),
  // The drive-thru floor, then the ramp over its exit, then the mesa top (later pads win)
  // drive-thru hall: the radius covers the exit corner's wall and column (14 m out), which stood on the
  // spine's cliff-edge ring
  s.pad(...HALL.ne(...HALL_PAD), 15, { blend: 6, height: H_HALL, planar: true }),
  ...FINANCIAL_RAMP.map(({ t, height }) => s.pad(...ROAD.ne(t, 0), RAMP_PAD.radius, { blend: RAMP_PAD.blend, height })),
  s.pad(...ROAD.ne(RAMP_LIP.t, 0), RAMP_LIP.radius, { blend: RAMP_LIP.blend, height: RAMP_LIP.height }),
  s.pad(...ROAD.ne(...MESA_AT), 10, { blend: 5, height: H_MESA, planar: true }), // mesa top
];

export const financialLayout: BiomeLayout = {
  biome: "financial",
  spawn: s.spawn(...FINANCIAL_SPAWN, ROAD_YAW),
  pads,
  markers: [s.marker(...ROAD.ne(44, 0), { id: "fullstack", kind: "job", label: "FullStack · GoDaddy" })],
  placements: [...driveThru(), ...mesa, ...roadside],
};
