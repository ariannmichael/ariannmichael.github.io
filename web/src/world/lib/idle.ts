"use client";

import { useEffect, useState } from "react";

/** requestIdleCallback where available (not Safari), else a short timeout. Returns a cancel function. */
export function onIdle(cb: () => void, timeout = 400): () => void {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 16);
  return () => clearTimeout(id);
}

/**
 * False on the first render, true once the browser has painted a frame and then gone idle. Lets heavy
 * synchronous setup (the planet trimesh, the car) wait until the page and loader are on screen, so it
 * doesn't stretch the first long task during load.
 */
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelIdle = () => {};
    const raf = requestAnimationFrame(() => {
      cancelIdle = onIdle(() => setReady(true), 600);
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelIdle();
    };
  }, []);
  return ready;
}
