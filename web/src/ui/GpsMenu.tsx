"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { districts } from "@/content";
import type { DistrictId } from "@/content/types";
import { useAppStore } from "@/state/useAppStore";
import { BIOMES } from "@/world/planet/biomes";
import Modal, { CloseButton } from "./Modal";
import TrackedLink from "./TrackedLink";
import { usePrefersReducedMotion } from "./lib/hooks";
import styles from "./GpsMenu.module.css";

/** The picked destination blinks this long before the jump (matches `.item[data-picked]` in the CSS) */
const PICK_FLASH_MS = 330;

/** Teleport menu. Opened by the HUD button or the M key (handled in the world). */
export default function GpsMenu() {
  const open = useAppStore((s) => s.gpsOpen);
  if (!open) return null;
  return <GpsDialog />;
}

function GpsDialog() {
  const headingId = useId();
  const setGpsOpen = useAppStore((s) => s.setGpsOpen);
  const teleportTo = useAppStore((s) => s.teleportTo);
  const visited = useAppStore((s) => s.visitedDistricts);
  const reducedMotion = usePrefersReducedMotion();
  // Destination being confirmed: it flashes, then we jump (straight away with reduced motion).
  const [picked, setPicked] = useState<DistrictId | null>(null);
  const close = () => setGpsOpen(false);

  useEffect(() => {
    if (!picked) return;
    const t = window.setTimeout(() => teleportTo(picked), PICK_FLASH_MS);
    // Closing (Esc, backdrop) during the flash cancels the jump.
    return () => window.clearTimeout(t);
  }, [picked, teleportTo]);

  function pick(id: DistrictId) {
    if (picked) return; // ignore double clicks while the first one flashes
    if (reducedMotion) teleportTo(id);
    else setPicked(id);
  }

  // Every career district is a biome on the planet now: all reachable, in content order.
  const themes = new Map(BIOMES.map((b) => [b.district, b.theme]));

  return (
    <Modal labelledBy={headingId} onClose={close} placement="center">
      <CloseButton onClick={close} label="Close map" />
      <div className={styles.body}>
        <header className={styles.header}>
          <p className={styles.kicker}>GPS</p>
          <h2 id={headingId} className={styles.title}>
            Where to?
          </h2>
        </header>
        <ul className={styles.list}>
          {districts.map((d, i) => {
            const wasVisited = visited.includes(d.id);
            const theme = themes.get(d.id);
            return (
              // --i staggers the entrance (CSS), so the list deals itself in after the panel pops
              <li key={d.id} className={styles.entry} style={{ "--i": i } as CSSProperties}>
                <button
                  type="button"
                  className={styles.item}
                  data-picked={picked === d.id || undefined}
                  onClick={() => pick(d.id)}
                  aria-describedby={`${headingId}-${d.id}`}
                >
                  <span className={styles.pin} aria-hidden="true">
                    📍
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>
                      {d.name}
                      {wasVisited && <span className={styles.visited}>✓ Visited</span>}
                    </span>
                    <span id={`${headingId}-${d.id}`} className={styles.blurb}>
                      {d.blurb}
                    </span>
                    {theme && <span className={styles.theme}>{theme}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <TrackedLink className={styles.plain} href="/plain/" event="plain_view">
          Prefer reading? Plain view (résumé) →
        </TrackedLink>
      </div>
    </Modal>
  );
}
