"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Color, Fog, ShaderMaterial, Vector3, type Camera, type Mesh, type Scene } from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { biomeAt } from "@/world/planet/terrain";
import { FOG_RANGE, fogLift } from "./fog";
import type { BiomeId } from "@/world/planet/types";
import { vehicleState } from "@/world/vehicle/vehicleState";
import {
  NIGHT,
  NIGHT_MIX,
  SUN_DIR,
  advanceSky,
  nightFactor,
  setSkyBiome,
  skyBasis,
  skyState,
  snapSkyBiome,
  starsForTop,
  type SkyBasis,
} from "./skyState";

/** Dome radius; any size works because the shader pins it to the far plane and depth testing is off. */
const RADIUS = 100;
/** Frames between automatic biome lookups (biomeAt at the camera). */
const BIOME_POLL_FRAMES = 12;

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position; // dome is centred on the camera and never rotated
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w * 0.99999; // always at the far plane, never clipped
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uFog;
uniform vec3 uUp;
uniform vec3 uEast;
uniform vec3 uNorth;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uNight;
uniform float uStars;
uniform float uCloudCover;
varying vec3 vDir;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 - 3.7) * 0.15;
}
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int xy = x ^ y;
  int v = ((xy & 1) << 3) | ((y & 1) << 2) | (((xy >> 1) & 1) << 1) | ((y >> 1) & 1);
  return (float(v) + 0.5) / 16.0;
}

void main() {
  vec3 d = normalize(vDir);
  // Elevation relative to the LOCAL up at the camera (planet: up changes as you drive)
  float h = dot(d, uUp);

  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
  // Melt into the fog colour at and below the horizon so distant fogged terrain meets the sky seamlessly
  col = mix(col, uFog, smoothstep(0.1, -0.06, h));

  // Sun glow (behind clouds)
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 sunCol = vec3(1.0, 0.9, 0.72);
  float day = 1.0 - uNight;
  col += sunCol * (pow(sd, 48.0) * 0.45 + pow(sd, 6.0) * 0.12) * day;

  // Stars: one hashed cell per direction bucket, only above the horizon
  float starVis = uStars * smoothstep(-0.02, 0.2, h);
  if (starVis > 0.001) {
    float r = hash13(floor(d * 170.0));
    float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + r * 80.0);
    col += step(0.9965, r) * starVis * twinkle * vec3(0.95, 0.95, 1.0);
  }

  // Chunky clouds: a flat layer projected onto the local sky, quantised to 3 shades and Bayer-dithered
  if (h > 0.0) {
    vec2 p = vec2(dot(d, uEast), dot(d, uNorth)) / (h + 0.18) * 1.4;
    p += uTime * vec2(0.010, 0.004);
    float n = fbm(p * 1.6);
    float c = smoothstep(uCloudCover, uCloudCover + 0.22, n);
    c = floor(c * 3.0 + bayer4(gl_FragCoord.xy)) / 3.0;
    vec3 cloudCol = mix(vec3(1.0), uHorizon, 0.3) * mix(1.0, 0.4, uNight);
    col = mix(col, cloudCol, c * 0.85 * smoothstep(0.0, 0.18, h));
  }

  // Sun disc (in front of clouds), chunky: no anti-aliasing
  col = mix(col, sunCol * 1.25, step(0.99935, sd) * day);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export interface SkyProps {
  /** Controlled biome tint. Omit to auto-track biomeAt(camera) every few frames. */
  biome?: BiomeId;
  /** Manage scene.fog (linear, biome-tinted, night-aware). Default true. */
  fog?: boolean;
  /** Fog range override (metres, at ground level). Default: FOG_RANGE (./fog). */
  fogNear?: number;
  fogFar?: number;
  /** Cloud threshold: lower = more cloud (0.4–0.75 sensible). */
  cloudCover?: number;
}

const _top = new Color();
const _horizon = new Color();
const _fogColor = new Color();
const _night = { top: new Color(NIGHT.top), horizon: new Color(NIGHT.horizon), fog: new Color(NIGHT.fog) };

/** The imperative sky: material, fog and per-frame update. React only holds the instance. */
export class SkyRig {
  readonly material: ShaderMaterial;
  readonly fog = new Fog(new Color(skyState.current.fog), FOG_RANGE.near, FOG_RANGE.far);
  private readonly basis: SkyBasis = { up: new Vector3(), east: new Vector3(), north: new Vector3() };
  private frames = 0;
  private teleportSeen = -1;
  private prevFog: Scene["fog"] = null;
  /** Fog range at ground level; `update` pushes it out with the camera's altitude (see fogLift) */
  private fogNear: number = FOG_RANGE.near;
  private fogFar: number = FOG_RANGE.far;
  /** Freeze cloud drift and twinkle (prefers-reduced-motion) */
  private still = false;

  constructor() {
    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uFog: { value: new Color() },
        uUp: { value: new Vector3(0, 1, 0) },
        uEast: { value: new Vector3(1, 0, 0) },
        uNorth: { value: new Vector3(0, 0, -1) },
        uSunDir: { value: SUN_DIR.clone() },
        uTime: { value: 0 },
        uNight: { value: 0 },
        uStars: { value: 0 },
        uCloudCover: { value: 0.56 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
  }

  setStill(still: boolean): void {
    this.still = still;
  }

  claimFog(scene: Scene): void {
    if (scene.fog === this.fog) return;
    this.prevFog = scene.fog;
    scene.fog = this.fog;
  }

  releaseFog(scene: Scene): void {
    if (scene.fog === this.fog) scene.fog = this.prevFog;
    this.prevFog = null;
  }

  setFogRange(near: number, far: number): void {
    this.fogNear = near;
    this.fogFar = far;
    this.fog.near = near;
    this.fog.far = far;
  }

  update(mesh: Mesh, camera: Camera, time: number, opts: { biome?: BiomeId; cloudCover: number }): void {
    const basis = this.basis;
    mesh.position.copy(camera.position);
    skyBasis(camera.position, basis);

    // Teleports snap the tint; otherwise poll the biome under the camera and blend
    const teleports = vehicleState.teleportCount;
    const teleported = teleports !== this.teleportSeen;
    this.teleportSeen = teleports;
    if (!opts.biome && (teleported || this.frames++ % BIOME_POLL_FRAMES === 0)) {
      const id = biomeAt(basis.up);
      if (teleported) snapSkyBiome(id);
      else setSkyBiome(id);
    }
    const c = advanceSky();

    const night = nightFactor(SUN_DIR, basis.up);
    const n = night * NIGHT_MIX;
    _top.copy(c.top).lerp(_night.top, n);
    _horizon.copy(c.horizon).lerp(_night.horizon, n);
    _fogColor.copy(c.fog).lerp(_night.fog, n);
    const stars = Math.max(night, starsForTop(c.top));
    skyState.night = night;
    skyState.stars = stars;

    const u = this.material.uniforms;
    u.uTop.value.copy(_top);
    u.uHorizon.value.copy(_horizon);
    u.uFog.value.copy(_fogColor);
    u.uUp.value.copy(basis.up);
    u.uEast.value.copy(basis.east);
    u.uNorth.value.copy(basis.north);
    u.uNight.value = night;
    u.uStars.value = stars;
    u.uCloudCover.value = opts.cloudCover;
    if (!this.still) u.uTime.value = time;
    this.fog.color.copy(_fogColor);
    const lift = fogLift(camera.position.length());
    this.fog.near = this.fogNear + lift;
    this.fog.far = this.fogFar + lift;
  }

  dispose(): void {
    this.material.dispose();
  }
}

/**
 * Procedural sky dome: gradient (top → horizon, relative to the local up), sun disc and glow,
 * dithered scrolling clouds, and stars on the night side or under dark skies. It follows the camera,
 * ignores fog, draws behind everything, and owns `scene.fog` (tinted with the sky).
 */
export function Sky({ biome, fog = true, fogNear, fogFar, cloudCover = 0.56 }: SkyProps) {
  const mesh = useRef<Mesh>(null);
  const scene = useThree((s) => s.scene);
  const reduced = usePrefersReducedMotion();
  const rig = useMemo(() => new SkyRig(), []);
  useEffect(() => () => rig.dispose(), [rig]);

  useEffect(() => {
    rig.setStill(reduced);
  }, [rig, reduced]);

  // Controlled biome
  useEffect(() => {
    if (biome) setSkyBiome(biome);
  }, [biome]);

  // Own scene.fog while mounted
  useEffect(() => {
    if (!fog) return;
    rig.claimFog(scene);
    return () => rig.releaseFog(scene);
  }, [fog, rig, scene]);

  useEffect(() => {
    rig.setFogRange(fogNear ?? FOG_RANGE.near, fogFar ?? FOG_RANGE.far);
  }, [rig, fogNear, fogFar]);

  useFrame(({ camera, clock }) => {
    if (!mesh.current) return;
    rig.update(mesh.current, camera, clock.elapsedTime, { biome, cloudCover });
    // Someone else (e.g. a leftover <fog attach>) replaced it: take it back
    if (fog) rig.claimFog(scene);
  });

  return (
    <mesh ref={mesh} material={rig.material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[RADIUS, 32, 16]} />
    </mesh>
  );
}
