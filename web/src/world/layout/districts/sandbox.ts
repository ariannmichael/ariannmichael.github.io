// Temporary test district used to exercise the town, vehicle, colliders and zones before the
// real districts are authored. The districts agent replaces it.
import type { DistrictLayout, Placement } from "@/world/layout/types";

const road = (x: number, z: number, rot: 0 | 1 = 0): Placement => ({
  model: "city-roads/road-straight",
  x,
  z,
  rot,
});

export const sandbox: DistrictLayout = {
  id: "home",
  origin: { x: 0, z: 0 },
  // South end of the north-south road, facing north (+Z) towards the crossroad
  spawn: { x: 0, z: -3, rot: 0 },
  placements: [
    // A plus-shaped road: crossroad in the middle, three straights in each direction
    { model: "city-roads/road-crossroad", x: 0, z: 0 },
    road(0, 1),
    road(0, 2),
    road(0, 3),
    road(0, -1),
    road(0, -2),
    road(0, -3),
    road(1, 0, 1),
    road(2, 0, 1),
    road(3, 0, 1),
    road(-1, 0, 1),
    road(-2, 0, 1),
    road(-3, 0, 1),

    // Buildings on the four blocks, fronts facing the roads
    { model: "city-commercial/building-a", x: 1, z: 1, rot: 3 },
    { model: "city-commercial/building-a", x: -1, z: 1, rot: 1 },
    { model: "city-commercial/building-a", x: 1, z: -1, rot: 3 },
    { model: "city-commercial/building-a", x: -1, z: 2, rot: 1 },
    { model: "city-commercial/building-a", x: 2, z: -1, rot: 0 },

    // Cones to knock over
    { model: "car-kit/cone", x: -0.2, z: -1.6, body: "dynamic" },
    { model: "car-kit/cone", x: 0.2, z: -1.4, body: "dynamic" },
    { model: "car-kit/cone", x: 0, z: -1.2, body: "dynamic" },
    { model: "car-kit/cone", x: 2.2, z: 0.15, body: "dynamic" },
    { model: "car-kit/cone", x: 2.2, z: -0.15, body: "dynamic" },
  ],
  markers: [
    { id: "about", kind: "about", x: 0, z: 2.5, label: "About me" },
    { id: "speed-king", kind: "game", x: 3, z: 0, label: "Speed King" },
    { id: "cv", kind: "cv", x: -3, z: 0 },
  ],
};
