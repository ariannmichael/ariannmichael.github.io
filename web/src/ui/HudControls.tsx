"use client";

import { useAppStore } from "@/state/useAppStore";
import { useWebGL2 } from "@/ui/lib/hooks";
import styles from "./AppShell.module.css";

/**
 * Top-right game buttons (GPS, sound, PSX look, quality). They only make sense with the 3D town running,
 * so they're hidden when WebGL2 isn't available. The Plain view link next to them is server-rendered.
 */
export default function HudControls() {
  const webgl = useWebGL2();
  const muted = useAppStore((s) => s.muted);
  const toggleMuted = useAppStore((s) => s.toggleMuted);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const psx = useAppStore((s) => s.psx);
  const setPsx = useAppStore((s) => s.setPsx);
  const gpsOpen = useAppStore((s) => s.gpsOpen);
  const setGpsOpen = useAppStore((s) => s.setGpsOpen);

  if (webgl === false) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.hudBtn} ${styles.gpsBtn}`}
        onClick={() => setGpsOpen(!gpsOpen)}
        aria-haspopup="dialog"
        aria-expanded={gpsOpen}
        title="Map (M)"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"
            fill="currentColor"
          />
          <circle cx="12" cy="10" r="2.4" fill="var(--accent-text)" />
        </svg>
        <span>GPS</span>
      </button>
      <button
        type="button"
        className={styles.hudBtn}
        onClick={toggleMuted}
        aria-pressed={!muted}
        aria-label="Sound"
        title={muted ? "Sound off" : "Sound on"}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? (
            <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          ) : (
            <path
              d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      {/* PSX look on/off. The visible text is the name ("PSX" / "Smooth"), so no aria-label that
          could disagree with it (WCAG 2.5.3); aria-pressed says whether the retro look is on. */}
      <button
        type="button"
        className={styles.hudBtn}
        onClick={() => setPsx(!psx)}
        aria-pressed={psx}
        title={psx ? "PlayStation-style graphics (tap for smooth)" : "Smooth graphics (tap for PlayStation style)"}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          {psx ? (
            // Chunky pixels
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor" />
          ) : (
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          )}
        </svg>
        <span className={styles.hudBtnText}>{psx ? "PSX" : "Smooth"}</span>
      </button>
      {/* Accessible name = "Graphics quality: HQ|Lite": it contains the visible text, as WCAG 2.5.3 asks */}
      <button
        type="button"
        className={styles.hudBtn}
        onClick={() => setQuality(quality === "high" ? "low" : "high")}
        title={quality === "high" ? "High quality (tap for faster)" : "Low quality (tap for prettier)"}
      >
        <span className="sr-only">Graphics quality: </span>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 3l2.2 5.2L20 9l-4.4 3.8L17 19l-5-3-5 3 1.4-6.2L4 9l5.8-.8z"
            fill={quality === "high" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.hudBtnText}>{quality === "high" ? "HQ" : "Lite"}</span>
      </button>
    </>
  );
}
