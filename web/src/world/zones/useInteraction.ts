"use client";

import { useEffect } from "react";
import { useAppStore } from "@/state/useAppStore";
import { useInputStore } from "@/state/useInputStore";
import { GPS_KEYS, INTERACT_KEYS } from "@/world/controls";
import type { DistrictLayout } from "@/world/layout/types";
import { indexMarkers, interactAction, zoneKey } from "./markers";

/** Keys typed into the overlay (buttons, inputs, dialogs) must not drive the world. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return !!target.closest("input, textarea, select, button, a, [role='dialog'], [contenteditable='true']");
}

function downloadFile(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = url.slice(url.lastIndexOf("/") + 1);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Interact (E / Enter / on-screen button): open the active zone's card, or download the CV for a
 * `cv` marker. GPS (M / G): toggle the GPS menu.
 */
export function useInteraction(layouts: readonly DistrictLayout[]): void {
  useEffect(() => {
    const markers = indexMarkers(layouts);

    const interact = () => {
      const { mode, gpsOpen, activeZone, openCard } = useAppStore.getState();
      if (mode === "card" || gpsOpen || !activeZone) return;
      const marker = markers.get(zoneKey(activeZone.district, activeZone.id));
      const action = interactAction(marker ?? { id: activeZone.id, kind: "job" });
      if (action.type === "download") downloadFile(action.url);
      else openCard(action.id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (INTERACT_KEYS.has(e.code)) {
        interact();
      } else if (GPS_KEYS.has(e.code)) {
        const { mode, gpsOpen, setGpsOpen } = useAppStore.getState();
        if (mode !== "card") setGpsOpen(!gpsOpen);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const unsubInput = useInputStore.subscribe((s, prev) => {
      if (s.interactNonce !== prev.interactNonce) interact();
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubInput();
    };
  }, [layouts]);
}
