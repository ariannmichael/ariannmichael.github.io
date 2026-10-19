// The audio "director": wires game state to sound. Owns the runtime (context + mixer), the continuous
// car layers, the ambience, the horn and every trigger (game events, store moments, DOM clicks).
// Plain class so AudioSystem stays a thin React shell; `frame` is called from useFrame.

import { useAppStore, type AppState } from "@/state/useAppStore";
import { onGameEvent, type GameEvent } from "@/world/events/gameEvents";
import { getRoads, nearestRoadXYZ, ROAD_HALF_WIDTH, type RoadHit } from "@/world/planet/roads";
import { biomeAt } from "@/world/planet/terrain";
import type { BiomeId } from "@/world/planet/types";
import { VEHICLE } from "@/world/vehicle/constants";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { Vector3 } from "three";
import { Ambience } from "./ambience";
import { AMBIENCE_FADE, AMBIENCE_FADE_FAST } from "./ambiencePresets";
import { AudioRuntime, type AudioKit } from "./audioRuntime";
import { createBackfireState, stepBackfire } from "./backfire";
import { CarSounds } from "./carSounds";
import { createEngineState, stepEngine, type EngineInput } from "./engineModel";
import {
  clunkRate,
  createEngineSoundParams,
  createRollParams,
  engineSoundParams,
  ImpactGate,
  impactParams,
  landingParams,
  RateLimiter,
  rollParams,
  surfaceHardness,
  type RollInput,
} from "./mapping";
import { loadMutedPref, MUTED_DEFAULT, saveMutedPref } from "./mutePref";
import { Horn, playBackfire, playClunk, playImpact, playLanding, playStarter, playWhoosh } from "./sfx";
import { playUi, type UiSound } from "./uiSfx";

/** How often the biome / surface under the car are re-checked (s) */
const BIOME_INTERVAL = 0.5;
const SURFACE_INTERVAL = 0.25;
/** A new biome must be seen this many checks in a row before the ambience follows (border jitter) */
const BIOME_CONFIRM = 2;
/** Engine revs to this right after the starter (the "catch" flare), then settles to idle */
const START_FLARE_RPM = 2100;
/** A generic click is skipped when a meaningful UI sound just played for the same click (ms) */
const MOMENT_SUPPRESS_MS = 60;
/** A store change this soon after a click counts as user-initiated (ms) */
const USER_CLICK_MS = 150;
const INTERACTIVE = 'button, a[href], [role="button"], summary';

const isDucked = (s: AppState) => s.mode === "card" || s.gpsOpen;
const nowMs = () => performance.now();

export class AudioDirector {
  private rt: AudioRuntime | null = null;
  private car: CarSounds | null = null;
  private amb: Ambience | null = null;
  private horn: Horn | null = null;
  private cleanups: (() => void)[] = [];
  private timers = new Set<number>();

  private readonly engine = createEngineState();
  private readonly backfire = createBackfireState();
  private readonly engineParams = createEngineSoundParams();
  private readonly roll = createRollParams();
  private readonly engineIn: EngineInput = { forwardSpeed: 0, throttle: 0, grounded: true, slip: 0 };
  private readonly rollIn: RollInput = { speed: 0, grounded: true, airTime: 0, slip: 0, hardness: 0, suspensionActivity: 0 };
  private readonly gate = new ImpactGate();
  private readonly limiter = new RateLimiter();
  private readonly dir = new Vector3();
  private readonly roadHit: RoadHit = { dist: Infinity, target: 0, road: -1, seg: 0, t: 0 };

  private biome: BiomeId | null = null;
  private candidate: BiomeId | null = null;
  private candidateCount = 0;
  private fastFade = false;
  private hardness = 0;
  private biomeTimer = BIOME_INTERVAL;
  private surfaceTimer = SURFACE_INTERVAL;
  private prevActivity = 0;
  /** ctx time before which the engine stays silent (starter cranking) */
  private engineStartAt = Infinity;
  private flarePending = false;
  private lastClickAt = -Infinity;
  private lastMomentAt = -Infinity;
  private lastHover: Element | null = null;

  mount(): void {
    const rt = new AudioRuntime();
    this.rt = rt;
    const store = useAppStore;

    // Restore the saved choice, unless the visitor already flipped the switch before the world loaded
    const pref = loadMutedPref();
    if (pref !== null && store.getState().muted === MUTED_DEFAULT && pref !== MUTED_DEFAULT) store.setState({ muted: pref });
    const s0 = store.getState();
    rt.setMuted(s0.muted);
    rt.setDucked(isDucked(s0));
    rt.setLite(s0.quality === "low");

    this.cleanups.push(store.subscribe((s, prev) => this.onStore(s, prev)));
    this.cleanups.push(onGameEvent((e) => this.onGameEvent(e)));
    this.cleanups.push(rt.onReady((kit) => this.onReady(kit)));

    const onClickCapture = () => {
      this.lastClickAt = nowMs();
    };
    const onClick = (e: MouseEvent) => this.onClick(e);
    const onOver = (e: PointerEvent) => this.onPointerOver(e);
    document.addEventListener("click", onClickCapture, { capture: true, passive: true });
    document.addEventListener("click", onClick, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    this.cleanups.push(() => {
      document.removeEventListener("click", onClickCapture, { capture: true });
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerover", onOver);
    });
  }

  dispose(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    for (const t of this.timers) window.clearTimeout(t);
    this.timers.clear();
    this.horn?.stop();
    this.car?.dispose();
    this.amb?.dispose();
    this.rt?.dispose();
    this.horn = null;
    this.car = null;
    this.amb = null;
    this.rt = null;
    this.biome = null;
  }

  /** Horn key edge (H). Runs inside the keydown handler, so it may also unlock audio. */
  hornKey(pressed: boolean): void {
    if (!pressed) {
      this.horn?.stop();
      return;
    }
    const s = useAppStore.getState();
    if (isDucked(s)) return;
    this.rt?.unlock();
    if (this.rt?.live) this.horn?.start();
  }

  /** Per rendered frame. dt is clamped by the caller. */
  frame(dt: number): void {
    const rt = this.rt;
    if (!rt) return;
    const vs = vehicleState;
    const app = useAppStore.getState();
    const active = vs.bodyHandle >= 0 && !isDucked(app);

    // The models always run (cheap), so the sound is coherent the moment audio starts
    const ei = this.engineIn;
    ei.forwardSpeed = active ? vs.forwardSpeed : 0;
    ei.throttle = active ? vs.throttle : 0;
    ei.grounded = active ? vs.grounded : true;
    ei.slip = active ? Math.max(vs.wheels[2].slip, vs.wheels[3].slip) : 0;
    stepEngine(this.engine, ei, dt);
    // Unconditional, same inputs as world juice's flames (see backfire.ts)
    const pop = stepBackfire(this.backfire, vs.throttle, vs.speed, dt);

    this.trackBiome(dt);

    const kit = rt.kit;
    if (!rt.live || !kit || !this.car) return;
    const t = kit.ctx.currentTime;

    if (this.flarePending && t >= this.engineStartAt) {
      this.flarePending = false;
      this.engine.rpm = Math.max(this.engine.rpm, START_FLARE_RPM);
    }
    const ep = engineSoundParams(this.engine.rpm, this.engine.load, this.engineParams);
    if (t < this.engineStartAt) ep.gain = 0;

    const ri = this.rollIn;
    let slip = 0;
    for (const w of vs.wheels) if (w.inContact && w.slip > slip) slip = w.slip;
    ri.speed = active ? vs.speed : 0;
    ri.grounded = active ? vs.grounded : true;
    ri.airTime = active ? vs.airTime : 0;
    ri.slip = active ? slip : 0;
    ri.hardness = this.hardness;
    ri.suspensionActivity = active ? vs.suspensionActivity : 0;
    this.car.update(ep, rollParams(ri, this.roll));
    this.amb?.update();

    if (pop > 0 && active) playBackfire(kit, pop);

    // Suspension clunks: random at a rate set by how hard it's working, plus one on a sharp jolt
    const act = ri.suspensionActivity;
    if (active && vs.grounded && vs.speed > 1) {
      const jolt = act - this.prevActivity > 0.25;
      if ((jolt || Math.random() < clunkRate(act) * dt) && this.limiter.allow("clunk", t, 0.07)) playClunk(kit, act);
    }
    this.prevActivity = act;
  }

  // --- Internals ------------------------------------------------------------------------------------

  private onReady(kit: AudioKit): void {
    this.car = new CarSounds(kit);
    this.amb = new Ambience(kit);
    this.horn = new Horn(kit);
    if (this.biome) this.amb.setBiome(this.biome, AMBIENCE_FADE_FAST);
    // Starter → catch → idle, the first time audio actually runs
    const start = () => {
      const crank = this.rt?.live ? playStarter(kit) : 0;
      this.engineStartAt = kit.ctx.currentTime + crank;
      this.flarePending = crank > 0;
    };
    if (kit.ctx.state === "running") start();
    else {
      const onState = () => {
        if (kit.ctx.state !== "running") return;
        kit.ctx.removeEventListener("statechange", onState);
        start();
      };
      kit.ctx.addEventListener("statechange", onState);
      this.cleanups.push(() => kit.ctx.removeEventListener("statechange", onState));
    }
  }

  private trackBiome(dt: number): void {
    const vs = vehicleState;
    if (vs.bodyHandle < 0 || vs.position.lengthSq() < 1) return;
    this.biomeTimer += dt;
    this.surfaceTimer += dt;
    if (this.biomeTimer >= BIOME_INTERVAL) {
      this.biomeTimer = 0;
      const b = biomeAt(this.dir.copy(vs.position).normalize());
      if (b === this.biome) this.candidateCount = 0;
      else {
        this.candidateCount = b === this.candidate ? this.candidateCount + 1 : 1;
        this.candidate = b;
        if (this.biome === null || this.fastFade || this.candidateCount >= BIOME_CONFIRM) {
          const fade = this.biome === null || this.fastFade ? AMBIENCE_FADE_FAST : AMBIENCE_FADE;
          this.biome = b;
          this.candidateCount = 0;
          this.fastFade = false;
          this.amb?.setBiome(b, fade);
        }
      }
    }
    if (this.surfaceTimer >= SURFACE_INTERVAL && this.biome) {
      this.surfaceTimer = 0;
      const d = this.dir.copy(vs.position).normalize();
      nearestRoadXYZ(d.x, d.y, d.z, getRoads(), this.roadHit);
      this.hardness = surfaceHardness(this.roadHit.dist, ROAD_HALF_WIDTH, this.biome);
    }
  }

  private onGameEvent(e: GameEvent): void {
    if (e.type === "teleport") this.fastFade = true;
    const rt = this.rt;
    const kit = rt?.kit;
    if (!rt?.live || !kit) return;
    const t = kit.ctx.currentTime;
    switch (e.type) {
      case "crash": {
        const s = this.gate.accept(t, e.strength);
        if (s > 0) playImpact(kit, impactParams(s, false, Math.random()), false);
        break;
      }
      case "bump": {
        // Scrapes against the world are softer than real crashes; props are their own sound
        const s = this.gate.accept(t, e.dynamic ? e.strength : e.strength * 0.8);
        if (s > 0) playImpact(kit, impactParams(s, e.dynamic, Math.random()), e.dynamic);
        break;
      }
      case "landing":
        // Claim the gate too, so the chassis bump of the same touchdown doesn't double it
        this.gate.accept(t, e.strength * 2);
        if (this.limiter.allow("landing", t, 0.15)) playLanding(kit, landingParams(e.strength));
        break;
      case "takeoff":
        if (this.limiter.allow("takeoff", t, 0.3)) playWhoosh(kit, "takeoff", Math.min(1, e.speed / VEHICLE.maxSpeed));
        break;
      case "reset":
        playWhoosh(kit, "reset");
        break;
      case "teleport":
        playWhoosh(kit, "teleport");
        break;
    }
  }

  private onStore(s: AppState, prev: AppState): void {
    const rt = this.rt;
    if (!rt) return;
    if (s.muted !== prev.muted) {
      saveMutedPref(s.muted);
      rt.setMuted(s.muted);
      // Confirmation once the context has had a moment to resume
      if (!s.muted) this.later(() => this.ui("unmute"), 90);
    }
    if (isDucked(s) !== isDucked(prev)) rt.setDucked(isDucked(s));
    const user = nowMs() - this.lastClickAt < USER_CLICK_MS;
    if (s.quality !== prev.quality) {
      rt.setLite(s.quality === "low");
      this.rebuildForQuality();
      // PerformanceMonitor also lowers quality on its own: only the button gets a sound
      if (user) this.ui(s.quality === "high" ? "qualityHigh" : "qualityLow");
    }
    if (s.openCardId !== prev.openCardId) this.ui(s.openCardId ? "cardOpen" : "cardClose");
    if (s.teleportNonce !== prev.teleportNonce) this.ui("gpsSelect");
    else if (s.gpsOpen !== prev.gpsOpen) this.ui(s.gpsOpen ? "gpsOpen" : "gpsClose");
    if (s.activeZone && s.activeZone.id !== prev.activeZone?.id && s.mode !== "card") this.ui("prompt");
    // The spawn district is marked on arrival: only later discoveries get the jingle
    if (s.visitedDistricts.length > prev.visitedDistricts.length && prev.visitedDistricts.length > 0) this.ui("discover");
  }

  private rebuildForQuality(): void {
    const kit = this.rt?.kit;
    if (!kit) return;
    if (this.car) {
      this.car.dispose();
      this.car = new CarSounds(kit);
    }
    if (this.amb && this.biome) this.amb.setBiome(this.biome, 0.6, true);
  }

  private onClick(e: MouseEvent): void {
    const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
    if (!el || el.closest("canvas")) return;
    if (el.matches("a[download]")) this.ui("download");
    else if (nowMs() - this.lastMomentAt > MOMENT_SUPPRESS_MS) this.ui("click", "click", 0.04);
  }

  private onPointerOver(e: PointerEvent): void {
    if (e.pointerType !== "mouse") return;
    const el = (e.target as Element | null)?.closest?.(INTERACTIVE) ?? null;
    if (el === this.lastHover) return;
    this.lastHover = el;
    if (!el || (el as HTMLButtonElement).disabled) return;
    this.ui("hover", "hover", 0.06);
  }

  /** Play a UI sound (if audio is live). Store moments mark `lastMomentAt` so the click doesn't double. */
  private ui(sound: UiSound, rateKey?: string, minInterval = 0): void {
    const rt = this.rt;
    const kit = rt?.kit;
    if (sound !== "hover" && sound !== "click") this.lastMomentAt = nowMs();
    if (!rt?.live || !kit) return;
    if (rateKey && !this.limiter.allow(rateKey, kit.ctx.currentTime, minInterval)) return;
    playUi(kit, sound);
  }

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
}
