"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3, type Mesh, type MeshBasicMaterial } from "three";
import { VEHICLE } from "@/world/vehicle/constants";
import { vehicleState } from "@/world/vehicle/vehicleState";

const _dir = new Vector3();

/** A black quad held just in front of the camera that fades out after a teleport/reset. */
export function TeleportFade() {
  const mesh = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const t = performance.now() / 1000 - vehicleState.teleportedAt;
    const alpha = 1 - t / VEHICLE.teleportFade;
    if (alpha <= 0) {
      m.visible = false;
      return;
    }
    m.visible = true;
    (m.material as MeshBasicMaterial).opacity = Math.min(1, alpha * 1.5);
    // Camera looks down its local -Z; use the quaternion (matrixWorld is only refreshed at render)
    _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    m.position.copy(camera.position).addScaledVector(_dir, 0.3);
    m.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} visible={false} renderOrder={1000} frustumCulled={false}>
      <planeGeometry args={[4, 4]} />
      <meshBasicMaterial color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} fog={false} />
    </mesh>
  );
}
