// AudioParam scheduling helpers. They only call the AudioParam automation API, so tests can pass a
// recording mock instead of a real AudioContext.

/** The subset of AudioParam these helpers use */
export interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): unknown;
  cancelScheduledValues(time: number): unknown;
}

/** Exponential ramps can't touch 0: this is "silent" for them */
export const SILENT = 0.0001;

/**
 * Attack–decay envelope: 0 → `peak` linearly over `attack`, then an exponential fall to silence over
 * `decay`. Returns the time the envelope ends (when the voice can be stopped).
 */
export function adEnvelope(p: ParamLike, t: number, peak: number, attack: number, decay: number): number {
  const a = Math.max(0.001, attack);
  const d = Math.max(0.005, decay);
  p.cancelScheduledValues(t);
  p.setValueAtTime(SILENT, t);
  p.linearRampToValueAtTime(Math.max(SILENT, peak), t + a);
  p.exponentialRampToValueAtTime(SILENT, t + a + d);
  return t + a + d;
}

/**
 * Attack–hold–release: 0 → peak over `attack`, held for `hold`, then released over `release`.
 * Returns the end time.
 */
export function ahrEnvelope(
  p: ParamLike,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): number {
  const a = Math.max(0.001, attack);
  const r = Math.max(0.005, release);
  const top = Math.max(SILENT, peak);
  p.cancelScheduledValues(t);
  p.setValueAtTime(SILENT, t);
  p.linearRampToValueAtTime(top, t + a);
  p.setValueAtTime(top, t + a + Math.max(0, hold));
  p.exponentialRampToValueAtTime(SILENT, t + a + Math.max(0, hold) + r);
  return t + a + Math.max(0, hold) + r;
}

/** Exponential pitch/frequency sweep from `from` to `to` over `dur` (both > 0). */
export function sweep(p: ParamLike, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(Math.max(SILENT, from), t);
  p.exponentialRampToValueAtTime(Math.max(SILENT, to), t + Math.max(0.005, dur));
}

/**
 * Smoothly glides a continuous param toward per-frame targets with setTargetAtTime. Skips the call when
 * the change is negligible, so a steady state doesn't pile automation events into the timeline.
 */
export class ParamGlide {
  private last = Number.NaN;
  constructor(
    private readonly p: ParamLike,
    private readonly timeConstant: number,
    /** Changes smaller than this (relative to the value, or absolute near 0) are skipped */
    private readonly epsilon = 0.004,
  ) {}

  to(target: number, t: number, timeConstant = this.timeConstant): void {
    // Relative threshold for big values (Hz), absolute for gains; reaching exactly 0 always goes through
    const skip =
      target === 0 ? this.last === 0 : Math.abs(target - this.last) <= this.epsilon * Math.max(Math.abs(this.last), 1);
    if (skip) return;
    this.last = target;
    this.p.setTargetAtTime(target, t, timeConstant);
  }

  /** Jump (no glide), e.g. when a layer is (re)built */
  set(value: number, t: number): void {
    this.last = value;
    this.p.cancelScheduledValues(t);
    this.p.setValueAtTime(value, t);
  }
}
