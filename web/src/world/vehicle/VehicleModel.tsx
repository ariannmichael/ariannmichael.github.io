"use client";

import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { TextureLoader, type Material, type Mesh, type Object3D } from "three";
import { warnOnce } from "@/world/lib/models";
import { flatMaterial, paletteMaterial } from "@/world/town/materials";
import { SEDAN_NODES } from "./constants";

/** Animated nodes of the car, filled in once the model is mounted. */
export interface SedanNodes {
  body: Object3D | null;
  /** Base local Y of the body node, so the bounce is an offset from it */
  bodyBaseY: number;
  wheelsFront: Object3D[];
  wheelsBack: Object3D[];
}

export function emptySedanNodes(): SedanNodes {
  return { body: null, bodyBaseY: 0, wheelsFront: [], wheelsBack: [] };
}

interface Props {
  url: string;
  kit: string;
  texture: string | null;
  /** Called with the animated nodes once mounted (and with empty nodes on unmount) */
  onNodes: (nodes: SedanNodes) => void;
}

export function SedanModel(props: Props) {
  return props.texture ? <TexturedSedan {...props} texture={props.texture} /> : <Sedan {...props} material={null} />;
}

function TexturedSedan(props: Props & { texture: string }) {
  const map = useLoader(TextureLoader, props.texture);
  return <Sedan {...props} material={paletteMaterial(props.texture, map)} />;
}

function Sedan({ url, kit, onNodes, material }: Props & { material: Material | null }) {
  const { scene } = useGLTF(url, false);
  // Own copy: we rotate wheel nodes every frame and must not disturb the cached glTF scene
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

    const find = (name: string) => {
      const node = model.getObjectByName(name) ?? null;
      if (!node) warnOnce(`sedan:${name}`, `sedan node "${name}" not found; that part won't animate`);
      return node;
    };
    const body = find(SEDAN_NODES.body);
    const wheels = [SEDAN_NODES.wheelFL, SEDAN_NODES.wheelFR, SEDAN_NODES.wheelBL, SEDAN_NODES.wheelBR].map(find);
    for (const w of wheels) {
      // Steer (Y) is applied in the parent frame, spin (X) in the wheel's own frame: R = Ry * Rx
      if (w) w.rotation.order = "YXZ";
    }
    onNodes({
      body,
      bodyBaseY: body?.position.y ?? 0,
      wheelsFront: wheels.slice(0, 2).filter((w): w is Object3D => !!w),
      wheelsBack: wheels.slice(2).filter((w): w is Object3D => !!w),
    });
    return () => onNodes(emptySedanNodes());
  }, [model, material, kit, onNodes]);

  return <primitive object={model} />;
}

/** Stand-in car when the sedan model is missing: still drivable, obviously a placeholder. */
export function BoxCar() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.7, 3.6]} />
        <meshStandardMaterial color="#e8483b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, -0.3]} castShadow>
        <boxGeometry args={[1.5, 0.5, 1.8]} />
        <meshStandardMaterial color="#2b2d42" roughness={0.4} />
      </mesh>
    </group>
  );
}
