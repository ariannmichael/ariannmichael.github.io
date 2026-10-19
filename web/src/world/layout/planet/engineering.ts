// Biome layout: engineering — "Downtown Plateau" (biome agent A).
//
// A raised, flat city block on a round plateau (everything within 40 m of the centre). One avenue
// runs north from the spawn and one street crosses it at a crossroads with traffic lights. Stefanini's
// office sits in the north-west block behind a mentoring plaza; GoFasti's data warehouse (giant
// snowflake on the roof, "AI onboarding" kiosk in front) fills the north-east block. Past the
// warehouse's east end the street drops off the plateau into a covered loading dock built from
// stacked shipping containers: drive in from the west, out to the east. The spawn's two road lanes
// (south-west to Speed King Canyon, south-east to the Badlands) are kept clear.
//
//                        N
//                           [sky-d]
//       [STEFANINI]       ║     [GOFASTI ❄ warehouse]
//           plaza ●       ║  ● kiosk
//  [sky-a]  ══════════════╬══════════  ⟍ ramp [== loading dock ==] →
//    [water tower]        ║
//                       spawn ↑
//                  ↙ lane        lane ↘
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { BIOMES } from "@/world/planet/biomes";
import { author } from "./a/kit";

/** Road tiles are flat squares on a curved surface: 2 % oversize hides the hairline seams. */
const ROAD_SCALE = 1.02;

const CENTER = BIOMES.find((b) => b.id === "engineering")!.center;
const { at, place, placeC, marker, spawn } = author(CENTER);

// --- Streets: the avenue (N-S, e = 0) and the street (E-W, n = −8) -----------------------------
const ST = -8;
const streets: PlanetPlacement[] = [];
// The avenue's south end (n = −24) is the T junction the two roads leave from (layout/planet/roadHubs.ts)
for (const n of [-16, 0, 8, 16]) {
  // road-straight runs along the model's X axis, which is E-W at yaw 0
  streets.push(place(n, 0, { model: "city-roads/road-straight", yaw: 90, scale: ROAD_SCALE }));
}
for (const e of [-16, -8, 8]) streets.push(place(ST, e, { model: "city-roads/road-straight", scale: ROAD_SCALE }));
streets.push(place(ST, 0, { model: "city-roads/road-crossroad", scale: ROAD_SCALE }));

// Traffic lights on two corners of the crossroads, street lights along the avenue's kerbs
const furniture: PlanetPlacement[] = [
  place(ST - 5, -5, { model: "city-roads/traffic-light", yaw: 0 }),
  place(ST + 5, 5, { model: "city-roads/traffic-light", yaw: 180 }),
  place(-16, -4.6, { model: "city-roads/light-square", yaw: 90 }),
  place(-16, 4.6, { model: "city-roads/light-square", yaw: -90 }),
  place(13, -4.6, { model: "city-roads/light-square", yaw: 90 }),
  place(13, 4.6, { model: "city-roads/light-square", yaw: -90 }),
];

// --- North-west block: Stefanini office (planar site) + mentoring plaza ---------------------------
const SF = at(14, -16);
const stefanini: PlanetPlacement[] = [
  place(14, -16, { model: "city-commercial/building-n", yaw: 180, plane: SF }), // front (n 6.7) faces south
  place(5.5, -22, { model: "city-commercial/detail-overhang-wide", y: 3.5, yaw: 180, plane: SF }),
  // the plaza is an open square: a table, a bench and a decorated tree in a row against the office
  // front (7 m+ clear of the tower on the plaza's west side)
  place(4.9, -18, { model: "city-commercial/detail-parasol-a" }),
  place(5.2, -13.5, { model: "holiday-kit/bench", yaw: 180 }),
  place(5, -9.5, { model: "holiday-kit/tree-decorated" }),
  // mentor and mentee
  place(2.8, -19.5, { model: "mini-characters/character-male-d", yaw: 80, anim: "interact-right" }),
  place(2.8, -16.5, { model: "mini-characters/character-female-c", yaw: -100, anim: "emote-yes" }),
];

// --- Towers around the blocks: few and well spaced (7 m+ between any two buildings) ---------------
const towers: PlanetPlacement[] = [
  place(26, 6, { model: "city-commercial/building-skyscraper-d", yaw: 180, y: -0.3 }), // the tallest, at the avenue's head
  place(-6, -27, { model: "city-commercial/building-skyscraper-a", yaw: -90, y: -0.55 }), // closes the street's west end
  place(-20, -18, { model: "city-industrial/water-tower" }),
];

// --- North-east block: GoFasti data warehouse (planar site), giant snowflake, AI kiosk ------------
const W: [number, number] = [10, 14];
const WH = at(...W);
const gofasti: PlanetPlacement[] = [
  place(W[0], W[1], { model: "city-industrial/building-a", yaw: 180, y: -0.2, plane: WH }), // long side E-W, front faces the street
  placeC(W[0], W[1], { model: "holiday-kit/snowflake-a", y: 11.6, yaw: 180, scale: 8, collider: "none", plane: WH }),
  // the "AI onboarding" kiosk: a robot arm against the warehouse front, its operator beside it
  place(3.5, 13, { model: "factory-kit/robot-arm-a", yaw: 90 }),
  place(3.2, 16, { model: "mini-characters/character-male-d", yaw: -90, anim: "emote-yes" }),
];

// --- Loading dock off the warehouse's east end: sunk below the plateau, open at both ends ---------
// Interior 9.4 m wide between the container walls (7.4 m clear beside the conveyor) and ~13 m long,
// 5.6 m clear under the roof; the planar pad keeps its floor and every piece square. The walls sit
// off-centre (north +5.6, south −6.8) so the north stack stays 7 m clear of the warehouse corner.
const D: [number, number] = [ST, 28];
const DK = at(...D);
const DOCK_WALLS = [5.6, -6.8];
/**
 * The south-east stack's outer corner reaches past the dock floor's rim, where the exit ramp falls
 * away: that stack and the roof slab on it sit this much lower so the corner meets the ground.
 */
const SE_SINK = 0.15;
const dock: PlanetPlacement[] = [];
for (const [i, de] of [-3.3, 3.3].entries()) {
  for (const [j, y] of [0, 2.8].entries()) {
    const c = (i + j) % 2 ? "a" : "b";
    for (const side of DOCK_WALLS) {
      const sink = side < 0 && de > 0 ? SE_SINK : 0;
      dock.push(place(D[0] + side, D[1] + de, { model: `city-industrial/shipping-container-${c}`, yaw: 90, y: y - sink, plane: DK }));
    }
  }
}
// Roof: four solid deck slabs resting on the container stacks (a short awning past each mouth). Their
// real light-metal underside reads from below, unlike a zero-thickness floor tile.
for (const dn of [-4, 2.8]) {
  for (const de of [-3.4, 3.4]) {
    const sink = dn < 0 && de > 0 ? SE_SINK : 0;
    dock.push(place(D[0] + dn, D[1] + de, { model: "space-kit/platform_large", y: 5.6 - sink, scale: 1.1, plane: DK }));
  }
}
dock.push(
  // inside: a conveyor and a robot arm tucked against the north wall; the lane stays open
  place(D[0] + 3.1, D[1] - 1, { model: "factory-kit/conveyor-long-stripe", plane: DK }),
  place(D[0] + 3.1, D[1] + 3.5, { model: "factory-kit/robot-arm-a", yaw: 180, scale: 0.85, plane: DK }), // 5.4 m: under the roof
  // one crate to bump at the way out, against the south wall
  place(D[0] - 5, D[1] + 8, { model: "factory-kit/box-small", body: "dynamic" }),
);

export const engineeringLayout: BiomeLayout = {
  biome: "engineering",
  // South on the avenue, looking north up it at the tallest tower; the road lanes leave behind it
  spawn: spawn(-22, 0, 0),
  pads: [
    // the raised plateau
    { ...at(0, 0), radius: 32, blend: 12, height: 2.5 },
    // loading dock: 2.5 m below the plateau; the blend makes the ramps in (west) and out (east)
    { ...DK, radius: 7.5, blend: 9, planar: true, height: -0.57 },
    // planar floors under the two wide buildings, level with the plateau
    { ...SF, radius: 12, blend: 4, planar: true, height: 5.6 },
    { ...WH, radius: 10, blend: 4, planar: true, height: 1.83 },
  ],
  markers: [
    marker(1, -15, { id: "stefanini", kind: "job", label: "Stefanini · Mentoring" }),
    marker(0.5, 8.5, { id: "gofasti", kind: "job", label: "GoFasti · Data & AI" }),
  ],
  placements: [...streets, ...furniture, ...stefanini, ...towers, ...gofasti, ...dock],
};
