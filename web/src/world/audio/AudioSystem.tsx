"use client";

import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { Control } from "@/world/controls";
import { AudioDirector } from "./audioDirector";

/**
 * All game audio, synthesised with Web Audio (no files). Mounted once inside the <Canvas> (inside
 * <KeyboardControls>). Nothing is created until the first user gesture; see audioRuntime.ts.
 * The logic lives in AudioDirector; this only connects it to React's lifecycle, the frame loop and H.
 */
export function AudioSystem() {
  const [director] = useState(() => new AudioDirector());
  const [subscribeKeys] = useKeyboardControls<Control>();

  useEffect(() => {
    director.mount();
    return () => director.dispose();
  }, [director]);

  useEffect(
    () =>
      subscribeKeys(
        (s) => s.horn,
        (pressed) => director.hornKey(pressed),
      ),
    [director, subscribeKeys],
  );

  // Same dt clamp as the FX systems: the backfire detector must see identical inputs on both sides
  useFrame((_, rawDt) => director.frame(Math.min(rawDt, 0.1)));

  return null;
}
