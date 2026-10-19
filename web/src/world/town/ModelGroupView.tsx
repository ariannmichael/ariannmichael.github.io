"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Euler,
  type Group,
  Matrix4,
  MeshStandardMaterial,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { KitInfo, ModelInfo } from "@/world/models/types";
import { isGroundRef, localColliderBox, resolveCollider } from "@/world/lib/placement";
import { placementPose, planetPlacementMatrix } from "@/world/lib/planetPlacement";
import { lookupKit, lookupModel, warnOnce } from "@/world/lib/models";
import type { ModelGroup, PlacedItem } from "./group";
import { cvBillboardMaterial, flatMaterial, paletteMaterial } from "./materials";
import { extractPrimitives, type Primitive } from "./primitives";

/**
 * Renders every placement of one model: static ones instanced, dynamic ones as rigid bodies.
 * `onReady(ref)` fires once the group is on screen (shaders compiled), or shows a placeholder.
 */
export function ModelGroupView({ group, onReady }: { group: ModelGroup; onReady?: OnReady }) {
  const info = lookupModel(group.ref);
  if (!info) {
    warnOnce(group.ref, `model "${group.ref}" is not in the manifest; rendering a placeholder`);
    return <Placeholders items={[...group.statics, ...group.dynamics]} onMount={() => onReady?.(group.ref)} />;
  }
  const kit = lookupKit(info.kit);
  if (!kit) warnOnce(`kit:${info.kit}`, `kit "${info.kit}" is not in the manifest; using scale 1`);
  return kit?.texture ? (
    <TexturedModel group={group} info={info} kit={kit} texture={kit.texture} onReady={onReady} />
  ) : (
    <FlatModel group={group} info={info} kit={kit} onReady={onReady} />
  );
}

type OnReady = (ref: string) => void;

interface ModelProps {
  group: ModelGroup;
  info: ModelInfo;
  kit: KitInfo | undefined;
  onReady?: OnReady;
}

function TexturedModel({ group, info, kit, texture, onReady }: ModelProps & { texture: string }) {
  const gltf = useGLTF(info.url, false);
  const map = useLoader(TextureLoader, texture);
  const resolve = useMemo<ResolveMaterial>(() => {
    const palette = paletteMaterial(texture, map);
    // Primitives without UVs can't sample the palette: keep their own flat colour
    return (material, geometry) => (geometry.attributes.uv ? palette : flatMaterial(info.kit, material));
  }, [map, texture, info.kit]);
  return (
    <ModelBody group={group} info={info} kitScale={kit?.scale ?? 1} gltf={gltf} resolve={resolve} onReady={onReady} />
  );
}

function FlatModel({ group, info, kit, onReady }: ModelProps) {
  const gltf = useGLTF(info.url, false);
  const resolve = useMemo<ResolveMaterial>(() => {
    // The home billboard's Tankco ad becomes the CV banner; the raceway's billboards are different
    // models, so they keep their own ads
    if (group.ref === "racing-kit/billboard") {
      return (material) => (material.name === "tankco" ? cvBillboardMaterial() : flatMaterial(info.kit, material));
    }
    return (material: Material) => flatMaterial(info.kit, material);
  }, [info.kit, group.ref]);
  return (
    <ModelBody group={group} info={info} kitScale={kit?.scale ?? 1} gltf={gltf} resolve={resolve} onReady={onReady} />
  );
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
  onReady,
}: {
  group: ModelGroup;
  info: ModelInfo;
  kitScale: number;
  gltf: GLTF;
  resolve: ResolveMaterial;
  onReady?: OnReady;
}) {
  const root = useRef<Group>(null);
  const warm = useWarmShaders(root, () => onReady?.(group.ref));
  const prims = useMemo(
    () => extractPrimitives(gltf.scene).map((p) => ({ ...p, material: resolve(p.material, p.geometry) })),
    [gltf.scene, resolve],
  );
  const skinned = useMemo(() => hasSkinnedMesh(gltf.scene), [gltf.scene]);
  // Flat ground pieces don't cast shadows (saves shadow-map draw calls and avoids acne on roads)
  const casts = !isGroundRef(group.ref) && resolveCollider({ model: group.ref }, info) === "box";
  // Surface poses sample the terrain: compute each placement's matrix once, share it across primitives
  const itemMatrices = useMemo(
    () => group.statics.map((it) => planetPlacementMatrix(it.placement, kitScale)),
    [group.statics, kitScale],
  );
  if (skinned) {
    // Skinned characters can't share an InstancedMesh: each placement gets its own skeleton clone
    return (
      <group ref={root} visible={warm}>
        {[...group.statics, ...group.dynamics].map((item, i) => (
          <SkinnedClone key={i} item={item} gltf={gltf} kitScale={kitScale} resolve={resolve} />
        ))}
      </group>
    );
  }
  // Hidden until its shaders are compiled (see useWarmShaders): the group's colliders don't depend on it
  return (
    <group ref={root} visible={warm}>
      {group.statics.length > 0 &&
        prims.map((prim, i) => (
          <InstancedPrimitive
            key={`${i}-${group.statics.length}`}
            prim={prim}
            itemMatrices={itemMatrices}
            castShadow={casts}
          />
        ))}
      {group.dynamics.map((item, i) => (
        <DynamicProp key={i} item={item} info={info} kitScale={kitScale} prims={prims} />
      ))}
    </group>
  );
}

/**
 * Compile the subtree's materials before it is ever drawn. `compileAsync` uses KHR_parallel_shader_compile
 * where available, so a new shader variant compiles off the main thread instead of stalling the first
 * frame that draws it (the biggest load-time spike after context creation). Materials are shared, so
 * after the first few groups this resolves immediately. Returns whether the subtree may be shown.
 */
function useWarmShaders(root: { current: Object3D | null }, onWarm: () => void): boolean {
  const get = useThree((s) => s.get);
  const [warm, setWarm] = useState(false);
  const onWarmRef = useRef(onWarm);
  useLayoutEffect(() => {
    onWarmRef.current = onWarm;
  });
  useLayoutEffect(() => {
    const obj = root.current;
    if (!obj) return;
    let live = true;
    const { gl, camera, scene } = get();
    // compile() gathers materials with traverse() (invisible objects included) and lights from `scene`.
    // Programs also depend on whether a render target is bound (output colour space, tone mapping):
    // the real frame draws straight to the canvas, so compile with no target bound.
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(null);
    let compiling: Promise<unknown>;
    try {
      compiling = gl.compileAsync(obj, camera, scene);
    } catch {
      compiling = Promise.resolve();
    } finally {
      gl.setRenderTarget(prevTarget);
    }
    compiling
      .catch(() => {})
      .then(() => {
        if (!live) return;
        setWarm(true);
        onWarmRef.current();
      });
    return () => {
      live = false;
    };
  }, [get, root]);
  return warm;
}

function InstancedPrimitive({
  prim,
  itemMatrices,
  castShadow,
}: {
  prim: Primitive;
  itemMatrices: Matrix4[];
  castShadow: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    itemMatrices.forEach((placed, i) => {
      // instance = placement transform (surface pose x scale) * node transform inside the model
      mesh.setMatrixAt(i, m.multiplyMatrices(placed, prim.matrix));
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Bounds over all instances so frustum culling works for the whole batch
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [itemMatrices, prim]);
  return (
    <instancedMesh
      ref={ref}
      args={[prim.geometry, prim.material, itemMatrices.length]}
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
  const { placement } = item;
  const s = placement.scale ?? 1;
  const pose = placementPose(placement);
  // Spawn a hair above the ground so the prop settles under PlanetGravity instead of starting in contact
  const { position, rotation } = useMemo(() => {
    const up = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion);
    const p = pose.position.clone().addScaledVector(up, DYNAMIC_DROP);
    const e = new Euler().setFromQuaternion(pose.quaternion);
    return {
      position: [p.x, p.y, p.z] as [number, number, number],
      rotation: [e.x, e.y, e.z] as [number, number, number],
    };
  }, [pose]);
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
      rotation={rotation}
      canSleep
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

/** Default animation for skinned characters (Kenney mini-characters ship "idle"); placement.anim overrides. */
const CHARACTER_CLIP = "idle";
/** Metres a dynamic prop starts above its resting point */
const DYNAMIC_DROP = 0.05;

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
    planetPlacementMatrix(item.placement, kitScale, clone.matrix);
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
    return clone;
  }, [gltf.scene, item, kitScale, resolve]);

  const mixer = useMemo(() => new AnimationMixer(object), [object]);
  const clipName = item.placement.anim ?? CHARACTER_CLIP;
  useEffect(() => {
    const clip = AnimationClip.findByName(gltf.animations, clipName);
    if (!clip) return;
    const action = mixer.clipAction(clip).play();
    // Random phase so a crowd doesn't move in lockstep
    action.time = Math.random() * clip.duration;
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, gltf.animations, clipName]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));

  return <primitive object={object} />;
}

const ONE = new Vector3(1, 1, 1);
const placeholderGeometry = new BoxGeometry(2, 2, 2).translate(0, 1, 0);
const placeholderMaterial: Material = new MeshStandardMaterial({ color: "#ff3fa4", roughness: 1 });

/** Magenta boxes where a model is missing, so authoring mistakes are obvious but harmless. */
export function Placeholders({ items, onMount }: { items: PlacedItem[]; onMount?: () => void }) {
  const ref = useRef<InstancedMesh>(null);
  const onMountRef = useRef(onMount);
  useEffect(() => {
    onMountRef.current?.();
  }, []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    items.forEach((it, i) => {
      const pose = placementPose(it.placement);
      mesh.setMatrixAt(i, m.compose(pose.position, pose.quaternion, ONE));
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
