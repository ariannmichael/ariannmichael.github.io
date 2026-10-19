// Road ports: the open tile edges the inter-town roads attach to (layout `roadPorts`, from
// layout/planet/roadHubs.ts). Shared by the offline router (the road starts on the edge, square to it)
// and the ribbon builder (its first row is the tile edge itself, so the two meet flush).

import { Vector3 } from "three";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import { placementPose } from "@/world/lib/planetPlacement";
import { getModel } from "@/world/models";
import type { BiomeId, RoadPort } from "./types";

export interface PortPose {
  /** Tile origin (on the ground at its centre) and up (the tile plane's normal) */
  origin: Vector3;
  up: Vector3;
  /** Outward heading (unit, in the tile plane) */
  heading: Vector3;
  /** Left of the outward heading (up × heading) */
  left: Vector3;
  /** Centre of the open edge at the tile's base (world) */
  edge: Vector3;
  /** Metres per tile unit (kit scale × placement scale): the tile's cross-section scale */
  scale: number;
}

/** Straight run out of a road port, square to the tile edge, metres (a multiple of ROAD_STEP) */
export const PORT_LEAD = 8;

const SIDES: Record<RoadPort["side"], [number, number]> = { "+x": [1, 0], "-x": [-1, 0], "+z": [0, 1], "-z": [0, -1] };

/** The port of the road from `here` toward `there`, or null when that end starts at the spawn. */
export function findRoadPort(here: BiomeId, there: BiomeId): RoadPort | null {
  const l = PLANET_LAYOUTS.find((x) => x.biome === here);
  return l?.roadPorts?.find((p) => p.to === there) ?? null;
}

/** World pose of a port's edge (tile models are 1 × 1 raw units, centred on their origin). */
export function portPose(port: RoadPort): PortPose {
  const pose = placementPose(port.tile);
  const { max } = getModel(port.tile.model); // kit scale applied: half the tile, metres
  const half = max[0] * (port.tile.scale ?? 1);
  const [sx, sz] = SIDES[port.side];
  const q = pose.quaternion;
  const up = new Vector3(0, 1, 0).applyQuaternion(q);
  const heading = new Vector3(sx, 0, sz).applyQuaternion(q);
  const left = new Vector3().crossVectors(up, heading).normalize();
  return {
    origin: pose.position.clone(),
    up,
    heading,
    left,
    edge: pose.position.clone().addScaledVector(heading, half),
    scale: half / 0.5,
  };
}
