// Pooled juice particles (pure, allocation-free): sparks, chips, dust rings, exhaust, flames, speed
// lines and confetti all share ONE pool so they cost one instanced draw call. Same struct-of-arrays
// ring buffer as ./particles.ts, plus what the extra effects need:
//   - a per-particle acceleration along the local planet up (sparks fall, smoke rises; on a sphere
//     "down" is towards the centre, never world -Y),
//   - per-particle drag,
//   - a world-space stretch vector (streaks: sparks stretch along their velocity, speed lines carry a
//     fixed one) and a shape id for the fragment shader.

/** Fragment shapes (aStretch.w): soft pixel puff, solid square chip, bright streak */
export const SHAPE = { puff: 0, chip: 1, streak: 2 } as const;
export type FxShape = (typeof SHAPE)[keyof typeof SHAPE];

export interface FxSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  /** Seconds */
  life: number;
  /** Size (m) at birth and at death */
  size0: number;
  size1: number;
  /** Peak opacity 0..1 */
  alpha: number;
  /** Acceleration along the local up (m/s²): positive rises, negative falls */
  accel: number;
  /** Velocity drag (1/s) */
  drag: number;
  /** Streak length = velocity × stretchK (s) … */
  stretchK: number;
  /** … plus this fixed world vector (speed lines) */
  sx: number;
  sy: number;
  sz: number;
  shape: FxShape;
}

/** A reusable spawn record: emitters fill this one object instead of allocating per particle. */
export function blankSpawn(): FxSpawn {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, life: 1, size0: 0.2, size1: 0.2, alpha: 1,
    accel: 0, drag: 0, stretchK: 0, sx: 0, sy: 0, sz: 0, shape: SHAPE.puff,
  };
}

/** Fade-in time (s): long enough to avoid a one-frame pop, short enough that sparks read as instant */
const FADE_IN = 0.04;

export class FxPool {
  readonly capacity: number;
  /** Render attributes (uploaded as instanced attributes) */
  readonly offset: Float32Array;
  readonly color: Float32Array;
  /** [size, alpha]; size 0 = dead (collapsed quad) */
  readonly sizeAlpha: Float32Array;
  /** [stretch xyz (world), shape] */
  readonly stretch: Float32Array;
  private readonly vel: Float32Array;
  private readonly fixed: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly alpha0: Float32Array;
  private readonly accel: Float32Array;
  private readonly drag: Float32Array;
  private readonly stretchK: Float32Array;
  private head = 0;
  private limitN: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.limitN = capacity;
    this.offset = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.sizeAlpha = new Float32Array(capacity * 2);
    this.stretch = new Float32Array(capacity * 4);
    this.vel = new Float32Array(capacity * 3);
    this.fixed = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.alpha0 = new Float32Array(capacity);
    this.accel = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.stretchK = new Float32Array(capacity);
  }

  get limit(): number {
    return this.limitN;
  }

  /** Slots in use (quality "low" lowers it); particles beyond the new limit are freed. */
  setLimit(n: number): void {
    const next = Math.max(1, Math.min(this.capacity, Math.floor(n)));
    for (let i = next; i < this.capacity; i++) this.kill(i);
    if (this.head >= next) this.head = 0;
    this.limitN = next;
  }

  isAlive(i: number): boolean {
    return this.life[i] > 0;
  }

  aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.limitN; i++) if (this.life[i] > 0) n++;
    return n;
  }

  /** Emit one particle; recycles the oldest slot when full. Returns the slot. */
  emit(p: FxSpawn): number {
    const i = this.head;
    this.head = (this.head + 1) % this.limitN;
    const i3 = i * 3;
    this.offset[i3] = p.x;
    this.offset[i3 + 1] = p.y;
    this.offset[i3 + 2] = p.z;
    this.vel[i3] = p.vx;
    this.vel[i3 + 1] = p.vy;
    this.vel[i3 + 2] = p.vz;
    this.fixed[i3] = p.sx;
    this.fixed[i3 + 1] = p.sy;
    this.fixed[i3 + 2] = p.sz;
    this.color[i3] = p.r;
    this.color[i3 + 1] = p.g;
    this.color[i3 + 2] = p.b;
    this.age[i] = 0;
    this.life[i] = Math.max(1e-3, p.life);
    this.size0[i] = p.size0;
    this.size1[i] = p.size1;
    this.alpha0[i] = p.alpha;
    this.accel[i] = p.accel;
    this.drag[i] = p.drag;
    this.stretchK[i] = p.stretchK;
    this.sizeAlpha[i * 2] = p.size0;
    this.sizeAlpha[i * 2 + 1] = 0;
    const i4 = i * 4;
    this.stretch[i4] = p.sx + p.vx * p.stretchK;
    this.stretch[i4 + 1] = p.sy + p.vy * p.stretchK;
    this.stretch[i4 + 2] = p.sz + p.vz * p.stretchK;
    this.stretch[i4 + 3] = p.shape;
    return i;
  }

  /** Advance every live particle (drag, radial acceleration, size/alpha curves, stretch). */
  update(dt: number): void {
    for (let i = 0; i < this.limitN; i++) {
      const life = this.life[i];
      if (life <= 0) continue;
      const age = this.age[i] + dt;
      if (age >= life) {
        this.kill(i);
        continue;
      }
      this.age[i] = age;
      const i3 = i * 3;
      const x = this.offset[i3];
      const y = this.offset[i3 + 1];
      const z = this.offset[i3 + 2];
      const len = Math.hypot(x, y, z) || 1;
      const a = this.accel[i] * dt;
      const k = Math.exp(-this.drag[i] * dt);
      const vx = (this.vel[i3] + (x / len) * a) * k;
      const vy = (this.vel[i3 + 1] + (y / len) * a) * k;
      const vz = (this.vel[i3 + 2] + (z / len) * a) * k;
      this.vel[i3] = vx;
      this.vel[i3 + 1] = vy;
      this.vel[i3 + 2] = vz;
      this.offset[i3] = x + vx * dt;
      this.offset[i3 + 1] = y + vy * dt;
      this.offset[i3 + 2] = z + vz * dt;

      const sk = this.stretchK[i];
      const i4 = i * 4;
      this.stretch[i4] = this.fixed[i3] + vx * sk;
      this.stretch[i4 + 1] = this.fixed[i3 + 1] + vy * sk;
      this.stretch[i4 + 2] = this.fixed[i3 + 2] + vz * sk;

      const t = age / life;
      const grow = 1 - (1 - t) * (1 - t);
      this.sizeAlpha[i * 2] = this.size0[i] + (this.size1[i] - this.size0[i]) * grow;
      const fadeIn = Math.min(1, age / FADE_IN);
      this.sizeAlpha[i * 2 + 1] = this.alpha0[i] * fadeIn * (1 - t) ** 1.5;
    }
  }

  private kill(i: number): void {
    this.life[i] = 0;
    this.sizeAlpha[i * 2] = 0;
    this.sizeAlpha[i * 2 + 1] = 0;
  }
}
