"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAppStore } from "@/state/useAppStore";
import { resolveCard } from "./cards/resolveCard";

/**
 * Opens a card from `?job=<id>` once on load. Must be rendered inside <Suspense>: with a static
 * export, useSearchParams makes everything up to the nearest boundary client-rendered.
 */
export default function CardDeepLink() {
  const params = useSearchParams();
  const id = params.get("job");
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !id) return;
    done.current = true;
    if (resolveCard(id)) useAppStore.getState().openCard(id);
  }, [id]);

  return null;
}
