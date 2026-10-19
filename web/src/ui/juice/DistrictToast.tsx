"use client";

import { useEffect, useRef, useState } from "react";
import { districts } from "@/content";
import { useAppStore } from "@/state/useAppStore";
import { usePrefersReducedMotion } from "@/ui/lib/hooks";
import { describeDiscovery, newlyDiscovered, type Discovery } from "./discovery";
import { STAMP_FRAMES, STAMP_MS, fadeFrames, play } from "./motion";
import styles from "./JuiceHud.module.css";

const NAMES = new Map(districts.map((d) => [d.id, d.name]));

/**
 * "DISTRICT DISCOVERED · Downtown Plateau · 3/7": a rubber stamp the first time the car enters each
 * career district. Driven by the store's visitedDistricts (written by DistrictTracker), so it costs
 * nothing per frame. The live region stays mounted so screen readers announce each new stamp.
 */
export default function DistrictToast() {
  const [discovery, setDiscovery] = useState<(Discovery & { key: number }) | null>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    let key = 0;
    return useAppStore.subscribe((state, prev) => {
      if (state.visitedDistricts === prev.visitedDistricts) return;
      const id = newlyDiscovered(prev.visitedDistricts, state.visitedDistricts);
      if (!id) return;
      key += 1;
      setDiscovery({
        ...describeDiscovery(id, NAMES.get(id) ?? id, state.visitedDistricts.length, districts.length),
        key,
      });
    });
  }, []);

  // Animate each new stamp, then clear it (unless a newer one replaced it meanwhile).
  useEffect(() => {
    const el = stampRef.current;
    if (!discovery || !el) return;
    let cancelled = false;
    const frames = reducedRef.current ? fadeFrames(0.08, 0.85) : STAMP_FRAMES;
    void play(el, frames, STAMP_MS).then(() => {
      if (!cancelled) setDiscovery((d) => (d?.key === discovery.key ? null : d));
    });
    return () => {
      cancelled = true;
    };
  }, [discovery]);

  return (
    <div className={styles.toastRegion} role="status" aria-live="polite">
      {discovery && (
        <div key={discovery.key} ref={stampRef} className={styles.stamp} data-complete={discovery.complete}>
          <span className="sr-only">{discovery.announcement}</span>
          <span className={styles.stampKicker} aria-hidden="true">
            {discovery.complete ? "All districts found!" : "District discovered"}
          </span>
          <span className={styles.stampName} aria-hidden="true">
            {discovery.name}
          </span>
          <span className={styles.stampProgress} aria-hidden="true">
            {discovery.progress}
          </span>
        </div>
      )}
    </div>
  );
}
