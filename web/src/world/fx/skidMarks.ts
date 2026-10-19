// Skid marks: dark tyre ribbons left on the ground by sliding wheels. One BufferGeometry holds a ring
// buffer of quads (one per ~0.35 m of travel per sliding wheel); the oldest quad is overwritten when
// full. Each vertex stores its birth time, and the shader fades the mark by age, so after a quad is
// written the CPU never touches it again: per frame only the new quads are uploaded (update ranges).
//
// Orientation is planet-local: the ribbon's width runs along cross(local up, travel direction) and it
// is lifted a few cm along the local up at the contact, plus polygon offset, so it hugs the sphere
// without z-fighting the terrain.
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from "three";
import type { Quality } from "@/state/useAppStore";
import type { VehicleState } from "@/world/vehicle/vehicleState";

export const SKID = {
  /** Quads in the ring buffer ("high") and the limit in "low" */
  maxSegments: 640,
  lowSegments: 240,
  /** Wheels sliding less than this leave no mark */
  minSlip: 0.32,
  /** A new quad every this many metres of wheel travel; a jump longer than `maxSegment` breaks the ribbon */
  segmentLength: 0.35,
  maxSegment: 2.5,
  /** Ribbon half-width (m) and lift above the contact (m) */
  halfWidth: 0.13,
  lift: 0.035,
  /** Opacity at full slip; marks stay solid for `hold` seconds then fade out over `fade` seconds */
  maxAlpha: 0.55,
  hold: 6,
  fade: 6,
  color: [0.07, 0.06, 0.055] as const,
} as const;

/** Per-wheel ribbon state: the last centre point and its two edge points */
interface Trail {
  active: boolean;
  hasEdges: boolean;
  center: Vector3;
  left: Vector3;
  right: Vector3;
}

const _dir = new Vector3();
const _side = new Vector3();
const _p = new Vector3();
const _l = new Vector3();
const _r = new Vector3();

/**
 * The pure ring buffer (geometry + per-wheel trails). No React, no renderer: `addPoint` is the whole
 * emission rule and is unit-tested; `frame` feeds it from vehicleState.
 */
export class SkidTrails {
  readonly geometry = new BufferGeometry();
  readonly material = createSkidMaterial();
  readonly positions: Float32Array;
  /** [birth time (s), alpha] per vertex; birth -1e6 = unused */
  readonly birthAlpha: Float32Array;
  private readonly posAttr: BufferAttribute;
  private readonly baAttr: BufferAttribute;
  private readonly trails: Trail[];
  private head = 0;
  private limitN: number;
  /** Segments written since the last upload (start index, count; wraps handled by two ranges) */
  private dirtyFrom = -1;
  private dirtyCount = 0;
  private teleportSeen = -1;

  constructor(readonly capacity: number = SKID.maxSegments, wheels = 4) {
    this.limitN = capacity;
    this.positions = new Float32Array(capacity * 4 * 3);
    this.birthAlpha = new Float32Array(capacity * 4 * 2);
    for (let i = 0; i < capacity * 4; i++) this.birthAlpha[i * 2] = -1e6;
    const index = new Uint32Array(capacity * 6);
    for (let s = 0; s < capacity; s++) {
      const v = s * 4;
      // 0 = previous left, 1 = previous right, 2 = new left, 3 = new right
      index.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], s * 6);
    }
    this.geometry.setIndex(new BufferAttribute(index, 1));
    this.posAttr = new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage);
    this.baAttr = new BufferAttribute(this.birthAlpha, 2).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("position", this.posAttr);
    this.geometry.setAttribute("aBirthAlpha", this.baAttr);
    this.trails = Array.from({ length: wheels }, () => ({
      active: false,
      hasEdges: false,
      center: new Vector3(),
      left: new Vector3(),
      right: new Vector3(),
    }));
  }

  get limit(): number {
    return this.limitN;
  }

  /** Segments written in total (wrapping index of the next one is `head`). For tests. */
  get nextSlot(): number {
    return this.head;
  }

  setLimit(n: number): void {
    this.limitN = Math.max(1, Math.min(this.capacity, Math.floor(n)));
    if (this.head >= this.limitN) this.head = 0;
    this.geometry.setDrawRange(0, this.limitN * 6);
  }

  /** Break every ribbon (teleport, reset). */
  breakAll(): void {
    for (const t of this.trails) t.active = false;
  }

  /**
   * Feed one wheel's contact this frame. `sliding` false (or a big jump) ends its ribbon. Returns true
   * when a quad was written.
   */
  addPoint(wheel: number, contact: Vector3, up: Vector3, slip: number, sliding: boolean, time: number): boolean {
    const t = this.trails[wheel];
    if (!t) return false;
    if (!sliding) {
      t.active = false;
      return false;
    }
    _p.copy(contact).addScaledVector(up, SKID.lift);
    if (!t.active) {
      t.active = true;
      t.hasEdges = false;
      t.center.copy(_p);
      return false;
    }
    _dir.copy(_p).sub(t.center);
    const dist = _dir.length();
    if (dist > SKID.maxSegment) {
      // Teleport or a glitchy contact: restart here rather than drawing a long smear
      t.hasEdges = false;
      t.center.copy(_p);
      return false;
    }
    if (dist < SKID.segmentLength) return false;

    _side.crossVectors(up, _dir);
    if (_side.lengthSq() < 1e-10) return false;
    _side.normalize().multiplyScalar(SKID.halfWidth);
    _l.copy(_p).add(_side);
    _r.copy(_p).sub(_side);
    if (!t.hasEdges) {
      t.left.copy(t.center).add(_side);
      t.right.copy(t.center).sub(_side);
    }
    this.writeSegment(t.left, t.right, _l, _r, time, Math.min(1, slip) * SKID.maxAlpha);
    t.left.copy(_l);
    t.right.copy(_r);
    t.center.copy(_p);
    t.hasEdges = true;
    return true;
  }

  private writeSegment(l0: Vector3, r0: Vector3, l1: Vector3, r1: Vector3, time: number, alpha: number): void {
    const s = this.head;
    this.head = (this.head + 1) % this.limitN;
    const p = this.positions;
    const o = s * 12;
    l0.toArray(p, o);
    r0.toArray(p, o + 3);
    l1.toArray(p, o + 6);
    r1.toArray(p, o + 9);
    const b = this.birthAlpha;
    for (let k = 0; k < 4; k++) {
      b[s * 8 + k * 2] = time;
      b[s * 8 + k * 2 + 1] = alpha;
    }
    // Track a contiguous dirty range; on wrap just upload everything up to the limit once
    if (this.dirtyFrom < 0) {
      this.dirtyFrom = s;
      this.dirtyCount = 1;
    } else if (s === this.dirtyFrom + this.dirtyCount) {
      this.dirtyCount++;
    } else {
      this.dirtyFrom = 0;
      this.dirtyCount = this.limitN;
    }
  }

  /** Push the new quads to the GPU (only the written range). */
  upload(): void {
    if (this.dirtyFrom < 0) return;
    this.posAttr.clearUpdateRanges();
    this.baAttr.clearUpdateRanges();
    this.posAttr.addUpdateRange(this.dirtyFrom * 12, this.dirtyCount * 12);
    this.baAttr.addUpdateRange(this.dirtyFrom * 8, this.dirtyCount * 8);
    this.posAttr.needsUpdate = true;
    this.baAttr.needsUpdate = true;
    this.dirtyFrom = -1;
    this.dirtyCount = 0;
  }

  /** Emit from every wheel that is on the ground and sliding. `time` = clock seconds (the shader's uTime). */
  frame(v: VehicleState, time: number, paused: boolean): void {
    this.material.uniforms.uTime.value = time;
    if (this.teleportSeen !== v.teleportCount) {
      this.teleportSeen = v.teleportCount;
      this.breakAll();
    }
    if (paused || v.bodyHandle < 0) {
      this.breakAll();
      return;
    }
    for (let i = 0; i < v.wheels.length; i++) {
      const w = v.wheels[i];
      this.addPoint(i, w.contact, v.up, w.slip, w.inContact && w.slip >= SKID.minSlip, time);
    }
    this.upload();
  }

  setQuality(quality: Quality): void {
    this.setLimit(quality === "low" ? SKID.lowSegments : SKID.maxSegments);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const vertexShader = /* glsl */ `
  attribute vec2 aBirthAlpha;
  uniform float uTime;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    float age = uTime - aBirthAlpha.x;
    vAlpha = aBirthAlpha.y * (1.0 - clamp((age - ${SKID.hold.toFixed(1)}) / ${SKID.fade.toFixed(1)}, 0.0, 1.0));
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    if (vAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor, vAlpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** The skid-mark material. `uniforms.uTime` follows the clock (SkidTrails.frame sets it). */
function createSkidMaterial(): ShaderMaterial {
  const m = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      { uTime: { value: 0 }, uColor: { value: new Vector3(...SKID.color) } },
    ]),
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  return m;
}
