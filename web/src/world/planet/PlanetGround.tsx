"use client";

// The planet surface: one faceted vertex-coloured mesh + one fixed Rapier trimesh with the exact
// same triangles (so `terrainHeight`, the visuals and the physics all agree).
// The material is a plain MeshLambertMaterial (cheap, Gouraud-like = PS1) so the PSX pass can
// patch it like every other material. Flat shading comes from the per-face normals baked into the
// non-indexed geometry, not from `flatShading`.

import { RigidBody, TrimeshCollider, useRapier } from "@react-three/rapier";
import { useEffect, useMemo } from "react";
import { buildPlanetColliderData, buildPlanetGeometry } from "./terrainMesh";

export function PlanetGround() {
  const { rapier } = useRapier();
  // Built once per mount (~80 ms on a laptop); the indexed data is cached at module level and shared.
  const geometry = useMemo(() => buildPlanetGeometry(), []);
  const collider = useMemo(() => buildPlanetColliderData(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // FIX_INTERNAL_EDGES stops bodies sliding across the mesh from catching on triangle seams.
  // TrimeshArgs is typed as 2 args, but r3f-rapier spreads args into ColliderDesc.trimesh(v, i, flags).
  const args = useMemo(
    () =>
      [collider.vertices, collider.indices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES] as unknown as [
        Float32Array,
        Uint32Array,
      ],
    [collider, rapier],
  );

  return (
    <>
      <mesh geometry={geometry} name="planet-ground" receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      <RigidBody type="fixed" colliders={false} name="planet-ground">
        <TrimeshCollider args={args} friction={0.9} />
      </RigidBody>
    </>
  );
}
