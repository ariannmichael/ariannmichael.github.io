// Car one-shots: impacts, landings, whooshes, backfire pops, suspension clunks, the starter and the
// horn. Each is a single voice (one budget slot) built from a few partials; see synth.ts.

import type { AudioKit } from "./audioRuntime";
import type { ImpactParams, LandingParams } from "./mapping";
import { biquad, gainNode, midi, noise, openVoice, softClipCurve, tone, type Voice } from "./synth";
import { PRIORITY } from "./voices";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Inharmonic partials of a struck steel panel (ratios of a free plate), for crunches and clanks */
const METAL = [1, 2.76, 5.4, 8.93] as const;

function metal(v: Voice, base: number, amount: number, decay: number, partials: number, at = 0): void {
  for (let i = 0; i < partials; i++) {
    tone(v, {
      type: i === 0 ? "triangle" : "sine",
      freq: base * METAL[i] * rand(0.98, 1.02),
      at: at + i * 0.004,
      attack: 0.001,
      decay: decay * (1 - i * 0.18),
      peak: (0.16 * amount) / (1 + i * 0.6),
    });
  }
}

/** World hit (heavy thud + metal crunch) or prop hit (light hollow knock), from `impactParams`. */
export function playImpact(kit: AudioKit, p: ImpactParams, dynamic: boolean): void {
  const v = openVoice(kit, kit.sfx, p.decay + 0.45, PRIORITY.impact, p.gain);
  if (!v) return;
  if (dynamic) {
    // Plastic / cardboard: a pitched hollow body plus a bright click
    tone(v, { type: "triangle", freq: p.thudFrom * p.pitch, to: p.thudTo * p.pitch, attack: 0.001, decay: p.decay, peak: 0.55 });
    tone(v, { freq: p.thudFrom * 1.52 * p.pitch, attack: 0.001, decay: p.decay * 0.6, peak: 0.18 });
    noise(v, { filter: "bandpass", freq: 3200 * p.pitch, q: 2, decay: 0.025, peak: 0.55 });
    return;
  }
  // Body thud: a falling sine is the "weight", the low-passed burst is the punch
  tone(v, { freq: p.thudFrom * p.pitch, to: p.thudTo, sweepTime: p.decay * 0.8, attack: 0.002, decay: p.decay, peak: 0.95 });
  noise(v, { filter: "lowpass", freq: 1100 * p.pitch, to: 180, q: 0.9, decay: 0.07 + p.decay * 0.3, peak: 0.8 });
  if (p.crunch > 0.01) {
    // Crumpling sheet metal: grainy band noise sweeping down, then a scatter of debris
    noise(v, {
      filter: "bandpass",
      freq: 2600 * p.pitch,
      to: 900 * p.pitch,
      q: 2.5,
      rate: 0.65,
      decay: 0.1 + 0.28 * p.crunch,
      peak: 0.55 * p.crunch,
    });
    noise(v, { at: 0.035, filter: "highpass", freq: 3800, rate: 0.45, decay: 0.08 + 0.2 * p.crunch, peak: 0.22 * p.crunch });
    metal(v, 310 * p.pitch, p.crunch, 0.18 + 0.35 * p.crunch, kit.lite ? 2 : 4);
  }
}

/** Touchdown: a thump, the springs creaking back, and a bottom-out clank on hard landings. */
export function playLanding(kit: AudioKit, p: LandingParams): void {
  const v = openVoice(kit, kit.sfx, 0.85, PRIORITY.impact, p.gain);
  if (!v) return;
  tone(v, { freq: 78, to: 38, sweepTime: 0.22, attack: 0.002, decay: 0.32, peak: 0.95 });
  noise(v, { filter: "lowpass", freq: 700, to: 150, decay: 0.16, peak: 0.6 });
  if (p.creak > 0.05) {
    // Leaf springs: a buzzy tone through a narrow band, compressing then rebounding
    const creak = { type: "sawtooth" as const, filter: { type: "bandpass" as const, freq: 950, q: 7 } };
    tone(v, { ...creak, freq: 150, to: 118, at: 0.04, attack: 0.03, hold: 0.04, decay: 0.16, peak: 0.2 * p.creak });
    if (!kit.lite) tone(v, { ...creak, freq: 112, to: 146, at: 0.24, attack: 0.03, decay: 0.2, peak: 0.13 * p.creak });
  }
  if (p.clank > 0.01) {
    noise(v, { filter: "bandpass", freq: 1900, q: 3, decay: 0.06, peak: 0.35 * p.clank });
    metal(v, 240, p.clank, 0.3, kit.lite ? 2 : 3);
  }
}

export type WhooshKind = "takeoff" | "reset" | "teleport";

/** Air whooshes: takeoff (rising), reset (quick swoosh + pop), teleport (long sweep + shimmer). */
export function playWhoosh(kit: AudioKit, kind: WhooshKind, amount = 1): void {
  if (kind === "takeoff") {
    const v = openVoice(kit, kit.sfx, 0.7, PRIORITY.whoosh, 0.25 + 0.45 * amount);
    if (!v) return;
    noise(v, { filter: "bandpass", freq: 320, to: 1500, q: 1.3, rate: 0.8, attack: 0.14, decay: 0.42, peak: 0.6 });
    return;
  }
  if (kind === "reset") {
    const v = openVoice(kit, kit.sfx, 0.6, PRIORITY.whoosh, 0.5);
    if (!v) return;
    noise(v, { filter: "bandpass", freq: 2200, to: 450, q: 1.6, attack: 0.04, decay: 0.3, peak: 0.55 });
    tone(v, { freq: 280, to: 760, at: 0.2, attack: 0.004, decay: 0.12, peak: 0.25 });
    return;
  }
  const v = openVoice(kit, kit.sfx, 1.4, PRIORITY.whoosh, 0.5);
  if (!v) return;
  noise(v, { filter: "bandpass", freq: 260, to: 3200, q: 1.1, attack: 0.25, hold: 0.05, decay: 0.55, peak: 0.6 });
  // Sparkle on arrival: a quick major arpeggio, high and soft
  const notes = [84, 88, 91, 96];
  notes.forEach((n, i) =>
    tone(v, { type: "triangle", freq: midi(n), at: 0.3 + i * 0.06, attack: 0.003, decay: 0.45, peak: 0.07 }),
  );
}

/** Exhaust backfire: a sharp low pop with a crackle tail. */
export function playBackfire(kit: AudioKit, strength: number): void {
  const v = openVoice(kit, kit.sfx, 0.3, PRIORITY.whoosh, 0.3 + 0.35 * strength);
  if (!v) return;
  const p = rand(0.85, 1.2);
  tone(v, { freq: 120 * p, to: 42, attack: 0.001, decay: 0.09, peak: 0.9 });
  noise(v, { filter: "lowpass", freq: 2400 * p, to: 500, decay: 0.05, peak: 0.9 });
  noise(v, { at: 0.018, filter: "bandpass", freq: 900 * p, q: 1.5, rate: 0.5, decay: 0.05, peak: 0.45 });
}

/** Suspension clunk / chassis rattle hit over rough ground. */
export function playClunk(kit: AudioKit, amount: number): void {
  const v = openVoice(kit, kit.sfx, 0.18, PRIORITY.clunk, 0.12 + 0.2 * amount);
  if (!v) return;
  const p = rand(0.85, 1.2);
  tone(v, { type: "triangle", freq: 105 * p, to: 62 * p, attack: 0.001, decay: 0.08, peak: 0.7 });
  noise(v, { filter: "bandpass", freq: 1500 * p, q: 4, decay: 0.035, peak: 0.35 });
}

/** Starter motor cranking, before the engine catches (the engine layer then fades in with a flare). */
export function playStarter(kit: AudioKit): number {
  const v = openVoice(kit, kit.sfx, 0.7, PRIORITY.whoosh, 0.22);
  if (!v) return 0;
  const { ctx, t } = v;
  // A buzzy whine, chopped at ~11 Hz by the compression strokes
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.linearRampToValueAtTime(175, t + 0.5);
  const lp = biquad(ctx, "lowpass", 900, 1.2);
  const chop = gainNode(ctx, 0.5);
  const lfo = ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 11;
  const lfoDepth = gainNode(ctx, 0.5);
  lfo.connect(lfoDepth).connect(chop.gain);
  const env = gainNode(ctx, 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.04);
  env.gain.setValueAtTime(1, t + 0.45);
  env.gain.linearRampToValueAtTime(0, t + 0.55);
  osc.connect(lp).connect(chop).connect(env).connect(v.out);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.6);
  lfo.stop(t + 0.6);
  return 0.5;
}

export const HORN = {
  /** Two simultaneous tones a major third apart: the classic dual-trumpet car horn */
  freqs: [370, 466] as const,
  gain: 0.2,
  /** Longest honk (s) before it lets go on its own */
  maxHold: 3,
} as const;

/** Holdable horn: start on key down, stop on key up. Not part of the one-shot budget. */
export class Horn {
  private oscs: OscillatorNode[] = [];
  private env: GainNode | null = null;
  private timer = 0;

  constructor(private readonly kit: AudioKit) {}

  start(): void {
    if (this.env || this.kit.ctx.state !== "running") return;
    const { ctx } = this.kit;
    const t = ctx.currentTime + 0.005;
    const env = gainNode(ctx, 0);
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve(2.2);
    const body = biquad(ctx, "peaking", 1000, 1.2);
    body.gain.value = 6;
    const lp = biquad(ctx, "lowpass", 2600, 0.8);
    const mix = gainNode(ctx, 0.5);
    mix.connect(shaper).connect(body).connect(lp).connect(env).connect(this.kit.sfx);
    for (const f of HORN.freqs) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      // A slight sag at the start, like the diaphragm getting going
      o.frequency.setValueAtTime(f * 0.94, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      o.connect(mix);
      o.start(t);
      this.oscs.push(o);
    }
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(HORN.gain, t + 0.015);
    this.env = env;
    this.timer = window.setTimeout(() => this.stop(), HORN.maxHold * 1000);
  }

  stop(): void {
    window.clearTimeout(this.timer);
    const env = this.env;
    if (!env) return;
    const t = this.kit.ctx.currentTime;
    env.gain.cancelScheduledValues(t);
    env.gain.setValueAtTime(env.gain.value, t);
    env.gain.linearRampToValueAtTime(0, t + 0.06);
    for (const o of this.oscs) o.stop(t + 0.08);
    const oscs = this.oscs;
    window.setTimeout(() => {
      env.disconnect();
      for (const o of oscs) o.disconnect();
    }, 200);
    this.oscs = [];
    this.env = null;
  }
}
