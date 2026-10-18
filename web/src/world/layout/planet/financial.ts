// Biome layout: financial — Desert Mesa (biome agent B).
//
// Sketch (north up, metres from the biome centre; the main road runs from the spawn south-east up
// to the mesa):
//
//      solar farm ▤▤                         ▲ spawn (44, -16), facing the tower
//                    giant burger · soda ↘
//                     ┌ drive-thru market ┐  (cash registers behind service windows)
//   canyon              ⇘ lane ⇘           water tower · tanks · windmill
//   (jumps)              ramp pads stepping up ⇘
//                                  ▓▓▓ MESA ▓▓▓  ◆fullstack
//                                   [FINANCE TOWER]  kiosks
//
// The drive-thru hall is the drivable interior: mini-market walls (scaled 1.6 → 4 m tall) form an
// 8 m lane with service windows on the left, a market counter with cash registers behind them.
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";

const s = site({ lat: 20, lon: -75 });

/** Main road: from the spawn toward the finance tower on the mesa (fwd = metres along the road). */
const ROAD_YAW = (Math.atan2(-52, -58) * 180) / Math.PI; // ≈ −138°: south-east
export const FINANCIAL_ROAD = s.frame(44, -16, ROAD_YAW);
const ROAD = FINANCIAL_ROAD;

// Natural heights measured once along the road (see financial.test.ts, which re-checks the ramp):
// t30 9.07, t36 9.10, t42 10.07, t48 11.23, t54 10.66 and the mesa centre 12.06 m.
// Pad heights below turn that into an even climb 9.5 → 13.9 m, onto a mesa raised to ~15.1 m.
export const FINANCIAL_RAMP: { t: number; height: number }[] = [
  { t: 30, height: 0.43 },
  { t: 36, height: 1.5 },
  { t: 42, height: 1.63 },
  { t: 48, height: 1.57 },
  { t: 54, height: 3.24 },
];
const MESA: [number, number] = [-12, 32];
const MESA_HEIGHT = 3;

// ---------------------------------------------------------------------------------------------
// Drive-thru payments hall, 16 m along the road at t = 16
export const FINANCIAL_HALL = s.frame(...ROAD.ne(16, 0), ROAD_YAW);
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
  // Shopping carts by the exit (knockable)
  out.push(HALL.place(11, 3.2, { model: "mini-market/shopping-cart", yaw: 30, scale: MM, body: "dynamic" }));
  out.push(HALL.place(12, 2, { model: "mini-market/shopping-cart", yaw: 70, scale: MM, body: "dynamic" }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Mesa top: the finance tower and its kiosks

const TOWER_YAW = ROAD_YAW + 180; // facing back down the road
const mesa: PlanetPlacement[] = [
  s.place(-13.4, 35.4, { model: "city-commercial/building-skyscraper-c", yaw: TOWER_YAW }),
  // Payment kiosks: a register under a parasol
  ...([
    [-4, 38],
    [-21, 27],
    [-17, 21],
  ] as const).flatMap(([n, e], i) => [
    s.place(n, e, { model: "mini-market/cash-register", yaw: TOWER_YAW + 40 * (i - 1), scale: 1.2 }),
    s.place(n + 1.6, e + 1.2, { model: "city-commercial/detail-parasol-b", yaw: i * 50 }),
  ]),
  s.place(-8, 24, { model: "mini-characters/character-male-d", yaw: TOWER_YAW, anim: "idle" }),
  s.place(-20, 34, { model: "food-kit/cupcake", yaw: 20 }),
  s.place(-12, 22, { model: "mini-market/shopping-cart", yaw: 10, scale: MM, body: "dynamic" }),
];

// ---------------------------------------------------------------------------------------------
// Roadside giants, the industrial yard, a solar farm and canyon junk

const roadside: PlanetPlacement[] = [
  ROAD.place(4, 9, { model: "food-kit/burger-double", yaw: 30, scale: 1.3 }),
  ROAD.place(6, -9, { model: "food-kit/soda", yaw: -20, scale: 1.4 }),
  ROAD.place(26, -11, { model: "food-kit/pizza-box", yaw: 70 }),
  ROAD.place(29, 10, { model: "food-kit/fries", yaw: 200, scale: 1.4 }),
  ROAD.place(38, -11, { model: "food-kit/hot-dog", yaw: 80, scale: 1.3 }),
  ROAD.place(46, 11, { model: "food-kit/ice-cream", yaw: 10 }),
  // Giant soda cans to knock over near the spawn
  ROAD.place(-4, 5, { model: "food-kit/soda-can", body: "dynamic" }),
  ROAD.place(-5, 7.5, { model: "food-kit/soda-can", body: "dynamic", yaw: 40 }),
  ROAD.place(-2.5, 7.6, { model: "food-kit/soda-can", body: "dynamic", yaw: 100 }),
  ROAD.place(2, 12, { model: "mini-characters/character-male-b", yaw: 200, anim: "idle" }),

  // Industrial yard: water tower and tanks
  s.place(28, 30, { model: "city-industrial/water-tower", yaw: 15 }),
  s.place(19, 38, { model: "city-industrial/detail-tank-large", yaw: 90 }),
  s.place(32, 42, { model: "city-industrial/detail-tank", yaw: 30 }),
  s.place(36, 34, { model: "city-industrial/detail-tank", yaw: 120 }),
  s.place(44, 30, { model: "city-industrial/windmill", yaw: -30 }),

  // Solar farm north-east of the spawn
  s.place(52, 6, { model: "city-industrial/solar-panel-portrait-group" }),
  s.place(42, 8, { model: "city-industrial/solar-panel-portrait-group" }),
  s.place(52, 18, { model: "city-industrial/solar-panel-portrait-group" }),

  // Canyon junk around the jumps
  s.place(-32, 4, { model: "city-industrial/shipping-container-a", yaw: 20 }),
  s.place(-44, -10, { model: "city-industrial/shipping-container-b", yaw: 75 }),
  s.place(-27, -14, { model: "city-industrial/shipping-container-c", yaw: -30 }),
  s.place(-40, 8, { model: "food-kit/barrel", yaw: 10 }),
  // A diner-sign cluster out west, seen from the canyon
  s.place(10, -40, { model: "food-kit/pizza", yaw: 0, y: 0.05 }),
  s.place(14, -46, { model: "food-kit/soda-glass", yaw: 120, scale: 1.3 }),
  s.place(4, -46, { model: "food-kit/hot-dog", yaw: 30, scale: 1.2 }),
];

const pads = [
  s.pad(44, -16, 6, { blend: 6 }), // spawn
  s.pad(...ROAD.ne(16, 0), 11, { blend: 8 }), // drive-thru hall
  ...FINANCIAL_RAMP.map(({ t, height }) => s.pad(...ROAD.ne(t, 0), 2.5, { blend: 7, height })),
  s.pad(MESA[0], MESA[1], 13, { blend: 8, height: MESA_HEIGHT }), // mesa top
  // Canyon jumps and plain kickers
  s.pad(-30, -6, 2.5, { blend: 4, height: 1.8 }),
  s.pad(-39, -3, 2.5, { blend: 4, height: 2.1 }),
  s.pad(24, 22, 3, { blend: 5, height: 2.2 }),
  s.pad(30, -36, 2.5, { blend: 4, height: 1.8 }),
];

export const financialLayout: BiomeLayout = {
  biome: "financial",
  spawn: s.spawn(44, -16, ROAD_YAW),
  pads,
  markers: [s.marker(...ROAD.ne(66, 0), { id: "fullstack", kind: "job", label: "FullStack · GoDaddy" })],
  placements: [...driveThru(), ...mesa, ...roadside],
};
