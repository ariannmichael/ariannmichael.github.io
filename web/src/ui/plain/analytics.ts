// GoatCounter is loaded from the root layout (next/script, afterInteractive).
// It may be missing (blocked, not loaded yet, SSR), so every call is a safe no-op then.

interface GoatCounterCountVars {
  path: string;
  title?: string;
  event?: boolean;
}

declare global {
  interface Window {
    goatcounter?: { count?: (vars: GoatCounterCountVars) => void };
  }
}

/** Record a custom event, e.g. trackEvent("cv-download"). */
export function trackEvent(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.goatcounter?.count?.({ path: name, title: name, event: true });
  } catch {
    // Analytics must never break the UI.
  }
}
