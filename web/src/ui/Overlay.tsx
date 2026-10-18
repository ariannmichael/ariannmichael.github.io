"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { links } from "@/content";
import type { DistrictId } from "@/content/types";
import { useAppStore } from "@/state/useAppStore";
import WorldLoader from "@/world/WorldLoader";
import { onIdle } from "@/world/lib/idle";
import GpsMenu from "./GpsMenu";
import InfoCard from "./InfoCard";
import TouchControls from "./TouchControls";
import TrackedLink from "./TrackedLink";
import { cardTitle, resolveCard } from "./cards/resolveCard";
import { useIsCoarsePointer, usePrefersReducedMotion, useWebGL2 } from "./lib/hooks";
import styles from "./AppShell.module.css";
import local from "./Overlay.module.css";

// Client-only and code-split: the bar is useless before JS anyway, and this keeps three.js'
// loading manager out of the critical path of the server-rendered text.
const Loader = dynamic(() => import("./Loader"), { ssr: false });

/** The 3D canvas (or the no-WebGL fallback) plus every interactive overlay layer. */
export default function Overlay({ district }: { district: DistrictId }) {
  const detected = useWebGL2();
  // The probe can pass while the real context still fails (GPU blocklist, too many contexts, driver
  // reset): R3F rethrows that from <Canvas>, and we fall back exactly as if WebGL2 were missing.
  const [crashed, setCrashed] = useState(false);
  const webgl = crashed ? false : detected;
  // Creating the WebGL context is a long main-thread task; start it only after the server-rendered
  // overlay (name, CV, controls hint) has been painted, so it never delays first/LCP paint.
  const painted = useAfterPresentedPaint();

  return (
    <>
      {webgl === true && painted && (
        <div className={styles.world}>
          <WorldBoundary onError={() => setCrashed(true)}>
            <WorldLoader district={district} />
          </WorldBoundary>
        </div>
      )}
      {webgl === false && <NoWebGL />}
      {/* Server-rendered (webgl is null until hydration): the controls hint is real text the browser
          paints with the first frame instead of after the WebGL probe and 3D bundle kick in. */}
      {webgl !== false && <BottomStack />}
      {webgl === true && (
        <>
          <Loader />
          <InteractionPrompt />
          <TouchControls />
          <GpsMenu />
        </>
      )}
      {/* Cards are plain HTML, so deep links still work without WebGL. */}
      <InfoCard />
    </>
  );
}

/** Catches a failed WebGL context (or any crash inside the 3D world) and reports it once. */
class WorldBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[world] the 3D world failed to start; showing the fallback", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function NoWebGL() {
  return (
    <section className={styles.fallback} aria-labelledby="no-webgl-title">
      <p className={styles.fallbackIcon} aria-hidden="true">
        🚗💤
      </p>
      <h2 id="no-webgl-title" className={styles.fallbackTitle}>
        Your device can&apos;t run the 3D town
      </h2>
      <p className={styles.fallbackText}>
        No worries: everything in the town is also on a simple, fast page.
      </p>
      <div className={styles.fallbackActions}>
        <TrackedLink className={styles.bigLink} href="/plain/" event="plain_view">
          Open the Plain view
        </TrackedLink>
        <TrackedLink className={styles.secondaryLink} href={links.cv} download event="cv_download">
          Download CV
        </TrackedLink>
      </div>
    </section>
  );
}

/** Bottom-left stack: reduced-motion suggestion + the controls hint. */
function BottomStack() {
  const mode = useAppStore((s) => s.mode);
  const reducedMotion = usePrefersReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const hintHidden = mode !== "intro";

  return (
    <div className={styles.bottomStack}>
      {reducedMotion && !dismissed && (
        <div className={styles.notice} role="note">
          <span>Prefer less motion?</span>
          <TrackedLink href="/plain/" event="plain_view" className={styles.noticeLink}>
            Try the Plain view
          </TrackedLink>
          <button
            type="button"
            className={styles.noticeClose}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <div className={styles.hint} data-hidden={hintHidden} aria-hidden={hintHidden}>
        {/* Both variants are in the HTML and a CSS (pointer: coarse) query picks one, so the hint
            never swaps after hydration (it is often the page's largest text, i.e. its LCP). */}
        <p className={`${styles.hintLine} ${local.coarseOnly}`}>
          <strong>Drag the stick</strong> to drive · hold <strong>■</strong> to brake · tap <Key>E</Key> at a sign
        </p>
        <ul className={`${styles.hintList} ${local.fineOnly}`}>
          <li>
            <Key>W</Key>
            <Key>A</Key>
            <Key>S</Key>
            <Key>D</Key> / arrows drive
          </li>
          <li>
            <Key wide>Space</Key> brake
          </li>
          <li>
            <Key>E</Key> open
          </li>
          <li>
            <Key>R</Key> reset
          </li>
          <li>
            <Key>M</Key> map
          </li>
        </ul>
      </div>
    </div>
  );
}

function Key({ children, wide }: { children: string; wide?: boolean }) {
  return <kbd className={wide ? `${styles.key} ${styles.keyWide}` : styles.key}>{children}</kbd>;
}

/** "Press E to open · <title>" while parked at a marker. Clicking/tapping it opens the card too. */
function InteractionPrompt() {
  const zone = useAppStore((s) => s.activeZone);
  const cardOpen = useAppStore((s) => s.openCardId !== null);
  const openCard = useAppStore((s) => s.openCard);
  const coarse = useIsCoarsePointer();
  const card = zone ? resolveCard(zone.id) : undefined;

  return (
    // Live region stays mounted so screen readers announce new prompts.
    <div className={styles.promptRegion} aria-live="polite">
      {zone && card && !cardOpen && (
        <button type="button" className={styles.prompt} onClick={() => openCard(zone.id)}>
          {coarse ? (
            <span className={styles.promptAction}>Tap to open</span>
          ) : (
            <span className={styles.promptAction}>
              Press <kbd className={styles.key}>E</kbd> to open
            </span>
          )}
          <span className={styles.promptTitle}>{cardTitle(card)}</span>
        </button>
      )}
    </div>
  );
}

/** True once a frame has been presented (two rAFs) and the browser then went idle. */
function useAfterPresentedPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelIdle = () => {};
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        cancelIdle = onIdle(() => setReady(true), 500);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelIdle();
    };
  }, []);
  return ready;
}
