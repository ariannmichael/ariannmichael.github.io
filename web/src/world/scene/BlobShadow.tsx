"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Quaternion, ShaderMaterial, Vector3, type Mesh } from "three";
import { PLANET_RADIUS } from "@/world/planet/config";
import { terrainHeight } from "@/world/planet/terrain";
import { vehicleState } from "@/world/vehicle/vehicleState";

/** Blob diameter (m) at ground contact; it widens and fades as the car gets air. */
const SIZE = 3.4;
/** Height above the ground (m, car centre) at which the blob has fully faded. */
const FADE_HEIGHT = 7;
/** Sample spacing (m) for the terrain normal under the car. */
const NORMAL_STEP = 1.2;
const LIFT = 0.06;

const Z = new Vector3(0, 0, 1);
const _up = new Vector3();
const _t1 = new Vector3();
const _t2 = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _n = new Vector3();
const _q = new Quaternion();

function groundPoint(dir: Vector3, out: Vector3): Vector3 {
  return out.copy(dir).multiplyScalar(PLANET_RADIUS + terrainHeight(dir));
}

function createBlobMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uOpacity: { value: 0.45 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        // Stepped falloff: chunky rings instead of a smooth gradient
        float a = floor((1.0 - smoothstep(0.35, 1.0, r)) * 4.0) / 4.0;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOpacity);
      }
    `,
  });
}

/** Places the blob on the terrain under the car (normal from 3 terrainHeight samples) and fades it with airtime. */
function updateBlob(mesh: Mesh, material: ShaderMaterial): void {
  const p = vehicleState.position;
  if (p.lengthSq() < 1) {
    mesh.visible = false;
    return;
  }
  _up.copy(p).normalize();
  _t1.set(0, 1, 0).cross(_up);
  if (_t1.lengthSq() < 1e-6) _t1.set(1, 0, 0);
  _t1.normalize();
  _t2.crossVectors(_up, _t1);
  groundPoint(_up, _a);
  const d = NORMAL_STEP / PLANET_RADIUS;
  groundPoint(_n.copy(_up).addScaledVector(_t1, d).normalize(), _b);
  groundPoint(_n.copy(_up).addScaledVector(_t2, d).normalize(), _c);
  _b.sub(_a);
  _c.sub(_a);
  _n.crossVectors(_b, _c).normalize();
  if (_n.dot(_up) < 0) _n.negate();

  const height = p.length() - _a.length();
  const k = Math.min(1, Math.max(0, height / FADE_HEIGHT));
  material.uniforms.uOpacity.value = 0.45 * (1 - k);
  mesh.visible = k < 1;
  mesh.position.copy(_a).addScaledVector(_n, LIFT);
  mesh.quaternion.copy(_q.setFromUnitVectors(Z, _n));
  mesh.scale.setScalar(SIZE * (1 + k * 0.5));
}

/**
 * PS1-style blob shadow: one soft dark disc on the terrain under the car, aligned to the terrain normal.
 * Costs one draw call and three terrainHeight() samples per frame, versus a 2048² shadow map pass.
 */
export function BlobShadow() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(() => createBlobMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (mesh.current) updateBlob(mesh.current, material);
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={1} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
