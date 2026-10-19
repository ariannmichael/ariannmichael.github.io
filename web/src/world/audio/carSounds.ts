// Continuous car layers: the engine, tyre squeal, gravel crunch, wind and chassis rattle. Built once
// when audio unlocks (rebuilt only when the quality changes) and steered every frame with smoothed
// setTargetAtTime glides from the pure mappings. Three noise players feed every noisy layer.
//
// Engine graph (a real tractor idle, re-pitched):
//   tractor loop (public/audio/tractor-engine-loop.wav, seamless 8 s @ ~950 rpm)
//     → pre (louder with load) → DC block → low-pass (opens with load: the bark) → level
// playbackRate follows the engine model's rpm (compressed to 0.8..2.4× — a tractor never revs
// like the game's 5-speed), and the filter opening under load makes throttle sound like effort.

import type { AudioKit } from "./audioRuntime";
import { rpmNorm } from "./engineModel";
import { ParamGlide } from "./envelope";
import { type EngineSoundParams, PULSES_PER_REV, type RollParams } from "./mapping";
import { biquad, gainNode, loopNoise } from "./synth";

/** Overall engine level (the mapping's gain is relative) */
export const ENGINE_LEVEL = 0.5;
/** The tractor idle recording, cut to a seamless 8 s loop and normalised to −1 dB peak */
const ENGINE_SAMPLE_URL = "/audio/tractor-engine-loop.wav";
/**
 * Loop playback rate. The recording idles at ~950 rpm but the game engine sweeps 750..4900 rpm
 * across 5 gears; re-pitching that whole range (up to ×5) would be cartoonish, so the rpm norm
 * 0..1 compresses it instead: idle sits just under the recording's own pitch, the limiter
 * screams at 2.4× (≈2300 rpm of real tractor, which is about a tractor's redline).
 */
const RATE_IDLE = 0.8;
const RATE_MAX = 2.4;
/** The mapping's cutoffs (400..2300 Hz) were tuned for thin band-limited pulse waves; a full-range
 *  recording needs more top end, so scale them up. */
const CUTOFF_SCALE = 2.4;

/** Decoded once, shared by every CarSounds rebuild (a quality switch rebuilds the whole graph) */
let engineBuffer: Promise<AudioBuffer | null> | null = null;

function loadEngineBuffer(kit: AudioKit): Promise<AudioBuffer | null> {
  engineBuffer ??= fetch(ENGINE_SAMPLE_URL)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((b) => kit.ctx.decodeAudioData(b))
    .catch((e: unknown) => {
      console.warn("[audio] engine sample failed to load", e);
      return null;
    });
  return engineBuffer;
}
/** Squeal tone centre (Hz) */
const SQUEAL_FREQ = 1150;

export class CarSounds {
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private readonly out: GainNode;
  private readonly g: Record<string, ParamGlide> = {};
  private disposed = false;
  /** Loop rate the last update asked for (the source may not exist yet while the sample loads) */
  private rate = RATE_IDLE;

  constructor(private readonly kit: AudioKit) {
    const { ctx } = kit;
    const lite = kit.lite;
    this.out = gainNode(ctx, 1);
    this.out.connect(kit.sfx);

    const noiseA = this.src(loopNoise(kit, 1));
    const noiseDark = this.src(loopNoise(kit, 0.5));

    // --- Engine: the tractor loop, re-pitched by rpm and opened up by load ---
    const pre = this.node(gainNode(ctx, 1));
    // DC safety: the loop is clean, but the throttle-dependent pre gain can still lean on it
    const dcBlock = this.node(biquad(ctx, "highpass", 25, 0.707));
    // The "effort" filter: shut at idle, opened by rpm and load (steered every frame)
    const lp = this.node(biquad(ctx, "lowpass", 220, 1.2));
    const level = this.node(gainNode(ctx, 0));
    pre.connect(dcBlock).connect(lp).connect(level).connect(this.out);
    this.g.pre = new ParamGlide(pre.gain, 0.05);
    this.g.cutoff = new ParamGlide(lp.frequency, 0.04);
    this.g.level = new ParamGlide(level.gain, 0.05);
    void loadEngineBuffer(kit).then((buf) => {
      if (!buf || this.disposed) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = this.rate;
      src.connect(pre);
      src.start();
      this.sources.push(src);
      this.g.rate = new ParamGlide(src.playbackRate, 0.03);
    });

    // --- Tyre squeal: a wobbling tone in a narrow band, plus (non-lite) a hiss band ---
    const squeal = this.node(gainNode(ctx, 0));
    squeal.connect(this.out);
    const sq = this.osc("triangle", SQUEAL_FREQ);
    const vib = this.osc("sine", 8.5);
    vib.connect(this.node(gainNode(ctx, 28))).connect(sq.frequency);
    sq.connect(this.node(biquad(ctx, "bandpass", 1300, 3))).connect(this.node(gainNode(ctx, 0.8))).connect(squeal);
    this.g.squealFreq = new ParamGlide(sq.frequency, 0.08);
    if (!lite) {
      noiseA.connect(this.node(biquad(ctx, "bandpass", 2700, 6))).connect(this.node(gainNode(ctx, 0.9))).connect(squeal);
    }
    this.g.squeal = new ParamGlide(squeal.gain, 0.06);

    // --- Gravel: band noise; non-lite adds a granular flutter from very slow noise as AM ---
    const gravelBand = this.node(biquad(ctx, "bandpass", 900, 0.9));
    const grain = this.node(gainNode(ctx, lite ? 1 : 0.6));
    const gravel = this.node(gainNode(ctx, 0));
    noiseA.connect(gravelBand).connect(grain).connect(gravel).connect(this.out);
    if (!lite) {
      const flutter = this.src(loopNoise(kit, 0.035));
      flutter.connect(this.node(biquad(ctx, "lowpass", 60, 0.7))).connect(this.node(gainNode(ctx, 2.5))).connect(grain.gain);
    }
    this.g.gravelFreq = new ParamGlide(gravelBand.frequency, 0.1);
    this.g.gravel = new ParamGlide(gravel.gain, 0.08);

    // --- Wind: dark noise, a moving band, slow gusts ---
    const windBand = this.node(biquad(ctx, "bandpass", 400, 0.6));
    const gust = this.node(gainNode(ctx, 0.85));
    const wind = this.node(gainNode(ctx, 0));
    noiseDark.connect(windBand).connect(this.node(biquad(ctx, "lowpass", 2600, 0.5))).connect(gust).connect(wind).connect(this.out);
    const gustLfo = this.osc("sine", 0.23);
    gustLfo.connect(this.node(gainNode(ctx, 0.15))).connect(gust.gain);
    this.g.windFreq = new ParamGlide(windBand.frequency, 0.2);
    this.g.wind = new ParamGlide(wind.gain, 0.25);

    // --- Chassis rattle (non-lite): a high band chopped at ~23 Hz ---
    if (!lite) {
      const chop = this.node(gainNode(ctx, 0.5));
      const rattle = this.node(gainNode(ctx, 0));
      noiseA.connect(this.node(biquad(ctx, "bandpass", 2900, 3))).connect(chop).connect(rattle).connect(this.out);
      const rLfo = this.osc("square", 23);
      rLfo.connect(this.node(gainNode(ctx, 0.5))).connect(chop.gain);
      this.g.rattle = new ParamGlide(rattle.gain, 0.08);
    }
  }

  /** Steer every layer toward the current params. Cheap: unchanged params are skipped. */
  update(e: EngineSoundParams, r: RollParams): void {
    if (this.disposed) return;
    const t = this.kit.ctx.currentTime;
    const g = this.g;
    // rpm back from the firing frequency (mapping sends freq = rpm/60 × pulses/rev), then 0..1 across
    // the model's 750..4900 rpm range
    const rpm = (e.freq * 60) / PULSES_PER_REV;
    this.rate = RATE_IDLE + (RATE_MAX - RATE_IDLE) * rpmNorm(rpm);
    g.rate?.to(this.rate, t);
    // e.drive (1.4..3.2) was synth pre-shaper gain; with no shaper it becomes a gentle throttle push
    g.pre.to(0.8 + (0.7 * (e.drive - 1.4)) / 1.8, t);
    g.cutoff.to(e.cutoff * CUTOFF_SCALE, t);
    g.level.to(e.gain * ENGINE_LEVEL, t);
    g.squeal.to(r.squeal, t);
    g.squealFreq.to(SQUEAL_FREQ * r.squealPitch, t);
    g.gravel.to(r.gravel, t);
    g.gravelFreq.to(r.gravelFreq, t);
    g.wind.to(r.wind, t);
    g.windFreq.to(r.windFreq, t);
    g.rattle?.to(r.rattle, t);
  }

  /** Fade out and release everything. */
  dispose(fade = 0.15): void {
    if (this.disposed) return;
    this.disposed = true;
    const t = this.kit.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, fade / 3);
    for (const s of this.sources) {
      try {
        s.stop(t + fade + 0.05);
      } catch {
        // Already stopped
      }
    }
    const nodes = [...this.nodes, this.out, ...this.sources];
    window.setTimeout(() => nodes.forEach((n) => n.disconnect()), (fade + 0.2) * 1000);
  }

  private osc(type: OscillatorType, freq: number): OscillatorNode {
    const o = this.kit.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start();
    return this.src(o);
  }

  private src<T extends AudioScheduledSourceNode>(s: T): T {
    this.sources.push(s);
    return s;
  }

  private node<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
}
