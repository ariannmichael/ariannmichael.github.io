// Synth primitives for one-shot sounds. A one-shot is a "voice": one output gain on a bus that a few
// short-lived oscillators / noise players feed. Nodes are created per *sound* (event-driven, a handful
// per second at most), never per frame, and disconnect themselves when they end.

import type { AudioKit } from "./audioRuntime";
import { adEnvelope, ahrEnvelope, sweep } from "./envelope";

export interface Voice {
  kit: AudioKit;
  ctx: AudioContext;
  out: GainNode;
  /** Start time (a few ms ahead of now, so envelopes never start in the past) */
  t: number;
}

/** Scheduling lead: start a hair in the future so the first automation point isn't already gone */
const LEAD = 0.005;

/**
 * Open a voice on `bus` lasting `duration` seconds at `priority`, or null when the voice budget says no
 * (or audio isn't running). Everything connected to `voice.out` is cleaned up after `duration`.
 */
export function openVoice(kit: AudioKit, bus: AudioNode, duration: number, priority: number, gain = 1): Voice | null {
  const ctx = kit.ctx;
  if (ctx.state !== "running") return null;
  const t = ctx.currentTime + LEAD;
  const out = ctx.createGain();
  out.gain.value = gain;
  const stop = () => {
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, 0.015);
  };
  if (!kit.voices.acquire(t, duration, priority, stop)) return null;
  out.connect(bus);
  // Disconnect the voice's output once everything has rung out (sources stop themselves)
  window.setTimeout(() => out.disconnect(), (duration + 0.25) * 1000);
  return { kit, ctx, out, t };
}

export interface ToneOpts {
  type?: OscillatorType;
  /** Start / end frequency (Hz); `to` = exponential sweep over the envelope */
  freq: number;
  to?: number;
  /** Sweep duration (defaults to the whole envelope) */
  sweepTime?: number;
  /** Delay from the voice start (s) */
  at?: number;
  attack?: number;
  decay: number;
  /** Optional hold before the decay (AHR envelope) */
  hold?: number;
  peak: number;
  detune?: number;
  /** Optional filter on this partial */
  filter?: { type: BiquadFilterType; freq: number; q?: number; to?: number };
}

/** One oscillator partial with its own envelope (and optional sweep / filter). Returns its end time. */
export function tone(v: Voice, o: ToneOpts): number {
  const { ctx } = v;
  const t = v.t + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  if (o.detune) osc.detune.value = o.detune;
  const total = (o.attack ?? 0.004) + (o.hold ?? 0) + o.decay;
  if (o.to !== undefined) sweep(osc.frequency, t, o.freq, o.to, o.sweepTime ?? total);
  else osc.frequency.setValueAtTime(o.freq, t);
  const g = ctx.createGain();
  const end =
    o.hold !== undefined
      ? ahrEnvelope(g.gain, t, o.peak, o.attack ?? 0.004, o.hold, o.decay)
      : adEnvelope(g.gain, t, o.peak, o.attack ?? 0.004, o.decay);
  let head: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.Q.value = o.filter.q ?? 0.7;
    if (o.filter.to !== undefined) sweep(f.frequency, t, o.filter.freq, o.filter.to, total);
    else f.frequency.value = o.filter.freq;
    head.connect(f);
    head = f;
  }
  head.connect(g);
  g.connect(v.out);
  osc.start(t);
  osc.stop(end + 0.02);
  return end;
}

export interface NoiseOpts {
  at?: number;
  attack?: number;
  decay: number;
  hold?: number;
  peak: number;
  filter: BiquadFilterType;
  freq: number;
  /** Filter sweep target (Hz) */
  to?: number;
  sweepTime?: number;
  q?: number;
  /** Playback rate of the noise (lower = darker, grainier) */
  rate?: number;
}

/** A filtered noise burst with its own envelope. Returns its end time. */
export function noise(v: Voice, o: NoiseOpts): number {
  const { ctx, kit } = v;
  const t = v.t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = kit.noise;
  src.loop = true;
  src.playbackRate.value = o.rate ?? 1;
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.Q.value = o.q ?? 1;
  const total = (o.attack ?? 0.003) + (o.hold ?? 0) + o.decay;
  if (o.to !== undefined) sweep(f.frequency, t, o.freq, o.to, o.sweepTime ?? total);
  else f.frequency.value = o.freq;
  const g = ctx.createGain();
  const end =
    o.hold !== undefined
      ? ahrEnvelope(g.gain, t, o.peak, o.attack ?? 0.003, o.hold, o.decay)
      : adEnvelope(g.gain, t, o.peak, o.attack ?? 0.003, o.decay);
  src.connect(f);
  f.connect(g);
  g.connect(v.out);
  // Random start point so repeated bursts don't share the same grain
  src.start(t, Math.random() * (kit.noise.duration - 0.1));
  src.stop(end + 0.02);
  return end;
}

/** A looping noise player (continuous layers). Started immediately; caller owns stopping it. */
export function loopNoise(kit: AudioKit, rate = 1): AudioBufferSourceNode {
  const src = kit.ctx.createBufferSource();
  src.buffer = kit.noise;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(kit.ctx.currentTime, Math.random() * (kit.noise.duration - 0.1));
  return src;
}

/** Biquad helper */
export function biquad(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Gain helper */
export function gainNode(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** Soft-clip curve (tanh), shared by every shaper; `amount` steepens it */
const curves = new Map<number, Float32Array<ArrayBuffer>>();
export function softClipCurve(amount = 1): Float32Array<ArrayBuffer> {
  const cached = curves.get(amount);
  if (cached) return cached;
  const n = 1024;
  const c = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / norm;
  }
  curves.set(amount, c);
  return c;
}

/** Note frequency from a MIDI number (A4 = 69 = 440 Hz) */
export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

