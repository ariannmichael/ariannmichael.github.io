"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Matrix4,
  MeshStandardMaterial,
  TextureLoader,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { KitInfo, ModelInfo } from "@/world/models/types";
import { isGroundRef, localColliderBox, placementMatrix, placementPosition, resolveCollider, rotToYaw } from "@/world/lib/placement";
import { lookupKit, lookupModel, warnOnce } from "@/world/lib/models";
import type { ModelGroup, PlacedItem } from "./group";
import { flatMaterial, paletteMaterial } from "./materials";
import { extractPrimitives, type Primitive } from "./primitives";

/** Renders every placement of one model: static ones instanced, dynamic ones as rigid bodies. */
export function ModelGroupView({ group }: { group: ModelGroup }) {
  const info = lookupModel(group.ref);
  if (!info) {
    warnOnce(group.ref, `model "${group.ref}" is not in the manifest; rendering a placeholder`);
    return <Placeholders items={[...group.statics, ...group.dynamics]} />;
  }
  const kit = lookupKit(info.kit);
  if (!kit) warnOnce(`kit:${info.kit}`, `kit "${info.kit}" is not in the manifest; using scale 1`);
  return kit?.texture ? (
    <TexturedModel group={group} info={info} kit={kit} texture={kit.texture} />
  ) : (
    <FlatModel group={group} info={info} kit={kit} />
  );
}

interface ModelProps {
  group: ModelGroup;
  info: ModelInfo;
  kit: KitInfo | undefined;
}

function TexturedModel({ group, info, kit, texture }: ModelProps & { texture: string }) {
  const gltf = useGLTF(info.url, false);
  const map = useLoader(TextureLoader, texture);
  const resolve = useMemo<ResolveMaterial>(() => {
    const palette = paletteMaterial(texture, map);
    // Primitives without UVs can't sample the palette: keep their own flat colour
    return (material, geometry) => (geometry.attributes.uv ? palette : flatMaterial(info.kit, material));
  }, [map, texture, info.kit]);
  return <ModelBody group={group} info={info} kitScale={kit?.scale ?? 1} gltf={gltf} resolve={resolve} />;
}

function FlatModel({ group, info, kit }: ModelProps) {
  const gltf = useGLTF(info.url, false);
  const resolve = useMemo<ResolveMaterial>(() => (material) => flatMaterial(info.kit, material), [info.kit]);
  return <ModelBody group={group} info={info} kitScale={kit?.scale ?? 1} gltf={gltf} resolve={resolve} />;
}

/** The parts of a loaded glTF we use (drei and three ship slightly different GLTF typings) */
interface GLTF {
  scene: Object3D;
  animations: AnimationClip[];
}

type ResolveMaterial = (material: Material, geometry: BufferGeometry) => Material;

function ModelBody({
  group,
  info,
  kitScale,
  gltf,
  resolve,
}: {
  group: ModelGroup;
  info: ModelInfo;
  kitScale: number;
  gltf: GLTF;
  resolve: ResolveMaterial;
}) {
  const prims = useMemo(
    () => extractPrimitives(gltf.scene).map((p) => ({ ...p, material: resolve(p.material, p.geometry) })),
    [gltf.scene, resolve],
  );
  const skinned = useMemo(() => hasSkinnedMesh(gltf.scene), [gltf.scene]);
  // Flat ground pieces don't cast shadows (saves shadow-map draw calls and avoids acne on roads)
  const casts = !isGroundRef(group.ref) && resolveCollider({ model: group.ref, x: 0, z: 0 }, info) === "box";
  if (skinned) {
    // Skinned characters can't share an InstancedMesh: each placement gets its own skeleton clone
    return (
      <>
        {[...group.statics, ...group.dynamics].map((item, i) => (
          <SkinnedClone key={i} item={item} gltf={gltf} kitScale={kitScale} resolve={resolve} />
        ))}
      </>
    );
  }
  return (
    <>
      {group.statics.length > 0 &&
        prims.map((prim, i) => (
          <InstancedPrimitive
            key={`${i}-${group.statics.length}`}
            prim={prim}
            items={group.statics}
            kitScale={kitScale}
            castShadow={casts}
          />
        ))}
      {group.dynamics.map((item, i) => (
        <DynamicProp key={i} item={item} info={info} kitScale={kitScale} prims={prims} />
      ))}
    </>
  );
}

function InstancedPrimitive({
  prim,
  items,
  kitScale,
  castShadow,
}: {
  prim: Primitive;
  items: PlacedItem[];
  kitScale: number;
  castShadow: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    items.forEach((it, i) => {
      // instance = placement transform * node transform inside the model
      placementMatrix(it.origin, it.placement, kitScale, m).multiply(prim.matrix);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Bounds over all instances so frustum culling works for the whole batch
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [items, kitScale, prim]);
  return (
    <instancedMesh
      ref={ref}
      args={[prim.geometry, prim.material, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

/** A knockable prop (cone, debris): its own dynamic body with a box collider from the model bounds. */
function DynamicProp({
  item,
  info,
  kitScale,
  prims,
}: {
  item: PlacedItem;
  info: ModelInfo;
  kitScale: number;
  prims: Primitive[];
}) {
  const { placement, origin } = item;
  const s = placement.scale ?? 1;
  const position = placementPosition(origin, placement);
  const box = localColliderBox(info, s);
  const matrices = useMemo(() => {
    const scale = new Matrix4().makeScale(kitScale * s, kitScale * s, kitScale * s);
    return prims.map((p) => scale.clone().multiply(p.matrix));
  }, [prims, kitScale, s]);
  return (
    <RigidBody
      type="dynamic"
      colliders={false}
      position={position}
      rotation={[0, rotToYaw(placement.rot), 0]}
    >
      <CuboidCollider args={box.halfExtents} position={box.center} density={0.6} friction={0.8} />
      {prims.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geometry}
          material={p.material}
          matrix={matrices[i]}
          matrixAutoUpdate={false}
          castShadow
          receiveShadow
        />
      ))}
    </RigidBody>
  );
}

function hasSkinnedMesh(root: Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) found = true;
  });
  return found;
}

/** Animation played by skinned characters (Kenney mini-characters ship "idle"). */
const CHARACTER_CLIP = "idle";

function SkinnedClone({
  item,
  gltf,
  kitScale,
  resolve,
}: {
  item: PlacedItem;
  gltf: GLTF;
  kitScale: number;
  resolve: ResolveMaterial;
}) {
  const object = useMemo(() => {
    const clone = cloneSkinned(gltf.scene);
    clone.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const own = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      mesh.material = resolve(own, mesh.geometry);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    placementMatrix(item.origin, item.placement, kitScale, clone.matrix);
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
    return clone;
  }, [gltf.scene, item, kitScale, resolve]);

  const mixer = useMemo(() => new AnimationMixer(object), [object]);
  useEffect(() => {
    const clip = AnimationClip.findByName(gltf.animations, CHARACTER_CLIP);
    if (!clip) return;
    const action = mixer.clipAction(clip).play();
    // Random phase so a crowd doesn't move in lockstep
    action.time = Math.random() * clip.duration;
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, gltf.animations]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));

  return <primitive object={object} />;
}

const placeholderGeometry = new BoxGeometry(2, 2, 2).translate(0, 1, 0);
const placeholderMaterial: Material = new MeshStandardMaterial({ color: "#ff3fa4", roughness: 1 });

/** Magenta boxes where a model is missing, so authoring mistakes are obvious but harmless. */
export function Placeholders({ items }: { items: PlacedItem[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    items.forEach((it, i) => {
      const [x, y, z] = placementPosition(it.origin, it.placement);
      mesh.setMatrixAt(i, m.makeTranslation(x, y, z));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[placeholderGeometry, placeholderMaterial, items.length]}
      castShadow
      receiveShadow
    />
  );
}
