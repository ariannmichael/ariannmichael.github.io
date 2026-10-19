"use client";

import { useEffect, useRef } from "react";
import { onGameEvent } from "@/world/events/gameEvents";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { usePrefersReducedMotion } from "@/ui/lib/hooks";
import { countTricks, createFlipTracker } from "./flip";
import { CRASH_FRAMES, POPUP_FRAMES, POPUP_MS, fadeFrames, play } from "./motion";
import { crashPopup, landingPopup, type Popup } from "./popups";
import styles from "./JuiceHud.module.css";

/** On screen at once; a new popup retires the oldest (a crash right after a trick, say) */
const MAX_POPUPS = 2;
/**
 * Seconds on the ground before the next takeoff starts a fresh trick. A wheel clipping a ramp lip
 * mid-flip touches down for a frame or two; that must not wipe the rotation so far.
 */
const REARM_GROUNDED = 0.3;

/**
 * Arcade popups: BIG AIR, flips and barrel rolls, NICE LANDING, CRASH!. Rotation is tracked in a
 * rAF loop (no React state); popups are plain DOM nodes animated with WAAPI and removed when done.
 * Purely decorative (aria-hidden): the car's moves aren't information a screen reader user needs.
 */
export default function TrickPopups() {
  const layerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const tracker = createFlipTracker();
    let airborne = false;
    let groundedFor = Infinity;
    let consumed = true;
    let lastCrashAt = -Infinity;
    let last = performance.now();
    let raf = 0;

    const show = (popup: Popup) => {
      while (layer.childElementCount >= MAX_POPUPS) layer.firstElementChild?.remove();
      const el = document.createElement("div");
      el.className = styles.popup;
      el.dataset.tone = popup.tone;
      const title = document.createElement("span");
      title.className = styles.popupTitle;
      title.textContent = popup.title;
      el.append(title);
      if (popup.detail) {
        const detail = document.createElement("span");
        detail.className = styles.popupDetail;
        detail.textContent = popup.detail;
        el.append(detail);
      }
      layer.append(el);
      const frames = reducedRef.current ? fadeFrames() : popup.tone === "crash" ? CRASH_FRAMES : POPUP_FRAMES;
      void play(el, frames, POPUP_MS).then(() => el.remove());
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = vehicleState;
      if (s.bodyHandle < 0) return;
      // wheelsInContact (not `grounded`, which has a grace period) so the first frames of a jump count.
      if (s.wheelsInContact === 0) {
        if (!airborne) {
          airborne = true;
          if (consumed || groundedFor > REARM_GROUNDED) tracker.begin(s.quaternion, s.up);
          consumed = false;
        } else {
          tracker.step(s.quaternion, s.up);
        }
        groundedFor = 0;
      } else {
        airborne = false;
        groundedFor += dt;
      }
    };
    raf = requestAnimationFrame(frame);

    const off = onGameEvent((e) => {
      if (e.type === "landing") {
        const tricks = countTricks(tracker.totals);
        consumed = true;
        tracker.clear();
        const popup = landingPopup(
          { airTime: e.airTime, strength: e.strength, upright: vehicleState.chassisUp.dot(vehicleState.up) },
          tricks,
        );
        if (popup) show(popup);
      } else if (e.type === "crash") {
        const now = performance.now() / 1000;
        const popup = crashPopup(e.strength, now - lastCrashAt);
        if (popup) {
          lastCrashAt = now;
          show(popup);
        }
      } else if (e.type === "reset" || e.type === "teleport") {
        // The car was moved by hand: whatever rotation happened isn't a trick.
        tracker.clear();
        consumed = true;
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      off();
      layer.replaceChildren();
    };
  }, []);

  return <div ref={layerRef} className={styles.popups} aria-hidden="true" />;
}
