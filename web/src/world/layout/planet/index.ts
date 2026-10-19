// Biome layouts on the planet: one file per biome (owned by biome agents), collected here (coordinator).
import { getModel } from "@/world/models";
import type { BiomeLayout, FlatPad, PlanetPlacement, RoadPort } from "@/world/planet/types";
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
 * Grounds the layout's road tiles. A flat 8 m tile stood on the curved ground lifts its corners by
 * d²/2R ≈ 0.19 m, so standard tiles sink 6 cm (corner gap ≤ 0.14 m, asphalt still above the ground at
 * the middle; the kerb and sidewalk blocks hide the gap). A bigger piece (the 16 m start straight)
 * would have to sink too far, so it gets its own planar pad (level with the ground left at its centre)
 * and stands on that plane.
 */
function groundRoadTiles(layout: BiomeLayout): BiomeLayout {
  const swap = new Map<PlanetPlacement, PlanetPlacement>();
  const pads: FlatPad[] = [];
  const placements = layout.placements.map((p) => {
    if (!isRoadTile(p) || p.plane) return p;
    const { min, max } = getModel(p.model);
    const s = p.scale ?? 1;
    const half = (Math.max(max[0] - min[0], max[2] - min[2]) / 2) * s;
    let grounded: PlanetPlacement;
    if (half <= STD_TILE_HALF) {
      grounded = { ...p, y: (p.y ?? 0) - TILE_SINK };
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
