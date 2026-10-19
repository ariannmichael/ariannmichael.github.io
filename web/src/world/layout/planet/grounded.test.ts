// @vitest-environment node
// Every placement stands on what is under it: no visible air gap below its base (on slopes, pad blend
// rings or the curved edge of a planar site), and nothing short is buried.
//
// Method. A model's contact points are its own mesh vertices within BAND of its lowest vertex (read
// from the optimized .glb, kit scale applied, deduped on a 20 cm grid): a building's floor outline, a
// tree's trunk foot, a water tower's four legs. Bounding-box corners would be wrong for most models (a
// tree's canopy corners hang in the air by design). Each point is posed like the instance
// (placementPose: radial or tangent-plane, `y` offset, yaw, scale) and compared with the rendered
// ground under it (meshHeightXYZ, the exact terrain mesh, flat triangles and all).
// - A point more than FLOAT_TOL above the ground floats, unless it rests on top of another placement
//   (inside its bounds, within REST_TOL of their top face): a wall on a floor slab, a stacked crate.
// - A piece lifted clear of the ground everywhere (a roof slab, a rocket stage, a rooftop sign) is held
//   when part of its base rests on or is against another placement; the rest overhangs by design.
// - A piece whose highest contact point is more than SINK_TOL (or half its height) underground is sunk.
//
// Debug: AUDIT_OUT=/some/prefix npx vitest run src/world/layout/planet/grounded.test.ts writes one
// tab-separated report per biome (worst gap, highest/lowest contact point, where).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { placementPose } from "@/world/lib/planetPlacement";
import { getKit, getModel } from "@/world/models";
import { BIOMES } from "@/world/planet/biomes";
import { PLANET_RADIUS } from "@/world/planet/config";
import { meshHeightXYZ } from "@/world/planet/terrain";
import type { BiomeId, BiomeLayout, PlanetPlacement } from "@/world/planet/types";
import { site } from "./b/site";
import { PLANET_LAYOUTS } from "./index";

/** A contact point may sit this far above the ground before it reads as floating (m) */
const FLOAT_TOL = 0.15;
/** A base buried deeper than this (or than half the model's height, at least 0.1 m) looks sunk (m) */
const SINK_TOL = 1;
/** Contact points: vertices within this of the model's lowest vertex (m, world scale) */
const BAND = 0.08;
/** A point rests on another placement when inside its bounds and this close to their top (m) */
const REST_TOL = 0.15;
/** A lifted piece is held by another one when its base is within this of that piece's bounds (m) */
const TOUCH_TOL = 0.1;

/**
 * Allowlist: pieces meant to be off the ground, or not this test's to level. Matched against the model
 * ref (and the biome, when given). `tol` replaces FLOAT_TOL for the match; without it the piece's gap
 * is not checked at all (it is still checked for being sunk).
 */
const ALLOW: { match: RegExp; biome?: BiomeId; tol?: number; why: string }[] = [
  {
    match: /\/detail-awning/,
    why: "an awning hangs on a shop front by its back edge, so its lowest point (the front lip) is in the air",
  },
  {
    match: /^(city-roads\/road-|racing-kit\/road)/,
    tol: 0.22,
    why:
      "a flat 8 m tile lifts its corners d²/2R ≈ 0.19 m off the curved ground; index.ts sinks every tile " +
      "6 cm (the asphalt stays above the ground at the middle), so corners float ≤ ~0.16 m on level ground " +
      "and up to ~0.2 m where the tile spans a slope. Bounded, not exempt",
  },
  {
    // Root cause in terrain.ts (reported): a planar pad's plane is exact out to its radius, but the walls sit past it
    // (the shell reaches 14.9 m, the pad radius is 13.5), and the mesh's ~3.5 m triangles straddling the room pad's steep ring (the natural crater
    // floor is ~4 m lower) cut under the plane. The room pad already reaches 15.5 m for the 14.9 m
    // shell; the corridor pads it shares the rim with keep it from going wider.
    match: /^modular-space-kit\//,
    biome: "opensource",
    tol: 0.56,
    why: "the lab's corners sit past its planar pad's radius, in the blend ring (worst 0.55 m); bounded, not exempt",
  },
];

const PUBLIC = path.resolve(__dirname, "../../../../public");
const R = PLANET_RADIUS;

/**
 * Per model (metres, kit scale applied): its vertices within 1 m of the lowest one, deduped on a 20 cm
 * grid, with `rise` = height above that lowest vertex. The contact band is BAND in world metres, so
 * which of them count depends on the placement's scale.
 */
interface Footprint {
  base: { x: number; z: number; rise: number }[];
  minY: number;
  height: number;
}
const footprints = new Map<string, Footprint>();

async function loadFootprint(io: NodeIO, ref: string) {
  const info = getModel(ref);
  const s = getKit(info.kit).scale;
  const doc = await io.readBinary(new Uint8Array(readFileSync(path.join(PUBLIC, info.url))));
  const pts: [number, number, number][] = [];
  const e: number[] = [];
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      const m = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute("POSITION");
        if (!pos) continue;
        for (let i = 0; i < pos.getCount(); i++) {
          pos.getElement(i, e);
          const [x, y, z] = e;
          pts.push([
            (m[0] * x + m[4] * y + m[8] * z + m[12]) * s,
            (m[1] * x + m[5] * y + m[9] * z + m[13]) * s,
            (m[2] * x + m[6] * y + m[10] * z + m[14]) * s,
          ]);
        }
      }
    });
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const seen = new Set<string>();
  const base: Footprint["base"] = [];
  for (const [x, y, z] of pts) {
    if (y > minY + 1) continue;
    const k = `${Math.round(x / 0.2)},${Math.round((y - minY) / 0.02)},${Math.round(z / 0.2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    base.push({ x, z, rise: y - minY });
  }
  footprints.set(ref, { base, minY, height: maxY - minY });
}

const _q = new Quaternion();
const _l = new Vector3();

/**
 * Where world point `w` is against placement `o`'s bounds box: "top" when it rests on the box (over
 * it, within REST_TOL of its top face), "touch" when it is in or against the box (within TOUCH_TOL),
 * else null.
 */
function contact(w: Vector3, o: PlanetPlacement): "top" | "touch" | null {
  const pose = placementPose(o);
  const sc = o.scale ?? 1;
  const { min, max } = getModel(o.model);
  _l.copy(w).sub(pose.position).applyQuaternion(_q.copy(pose.quaternion).invert()).divideScalar(sc);
  const m = TOUCH_TOL / sc;
  if (_l.x < min[0] - m || _l.x > max[0] + m || _l.z < min[2] - m || _l.z > max[2] + m) return null;
  if (Math.abs(_l.y - max[1]) <= REST_TOL / sc) return "top";
  return _l.y >= min[1] - m && _l.y <= max[1] + m ? "touch" : null;
}

interface Audit {
  p: PlanetPlacement;
  index: number;
  /** Worst gap (m) above the ground of a contact point that rests on nothing; -Infinity if none */
  float: number;
  /** Highest / lowest contact point relative to the ground (m) */
  top: number;
  low: number;
  height: number;
  /** The worst floating point, in the town frame (north, east) */
  ne: [number, number];
}

function audit(layout: BiomeLayout, index: number): Audit {
  const p = layout.placements[index];
  const pose = placementPose(p);
  const sc = p.scale ?? 1;
  const fp = footprints.get(p.model)!;
  const w = new Vector3();
  let top = -Infinity;
  let low = Infinity;
  let attached = false;
  let float = -Infinity;
  const worst = new Vector3();
  for (const { x, z, rise } of fp.base) {
    if (rise * sc > BAND) continue;
    w.set(x * sc, (fp.minY + rise) * sc, z * sc).applyQuaternion(pose.quaternion).add(pose.position);
    const l = w.length();
    const g = l - R - meshHeightXYZ(w.x / l, w.y / l, w.z / l);
    top = Math.max(top, g);
    low = Math.min(low, g);
    if (g <= FLOAT_TOL) continue;
    let onTop = false;
    for (const o of layout.placements) {
      if (o === p) continue;
      const c = contact(w, o);
      if (c) attached = true;
      if (c === "top") {
        onTop = true;
        break;
      }
    }
    if (!onTop && g > float) {
      float = g;
      worst.copy(w);
    }
  }
  // Lifted clear of the ground everywhere and held by another piece: stacked, its overhang is fine
  if (attached && low > FLOAT_TOL) float = -Infinity;
  let ne: [number, number] = [0, 0];
  if (float > -Infinity) {
    const wl = worst.length();
    const center = BIOMES.find((b) => b.id === layout.biome)!.center;
    ne = site(center).toNE({ lat: (Math.asin(worst.y / wl) * 180) / Math.PI, lon: (Math.atan2(worst.x, worst.z) * 180) / Math.PI });
  }
  return { p, index, float, top, low, height: fp.height * sc, ne };
}

const allowFor = (biome: BiomeId, ref: string) => ALLOW.find((a) => a.match.test(ref) && (!a.biome || a.biome === biome));
const sinkLimit = (a: Audit) => -Math.max(0.1, Math.min(SINK_TOL, a.height / 2));
const where = (layout: BiomeLayout, a: Audit) => {
  const [n, e] = site(BIOMES.find((b) => b.id === layout.biome)!.center).toNE(a.p);
  return `#${a.index} ${a.p.model} at (${n.toFixed(1)}, ${e.toFixed(1)})`;
};

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const refs = new Set(PLANET_LAYOUTS.flatMap((l) => l.placements.map((p) => p.model)));
  for (const ref of refs) await loadFootprint(io, ref);
}, 120_000);

describe("placements stand on the ground", () => {
  it("reads a contact footprint for every model", () => {
    for (const [ref, fp] of footprints) expect(fp.base.length, ref).toBeGreaterThan(0);
  });

  for (const layout of PLANET_LAYOUTS) {
    describe(layout.biome, () => {
      const rows = () => layout.placements.map((_, i) => audit(layout, i));

      it(`no placement floats more than ${FLOAT_TOL} m above the ground under it`, () => {
        const all = rows();
        if (process.env.AUDIT_OUT) {
          const f = (n: number) => n.toFixed(2);
          const lines = all
            .filter((a) => a.float > FLOAT_TOL || a.top < sinkLimit(a))
            .map((a) => [where(layout, a), f(a.p.y ?? 0), a.p.plane ? "plane" : "radial", f(a.float), f(a.top), f(a.low), f(a.height), `ne ${f(a.ne[0])},${f(a.ne[1])}`, allowFor(layout.biome, a.p.model) ? "ALLOW" : ""].join("\t"));
          writeFileSync(`${process.env.AUDIT_OUT}.${layout.biome}.tsv`, lines.join("\n"));
        }
        const floating = all
          .filter((a) => {
            // dynamic bodies drop onto the ground under gravity when the world loads
            if (a.p.body === "dynamic") return false;
            const allow = allowFor(layout.biome, a.p.model);
            if (allow && allow.tol === undefined) return false;
            return a.float > (allow?.tol ?? FLOAT_TOL);
          })
          .map((a) => `${where(layout, a)}: ${a.float.toFixed(2)} m up at (${a.ne[0].toFixed(1)}, ${a.ne[1].toFixed(1)})`);
        expect(floating).toEqual([]);
      });

      it(`nothing is buried (base more than ${SINK_TOL} m or half its height underground)`, () => {
        const sunk = rows()
          .filter((a) => a.top < sinkLimit(a))
          .map((a) => `${where(layout, a)}: highest contact ${a.top.toFixed(2)} m`);
        expect(sunk).toEqual([]);
      });
    });
  }
});
