// HUD juice animations run through the Web Animations API, not CSS keyframes, on purpose: the global
// reduced-motion rule (globals.css) squashes every CSS animation to 0.01 ms, which would make a
// popup vanish the instant it appears. Here reduced motion gets its own gentle keyframes (a plain
// fade at a readable pace) instead of no popup at all.

/** Plays keyframes on `el`; resolves when done. Without WAAPI (old browsers, jsdom) it just waits. */
export function play(el: HTMLElement, keyframes: Keyframe[], duration: number): Promise<void> {
  if (typeof el.animate !== "function") {
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }
  const anim = el.animate(keyframes, { duration, easing: "linear", fill: "forwards" });
  // A cancelled animation (element removed early) rejects `finished`; treat it as done.
  return anim.finished.then(
    () => undefined,
    () => undefined,
  );
}

/** Same transform function list in every frame so the browser interpolates each part separately. */
const t = (y: number, scale: number, rot: number) => `translateY(${y}px) scale(${scale}) rotate(${rot}deg)`;

/** Trick popup: slam in past full size, wobble, settle, hold, then drift up and fade. */
export const POPUP_MS = 1500;
export const POPUP_FRAMES: Keyframe[] = [
  { offset: 0, opacity: 0, transform: t(10, 0.3, -6) },
  { offset: 0.09, opacity: 1, transform: t(0, 1.28, 3) },
  { offset: 0.16, transform: t(0, 0.93, -1.5) },
  { offset: 0.23, transform: t(0, 1.03, 0.5) },
  { offset: 0.3, transform: t(0, 1, 0) },
  { offset: 0.78, opacity: 1, transform: t(0, 1, 0) },
  { offset: 1, opacity: 0, transform: t(-18, 1, 0) },
];

/** CRASH!: same pop plus a short horizontal judder (it's the "ouch" one). */
const j = (x: number, scale: number, rot: number) => `translateX(${x}px) scale(${scale}) rotate(${rot}deg)`;
export const CRASH_FRAMES: Keyframe[] = [
  { offset: 0, opacity: 0, transform: j(0, 1.6, 0) },
  { offset: 0.07, opacity: 1, transform: j(-8, 1, -4) },
  { offset: 0.11, transform: j(7, 1, 3) },
  { offset: 0.15, transform: j(-5, 1, -2) },
  { offset: 0.19, transform: j(3, 1, 1) },
  { offset: 0.24, transform: j(0, 1, 0) },
  { offset: 0.8, opacity: 1, transform: j(0, 1, 0) },
  { offset: 1, opacity: 0, transform: j(0, 0.96, 0) },
];

/** District stamp: thumped onto the screen at an angle like a rubber stamp, then fades. */
export const STAMP_MS = 3400;
const s = (scale: number, rot: number) => `scale(${scale}) rotate(${rot}deg)`;
export const STAMP_FRAMES: Keyframe[] = [
  { offset: 0, opacity: 0, transform: s(1.9, -14) },
  { offset: 0.06, opacity: 1, transform: s(0.92, -3) },
  { offset: 0.09, transform: s(1.03, -4.5) },
  { offset: 0.12, transform: s(1, -4) },
  { offset: 0.88, opacity: 1, transform: s(1, -4) },
  { offset: 1, opacity: 0, transform: s(1, -4) },
];

/** Reduced motion: no scale, no movement, just an unhurried fade in and out. */
export const fadeFrames = (holdFrom = 0.15, holdTo = 0.8): Keyframe[] => [
  { offset: 0, opacity: 0 },
  { offset: holdFrom, opacity: 1 },
  { offset: holdTo, opacity: 1 },
  { offset: 1, opacity: 0 },
];
