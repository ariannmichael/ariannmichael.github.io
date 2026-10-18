"use client";

import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { TextureLoader, type Material, type Mesh, type Object3D } from "three";
import { warnOnce } from "@/world/lib/models";
import { flatMaterial, paletteMaterial } from "@/world/town/materials";
import { VEHICLE_WHEEL_NODES } from "./constants";

/** Wheel nodes of the car model (controller order: FL, FR, BL, BR), filled in once mounted. */
export interface VehicleNodes {
  /** null where the node is missing; that wheel just doesn't animate */
  wheels: (Object3D | null)[];
}

export function emptyVehicleNodes(): VehicleNodes {
  return { wheels: [] };
}

interface Props {
  url: string;
  kit: string;
  texture: string | null;
  /** Called with the animated nodes once mounted (and with empty nodes on unmount) */
  onNodes: (nodes: VehicleNodes) => void;
}

/** A Kenney car-kit vehicle with its four road wheels exposed for animation. */
export function VehicleModel(props: Props) {
  return props.texture ? <TexturedVehicle {...props} texture={props.texture} /> : <Car {...props} material={null} />;
}

function TexturedVehicle(props: Props & { texture: string }) {
  const map = useLoader(TextureLoader, props.texture);
  return <Car {...props} material={paletteMaterial(props.texture, map)} />;
}

function Car({ url, kit, onNodes, material }: Props & { material: Material | null }) {
  const { scene } = useGLTF(url, false);
  // Own copy: we move and rotate wheel nodes every frame and must not disturb the cached glTF scene
  const model = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      mesh.material = material && mesh.geometry.attributes.uv ? material : flatMaterial(kit, own);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    const wheels = VEHICLE_WHEEL_NODES.map((name) => {
      const node = model.getObjectByName(name) ?? null;
      if (!node) warnOnce(`vehicle:${name}`, `vehicle node "${name}" not found; that wheel won't animate`);
      // Steer (Y) is applied in the parent frame, spin (X) in the wheel's own frame: R = Ry * Rx
      if (node) node.rotation.order = "YXZ";
      return node;
    });
    onNodes({ wheels });
    return () => onNodes(emptyVehicleNodes());
  }, [model, material, kit, onNodes]);

  return <primitive object={model} />;
}

/** Stand-in car when the model is missing: still drivable, obviously a placeholder. */
export function BoxCar() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[2.2, 0.9, 4.2]} />
        <meshStandardMaterial color="#e8483b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.6, -0.3]} castShadow>
        <boxGeometry args={[1.9, 0.6, 2.4]} />
        <meshStandardMaterial color="#2b2d42" roughness={0.4} />
      </mesh>
    </group>
  );
}
