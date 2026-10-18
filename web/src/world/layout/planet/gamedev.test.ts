// Terrain first: it pulls in every layout before frame.ts is re-entered (avoids an import cycle TDZ).
import { biomeAt } from "@/world/planet/terrain";
import { describe, expect, it } from "vitest";
import { getContent } from "@/content";
import { hasModel } from "@/world/models";
import { angleBetween, latLonToDir } from "@/world/planet/frame";
import { BIOMES } from "@/world/planet/biomes";
import { markerSensorBox } from "@/world/lib/planetPlacement";
import { SENSOR, budgetCounts, fixedBoxes, groundPoint, insideBox, sensorCenter } from "./c/check";
import { grid } from "./author";
import { gamedevLayout as layout } from "./gamedev";

const biome = BIOMES.find((b) => b.id === "gamedev")!;
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

  it("leaves a clear lane from each drive-in marker through its doorway", () => {
    const g = grid(biome.center);
    const boxes = fixedBoxes(layout);
    // [from north, to north, lane centre east]: both interiors are drive-through, so the lanes run
    // from in front of the entrance out through the far doorway (arcade south → north, dungeon north → south)
    const lanes: [number, number, number][] = [
      [14, 46, 21],
      [-18, -54, 20],
    ];
    const hits: string[] = [];
    for (const [n0, n1, e] of lanes) {
      for (let n = n0; Math.abs(n - n0) <= Math.abs(n1 - n0); n += Math.sign(n1 - n0) * 0.5) {
        for (const de of [-1.4, 0, 1.4]) {
          for (const h of [0.4, 1.2, 2.2]) {
            const pt = groundPoint(g.at(n, e + de), h);
            for (const b of boxes) if (insideBox(pt, b.box)) hits.push(`${n},${e + de} in ${b.model}`);
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
    const lanes: [number, number, number][] = [
      [2, 46, 21],
      [-8, -54, 20],
    ];
    const hits: string[] = [];
    for (const [n0, n1, e] of lanes) {
      for (let n = n0; Math.abs(n - n0) <= Math.abs(n1 - n0); n += Math.sign(n1 - n0) * 0.5) {
        for (const de of [-1.4, 0, 1.4]) {
          const pt = groundPoint(g.at(n, e + de), 0.5);
          for (const s of sensors) if (insideBox(pt, s.box, 1.5)) hits.push(`${n},${e + de} in ${s.id}`);
        }
      }
    }
    expect(hits).toEqual([]);
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
