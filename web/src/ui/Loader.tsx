"use client";

// Progress comes from the world's spawn-biome status (a tiny zustand store, no three.js/drei), not
// drei's global loading manager: that one also counts background downloads of the far side of the
// planet, which would keep the bar up long after the car can drive.
import { useEffect, useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import { spawnProgress, useSpawnLoad } from "@/world/town/loadStatus";
import styles from "./Loader.module.css";

// If the world hasn't started loading after this long, assume it has nothing to track.
const IDLE_GRACE_MS = 6000;
// Never keep the bar up forever (e.g. a lost WebGL context): the HTML around it works regardless.
const MAX_WAIT_MS = 45000;

/**
 * Small, non-blocking loading bar: a toy car driving along a road. Sits at the bottom, ignores
 * pointer events, and fades out at 100%. The server-rendered name and CV stay usable meanwhile.
 */
export default function Loader() {
  const progress = useSpawnLoad(spawnProgress);
  const ready = useSpawnLoad((s) => s.ready);
  const started = useSpawnLoad((s) => s.biome !== "");
  const mode = useAppStore((s) => s.mode);
  const [graceOver, setGraceOver] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const grace = window.setTimeout(() => setGraceOver(true), IDLE_GRACE_MS);
    const max = window.setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => {
      window.clearTimeout(grace);
      window.clearTimeout(max);
    };
  }, []);

  // Up until the spawn biome is downloaded, instanced and has its shaders compiled
  const finished = ready || (graceOver && !started) || timedOut || mode !== "intro";
  const pct = finished ? 100 : Math.max(0, Math.min(100, Math.round(progress)));

  if (gone) return null;

  return (
    <div
      className={styles.loader}
      data-done={finished}
      onTransitionEnd={(e) => {
        if (finished && e.propertyName === "opacity") setGone(true);
      }}
    >
      <p className={styles.label}>{finished ? "Town ready!" : "Paving the roads…"}</p>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Loading the 3D town"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={styles.fill} style={{ width: `${pct}%` }} />
        <div className={styles.car} style={{ left: `${pct}%` }} aria-hidden="true">
          <svg viewBox="0 0 40 22" width="40" height="22">
            <rect x="4" y="7" width="32" height="10" rx="4" fill="var(--accent)" />
            <path d="M11 7l4-5h10l5 5z" fill="var(--accent)" />
            <path d="M15.5 6.5l2.5-3h6l3 3z" fill="#bfe3ff" />
            <circle cx="12" cy="17" r="4" fill="#222" />
            <circle cx="28" cy="17" r="4" fill="#222" />
            <circle cx="12" cy="17" r="1.6" fill="#ddd" />
            <circle cx="28" cy="17" r="1.6" fill="#ddd" />
          </svg>
        </div>
        <span className={styles.flag} aria-hidden="true">
          🏁
        </span>
      </div>
    </div>
  );
}
