// The one AudioContext and its mixer. Browsers only let audio start from a user gesture, so nothing is
// created until the first pointerdown/keydown/touchstart; after that the context runs only while the
// sound is on and the tab is visible (suspended otherwise, which also saves battery).
//
// Mixer: sfx (car), ambience and ui buses → compressor (glues hits and keeps peaks polite) → master
// (mute fades) → speakers. Cards and the GPS "duck" the sfx and ambience buses instead of stopping
// them, so the world keeps breathing quietly behind the UI.

import { ParamGlide } from "./envelope";
import { VoicePool } from "./voices";

export const MIX = {
  master: 0.8,
  sfx: 0.85,
  ambience: 0.32,
  ui: 0.42,
  /** Bus multipliers while a card or the GPS is open */
  duckSfx: 0.22,
  duckAmbience: 0.55,
  /** Fade time constants (s) */
  muteFade: 0.06,
  duckFade: 0.18,
  /** One-shot voice budget (continuous layers excluded) */
  voices: 6,
  voicesLite: 4,
} as const;

/** Everything a sound needs to play */
export interface AudioKit {
  ctx: AudioContext;
  sfx: GainNode;
  ambience: GainNode;
  ui: GainNode;
  /** 2 s of white noise shared by every noise source (one allocation, many players) */
  noise: AudioBuffer;
  voices: VoicePool;
  /** quality === "low": fewer layers and voices */
  lite: boolean;
}

type ReadyListener = (kit: AudioKit) => void;

// iOS Safari only counts touchend/click/keydown as "user activation" for an AudioContext (pointerdown
// and touchstart do not), so those are listed too. The first one that really resumes it wins.
const GESTURES = ["pointerdown", "pointerup", "keydown", "touchstart", "touchend", "click"] as const;

export class AudioRuntime {
  kit: AudioKit | null = null;
  private master: GainNode | null = null;
  private masterGlide: ParamGlide | null = null;
  private sfxGlide: ParamGlide | null = null;
  private ambGlide: ParamGlide | null = null;
  private muted = false;
  private hidden = false;
  private ducked = false;
  private lite = false;
  private suspendTimer = 0;
  private readonly readyListeners = new Set<ReadyListener>();
  private disposed = false;

  constructor() {
    if (typeof window === "undefined") return;
    for (const g of GESTURES) window.addEventListener(g, this.onGesture, { capture: true, passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.hidden = document.hidden;
  }

  /** Called with the kit once audio is unlocked (immediately if it already is). Returns unsubscribe. */
  onReady(fn: ReadyListener): () => void {
    if (this.kit) fn(this.kit);
    else this.readyListeners.add(fn);
    return () => this.readyListeners.delete(fn);
  }

  /** True when sounds should actually be scheduled (unlocked, on, visible, context running) */
  get live(): boolean {
    return !!this.kit && !this.muted && !this.hidden && this.kit.ctx.state === "running";
  }

  get now(): number {
    return this.kit ? this.kit.ctx.currentTime : 0;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyRunState();
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    if (!this.kit) return;
    const t = this.kit.ctx.currentTime;
    this.sfxGlide?.to(MIX.sfx * (ducked ? MIX.duckSfx : 1), t, MIX.duckFade);
    this.ambGlide?.to(MIX.ambience * (ducked ? MIX.duckAmbience : 1), t, MIX.duckFade);
  }

  setLite(lite: boolean): void {
    this.lite = lite;
    if (!this.kit) return;
    this.kit.lite = lite;
    this.kit.voices.setMax(lite ? MIX.voicesLite : MIX.voices);
  }

  /**
   * Create/resume the context. Must run inside a user-gesture handler (the gesture listeners call it;
   * so can a key handler that may run before them, like the horn).
   */
  unlock(): void {
    if (this.disposed || typeof window === "undefined") return;
    if (!this.kit) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      let ctx: AudioContext;
      try {
        ctx = new Ctor({ latencyHint: "interactive" });
      } catch {
        return;
      }
      this.build(ctx);
      // Old iOS only unlocks after something actually plays inside the gesture
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination);
        src.start();
      } catch {
        // Not needed on modern browsers
      }
    }
    this.applyRunState();
    if (this.kit && this.readyListeners.size) {
      const kit = this.kit;
      for (const fn of [...this.readyListeners]) fn(kit);
      this.readyListeners.clear();
    }
  }

  dispose(): void {
    this.disposed = true;
    if (typeof window !== "undefined") {
      for (const g of GESTURES) window.removeEventListener(g, this.onGesture, { capture: true });
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    window.clearTimeout(this.suspendTimer);
    this.readyListeners.clear();
    const ctx = this.kit?.ctx;
    this.kit = null;
    void ctx?.close().catch(() => {});
  }

  private build(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(master);
    master.connect(ctx.destination);

    const bus = (level: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(comp);
      return g;
    };
    const sfx = bus(MIX.sfx * (this.ducked ? MIX.duckSfx : 1));
    const ambience = bus(MIX.ambience * (this.ducked ? MIX.duckAmbience : 1));
    const ui = bus(MIX.ui);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.master = master;
    this.masterGlide = new ParamGlide(master.gain, MIX.muteFade);
    this.sfxGlide = new ParamGlide(sfx.gain, MIX.duckFade);
    this.ambGlide = new ParamGlide(ambience.gain, MIX.duckFade);
    this.kit = {
      ctx,
      sfx,
      ambience,
      ui,
      noise,
      voices: new VoicePool(this.lite ? MIX.voicesLite : MIX.voices),
      lite: this.lite,
    };
  }

  /** Run only while unlocked, on and visible; fade the master in/out around resume/suspend. */
  private applyRunState(): void {
    const kit = this.kit;
    if (!kit || !this.master || !this.masterGlide) return;
    const run = !this.muted && !this.hidden;
    window.clearTimeout(this.suspendTimer);
    if (run) {
      if (kit.ctx.state !== "running") void kit.ctx.resume().catch(() => {});
      this.masterGlide.to(MIX.master, kit.ctx.currentTime, MIX.muteFade);
    } else {
      this.masterGlide.to(0, kit.ctx.currentTime, MIX.muteFade);
      // Let the fade finish, then stop the audio thread entirely
      this.suspendTimer = window.setTimeout(() => {
        if ((this.muted || this.hidden) && this.kit) void this.kit.ctx.suspend().catch(() => {});
      }, 250);
    }
  }

  private onGesture = () => {
    this.unlock();
    // Once unlocked (and running) the listeners have done their job
    if (this.kit && this.kit.ctx.state === "running") {
      for (const g of GESTURES) window.removeEventListener(g, this.onGesture, { capture: true });
    }
  };

  private onVisibility = () => {
    this.hidden = document.hidden;
    this.applyRunState();
  };
}
