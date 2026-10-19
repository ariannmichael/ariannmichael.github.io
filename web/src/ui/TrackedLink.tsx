"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackEvent } from "@/ui/plain/analytics";

/** Events the overlay records (GoatCounter custom events). */
export type UiEvent = "cv_download" | "steam_click" | "itch_play" | "plain_view";

/**
 * A plain <a> that also records an analytics event. It still server-renders as a normal link,
 * so it works (and is crawlable) before JS loads; tracking just kicks in after hydration.
 */
export default function TrackedLink({
  event,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { event: UiEvent }) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        trackEvent(event);
        onClick?.(e);
      }}
    />
  );
}
