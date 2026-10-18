"use client";

import { create } from "zustand";
import type { DistrictId } from "@/content/types";

export type AppMode = "intro" | "drive" | "card";
export type Quality = "high" | "low";

/** What the vehicle is currently parked next to (a layout marker). */
export interface ActiveZone {
  /** Content id: a job id, game id, or one of "about" | "contact" | "cv" */
  id: string;
  district: DistrictId;
}

export interface AppState {
  mode: AppMode;
  quality: Quality;
  /** PSX (PS1) visual style: low-res, vertex snapping, dithering. On by default; off = smooth rendering */
  psx: boolean;
  muted: boolean;
  activeZone: ActiveZone | null;
  /** Content id of the open info card */
  openCardId: string | null;
  gpsOpen: boolean;
  /** District the vehicle should (re)spawn at. Bumping `teleportNonce` triggers a teleport. */
  spawnDistrict: DistrictId;
  teleportNonce: number;
  visitedDistricts: DistrictId[];

  setMode: (mode: AppMode) => void;
  setQuality: (quality: Quality) => void;
  setPsx: (psx: boolean) => void;
  toggleMuted: () => void;
  setActiveZone: (zone: ActiveZone | null) => void;
  openCard: (id: string) => void;
  closeCard: () => void;
  setGpsOpen: (open: boolean) => void;
  teleportTo: (district: DistrictId) => void;
  markVisited: (district: DistrictId) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  mode: "intro",
  quality: "high",
  psx: true,
  muted: true,
  activeZone: null,
  openCardId: null,
  gpsOpen: false,
  spawnDistrict: "home",
  teleportNonce: 0,
  visitedDistricts: [],

  setMode: (mode) => set({ mode }),
  setQuality: (quality) => set({ quality }),
  setPsx: (psx) => set({ psx }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setActiveZone: (activeZone) => set({ activeZone }),
  openCard: (id) => set({ openCardId: id, mode: "card" }),
  closeCard: () => set({ openCardId: null, mode: "drive" }),
  setGpsOpen: (gpsOpen) => set({ gpsOpen }),
  teleportTo: (district) =>
    set((s) => ({ spawnDistrict: district, teleportNonce: s.teleportNonce + 1, gpsOpen: false })),
  markVisited: (district) =>
    set((s) =>
      s.visitedDistricts.includes(district)
        ? s
        : { visitedDistricts: [...s.visitedDistricts, district] },
    ),
}));
