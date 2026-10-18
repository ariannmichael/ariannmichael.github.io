// Biome layout: engineering — "Downtown Plateau" (biome agent A).
//
// A raised, flat city block on a big pad: a 3×3 grid of blocks cut by four streets (crossroads with
// traffic lights, street lights along the kerbs). Stefanini's office sits in the centre block behind
// a mentoring plaza; GoFasti's data warehouse (giant snowflake on the roof, "AI onboarding" kiosk in
// front) fills the east block. Behind the warehouse the road drops off the plateau into a covered
// loading dock built from stacked shipping containers: drive in from the west, out to the east.
//
//            N
//   [sky-b]   [sky-c][hall-l]   [sky-d]
//   ══════════╬══════════════╬═══════════
//   [tower-m] ║  STEFANINI   ║ [GOFASTI ❄]   ⟋ ramp ⟍ [== loading dock ==] → wilds
//   [hall-j]  ║  plaza ●     ║  kiosk ●
//   ══════════╬══════════════╬═══════════
//   [sky-a]     [low] ↑ [low]
//                   spawn
import type { BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { BIOMES } from "@/world/planet/biomes";
import { author } from "./a/kit";

/** Road tiles are flat squares on a curved surface: 2 % oversize hides the hairline seams. */
const ROAD_SCALE = 1.02;

const CENTER = BIOMES.find((b) => b.id === "engineering")!.center;
const { at, place, placeC, marker } = author(CENTER);

// --- Streets: two N-S avenues (e = ±20) and two E-W streets (n = ±20) --------------------------
const S = 20;
const streets: PlanetPlacement[] = [];
for (const k of [-36, -28, -12, -4, 4, 12, 28, 36]) {
  for (const s of [-S, S]) {
    // road-straight runs along the model's X axis, which is E-W at yaw 0
    streets.push(place(k, s, { model: "city-roads/road-straight", yaw: 90, scale: ROAD_SCALE })); // N-S avenue tile
    streets.push(place(s, k, { model: "city-roads/road-straight", scale: ROAD_SCALE })); // E-W street tile
  }
}
for (const n of [-S, S]) for (const e of [-S, S]) streets.push(place(n, e, { model: "city-roads/road-crossroad", scale: ROAD_SCALE }));

// Traffic lights on one corner of each crossroads, street lights along the inner kerbs
const furniture: PlanetPlacement[] = [
  place(-S - 5, -S + 5, { model: "city-roads/traffic-light", yaw: 0 }),
  place(-S + 5, S + 5, { model: "city-roads/traffic-light", yaw: -90 }),
  place(S + 5, S - 5, { model: "city-roads/traffic-light", yaw: 180 }),
  place(S - 5, -S - 5, { model: "city-roads/traffic-light", yaw: 90 }),
];
for (const k of [-30, -10, 10, 30]) {
  furniture.push(place(k, -S + 4.6, { model: "city-roads/light-square", yaw: 90 }));
  furniture.push(place(k, S - 4.6, { model: "city-roads/light-square", yaw: -90 }));
}

// --- Centre block: Stefanini office + mentoring plaza ------------------------------------------
const stefanini: PlanetPlacement[] = [
  place(7, 0, { model: "city-commercial/building-n", yaw: 180 }), // front faces south, to the plaza
  place(-1.5, -6, { model: "city-commercial/detail-overhang-wide", y: 3.5, yaw: 180 }),
  // the plaza: parasol tables, benches, lanterns, a decorated tree
  place(-4, -10, { model: "city-commercial/detail-parasol-a" }),
  place(-4, 10, { model: "city-commercial/detail-parasol-a" }),
  place(-11, -8, { model: "holiday-kit/bench", yaw: 60 }),
  place(-11, 8, { model: "holiday-kit/bench", yaw: -60 }),
  place(-14, -13, { model: "holiday-kit/lantern" }),
  place(-14, 13, { model: "holiday-kit/lantern" }),
  place(-1, 13, { model: "holiday-kit/tree-decorated" }),
  // mentor and mentees
  place(-8, -7, { model: "mini-characters/character-male-d", yaw: -80, anim: "interact-right" }),
  place(-9.5, -4, { model: "mini-characters/character-female-c", yaw: 120, anim: "emote-yes" }),
  place(-6.5, -10, { model: "mini-characters/character-male-b", yaw: 30, anim: "idle" }),
  place(-3, 7, { model: "mini-characters/character-female-c", yaw: 200, anim: "sit" }),
];

// --- Towers in the surrounding blocks ------------------------------------------------------------
const towers: PlanetPlacement[] = [
  place(32, -32, { model: "city-commercial/building-skyscraper-b", yaw: 180 }),
  place(32, -7, { model: "city-commercial/building-skyscraper-c", yaw: 180 }),
  place(32, 8, { model: "city-commercial/building-l", yaw: 180 }),
  place(32, 32, { model: "city-commercial/building-skyscraper-d", yaw: 180 }),
  place(9, -32, { model: "city-commercial/building-m", yaw: -90 }),
  place(-7, -32, { model: "city-commercial/building-j", yaw: -90 }),
  place(-32, -32, { model: "city-commercial/building-skyscraper-a", yaw: 0 }),
  place(-32, -10, { model: "city-commercial/low-detail-building-wide-a", yaw: 0 }),
  place(-32, 10, { model: "city-commercial/low-detail-building-wide-a", yaw: 0 }),
  place(-32, 32, { model: "city-commercial/building-skyscraper-e", yaw: 0 }),
  // background skyline beyond the plateau edge
  place(44, -14, { model: "city-commercial/low-detail-building-c" }),
  place(46, 2, { model: "city-commercial/low-detail-building-c" }),
  place(42, 18, { model: "city-commercial/low-detail-building-c" }),
  place(-12, -44, { model: "city-commercial/low-detail-building-c" }),
  place(10, -45, { model: "city-commercial/low-detail-building-c" }),
];

// --- East block: GoFasti data warehouse, giant snowflake, AI onboarding kiosk --------------------
const W: [number, number] = [6, 36];
const gofasti: PlanetPlacement[] = [
  place(W[0], W[1], { model: "city-industrial/building-a", yaw: 90 }), // long side along N-S, front west
  placeC(W[0], W[1], { model: "holiday-kit/snowflake-a", y: 11.6, yaw: 90, scale: 8, collider: "none" }),
  // the kiosk
  place(-9, 34, { model: "city-commercial/low-detail-building-n", yaw: 90 }),
  place(-14, 34, { model: "factory-kit/robot-arm-a", yaw: 90 }),
  place(-12.5, 30.5, { model: "mini-characters/character-male-d", yaw: -90, anim: "emote-yes" }),
];

// --- Loading dock east of the warehouse: dug in below the plateau, open at both ends -------------
// Interior 9 m wide (n 1.5..10.5) and ~20 m long (e 52..72), 5.6 m clear under the roof.
const D: [number, number] = [6, 62];
const dock: PlanetPlacement[] = [];
for (const [i, de] of [-6.6, 0, 6.6].entries()) {
  for (const [j, y] of [0, 2.8].entries()) {
    const c = (i + j) % 2 ? "a" : "b";
    dock.push(place(D[0] + 6, D[1] + de, { model: `city-industrial/shipping-container-${c}`, yaw: 90, y }));
    dock.push(place(D[0] - 6, D[1] + de, { model: `city-industrial/shipping-container-${c}`, yaw: 90, y }));
  }
}
// Roof: three solid 8.8 m deck slabs resting on the container stacks (a 3 m awning past each mouth).
// A zero-thickness floor tile read black from below (its dark top swatch, back-lit); these slabs
// have a real light-metal underside, which the hemisphere fill lights from below.
for (const de of [-8.8, 0, 8.8]) {
  dock.push(place(D[0], D[1] + de, { model: "space-kit/platform_large", y: 5.6, scale: 1.1 }));
}
dock.push(
  // inside: conveyor and crates along the north wall, hazard posts at both mouths
  place(D[0] + 3.5, D[1] - 4, { model: "factory-kit/conveyor-long-stripe", yaw: 90 }),
  place(D[0] + 3.5, D[1], { model: "factory-kit/conveyor-long-stripe", yaw: 90 }),
  place(D[0] + 3.6, D[1] + 4, { model: "factory-kit/box-large" }),
  place(D[0] + 3.6, D[1] + 6.5, { model: "factory-kit/box-large" }),
  place(D[0] + 3.5, D[1] - 8, { model: "factory-kit/robot-arm-a", yaw: 180, scale: 0.85 }), // 5.4 m: under the roof
  place(D[0] + 4, D[1] - 11, { model: "factory-kit/warning-traffic" }),
  place(D[0] - 4, D[1] - 11, { model: "factory-kit/warning-traffic" }),
  place(D[0] + 4, D[1] + 11, { model: "factory-kit/warning-traffic" }),
  place(D[0] - 4, D[1] + 11, { model: "factory-kit/warning-traffic" }),
  // a few dynamic crates to bump on the way out
  place(D[0] - 2.5, D[1] + 11.5, { model: "factory-kit/box-small", body: "dynamic" }),
  place(D[0] - 1.2, D[1] + 12, { model: "factory-kit/box-small", body: "dynamic" }),
  place(D[0] - 1.8, D[1] + 11.7, { model: "factory-kit/box-small", body: "dynamic", y: 1.1 }),
);

// --- Outskirts: wind turbines, solar farm, water tower, earthen kickers --------------------------
const outskirts: PlanetPlacement[] = [
  place(58, 6, { model: "city-industrial/windmill", yaw: 30 }),
  place(54, 26, { model: "city-industrial/windmill", yaw: 40 }),
  place(60, -16, { model: "city-industrial/windmill", yaw: 20 }),
  place(-50, 30, { model: "city-industrial/water-tower" }),
  place(-48, -36, { model: "city-industrial/solar-panel-landscape-group", yaw: 10 }),
  place(-58, -22, { model: "city-industrial/solar-panel-landscape-group", yaw: 10 }),
  place(-31, -54, { model: "city-roads/construction-cone", body: "dynamic" }),
  place(-25, -58, { model: "city-roads/construction-cone", body: "dynamic" }),
];

export const engineeringLayout: BiomeLayout = {
  biome: "engineering",
  // South of the grid on the central lane, looking north across the plaza at Stefanini
  spawn: { ...at(-35, 0), yaw: 0 },
  pads: [
    // the raised plateau
    { ...at(0, 0), radius: 46, blend: 12, height: 2.5 },
    // loading dock: dug below the plateau, the blend makes the ramps in (west) and out (east)
    { ...at(D[0], D[1]), radius: 12, blend: 9, height: -1.5 },
    // kickers in the outskirts
    { ...at(-52, 4), radius: 3, blend: 5, height: 1.5 },
    { ...at(50, -40), radius: 3.5, blend: 6, height: 1.8 },
    { ...at(-30, 58), radius: 3, blend: 5, height: 1.4 },
  ],
  markers: [
    marker(-6, 0, { id: "stefanini", kind: "job", label: "Stefanini · Mentoring" }),
    marker(-9, 27.5, { id: "gofasti", kind: "job", label: "GoFasti · Data & AI" }),
  ],
  placements: [...streets, ...furniture, ...stefanini, ...towers, ...gofasti, ...dock, ...outskirts],
};
