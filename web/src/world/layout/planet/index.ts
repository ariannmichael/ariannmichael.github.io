// Biome layouts on the planet: one file per biome (owned by biome agents), collected here (coordinator).
import { getModel } from "@/world/models";
import type { BiomeLayout, FlatPad, PlanetPlacement, RoadPort } from "@/world/planet/types";
import { PLANET_RADIUS } from "@/world/planet/config";
import { latLonToDir } from "@/world/planet/sphere";
import { grid } from "./author";
import { rotateLocal } from "./a/kit";
import { badlandsLayout } from "./badlands";
import { engineeringLayout } from "./engineering";
import { financialLayout } from "./financial";
import { gamedevLayout } from "./gamedev";
import { healthcareLayout } from "./healthcare";
import { homeLayout } from "./home";
import { opensourceLayout } from "./opensource";
import { racewayLayout } from "./raceway";
import { ROAD_HUBS } from "./roadHubs";

const isRoadTile = (p: PlanetPlacement) => /^(city-roads\/road-|racing-kit\/road)/.test(p.model);

/** Standard city-roads / racing-kit tiles are 8 m (× 1.02): corners lift d²/2R ≈ 0.19 m off the ground */
const STD_TILE_HALF = 4.2;
/** Standard tiles sink this far: corners float ≤ ~0.14 m, the centre's asphalt (0.08 m up) stays above ground */
const TILE_SINK = 0.06;
/**
 * Neighbouring standard tiles overlap by ~8 cm (scale 1.02, to cover the cracks the curved ground opens),
 * and in that strip their tops are within 1 mm of each other: the dark edge faces of one tile fight the
 * top of the next and sparkle whenever the camera moves. So each tile gets a stacking level and rises
 * `STACK_STEP` per level: overlapping tiles never share a level, which gives every seam a fixed 4 mm
 * winner (the depth buffer resolves ~0.1 mm at 15 m and ~1 mm at 40 m). A road grid colours with two levels.
 */
const STACK_STEP = 0.004;
/** Centres closer than this are edge neighbours (8.16 m apart); diagonals only touch in an 8 cm corner */
const STACK_REACH = 9;

/**
 * Grounds the layout's road tiles. A flat 8 m tile stood on the curved ground lifts its corners by
 * d²/2R ≈ 0.19 m, so standard tiles sink 6 cm (corner gap ≤ 0.14 m, asphalt still above the ground at
 * the middle; the kerb and sidewalk blocks hide the gap). A bigger piece (the 16 m start straight)
 * would have to sink too far, so it gets its own planar pad (level with the ground left at its centre)
 * and stands on that plane.
 */
/** Stacking level (0, 1, 2…) per standard road tile: the lowest one no overlapping tile already uses. */
export function roadTileLevels(tiles: readonly PlanetPlacement[]): Map<PlanetPlacement, number> {
  const dirs = tiles.map((t) => latLonToDir(t.lat, t.lon));
  const levels = new Map<PlanetPlacement, number>();
  tiles.forEach((t, i) => {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      const c = dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y + dirs[i].z * dirs[j].z;
      if (Math.acos(Math.min(1, c)) * PLANET_RADIUS < STACK_REACH) used.add(levels.get(tiles[j])!);
    }
    let level = 0;
    while (used.has(level)) level++;
    levels.set(t, level);
  });
  return levels;
}

const isStandardTile = (p: PlanetPlacement) => {
  if (!isRoadTile(p) || p.plane) return false;
  const { min, max } = getModel(p.model);
  return (Math.max(max[0] - min[0], max[2] - min[2]) / 2) * (p.scale ?? 1) <= STD_TILE_HALF;
};

function groundRoadTiles(layout: BiomeLayout): BiomeLayout {
  const swap = new Map<PlanetPlacement, PlanetPlacement>();
  const pads: FlatPad[] = [];
  const levels = roadTileLevels(layout.placements.filter(isStandardTile));
  const placements = layout.placements.map((p) => {
    if (!isRoadTile(p) || p.plane) return p;
    const { min, max } = getModel(p.model);
    const s = p.scale ?? 1;
    const half = (Math.max(max[0] - min[0], max[2] - min[2]) / 2) * s;
    let grounded: PlanetPlacement;
    if (half <= STD_TILE_HALF) {
      grounded = { ...p, y: (p.y ?? 0) - TILE_SINK + (levels.get(p) ?? 0) * STACK_STEP };
    } else {
      // The footprint centre (the start piece's origin is at its end, not its middle)
      const [dn, de] = rotateLocal(((min[0] + max[0]) / 2) * s, ((min[2] + max[2]) / 2) * s, p.yaw ?? 0);
      const centre = grid({ lat: p.lat, lon: p.lon }).at(dn, de);
      pads.push({ ...centre, radius: half * 1.25, blend: 5, planar: true, onGround: true });
      grounded = { ...p, plane: centre };
    }
    swap.set(p, grounded);
    return grounded;
  });
  const roadPorts: RoadPort[] | undefined = layout.roadPorts?.map((port) => ({ ...port, tile: swap.get(port.tile) ?? port.tile }));
  return { ...layout, placements, pads: [...layout.pads, ...pads], roadPorts };
}

/** A layout with its road hub merged in: the hub's tiles, its level pads and its ports; tiles grounded. */
function withRoadHub(layout: BiomeLayout): BiomeLayout {
  const hub = ROAD_HUBS.find((h) => h.biome === layout.biome);
  const merged: BiomeLayout = hub
    ? {
        ...layout,
        placements: [...layout.placements, ...hub.tiles],
        pads: [...layout.pads, ...hub.pads],
        roadPorts: [...(layout.roadPorts ?? []), ...hub.ports],
      }
    : layout;
  return groundRoadTiles(merged);
}

export const PLANET_LAYOUTS: BiomeLayout[] = [
  homeLayout,
  engineeringLayout,
  healthcareLayout,
  financialLayout,
  opensourceLayout,
  gamedevLayout,
  racewayLayout,
  badlandsLayout,
].map(withRoadHub);
