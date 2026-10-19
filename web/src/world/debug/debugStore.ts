"use client";

import { create } from "zustand";

/** Dev-only toggles (written by the leva panel in DebugControls, read by Experience). */
export const useDebugStore = create<{ physics: boolean; setPhysics: (on: boolean) => void }>()((set) => ({
  physics: false,
  setPhysics: (physics) => set({ physics }),
}));
