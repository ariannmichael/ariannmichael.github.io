// Road hubs (coordinator-owned): where the inter-town roads attach to each town. Every road ends on
// the open edge of a Kenney city-roads tile, so the paved ribbon (roads/roadGeometry.ts) continues the
// tile's own cross-section flush: same asphalt, gutters, centre line and raised sidewalks.
//
// - Home and Downtown leave from their own street grid: T junctions replace the loop's two south
//   corners and the avenue's south end (same grid position, scale and authoring helper as the rest of
//   their streets).
// - Speed King Canyon: a crossroad north of the start/finish straight, its south arm opening onto the track.
// - The other towns have no streets: one crossroad on a small level patch where both roads arrive,
//   two of its arms facing the roads and the other two opening into town.
//
// index.ts merges each hub's tile, pad and ports into its layout.
import { BIOMES } from "@/world/planet/biomes";
import type { BiomeId, FlatPad, PlanetPlacement, RoadPort } from "@/world/planet/types";
import { author } from "./a/kit";
import { site } from "./b/site";

/** Same oversize as the towns' street tiles (hides hairline seams between flat tiles on the sphere) */
export const ROAD_TILE_SCALE = 1.02;
const T = "city-roads/road-intersection"; // arms along ±X, stem toward +Z, sidewalk along −Z
const CROSS = "city-roads/road-crossroad";

export interface RoadHub {
  biome: BiomeId;
  tiles: PlanetPlacement[];
  pads: FlatPad[];
  ports: RoadPort[];
}

const center = (id: BiomeId) => BIOMES.find((b) => b.id === id)!.center;

/**
 * A crossroad on its own level patch: planar, at the height the town's pads left at its centre, plus
 * `level` metres (to sit flush with a neighbouring plaza when the hub straddles its blend ring).
 */
function crossroad(
  biome: BiomeId,
  north: number,
  east: number,
  yaw: number,
  ports: [BiomeId, RoadPort["side"]][],
  level = 0,
): RoadHub {
  const s = site(center(biome));
  const tile = s.place(north, east, { model: CROSS, yaw, scale: ROAD_TILE_SCALE });
  return {
    biome,
    tiles: [tile],
    // Corners reach 5.9 m; the planar core keeps the whole tile on its own flat ground
    pads: [s.pad(north, east, 6, { blend: 4, planar: true, onGround: true, height: level })],
    ports: ports.map(([to, side]) => ({ to, tile, side })),
  };
}

function home(): RoadHub {
  const { place } = author(center("home"));
  // Loop corners at (±12, ±12). SW: stem east (along the south row), arms north (west column) and
  // south (out of town). SE: stem west, arms north and south.
  const sw = place(-12, -12, { model: T, yaw: -90, scale: ROAD_TILE_SCALE });
  const se = place(-12, 12, { model: T, yaw: 90, scale: ROAD_TILE_SCALE });
  return {
    biome: "home",
    tiles: [sw, se],
    pads: [],
    ports: [
      { to: "opensource", tile: sw, side: "-x" },
      { to: "raceway", tile: se, side: "+x" },
    ],
  };
}

function engineering(): RoadHub {
  const { place } = author(center("engineering"));
  // The avenue's south end: stem north up the avenue, arms west and east
  const t = place(-24, 0, { model: T, yaw: 0, scale: ROAD_TILE_SCALE });
  return {
    biome: "engineering",
    tiles: [t],
    pads: [],
    ports: [
      { to: "raceway", tile: t, side: "+x" },
      { to: "badlands", tile: t, side: "-x" },
    ],
  };
}

function raceway(): RoadHub {
  const { place } = author(center("raceway"));
  // North of the start straight's west tile (racing tiles are 8 m: the straight's north edge is n 17).
  // South onto the track, north to Downtown, west to Hometown; east opens onto the infield verge.
  const t = place(17 + 4 * ROAD_TILE_SCALE, -12, { model: CROSS, yaw: 0, scale: ROAD_TILE_SCALE });
  return {
    biome: "raceway",
    tiles: [t],
    pads: [],
    ports: [
      { to: "home", tile: t, side: "+x" },
      { to: "engineering", tile: t, side: "+z" },
    ],
  };
}

// Crossroad sides at yaw y (anchor frame, compass bearings): +Z = −y, −X = 90 − y, −Z = 180 − y, +X = 270 − y.
// Yaws are tuned so that every road turns out of its port gently (route turn radius ≥ 7 m).
export const ROAD_HUBS: RoadHub[] = [
  home(),
  engineering(),
  raceway(),
  // On the spawn apron. Both roads leave north-east, so the arms straddle that: north to Downtown,
  // east to Clinic Lakeside; the other two open onto the jump field
  crossroad("badlands", 16, 0, 0, [["engineering", "+z"], ["healthcare", "-x"]]),
  // On the spawn. Both roads leave south: south-south-west to the Badlands, south-east to Game Dev
  // Park; the other two open toward the plaza and the hall
  crossroad("healthcare", -18, 0, -33, [["badlands", "-z"], ["gamedev", "-x"]]),
  // North of the spawn plaza; west to Clinic Lakeside, east to Fintech Dunes; south into the park
  crossroad("gamedev", 24.5, 0, 0, [["healthcare", "+x"], ["financial", "-x"]]),
  // Behind the spawn, on the dune flank past the spawn pad: lowered to the spawn's level (6.4 m).
  // South-west to Game Dev Park, east-south-east to Open Source; the rest into town
  crossroad("financial", -24, -11, -30, [["gamedev", "-z"], ["opensource", "-x"]], -0.9),
  // North of the spawn; north-north-west to Fintech Dunes, east-north-east to Hometown
  crossroad("opensource", 31, -7, 35, [["financial", "+z"], ["home", "-x"]]),
];
