// Terrain first: it pulls in every layout before frame.ts is re-entered (avoids an import cycle TDZ).
import { biomeAt } from "@/world/planet/terrain";
import { describe, expect, it } from "vitest";
import { getContent } from "@/content";
import { hasModel } from "@/world/models";
import { angleBetween, degToMetres, latLonToDir } from "@/world/planet/frame";
import { BIOMES } from "@/world/planet/biomes";
import { markerSensorBox } from "@/world/lib/planetPlacement";
import { SENSOR, budgetCounts, fixedBoxes, groundPoint, insideBox, laneHits, sensorCenter, unreachable } from "./c/check";
import { grid } from "./author";
import { GAMEDEV_SPAWN, gamedevLayout as layout } from "./gamedev";

const biome = BIOMES.find((b) => b.id === "gamedev")!;

/** Local metres (north, east) of a lat/lon on the gamedev grid, by Newton steps on grid().at */
function localOf(p: { lat: number; lon: number }): { n: number; e: number } {
  const g = grid(biome.center);
  let n = 0;
  let e = 0;
  for (let k = 0; k < 20; k++) {
    const q = g.at(n, e);
    const dn = g.at(n + 0.01, e);
    const de = g.at(n, e + 0.01);
    // 2×2 Jacobian of (lat, lon) w.r.t. (n, e)
    const a = (dn.lat - q.lat) / 0.01;
    const b = (de.lat - q.lat) / 0.01;
    const c = (dn.lon - q.lon) / 0.01;
    const d = (de.lon - q.lon) / 0.01;
    const rl = p.lat - q.lat;
    const ro = p.lon - q.lon;
    const det = a * d - b * c;
    n += (d * rl - b * ro) / det;
    e += (a * ro - c * rl) / det;
  }
  return { n, e };
}
const GAMES = ["super-mega-ultra-pong", "shoot-em-all", "rat-catcher", "lead-me-to-the-light", "get-notes"];

describe("gamedev layout", () => {
  it("only uses models that exist", () => {
    const missing = layout.placements.filter((p) => !hasModel(p.model)).map((p) => p.model);
    expect(missing).toEqual([]);
  });

  it("has one game marker per itch.io game, with valid content ids", () => {
    expect(layout.markers.map((m) => m.id).sort()).toEqual([...GAMES].sort());
    for (const m of layout.markers) {
      expect(m.kind).toBe("game");
      expect(getContent(m.id)?.type).toBe("game");
      expect((m.label ?? "").length).toBeLessThanOrEqual(20);
    }
  });

  it("keeps the spawn and every marker inside the gamedev biome core", () => {
    for (const p of [layout.spawn, ...layout.markers]) {
      expect(biomeAt(latLonToDir(p.lat, p.lon))).toBe("gamedev");
      expect(angleBetween(p, biome.center)).toBeLessThan(biome.radiusDeg * 0.8);
    }
  });

  it("keeps every placement and pad within the biome radius", () => {
    for (const p of [...layout.placements, ...layout.pads]) {
      expect(angleBetween(p, biome.center)).toBeLessThan(biome.radiusDeg);
    }
  });

  it("puts no marker sensor or the spawn inside a fixed collider", () => {
    const boxes = fixedBoxes(layout);
    const points = [
      { what: "spawn", pt: groundPoint(layout.spawn) },
      ...layout.markers.map((m) => ({ what: m.id, pt: sensorCenter(m) })),
    ];
    const hits = points.flatMap(({ what, pt }) =>
      boxes.filter(({ box }) => insideBox(pt, box, 0.5)).map((b) => `${what} in ${b.model}#${b.index}`),
    );
    expect(hits).toEqual([]);
  });

  // Doorway lanes as [from, to] in local metres: both interiors are drive-through, so each lane runs
  // from in front of the entrance out through the far doorway (arcade west → east, dungeon north → south)
  type Lane = [[number, number], [number, number]];
  const walk = (lane: Lane, step = 0.5) => {
    const [[n0, e0], [n1, e1]] = lane;
    const len = Math.hypot(n1 - n0, e1 - e0);
    const out: { n: number; e: number; side: [number, number] }[] = [];
    for (let s = 0; s <= len; s += step) {
      // unit sideways vector, for the lane's width
      out.push({ n: n0 + ((n1 - n0) * s) / len, e: e0 + ((e1 - e0) * s) / len, side: [-(e1 - e0) / len, (n1 - n0) / len] });
    }
    return out;
  };

  it("leaves a clear lane from each drive-in marker through its doorway", () => {
    const g = grid(biome.center);
    const boxes = fixedBoxes(layout);
    const lanes: Lane[] = [
      [[5, 8], [5, 42]],
      [[-6, 0], [-40, 0]],
    ];
    const hits: string[] = [];
    for (const lane of lanes) {
      for (const { n, e, side } of walk(lane)) {
        for (const d of [-1.4, 0, 1.4]) {
          for (const h of [0.4, 1.2, 2.2]) {
            const pt = groundPoint(g.at(n + side[0] * d, e + side[1] * d), h);
            for (const b of boxes) if (insideBox(pt, b.box)) hits.push(`${n.toFixed(1)},${e.toFixed(1)} in ${b.model}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps marker sensors out of the doorway approach lanes", () => {
    // The wheel raycasts hit zone sensors today, so a sensor in a lane is an invisible 4 m block.
    const g = grid(biome.center);
    const sensors = layout.markers.map((m) => ({ id: m.id, box: markerSensorBox(m, SENSOR.size, SENSOR.height) }));
    const lanes: Lane[] = [
      [[5, 4], [5, 42]],
      [[-2, 0], [-40, 0]],
    ];
    const hits: string[] = [];
    for (const lane of lanes) {
      for (const { n, e, side } of walk(lane)) {
        for (const d of [-1.4, 0, 1.4]) {
          const pt = groundPoint(g.at(n + side[0] * d, e + side[1] * d), 0.5);
          for (const s of sensors) if (insideBox(pt, s.box, 1.5)) hits.push(`${n.toFixed(1)},${e.toFixed(1)} in ${s.id}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps two 12 m road lanes clear from the spawn toward 321° and 39°", () => {
    expect(laneHits(layout, biome.center, GAMEDEV_SPAWN, [321, 39])).toEqual([]);
  });

  it("can drive from the spawn to every marker and into both interiors", () => {
    const targets = [
      ...layout.markers.map((m) => {
        const { n, e } = localOf(m);
        return { label: m.id, n, e, near: 5.5 };
      }),
      { label: "arcade hall", n: 5, e: 24 },
      { label: "arcade hall exit", n: 5, e: 38 },
      { label: "dungeon", n: -23, e: 0 },
      { label: "dungeon exit", n: -38, e: 0 },
      { label: "lighthouse", n: -19, e: -21, near: 2 },
    ];
    expect(unreachable(layout, biome.center, GAMEDEV_SPAWN, targets)).toEqual([]);
  });

  it("spawns 5–25 m from the centre on a flat pad, facing into the park", () => {
    const d = degToMetres(angleBetween(layout.spawn, biome.center));
    expect(d).toBeGreaterThanOrEqual(5);
    expect(d).toBeLessThanOrEqual(25);
    const onFlat = layout.pads.some((p) => !p.height && degToMetres(angleBetween(p, layout.spawn)) <= p.radius);
    expect(onFlat).toBe(true);
  });

  it("keeps the signature landmarks and both drive-in interiors", () => {
    const has = (model: string) => layout.placements.some((p) => p.model === model);
    for (const model of [
      "coaster-kit/park-entrance",
      "coaster-kit/coaster-steel-looping",
      "coaster-kit/station",
      "space-kit/platform_large",
      "space-kit/craft_speederA",
      "space-kit/craft_speederD",
      "pirate-kit/tower-complete-large",
      "pirate-kit/ship-pirate-small",
      "fantasy-town/wall-wood",
      "graveyard-kit/crypt-small",
      "mini-arcade/air-hockey",
    ]) {
      expect(has(model), model).toBe(true);
    }
    // The arcade hall and the dungeon stand square on planar pads
    for (const model of ["mini-arcade/wall", "mini-dungeon/wall"]) {
      const pieces = layout.placements.filter((p) => p.model === model);
      expect(pieces.length, model).toBeGreaterThanOrEqual(10);
      for (const p of pieces) {
        expect(p.plane, model).toBeDefined();
        const site = layout.pads.find((pad) => pad.planar && angleBetween(pad, p.plane!) < 1e-6);
        expect(site, `${model} plane is a planar pad centre`).toBeDefined();
      }
    }
  });

  it("keeps markers at least 8 m apart", () => {
    const ms = layout.markers;
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        expect(sensorCenter(ms[i]).distanceTo(sensorCenter(ms[j]))).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("respects the per-biome budgets", () => {
    const c = budgetCounts(layout);
    expect(c.placements).toBeLessThanOrEqual(220);
    expect(c.unique).toBeLessThanOrEqual(40);
    expect(c.characters).toBeLessThanOrEqual(8);
    expect(c.dynamic).toBeLessThanOrEqual(12);
  });
});
