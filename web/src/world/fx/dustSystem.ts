// Wheel smoke / dust particle system: pool + instanced billboard buffers + emitters (no React).
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import type { Quality } from "@/state/useAppStore";
import { groundColorAt } from "@/world/planet/terrainColor";
import type { VehicleState } from "@/world/vehicle/vehicleState";
import { ParticlePool, type ParticleSpawn } from "./particles";

/** Wheel smoke / dust tuning */
export const DUST = {
  maxParticles: 400,
  /** Pool limit in "low" quality */
  lowParticles: 140,
  /** Emission scale in "low" quality */
  lowRate: 0.5,
  /** Smoke particles per second per wheel at full slip */
  smokeRate: 55,
  /** Dust particles per second per wheel at top speed, rear wheels only */
  dustRate: 16,
  /** Dust starts above this speed (m/s); full rate at `dustFullSpeed` */
  dustMinSpeed: 5,
  dustFullSpeed: 25,
  /** Landing burst: particles per m/s of vertical impact, capped */
  burstPerSpeed: 2.2,
  burstMax: 36,
  /** How far tyre smoke is pushed toward this grey (0 = pure ground colour) */
  smokeWhiteness: 0.7,
  /** Dirt dust is the ground colour pulled toward a dusty tan, so grass doesn't throw green clouds */
  dustTintMix: 0.45,
  rise: 1.6,
  drag: 1.8,
} as const;

const SMOKE_GREY = new Color("#e6e3de");
const DUST_TAN = new Color("#c9b48e");

const _p: ParticleSpawn = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0, life: 1, size0: 0.5, size1: 2, alpha: 0.5 };

/** Emit one particle at a wheel contact with a little scatter and an upward puff. No allocation. */
function emitAt(
  pool: ParticlePool,
  color: Color,
  at: Vector3,
  up: Vector3,
  carVel: Vector3,
  inherit: number,
  life: number,
  size0: number,
  size1: number,
  alpha: number,
  spread = 1.2,
): void {
  const rx = (Math.random() - 0.5) * 2;
  const ry = (Math.random() - 0.5) * 2;
  const rz = (Math.random() - 0.5) * 2;
  _p.x = at.x + rx * 0.25 + up.x * 0.2;
  _p.y = at.y + ry * 0.25 + up.y * 0.2;
  _p.z = at.z + rz * 0.25 + up.z * 0.2;
  _p.vx = carVel.x * inherit + rx * spread + up.x * 0.8;
  _p.vy = carVel.y * inherit + ry * spread + up.y * 0.8;
  _p.vz = carVel.z * inherit + rz * spread + up.z * 0.8;
  _p.r = color.r;
  _p.g = color.g;
  _p.b = color.b;
  _p.life = life;
  _p.size0 = size0;
  _p.size1 = size1;
  _p.alpha = alpha;
  pool.emit(_p);
}

// Billboard quads: the centre comes from the instance, the corner is offset in view space so the quad
// always faces the camera. The round "puff" is pixel-quantised (8×8) for the PSX look, no texture.
const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aColor;
  attribute vec2 aSizeAlpha;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vColor = aColor;
    vAlpha = aSizeAlpha.y;
    vec4 mvPosition = modelViewMatrix * vec4(aOffset, 1.0);
    mvPosition.xy += position.xy * aSizeAlpha.x;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    // Snap to an 8x8 grid, then a soft round falloff: chunky PS1-era puffs
    vec2 cell = (floor(vUv * 8.0) + 0.5) / 8.0 - 0.5;
    float d = length(cell) * 2.0;
    float mask = 1.0 - smoothstep(0.55, 1.0, d);
    float a = vAlpha * mask;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const UPDATE = { rise: DUST.rise, drag: DUST.drag };

/**
 * Owns the particle pool, the GPU buffers and the emitters. Plain class (not hook state) so the
 * per-frame mutation is explicit and allocation-free; <WheelDust> just calls `frame()`.
 */
export class DustSystem {
  readonly pool = new ParticlePool(DUST.maxParticles);
  readonly geometry = new InstancedBufferGeometry();
  readonly material: ShaderMaterial;
  private readonly attrs: InstancedBufferAttribute[];
  private readonly accum = new Float32Array(8);
  private readonly ground = new Color();
  private readonly col = new Color();
  private readonly dir = new Vector3();
  private landingSeen = -1;
  private teleportSeen = -1;

  constructor() {
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute("position", quad.getAttribute("position"));
    this.geometry.setAttribute("uv", quad.getAttribute("uv"));
    const offset = new InstancedBufferAttribute(this.pool.offset, 3).setUsage(DynamicDrawUsage);
    const color = new InstancedBufferAttribute(this.pool.color, 3).setUsage(DynamicDrawUsage);
    const sizeAlpha = new InstancedBufferAttribute(this.pool.sizeAlpha, 2).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("aOffset", offset);
    this.geometry.setAttribute("aColor", color);
    this.geometry.setAttribute("aSizeAlpha", sizeAlpha);
    this.attrs = [offset, color, sizeAlpha];
    this.geometry.instanceCount = this.pool.capacity;
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: UniformsUtils.merge([UniformsLib.fog]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
  }

  setQuality(quality: Quality): void {
    this.pool.setLimit(quality === "low" ? DUST.lowParticles : DUST.maxParticles);
    this.geometry.instanceCount = this.pool.limit;
  }

  /** Emit from the car's wheels (unless `paused`), then advance and upload the particles. */
  frame(dt: number, v: VehicleState, quality: Quality, paused: boolean): void {
    const rate = quality === "low" ? DUST.lowRate : 1;
    const pool = this.pool;

    if (this.teleportSeen !== v.teleportCount) {
      // Don't burst on the spawn drop after a teleport
      this.teleportSeen = v.teleportCount;
      this.landingSeen = v.landingCount;
    }

    if (!paused && v.bodyHandle >= 0) {
      const up = v.up;
      const dustK = Math.min(1, Math.max(0, (v.speed - DUST.dustMinSpeed) / (DUST.dustFullSpeed - DUST.dustMinSpeed)));

      for (let i = 0; i < v.wheels.length; i++) {
        const w = v.wheels[i];
        if (!w.inContact) {
          this.accum[i] = 0;
          this.accum[i + 4] = 0;
          continue;
        }
        this.accum[i] += w.slip * DUST.smokeRate * rate * dt;
        if (i >= 2) this.accum[i + 4] += dustK * DUST.dustRate * rate * dt;
        if (this.accum[i] < 1 && this.accum[i + 4] < 1) continue;
        // Only sample the terrain colour when this wheel actually emits
        groundColorAt(this.dir.copy(w.contact).normalize(), this.ground);

        // Tyre smoke from slip (drift, handbrake, burnout)
        if (this.accum[i] >= 1) this.col.copy(this.ground).lerp(SMOKE_GREY, DUST.smokeWhiteness);
        while (this.accum[i] >= 1) {
          this.accum[i] -= 1;
          emitAt(pool, this.col, w.contact, up, v.velocity, 0.25, 0.9 + Math.random() * 0.5, 0.6, 2.6, 0.55);
        }

        // Light dust behind the rear wheels at speed
        if (this.accum[i + 4] >= 1) this.col.copy(this.ground).lerp(DUST_TAN, DUST.dustTintMix);
        while (this.accum[i + 4] >= 1) {
          this.accum[i + 4] -= 1;
          emitAt(pool, this.col, w.contact, up, v.velocity, 0.15, 0.7 + Math.random() * 0.4, 0.5, 1.8, 0.35);
        }
      }

      // Landing burst, spread over the wheels
      if (this.landingSeen !== v.landingCount) {
        this.landingSeen = v.landingCount;
        const n = Math.min(DUST.burstMax, Math.round(v.landingSpeed * DUST.burstPerSpeed * rate));
        for (let k = 0; k < n; k++) {
          const w = v.wheels[k % 4];
          if (k < 4) {
            groundColorAt(this.dir.copy(w.contact).normalize(), this.ground);
            this.col.copy(this.ground).lerp(DUST_TAN, DUST.dustTintMix);
          }
          emitAt(pool, this.col, w.contact, up, v.velocity, 0.1, 0.8 + Math.random() * 0.6, 0.7, 3, 0.5, 3.5);
        }
      }
    }

    pool.update(dt, UPDATE);
    for (const a of this.attrs) a.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
