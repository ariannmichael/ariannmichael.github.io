// End-to-end: real Rapier (WASM) world, the planet trimesh, and planet gravity.
import { describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import { PLANET_RADIUS } from "./config";
import { latLonToDir } from "./frame";
import { applyPlanetGravityStep } from "./gravity";
import { terrainHeight } from "./terrain";
import { buildPlanetColliderData } from "./terrainMesh";

describe("planet physics", () => {
  it("dynamic bodies fall toward the centre and come to rest on the terrain surface", async () => {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const { vertices, indices } = buildPlanetColliderData();
    const t0 = performance.now();
    world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES));
    console.info(`[terrain] Rapier trimesh collider created in ${(performance.now() - t0).toFixed(0)} ms`);

    const radius = 0.5;
    // Open ground between towns, around the planet (pads and roads aside: plain terrain faces)
    const spots = [latLonToDir(0, 22), latLonToDir(0, 112), latLonToDir(0, -158), latLonToDir(0, -68)];
    const bodies = spots.map((dir) => {
      const p = dir.clone().multiplyScalar(PLANET_RADIUS + terrainHeight(dir) + 4);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setLinearDamping(2).setAngularDamping(2));
      world.createCollider(RAPIER.ColliderDesc.ball(radius).setFriction(1), body);
      return body;
    });
    for (let i = 0; i < 240; i++) {
      applyPlanetGravityStep(world);
      world.step();
    }
    for (const body of bodies) {
      const t = body.translation();
      const p = new Vector3(t.x, t.y, t.z);
      const dir = p.clone().normalize();
      const clearance = p.length() - (PLANET_RADIUS + terrainHeight(dir));
      // A ball resting on a (possibly sloped) face: centre is ~radius above the surface.
      expect(clearance).toBeGreaterThan(radius * 0.8);
      expect(clearance).toBeLessThan(radius * 1.6);
    }
    world.free();
  }, 30000);
});
