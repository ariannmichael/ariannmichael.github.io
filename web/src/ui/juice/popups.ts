// Which arcade popup (if any) a game moment earns. Pure, so the rules are unit-tested and tunable
// in one place; TrickPopups only turns the result into DOM.
import type { TrickCounts } from "./flip";

export type PopupTone = "trick" | "air" | "nice" | "crash";

export interface Popup {
  title: string;
  /** Smaller second line (air time, "NICE LANDING" after a trick…) */
  detail?: string;
  tone: PopupTone;
}

export const POPUP_RULES = {
  /** Airtime (s) for "BIG AIR". Ramps on the planet give ~0.6–1.8 s */
  bigAirMin: 1.0,
  /** Airtime (s) before a soft touchdown is worth praising */
  niceAirMin: 0.5,
  /** Landing strength (0..1, the event's) at or below which it counts as soft */
  niceMaxStrength: 0.3,
  /** dot(chassis up, planet up) at touchdown needed to call a landing clean (≈53°) */
  uprightDot: 0.6,
  /** Crash strength (0..1) for "CRASH!": ~8 m/s (≈30 km/h) lost in one step */
  crashMin: 0.45,
  /** Seconds between two CRASH! popups (a tumble is many crashes) */
  crashCooldown: 1.5,
} as const;

const MULTIPLIER = ["", "", "DOUBLE ", "TRIPLE ", "QUADRUPLE "];

function times(n: number, name: string): string {
  return n < MULTIPLIER.length ? `${MULTIPLIER[n]}${name}` : `${n}× ${name}`;
}

/** "BACKFLIP", "DOUBLE BARREL ROLL", "720"…, biggest move first. */
export function trickNames(t: TrickCounts): string[] {
  const names: string[] = [];
  if (t.flips !== 0) names.push(times(Math.abs(t.flips), t.flips > 0 ? "FRONT FLIP" : "BACKFLIP"));
  if (t.rolls > 0) names.push(times(t.rolls, "BARREL ROLL"));
  if (t.spins > 0) names.push(String(t.spins * 360));
  return names;
}

/** 1.43 → "1.4s" (fixed one decimal: reads like an arcade timer and doesn't jitter in width) */
export function formatAirTime(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`;
}

export interface LandingInfo {
  airTime: number;
  /** 0..1 from the landing event */
  strength: number;
  /** dot(chassis up, planet up) at touchdown: 1 = flat on its wheels, < 0 = on its roof */
  upright: number;
}

export function landingPopup(l: LandingInfo, tricks: TrickCounts): Popup | null {
  const r = POPUP_RULES;
  const bigAir = l.airTime >= r.bigAirMin ? `BIG AIR ${formatAirTime(l.airTime)}` : undefined;
  const clean = l.upright >= r.uprightDot && l.strength <= r.niceMaxStrength && l.airTime >= r.niceAirMin;
  const names = trickNames(tricks);

  if (names.length > 0) {
    // Tricks count even when you botch the landing; the CRASH! that follows tells that story.
    const detail = [bigAir, clean ? "NICE LANDING" : undefined].filter(Boolean).join(" · ");
    return { title: `${names.join(" + ")}!`, detail: detail || undefined, tone: "trick" };
  }
  if (bigAir) return { title: bigAir, detail: clean ? "NICE LANDING" : undefined, tone: "air" };
  if (clean) return { title: "NICE LANDING", tone: "nice" };
  return null;
}

/** `sinceLast` = seconds since the previous CRASH! popup (Infinity if none). */
export function crashPopup(strength: number, sinceLast: number): Popup | null {
  if (strength < POPUP_RULES.crashMin || sinceLast < POPUP_RULES.crashCooldown) return null;
  return { title: "CRASH!", tone: "crash" };
}
