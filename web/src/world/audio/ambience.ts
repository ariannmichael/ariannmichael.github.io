// Procedural biome ambience. One "bed" per biome: a couple of continuous layers (filtered noise, slow
// LFOs, drones) plus occasional events (bird chirps, traffic passes, water plips, music-box notes…)
// played as low-priority voices into the bed. Crossing a border crossfades the old bed out (then frees
// it) and the new one in; at most two beds exist at once, and only during the fade.

import type { BiomeId } from "@/world/planet/types";
import { AMBIENCE, AMBIENCE_FADE, nextEventDelay } from "./ambiencePresets";
import type { AudioKit } from "./audioRuntime";
import { biquad, gainNode, loopNoise, midi, noise, openVoice, tone } from "./synth";
import { PRIORITY } from "./voices";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

interface Bed {
  biome: BiomeId;
  out: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  nextAt: number;
}

/** Build helpers bound to one bed */
class BedBuilder {
  constructor(
    readonly kit: AudioKit,
    readonly bed: Bed,
  ) {}
  get ctx() {
    return this.kit.ctx;
  }
  node<T extends AudioNode>(n: T): T {
    this.bed.nodes.push(n);
    return n;
  }
  src<T extends AudioScheduledSourceNode>(s: T): T {
    this.bed.sources.push(s);
    return s;
  }
  noise(rate = 1) {
    return this.src(loopNoise(this.kit, rate));
  }
  osc(type: OscillatorType, freq: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start();
    return this.src(o);
  }
  filter(type: BiquadFilterType, freq: number, q = 0.7) {
    return this.node(biquad(this.ctx, type, freq, q));
  }
  gain(v: number) {
    return this.node(gainNode(this.ctx, v));
  }
  /** Modulate `param` with a sine LFO of `rate` Hz and ±`depth` */
  lfo(param: AudioParam, rate: number, depth: number, type: OscillatorType = "sine") {
    this.osc(type, rate).connect(this.gain(depth)).connect(param);
  }
  /** A gain whose level breathes: base ± depth at `rate` Hz (gusts, swells, laps) */
  swell(base: number, rate: number, depth: number) {
    const g = this.gain(base);
    this.lfo(g.gain, rate, depth);
    return g;
  }
}

type BedLayers = (b: BedBuilder) => void;
type BedEvent = (kit: AudioKit, out: AudioNode) => void;

/** Continuous layers per biome */
const LAYERS: Record<BiomeId, BedLayers> = {
  home(b) {
    // Breeze through grass: mid noise in gentle gusts
    b.noise(0.6).connect(b.filter("bandpass", 650, 0.5)).connect(b.swell(0.35, 0.13, 0.22)).connect(b.bed.out);
  },
  engineering(b) {
    // City hum: a dark rumble plus faint mains/HVAC tones
    b.noise(0.25).connect(b.filter("lowpass", 230, 0.7)).connect(b.gain(0.9)).connect(b.bed.out);
    b.osc("sine", 58).connect(b.gain(0.035)).connect(b.bed.out);
    if (!b.kit.lite) b.osc("sine", 117).connect(b.swell(0.015, 0.07, 0.008)).connect(b.bed.out);
  },
  healthcare(b) {
    // Water lapping: low noise in slow laps, a glassy shimmer band on a different period
    b.noise(0.7).connect(b.filter("lowpass", 650, 0.6)).connect(b.swell(0.4, 0.22, 0.32)).connect(b.bed.out);
    if (!b.kit.lite) b.noise(1).connect(b.filter("bandpass", 1800, 1.5)).connect(b.swell(0.05, 0.31, 0.045)).connect(b.bed.out);
  },
  financial(b) {
    // Dry wind: a whistling band that wanders in pitch, over a low sand rumble
    const whistle = b.filter("bandpass", 1500, 2.5);
    b.lfo(whistle.frequency, 0.09, 450);
    b.noise(1).connect(whistle).connect(b.swell(0.22, 0.17, 0.15)).connect(b.bed.out);
    if (!b.kit.lite) b.noise(0.3).connect(b.filter("lowpass", 260, 0.7)).connect(b.gain(0.35)).connect(b.bed.out);
  },
  opensource(b) {
    // Alien drone: a root and a slightly-off fifth under a slowly sweeping filter
    const lp = b.filter("lowpass", 420, 2);
    b.lfo(lp.frequency, 0.07, 220);
    const drone = b.gain(0.07);
    lp.connect(drone).connect(b.bed.out);
    b.osc("sine", 55).connect(lp);
    b.osc("triangle", 82.8).connect(b.swell(0.6, 0.5, 0.35)).connect(lp);
    if (!b.kit.lite) b.osc("triangle", 110.4).connect(b.gain(0.4)).connect(lp);
  },
  gamedev(b) {
    // Crickets: a high tone pulsed fast (the chirp) and gated slow (the rhythm)
    const cricket = (freq: number, pulse: number, gate: number, level: number) => {
      const am = b.gain(0.5);
      b.lfo(am.gain, pulse, 0.5, "square");
      const g = b.gain(0.5);
      b.lfo(g.gain, gate, 0.5, "square");
      b.osc("sine", freq).connect(am).connect(g).connect(b.gain(level)).connect(b.bed.out);
    };
    cricket(4500, 31, 1.1, 0.022);
    if (!b.kit.lite) cricket(4920, 27, 0.83, 0.016);
  },
  raceway(b) {
    // Distant crowd: a murmur band that swells and settles
    b.noise(1).connect(b.filter("bandpass", 900, 0.8)).connect(b.filter("lowpass", 2200, 0.5)).connect(b.swell(0.22, 0.11, 0.1)).connect(b.bed.out);
    if (!b.kit.lite) b.noise(0.5).connect(b.filter("bandpass", 450, 1)).connect(b.gain(0.18)).connect(b.bed.out);
  },
  badlands(b) {
    // Low wind with a faint hollow whistle
    b.noise(0.4).connect(b.filter("lowpass", 320, 0.8)).connect(b.swell(0.55, 0.11, 0.35)).connect(b.bed.out);
    if (!b.kit.lite) {
      const band = b.filter("bandpass", 850, 7);
      b.lfo(band.frequency, 0.05, 160);
      b.noise(1).connect(band).connect(b.gain(0.07)).connect(b.bed.out);
    }
  },
};

/** A bird: 2–5 quick chirps, rising or falling */
const bird: BedEvent = (kit, out) => {
  const v = openVoice(kit, out, 1, PRIORITY.ambient, rand(0.5, 1));
  if (!v) return;
  const n = 2 + Math.floor(Math.random() * 4);
  const f = rand(2600, 4200);
  const up = Math.random() < 0.6;
  for (let i = 0; i < n; i++) {
    const fi = f * rand(0.95, 1.08);
    tone(v, { freq: fi, to: up ? fi * 1.4 : fi * 0.75, sweepTime: 0.06, at: i * rand(0.09, 0.14), attack: 0.006, decay: 0.06, peak: 0.08 });
  }
};

const EVENTS: Record<BiomeId, BedEvent> = {
  home: bird,
  engineering(kit, out) {
    // A car passing a few blocks away; now and then a far horn
    const v = openVoice(kit, out, 3.2, PRIORITY.ambient);
    if (!v) return;
    noise(v, { filter: "bandpass", freq: 380, to: 700, sweepTime: 1.3, q: 1.2, rate: 0.5, attack: 1.2, hold: 0.2, decay: 1.5, peak: 0.35 });
    if (Math.random() < 0.25) {
      tone(v, { type: "square", freq: pick([330, 349, 392]), at: rand(0.4, 1.4), attack: 0.01, hold: 0.12, decay: 0.08, peak: 0.012, filter: { type: "lowpass", freq: 900 } });
    }
  },
  healthcare(kit, out) {
    // A plip on the water (sometimes two), occasionally a bird across the lake
    if (Math.random() < 0.2) return bird(kit, out);
    const v = openVoice(kit, out, 0.5, PRIORITY.ambient);
    if (!v) return;
    const f = rand(700, 1100);
    tone(v, { freq: f, to: f * 0.4, sweepTime: 0.05, attack: 0.002, decay: 0.07, peak: 0.07 });
    if (Math.random() < 0.4) tone(v, { freq: f * 1.3, to: f * 0.5, sweepTime: 0.05, at: 0.13, attack: 0.002, decay: 0.06, peak: 0.04 });
  },
  financial(kit, out) {
    // A gust lifting sand
    const v = openVoice(kit, out, 2.4, PRIORITY.ambient);
    if (!v) return;
    noise(v, { filter: "highpass", freq: 2200, to: 3200, q: 0.6, attack: 0.8, decay: 1.4, peak: 0.12 });
  },
  opensource(kit, out) {
    // A distant sci-fi blip with a fake echo
    const v = openVoice(kit, out, 1.2, PRIORITY.ambient);
    if (!v) return;
    const f = midi(pick([84, 86, 89, 91, 93, 96]));
    for (let i = 0; i < 3; i++) {
      tone(v, { freq: f, to: f * 0.67, sweepTime: 0.25, at: i * 0.24, attack: 0.004, decay: 0.3, peak: 0.035 / (1 + i * 1.2) });
    }
  },
  gamedev(kit, out) {
    // A faint music box drifting over from the park: 3–6 notes of a pentatonic tune
    const v = openVoice(kit, out, 2.8, PRIORITY.ambient);
    if (!v) return;
    const scale = [84, 86, 88, 91, 93, 96];
    const n = 3 + Math.floor(Math.random() * 4);
    let idx = Math.floor(Math.random() * scale.length);
    for (let i = 0; i < n; i++) {
      idx = Math.max(0, Math.min(scale.length - 1, idx + pick([-2, -1, 1, 2])));
      const f = midi(scale[idx]);
      const at = i * 0.24;
      tone(v, { freq: f, at, attack: 0.002, decay: 0.9, peak: 0.04 });
      tone(v, { freq: f * 3, at, attack: 0.002, decay: 0.3, peak: 0.008 });
    }
  },
  raceway(kit, out) {
    const v = openVoice(kit, out, 3.4, PRIORITY.ambient);
    if (!v) return;
    if (Math.random() < 0.5) {
      // A race car screaming past on the far straight (Doppler drop)
      const f = rand(220, 280);
      tone(v, { type: "sawtooth", freq: f * 1.15, to: f * 0.7, sweepTime: 2.4, attack: 1, hold: 0.15, decay: 1.3, peak: 0.03, filter: { type: "lowpass", freq: 800 } });
    } else {
      // The crowd cheers
      noise(v, { filter: "bandpass", freq: 1100, q: 0.7, attack: 0.6, hold: 0.6, decay: 1.6, peak: 0.25 });
    }
  },
  badlands(kit, out) {
    // A hawk, far away
    const v = openVoice(kit, out, 1.4, PRIORITY.ambient);
    if (!v) return;
    tone(v, { freq: 2300, to: 1500, sweepTime: 0.6, attack: 0.05, decay: 0.6, peak: 0.025 });
    tone(v, { freq: 2200, to: 1450, sweepTime: 0.5, at: 0.75, attack: 0.05, decay: 0.5, peak: 0.015 });
  },
};

export class Ambience {
  private current: Bed | null = null;
  private readonly fading = new Set<Bed>();

  constructor(private readonly kit: AudioKit) {}

  get biome(): BiomeId | null {
    return this.current?.biome ?? null;
  }

  /** Crossfade to `biome` (no-op if already there unless `rebuild`, e.g. after a quality change). */
  setBiome(biome: BiomeId, fade = AMBIENCE_FADE, rebuild = false): void {
    if (this.current?.biome === biome && !rebuild) return;
    const { ctx } = this.kit;
    const t = ctx.currentTime;
    if (this.current) this.release(this.current, fade);
    const out = gainNode(ctx, 0);
    out.connect(this.kit.ambience);
    const bed: Bed = { biome, out, sources: [], nodes: [], nextAt: t + nextEventDelay(biome, Math.random(), this.kit.lite) * 0.5 };
    LAYERS[biome](new BedBuilder(this.kit, bed));
    out.gain.setTargetAtTime(AMBIENCE[biome].level, t, fade / 3);
    this.current = bed;
  }

  /** Fire due events (call every frame or so while audio is live). */
  update(): void {
    const bed = this.current;
    if (!bed) return;
    const t = this.kit.ctx.currentTime;
    if (t < bed.nextAt) return;
    bed.nextAt = t + nextEventDelay(bed.biome, Math.random(), this.kit.lite);
    EVENTS[bed.biome](this.kit, bed.out);
  }

  dispose(): void {
    if (this.current) this.release(this.current, 0.2);
    this.current = null;
  }

  private release(bed: Bed, fade: number): void {
    const t = this.kit.ctx.currentTime;
    bed.out.gain.setTargetAtTime(0, t, fade / 3);
    this.fading.add(bed);
    for (const s of bed.sources) {
      try {
        s.stop(t + fade * 1.3);
      } catch {
        // Already stopped
      }
    }
    window.setTimeout(() => {
      for (const n of bed.nodes) n.disconnect();
      for (const s of bed.sources) s.disconnect();
      bed.out.disconnect();
      this.fading.delete(bed);
    }, (fade * 1.3 + 0.2) * 1000);
  }
}
