// "Under construction" plots for the Milestone 2 districts (healthcare, financial, opensource,
// gamedev). They are part of the town's look but not districts yet, so each one is attached to the
// placements of the nearest Milestone 1 district. Coordinates are town tiles.
import type { Placement } from "@/world/layout/types";
import { flat, put, row } from "./helpers";

/**
 * A ~2.5 x 2.5 tile building site whose open side faces EAST (towards the west ring road).
 * `variant` swaps the centrepiece so the four plots don't look identical.
 */
export function constructionPlot(cx: number, cz: number, variant: 0 | 1 | 2 | 3): Placement[] {
  const front = cx + 1.25; // east edge, facing the road
  const back = cx - 1.25;
  const out: Placement[] = [
    // Fence along the street side with a gap in the middle for the site entrance
    ...row("city-roads/construction-fence", { x: front, z: cz - 1.03 }, { x: 0, z: 0.375 }, 2),
    ...row("city-roads/construction-fence", { x: front, z: cz + 0.66 }, { x: 0, z: 0.375 }, 2),
    // Back and side fences, so the site reads as an enclosed lot
    ...row("city-roads/construction-fence", { x: back, z: cz - 1.03 }, { x: 0, z: 0.375 }, 6),
    ...row("city-roads/construction-fence", { x: cx - 1.0, z: cz - 1.32 }, { x: 0.375, z: 0 }, 6, 1),
    ...row("city-roads/construction-fence", { x: cx - 1.0, z: cz + 1.32 }, { x: 0.375, z: 0 }, 6, 1),
    // Entrance: barriers, a warning light and knockable cones on the verge in front of the gap
    put("city-roads/construction-barrier", front + 0.2, cz - 0.42),
    put("city-roads/construction-barrier", front + 0.2, cz + 0.42),
    put("city-roads/construction-light", front + 0.1, cz - 0.62),
    put("city-roads/construction-light", front + 0.1, cz + 0.62),
    put("car-kit/cone", front + 0.6, cz - 0.3, 0, { body: "dynamic" }),
    put("car-kit/cone", front + 0.6, cz, 0, { body: "dynamic" }),
    put("car-kit/cone", front + 0.6, cz + 0.3, 0, { body: "dynamic" }),
    // Ground marking inside the lot
    flat("factory-kit/top-large-checkerboard", cx + 0.3, cz, 0),
  ];
  // Centrepieces: a crane, stacked containers, half-built walls, materials
  switch (variant) {
    case 0:
      out.push(
        put("factory-kit/crane", cx - 0.5, cz - 0.4, 1),
        put("city-industrial/shipping-container-a", cx - 0.6, cz + 0.6, 1),
        put("factory-kit/box-large", cx + 0.4, cz + 0.7),
        put("factory-kit/box-long", cx + 0.4, cz - 0.8, 1),
      );
      break;
    case 1:
      out.push(
        put("factory-kit/structure-wall", cx - 0.6, cz - 0.6, 0),
        put("factory-kit/structure-window", cx - 0.6, cz + 0.15, 0),
        put("city-industrial/shipping-container-b", cx + 0.1, cz + 0.85, 1),
        put("factory-kit/box-large", cx + 0.45, cz - 0.75),
      );
      break;
    case 2:
      out.push(
        put("factory-kit/crane", cx - 0.6, cz + 0.5, 0),
        put("city-industrial/shipping-container-c", cx - 0.6, cz - 0.6, 1),
        put("city-industrial/shipping-container-a", cx - 0.6, cz - 0.6, 1, { y: 2.785 }),
        put("factory-kit/box-wide", cx + 0.45, cz + 0.8),
      );
      break;
    default:
      out.push(
        put("factory-kit/structure-wall", cx - 0.6, cz - 0.6, 0),
        put("factory-kit/robot-arm-a", cx + 0.1, cz - 0.6),
        put("city-industrial/shipping-container-b", cx - 0.6, cz + 0.7, 1),
        put("factory-kit/box-long", cx + 0.45, cz + 0.75, 1),
      );
  }
  return out;
}
