// One-shot voice budget (pure). Every one-shot sound (impact, whoosh, UI blip, ambient chirp…) asks
// the pool for a slot first. When the pool is full, a more important sound steals the slot of the
// least important (then oldest) one, which is faded out through its `stop` callback; an equally or
// less important sound is simply dropped. Continuous layers (engine, tyres, wind, ambience bed) are
// not counted here: they are a fixed handful created once.

/** Priorities: higher wins a contested slot */
export const PRIORITY = {
  ambient: 0,
  hover: 0,
  clunk: 1,
  ui: 2,
  whoosh: 2,
  impact: 3,
} as const;

interface Slot {
  end: number;
  priority: number;
  started: number;
  stop: (() => void) | null;
}

export class VoicePool {
  private readonly slots: Slot[] = [];
  private max: number;

  constructor(max: number) {
    this.max = max;
  }

  setMax(max: number): void {
    this.max = max;
  }

  /** Voices still sounding at `now` */
  active(now: number): number {
    this.purge(now);
    return this.slots.length;
  }

  /**
   * Try to start a voice lasting until `now + duration`. Returns false if it should not play. `stop`
   * (optional) fades the voice out early if it is later stolen.
   */
  acquire(now: number, duration: number, priority: number, stop: (() => void) | null = null): boolean {
    this.purge(now);
    if (this.slots.length >= this.max) {
      let victim = -1;
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i];
        if (s.priority >= priority) continue;
        if (
          victim < 0 ||
          s.priority < this.slots[victim].priority ||
          (s.priority === this.slots[victim].priority && s.started < this.slots[victim].started)
        ) {
          victim = i;
        }
      }
      if (victim < 0) return false;
      this.slots[victim].stop?.();
      this.slots.splice(victim, 1);
    }
    this.slots.push({ end: now + duration, priority, started: now, stop });
    return true;
  }

  private purge(now: number): void {
    for (let i = this.slots.length - 1; i >= 0; i--) if (this.slots[i].end <= now) this.slots.splice(i, 1);
  }
}
