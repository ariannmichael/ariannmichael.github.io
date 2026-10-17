"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";
import type { DistrictId } from "@/content/types";

// Placeholder scene proving the stack works. The world-core agent replaces it.
function SpinningBox() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry />
      <meshStandardMaterial color="#f5a623" />
    </mesh>
  );
}

export default function Experience({ district }: { district: DistrictId }) {
  return (
    <Canvas camera={{ position: [3, 2, 3] }} data-district={district}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} />
      <SpinningBox />
      <OrbitControls />
    </Canvas>
  );
}
