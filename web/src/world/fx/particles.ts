// Pooled particle simulation (pure, allocation-free). Struct-of-arrays in Float32Arrays that the
// renderer uploads directly as instanced attributes: `offset` (xyz), `color` (rgb) and `sizeAlpha`.
// A ring buffer: emitting when full recycles the oldest slot, so the pool never grows or allocates.

export interface ParticleSpawn {
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
  /** Diameter (m) at birth and at death */
  size0: number;
  size1: number;
  /** Peak opacity 0..1 */
  alpha: number;
}

export interface ParticleUpdate {
  /** Rise acceleration along the local planet up (m/s²) */
  rise: number;
  /** Velocity drag (1/s) */
  drag: number;
}

export class ParticlePool {
  readonly capacity: number;
  /** Render attributes (shared with the GPU buffers) */
  readonly offset: Float32Array;
  readonly color: Float32Array;
  /** [size, alpha] per particle; size 0 = dead (collapsed quad) */
  readonly sizeAlpha: Float32Array;
  // Simulation state
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly alpha0: Float32Array;
  private head = 0;
  private limitN: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.limitN = capacity;
    this.offset = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.sizeAlpha = new Float32Array(capacity * 2);
    this.vel = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity); // 0 = free
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.alpha0 = new Float32Array(capacity);
  }

  /** Slots in use (≤ capacity). Lowering it frees particles beyond the new limit (quality "low"). */
  get limit(): number {
    return this.limitN;
  }

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

  /** Emit one particle; returns its slot. Overwrites the oldest slot when the pool is full. */
  emit(p: ParticleSpawn): number {
    const i = this.head;
    this.head = (this.head + 1) % this.limitN;
    const i3 = i * 3;
    this.offset[i3] = p.x;
    this.offset[i3 + 1] = p.y;
    this.offset[i3 + 2] = p.z;
    this.vel[i3] = p.vx;
    this.vel[i3 + 1] = p.vy;
    this.vel[i3 + 2] = p.vz;
    this.color[i3] = p.r;
    this.color[i3 + 1] = p.g;
    this.color[i3 + 2] = p.b;
    this.age[i] = 0;
    this.life[i] = Math.max(1e-3, p.life);
    this.size0[i] = p.size0;
    this.size1[i] = p.size1;
    this.alpha0[i] = p.alpha;
    this.sizeAlpha[i * 2] = p.size0;
    this.sizeAlpha[i * 2 + 1] = 0;
    return i;
  }

  /**
   * Advance every live particle: drag, rise along the local up (radial from the planet centre),
   * grow, fade in quickly and out slowly; free it at the end of its life.
   */
  update(dt: number, u: ParticleUpdate): void {
    const k = Math.exp(-u.drag * dt);
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
      const a = u.rise * dt;
      const vx = (this.vel[i3] + (x / len) * a) * k;
      const vy = (this.vel[i3 + 1] + (y / len) * a) * k;
      const vz = (this.vel[i3 + 2] + (z / len) * a) * k;
      this.vel[i3] = vx;
      this.vel[i3 + 1] = vy;
      this.vel[i3 + 2] = vz;
      this.offset[i3] = x + vx * dt;
      this.offset[i3 + 1] = y + vy * dt;
      this.offset[i3 + 2] = z + vz * dt;

      const t = age / life;
      const grow = 1 - (1 - t) * (1 - t); // ease-out expansion
      this.sizeAlpha[i * 2] = this.size0[i] + (this.size1[i] - this.size0[i]) * grow;
      const fadeIn = Math.min(1, age / 0.06);
      this.sizeAlpha[i * 2 + 1] = this.alpha0[i] * fadeIn * (1 - t) ** 1.5;
    }
  }

  private kill(i: number): void {
    this.life[i] = 0;
    this.sizeAlpha[i * 2] = 0;
    this.sizeAlpha[i * 2 + 1] = 0;
  }
}
