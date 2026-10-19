// World juice particles: impact sparks and prop chips, landing dust rings, exhaust puffs, backfire
// flames, speed lines and the card-open confetti. All of them live in ONE FxPool and draw as ONE
// instanced mesh of camera-facing quads (round puffs, square chips or velocity-stretched streaks).
// Plain class, no React: <Juice> forwards events and calls `frame()`. No allocation after construction.
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
  type Camera,
} from "three";
import type { Quality } from "@/state/useAppStore";
import { PLANET_GRAVITY } from "@/world/planet/config";
import { groundColorAt } from "@/world/planet/terrainColor";
import { VEHICLE } from "@/world/vehicle/constants";
import type { VehicleState } from "@/world/vehicle/vehicleState";
import { FxPool, SHAPE, blankSpawn, type FxShape } from "./fxPool";
import {
  LANDING_RING,
  allowBurst,
  exhaustRate,
  impactBurst,
  landingRingCount,
  speedLineRate,
  type ImpactBurst,
} from "./juiceRules";

export const FX = {
  maxParticles: 420,
  lowParticles: 180,
  /** Emission scale in "low" quality */
  lowRate: 0.5,
  /**
   * Exhaust pipe in car space (m; +Z nose, +X left): under the rear bumper, right side. The SUV has no
   * modelled pipe, so this is where one would be.
   */
  exhaust: [-0.62, 0.5, -2.1] as const,
  /** Where impact bursts come from, in car space: the front bumper at headlight height */
  impactPoint: [0, 0.9, 2.2] as const,
  /** Speed lines: spawned this far ahead of the camera (m) in a ring of these radii around the view axis */
  lineAhead: [5, 16] as const,
  lineRadius: [2.2, 6.5] as const,
  /** Streak length (m) per m/s of car speed */
  lineLengthPerSpeed: 0.11,
} as const;

/** Hot spark colours (white-yellow core → orange) */
const SPARK_COLORS = [new Color("#fff3b0"), new Color("#ffc94a"), new Color("#ff8a2a")];
/** Prop chips / confetti: the bright Kenney palette the props use */
const CHIP_COLORS = [
  new Color("#e8483b"),
  new Color("#ffd23f"),
  new Color("#3bceac"),
  new Color("#4a7bd9"),
  new Color("#f2f2f2"),
  new Color("#ee6c4d"),
];
const FLAME_COLORS = [new Color("#fff2a8"), new Color("#ffb03a"), new Color("#ff5a1f")];
const EXHAUST_GREY = new Color("#8d8a86");
const DUST_TAN = new Color("#c9b48e");
const LINE_WHITE = new Color("#ffffff");
const ZERO = new Vector3();

const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aColor;
  attribute vec2 aSizeAlpha;
  attribute vec4 aStretch;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vShape;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vColor = aColor;
    vAlpha = aSizeAlpha.y;
    vShape = aStretch.w;
    float size = aSizeAlpha.x;
    vec4 mvPosition = modelViewMatrix * vec4(aOffset, 1.0);
    // Streak along the view-space projection of the world stretch vector, trailing behind the particle
    vec2 s = (modelViewMatrix * vec4(aStretch.xyz, 0.0)).xy;
    float len = length(s);
    if (len > 1e-4) {
      vec2 ax = s / len;
      vec2 perp = vec2(-ax.y, ax.x);
      mvPosition.xy += perp * position.x * size + ax * position.y * (size + len) - s * 0.5;
    } else {
      mvPosition.xy += position.xy * size;
    }
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vShape;
  #include <fog_pars_fragment>
  void main() {
    float mask;
    if (vShape < 0.5) {
      // Puff: 8x8 snapped soft disc (PS1-era smoke, matches the wheel dust)
      vec2 cell = (floor(vUv * 8.0) + 0.5) / 8.0 - 0.5;
      mask = 1.0 - smoothstep(0.55, 1.0, length(cell) * 2.0);
    } else if (vShape < 1.5) {
      // Chip: a solid square
      mask = 1.0;
    } else {
      // Streak: solid core, soft sides and tail
      mask = (1.0 - smoothstep(0.25, 0.5, abs(vUv.x - 0.5))) * smoothstep(0.0, 0.35, vUv.y);
    }
    float a = vAlpha * mask;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];

export class FxSystem {
  readonly pool = new FxPool(FX.maxParticles);
  readonly geometry = new InstancedBufferGeometry();
  readonly material: ShaderMaterial;
  private readonly attrs: InstancedBufferAttribute[];
  private readonly sp = blankSpawn();
  private readonly burst: ImpactBurst = { sparks: 0, chips: 0 };
  private readonly limiter = { last: -Infinity };
  private rate = 1;
  private exhaustAccum = 0;
  private lineAccum = 0;
  // Scratch
  private readonly at = new Vector3();
  private readonly dir = new Vector3();
  private readonly e1 = new Vector3();
  private readonly e2 = new Vector3();
  private readonly camFwd = new Vector3();
  private readonly ground = new Color();
  private readonly col = new Color();

  constructor() {
    const quad = new PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute("position", quad.getAttribute("position"));
    this.geometry.setAttribute("uv", quad.getAttribute("uv"));
    const p = this.pool;
    const offset = new InstancedBufferAttribute(p.offset, 3).setUsage(DynamicDrawUsage);
    const color = new InstancedBufferAttribute(p.color, 3).setUsage(DynamicDrawUsage);
    const sizeAlpha = new InstancedBufferAttribute(p.sizeAlpha, 2).setUsage(DynamicDrawUsage);
    const stretch = new InstancedBufferAttribute(p.stretch, 4).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("aOffset", offset);
    this.geometry.setAttribute("aColor", color);
    this.geometry.setAttribute("aSizeAlpha", sizeAlpha);
    this.geometry.setAttribute("aStretch", stretch);
    this.attrs = [offset, color, sizeAlpha, stretch];
    this.geometry.instanceCount = p.capacity;
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
    this.rate = quality === "low" ? FX.lowRate : 1;
    this.pool.setLimit(quality === "low" ? FX.lowParticles : FX.maxParticles);
    this.geometry.instanceCount = this.pool.limit;
  }

  // --- Emitters ---

  /** Point in car space → world (scratch `out`). */
  private carPoint(v: VehicleState, local: readonly [number, number, number], out: Vector3): Vector3 {
    return out.set(local[0], local[1], local[2]).applyQuaternion(v.quaternion).add(v.position);
  }

  /** Random direction in the hemisphere around `up`, biased upwards by `lift` (0 flat … 1 straight up). */
  private scatter(up: Vector3, lift: number, out: Vector3): Vector3 {
    out.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    out.addScaledVector(up, -out.dot(up)).normalize().multiplyScalar(1 - lift);
    return out.addScaledVector(up, lift + Math.random() * (1 - lift));
  }

  private spawn(
    at: Vector3,
    vel: Vector3,
    color: Color,
    life: number,
    size0: number,
    size1: number,
    alpha: number,
    accel: number,
    drag: number,
    shape: FxShape,
    stretchK = 0,
    fixed: Vector3 | null = null,
  ): void {
    const s = this.sp;
    s.x = at.x;
    s.y = at.y;
    s.z = at.z;
    s.vx = vel.x;
    s.vy = vel.y;
    s.vz = vel.z;
    s.r = color.r;
    s.g = color.g;
    s.b = color.b;
    s.life = life;
    s.size0 = size0;
    s.size1 = size1;
    s.alpha = alpha;
    s.accel = accel;
    s.drag = drag;
    s.stretchK = stretchK;
    s.sx = fixed ? fixed.x : 0;
    s.sy = fixed ? fixed.y : 0;
    s.sz = fixed ? fixed.z : 0;
    s.shape = shape;
    this.pool.emit(s);
  }

  /** Crash / bump burst: sparks for world hits, coloured chips for props. Rate-limited. */
  impact(v: VehicleState, strength: number, dynamic: boolean, now: number): void {
    const b = impactBurst(strength, dynamic, this.rate, this.burst);
    if (b.sparks + b.chips === 0 || !allowBurst(this.limiter, now)) return;
    // Hits are almost always at the nose; reversing into something, at the tail
    const back = v.forwardSpeed < -0.5 ? -1 : 1;
    this.at.set(FX.impactPoint[0], FX.impactPoint[1], FX.impactPoint[2] * back);
    this.at.applyQuaternion(v.quaternion).add(v.position);
    const up = v.up;
    const s = Math.min(1, strength);
    for (let k = 0; k < b.sparks; k++) {
      this.scatter(up, 0.35, this.dir).multiplyScalar(rand(4, 9) * (0.6 + 0.6 * s)).addScaledVector(v.velocity, 0.3);
      this.spawn(this.at, this.dir, pick(SPARK_COLORS), rand(0.25, 0.55), 0.07, 0.03, 1, -PLANET_GRAVITY, 1.2, SHAPE.streak, 0.045);
    }
    for (let k = 0; k < b.chips; k++) {
      this.scatter(up, 0.55, this.dir).multiplyScalar(rand(2.5, 6)).addScaledVector(v.velocity, 0.4);
      const size = rand(0.1, 0.2);
      this.spawn(this.at, this.dir, pick(CHIP_COLORS), rand(0.6, 1.1), size, size * 0.8, 1, -PLANET_GRAVITY, 0.8, SHAPE.chip);
    }
  }

  /** Landing: a ring of dust thrown outward along the ground (tangent plane) around the car. */
  landing(v: VehicleState, strength: number): void {
    const n = landingRingCount(strength, this.rate);
    if (n === 0) return;
    const up = v.up;
    groundColorAt(v.up, this.ground);
    this.col.copy(this.ground).lerp(DUST_TAN, 0.45);
    // Tangent basis around the car
    this.e1.copy(v.heading);
    this.e2.crossVectors(up, this.e1).normalize();
    const speed = LANDING_RING.speedMin + (LANDING_RING.speedMax - LANDING_RING.speedMin) * Math.min(1, strength);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rand(-0.12, 0.12);
      const c = Math.cos(a);
      const s = Math.sin(a);
      // Start on an ellipse around the car's footprint so the ring doesn't spawn inside the body
      this.at.copy(v.ground).addScaledVector(this.e1, c * 2.2).addScaledVector(this.e2, s * 1.4).addScaledVector(up, 0.25);
      this.dir.copy(this.e1).multiplyScalar(c).addScaledVector(this.e2, s).multiplyScalar(speed * rand(0.8, 1.15));
      this.dir.addScaledVector(up, rand(0.3, 1.2));
      this.spawn(this.at, this.dir, this.col, rand(0.6, 0.95), 0.6, 2.4, 0.5, 0.6, 3.2, SHAPE.puff);
    }
  }

  /** Backfire: a short tongue of flame and a dark puff out of the exhaust. `flames` false = puff only. */
  backfire(v: VehicleState, flames: boolean): void {
    const at = this.carPoint(v, FX.exhaust, this.at);
    this.e1.copy(v.forward).negate();
    if (flames) {
      for (let k = 0; k < 6; k++) {
        this.dir.copy(this.e1).multiplyScalar(rand(4, 8)).addScaledVector(v.velocity, 0.9);
        this.dir.addScaledVector(this.scatter(v.up, 0.2, this.e2), 0.8);
        this.spawn(at, this.dir, pick(FLAME_COLORS), rand(0.08, 0.16), 0.4, 0.15, 1, 0, 6, k < 2 ? SHAPE.streak : SHAPE.puff, 0.03);
      }
    }
    this.dir.copy(this.e1).multiplyScalar(2).addScaledVector(v.velocity, 0.6);
    this.col.copy(EXHAUST_GREY).multiplyScalar(0.45);
    this.spawn(at, this.dir, this.col, 0.6, 0.35, 1.1, 0.5, 1, 2.5, SHAPE.puff);
  }

  /** Card opened: a pop of confetti chips over the car (it's parked on the marker). */
  confetti(v: VehicleState): void {
    const n = Math.round(26 * this.rate);
    this.at.copy(v.position).addScaledVector(v.up, 2.6);
    for (let k = 0; k < n; k++) {
      this.scatter(v.up, 0.6, this.dir).multiplyScalar(rand(4, 7.5));
      const size = rand(0.12, 0.22);
      this.spawn(this.at, this.dir, pick(CHIP_COLORS), rand(0.9, 1.4), size, size, 1, -PLANET_GRAVITY * 0.55, 1.4, SHAPE.chip);
    }
  }

  private exhaust(v: VehicleState, dt: number): void {
    const speedRatio = Math.abs(v.forwardSpeed) / VEHICLE.maxSpeed;
    this.exhaustAccum += exhaustRate(v.throttle, speedRatio, v.grounded) * this.rate * dt;
    if (this.exhaustAccum < 1) return;
    const at = this.carPoint(v, FX.exhaust, this.at);
    const load = Math.max(0, v.throttle);
    while (this.exhaustAccum >= 1) {
      this.exhaustAccum -= 1;
      this.dir.copy(v.forward).multiplyScalar(-1.4).addScaledVector(v.velocity, 0.6);
      this.dir.addScaledVector(this.scatter(v.up, 0.4, this.e2), 0.5);
      this.spawn(at, this.dir, EXHAUST_GREY, rand(0.45, 0.75), 0.15, 0.6 + 0.4 * load, 0.22 + 0.18 * load, 1.4, 2.2, SHAPE.puff);
    }
  }

  private speedLines(v: VehicleState, camera: Camera, dt: number): void {
    const ratio = Math.abs(v.forwardSpeed) / VEHICLE.maxSpeed;
    this.lineAccum += speedLineRate(ratio) * this.rate * dt;
    if (this.lineAccum < 1) return;
    camera.getWorldDirection(this.camFwd);
    // Basis perpendicular to the view axis for the ring of streaks
    this.e1.crossVectors(this.camFwd, v.up);
    if (this.e1.lengthSq() < 1e-8) return;
    this.e1.normalize();
    this.e2.crossVectors(this.e1, this.camFwd).normalize();
    // Streaks lie along the car's motion and stay still in the world, so the camera rushes past them
    this.dir.copy(v.velocity).normalize().multiplyScalar(v.speed * FX.lineLengthPerSpeed);
    while (this.lineAccum >= 1) {
      this.lineAccum -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = rand(FX.lineRadius[0], FX.lineRadius[1]);
      this.at
        .copy(camera.position)
        .addScaledVector(this.camFwd, rand(FX.lineAhead[0], FX.lineAhead[1]))
        .addScaledVector(this.e1, Math.cos(a) * r)
        .addScaledVector(this.e2, Math.sin(a) * r);
      this.spawn(this.at, ZERO, LINE_WHITE, rand(0.22, 0.34), 0.05, 0.03, 0.35, 0, 0, SHAPE.streak, 0, this.dir);
    }
  }

  /**
   * Per frame: continuous emitters (unless `paused`: card/GPS open), then simulate and upload.
   * `speedLines` false with reduced motion.
   */
  frame(dt: number, v: VehicleState, camera: Camera, paused: boolean, speedLines: boolean): void {
    if (!paused && v.bodyHandle >= 0) {
      this.exhaust(v, dt);
      if (speedLines) this.speedLines(v, camera, dt);
      else this.lineAccum = 0;
    }
    this.pool.update(dt);
    for (const a of this.attrs) a.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
