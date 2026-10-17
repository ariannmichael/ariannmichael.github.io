// Keyboard map for drei <KeyboardControls>. Driving keys only: interact (E/Enter) and GPS (M/G) are
// handled by InteractionController with a DOM listener so they can ignore keys typed into the overlay.
import type { KeyboardControlsEntry } from "@react-three/drei";

export type Control = "forward" | "back" | "left" | "right" | "brake" | "reset";

export const KEYMAP: KeyboardControlsEntry<Control>[] = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "back", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "brake", keys: ["Space"] },
  { name: "reset", keys: ["KeyR"] },
];

export const INTERACT_KEYS = new Set(["KeyE", "Enter", "NumpadEnter"]);
export const GPS_KEYS = new Set(["KeyM", "KeyG"]);
