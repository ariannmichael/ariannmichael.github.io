"use client";

import { create } from "zustand";

// Touch/on-screen input written by the UI (joystick, buttons) and read by the vehicle every frame.
// Keyboard input is handled inside the world with drei's KeyboardControls.
export interface InputState {
  /** -1..1, right is positive */
  steer: number;
  /** -1..1, forward is positive */
  throttle: number;
  brake: boolean;
  /** Incremented on each tap of the on-screen interact button */
  interactNonce: number;
  /** Incremented on each tap of the on-screen reset button */
  resetNonce: number;

  setAxes: (steer: number, throttle: number) => void;
  setBrake: (brake: boolean) => void;
  pressInteract: () => void;
  pressReset: () => void;
}

export const useInputStore = create<InputState>()((set) => ({
  steer: 0,
  throttle: 0,
  brake: false,
  interactNonce: 0,
  resetNonce: 0,

  setAxes: (steer, throttle) => set({ steer, throttle }),
  setBrake: (brake) => set({ brake }),
  pressInteract: () => set((s) => ({ interactNonce: s.interactNonce + 1 })),
  pressReset: () => set((s) => ({ resetNonce: s.resetNonce + 1 })),
}));
