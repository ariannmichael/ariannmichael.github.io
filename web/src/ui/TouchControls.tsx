"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { useAppStore } from "@/state/useAppStore";
import { useInputStore } from "@/state/useInputStore";
import { joystickAxes } from "@/ui/lib/joystick";
import { useIsCoarsePointer } from "@/ui/lib/hooks";
import styles from "./TouchControls.module.css";

/** On-screen controls for touch devices. Writes useInputStore; the vehicle reads it every frame. */
export default function TouchControls() {
  const coarse = useIsCoarsePointer();
  const dialogOpen = useAppStore((s) => s.openCardId !== null || s.gpsOpen);
  if (!coarse || dialogOpen) return null;
  return <Controls />;
}

function Controls() {
  const setBrake = useInputStore((s) => s.setBrake);
  const pressInteract = useInputStore((s) => s.pressInteract);
  const pressReset = useInputStore((s) => s.pressReset);
  const hasZone = useAppStore((s) => s.activeZone !== null);

  // Release everything if the controls unmount mid-drive (card opened, rotated to desktop...).
  useEffect(
    () => () => {
      useInputStore.getState().setAxes(0, 0);
      useInputStore.getState().setBrake(false);
    },
    [],
  );

  // A finger can vanish without a pointerup (app switch, notification shade, tab hidden, an alert):
  // drop every held input so the car never keeps driving on its own.
  useEffect(() => {
    const letGo = () => {
      useInputStore.getState().setAxes(0, 0);
      useInputStore.getState().setBrake(false);
    };
    const onVisibility = () => {
      if (document.hidden) letGo();
    };
    window.addEventListener("blur", letGo);
    window.addEventListener("pagehide", letGo);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", letGo);
      window.removeEventListener("pagehide", letGo);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    // The long-press menu would otherwise pop up over a held button on Android
    <div className={styles.root} onContextMenu={(e) => e.preventDefault()}>
      <Joystick />
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.btn} ${styles.reset}`}
          aria-label="Reset car"
          onClick={pressReset}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.interact}`}
          data-ready={hasZone}
          aria-label="Interact"
          onClick={pressInteract}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V8.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.8-2.4L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.btnLabel}>Open</span>
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.brake}`}
          aria-label="Brake"
          // Hold to brake: release on up, cancel, or the finger sliding off.
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            markDriving();
            setBrake(true);
          }}
          onPointerUp={() => setBrake(false)}
          onPointerCancel={() => setBrake(false)}
          onLostPointerCapture={() => setBrake(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function markDriving() {
  // First touch input counts as "first input", like a key press does in the world.
  const app = useAppStore.getState();
  if (app.mode === "intro") app.setMode("drive");
}

function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0, radius: 1 });

  function update(clientX: number, clientY: number) {
    const c = center.current;
    const r = joystickAxes(clientX - c.x, clientY - c.y, c.radius);
    useInputStore.getState().setAxes(r.steer, r.throttle);
    // Move the knob directly (no React re-render per pointermove).
    if (knobRef.current) knobRef.current.style.transform = `translate(${r.knobX}px, ${r.knobY}px)`;
  }

  // Only touches refs and the store, so it is stable and safe to hand to window listeners.
  const release = useCallback(() => {
    pointerId.current = null;
    useInputStore.getState().setAxes(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "";
    baseRef.current?.removeAttribute("data-active");
  }, []);

  // The page lost the finger without telling us (blur, app switch): recentre the knob too.
  useEffect(() => {
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("pagehide", release);
    };
  }, [release]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== null) return;
    e.preventDefault();
    const base = baseRef.current;
    if (!base) return;
    pointerId.current = e.pointerId;
    base.setPointerCapture?.(e.pointerId);
    const rect = base.getBoundingClientRect();
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width / 2 };
    base.setAttribute("data-active", "true");
    markDriving();
    update(e.clientX, e.clientY);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    update(e.clientX, e.clientY);
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    release();
  }

  return (
    <div
      ref={baseRef}
      className={styles.stick}
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <div ref={knobRef} className={styles.knob} />
    </div>
  );
}
