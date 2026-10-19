"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/state/useAppStore";
import { VEHICLE } from "@/world/vehicle/constants";
import { vehicleState } from "@/world/vehicle/vehicleState";
import {
  REVERSE_THRESHOLD,
  SPEED_SEGMENTS,
  litSegments,
  smoothToward,
  speedText,
  speedValue,
  toKmh,
} from "./speed";
import styles from "./JuiceHud.module.css";

const SEGMENT_KEYS = Array.from({ length: SPEED_SEGMENTS }, (_, i) => i);

/**
 * PSX-style speedometer (bottom right). React renders it once; a requestAnimationFrame loop then
 * reads vehicleState and writes text/attributes straight to the DOM, and only when a value actually
 * changes, so driving never re-renders React.
 */
export default function Speedometer() {
  // Only while driving: hidden on the intro (the controls hint owns the screen) and behind cards.
  const visible = useAppStore((s) => s.mode === "drive");
  const rootRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLSpanElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const gearRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const root = rootRef.current;
    const lead = leadRef.current;
    const digits = digitsRef.current;
    const gear = gearRef.current;
    const segments = barRef.current ? Array.from(barRef.current.children) : [];
    if (!root || !lead || !digits || !gear) return;

    // Last written values: skip DOM writes when nothing changed (most frames at cruise).
    let shownValue = -1;
    let shownLit = -1;
    let shownReverse: boolean | null = null;
    let smoothed = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (vehicleState.bodyHandle < 0) return; // car not spawned yet

      smoothed = smoothToward(smoothed, vehicleState.speed, dt);
      const value = speedValue(toKmh(smoothed));
      if (value !== shownValue) {
        shownValue = value;
        const text = speedText(value);
        lead.textContent = text.lead;
        digits.textContent = text.digits;
      }
      const lit = litSegments(smoothed, VEHICLE.maxSpeed);
      if (lit !== shownLit) {
        for (let i = 0; i < segments.length; i++) segments[i].toggleAttribute("data-on", i < lit);
        // Top speed: the readout glows (CSS), like hitting the limiter.
        root.toggleAttribute("data-redline", lit >= SPEED_SEGMENTS);
        shownLit = lit;
      }
      const reverse = vehicleState.forwardSpeed < REVERSE_THRESHOLD;
      if (reverse !== shownReverse) {
        shownReverse = reverse;
        gear.textContent = reverse ? "R" : "D";
        gear.toggleAttribute("data-reverse", reverse);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  return (
    // Decorative: a number that changes 60 times a second is noise to a screen reader.
    <div ref={rootRef} className={styles.speedo} data-visible={visible} aria-hidden="true">
      <div className={styles.speedoTop}>
        <span ref={gearRef} className={styles.gear}>
          D
        </span>
        <span className={styles.speedoNumber}>
          <span ref={leadRef} className={styles.speedoLead}>
            00
          </span>
          <span ref={digitsRef}>0</span>
        </span>
        <span className={styles.speedoUnit}>km/h</span>
      </div>
      <div ref={barRef} className={styles.speedoBar}>
        {SEGMENT_KEYS.map((i) => (
          <span key={i} className={styles.segment} />
        ))}
      </div>
    </div>
  );
}
