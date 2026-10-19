"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query. Returns `false` on the server and during hydration so the
 * server HTML always matches, then updates to the real value on the client.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export const useIsCoarsePointer = () => useMediaQuery("(pointer: coarse)");
export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/**
 * Current time in epoch ms at one-second granularity, ticking every second. `null` on the server,
 * so time-dependent UI never causes a hydration mismatch.
 */
export function useNowSeconds(): number | null {
  return useSyncExternalStore(subscribeSeconds, nowSeconds, () => null);
}

function subscribeSeconds(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}

// Snapshot must be stable between calls within the same tick, so floor to the second.
function nowSeconds() {
  return Math.floor(Date.now() / 1000) * 1000;
}

let webgl2Cache: boolean | undefined;

/** Whether this browser can create a WebGL2 context. Cached: creating contexts is expensive. */
export function detectWebGL2(): boolean {
  if (webgl2Cache !== undefined) return webgl2Cache;
  // Feature check only. Creating a throwaway WebGL2 context here cost a multi-second long task on
  // slow GPUs/software GL during hydration; if the real context still fails, the error boundary
  // around the world (Overlay) shows the no-WebGL fallback.
  webgl2Cache = typeof window !== "undefined" && typeof window.WebGL2RenderingContext !== "undefined";
  return webgl2Cache;
}

const noopSubscribe = () => () => {};

/** `null` on the server / during hydration, then true or false. */
export function useWebGL2(): boolean | null {
  return useSyncExternalStore(noopSubscribe, detectWebGL2, () => null);
}
