"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TextureLoader, Vector3, type Material, type Mesh, type Object3D } from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useAppStore } from "@/state/useAppStore";
import { onGameEvent } from "@/world/events/gameEvents";
import { BODY, createBodyMotion, kickSquash, resetBodyMotion, stepBodyMotion } from "@/world/fx/bodyMotion";
import { CarLights } from "@/world/fx/carLights";
import { warnOnce } from "@/world/lib/models";
import { flatMaterial, paletteMaterial } from "@/world/town/materials";
import { VEHICLE_WHEEL_NODES } from "./constants";
import { paintedCarMaterial } from "./paint";
import { vehicleState } from "./vehicleState";

/** The model node that holds the car body (wheels are its siblings), for visual-only lean/squash */
const BODY_NODE = "body";

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
  // The player's own copy of the palette with the body paint swatch repainted (vehicle/paint), so
  // other models of the kit keep the shared palette. Falls back to the shared one if it can't be built.
  const painted = useMemo(() => paintedCarMaterial(map), [map]);
  useEffect(
    () => () => {
      painted?.map?.dispose();
      painted?.dispose();
    },
    [painted],
  );
  return <Car {...props} material={painted ?? paletteMaterial(props.texture, map)} />;
}

function Car({ url, kit, onNodes, material }: Props & { material: Material | null }) {
  const { scene } = useGLTF(url, false);
  // Own copy: we move and rotate wheel nodes every frame and must not disturb the cached glTF scene
  const model = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    model.traverse((o) => {
      const mesh = o as Mesh;
      // Juice meshes (the lamps) parented under the body keep their own material
      if (!mesh.isMesh || mesh.userData.keepMaterial) return;
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

  useBodyJuice(model);

  return <primitive object={model} />;
}

/**
 * Visual-only juice on the "body" node: lean into turns, pitch under throttle/brake, squash on
 * landings (bodyMotion springs), plus the brake/reverse/head lamps (CarLights), which ride on the body.
 * The physics chassis and the wheel nodes are never touched. Reduced motion halves the lean and drops
 * the squash.
 */
function useBodyJuice(model: Object3D) {
  const reduced = usePrefersReducedMotion();
  const quality = useAppStore((s) => s.quality);
  const [lights] = useState(() => new CarLights());
  const [motion] = useState(createBodyMotion);
  const rig = useRef({
    body: null as Object3D | null,
    basePos: new Vector3(),
    baseRot: new Vector3(),
    baseScale: new Vector3(1, 1, 1),
    prevVel: new Vector3(),
    accel: new Vector3(),
    axis: new Vector3(),
    teleportSeen: -1,
  });

  useLayoutEffect(() => {
    const r = rig.current;
    const body = model.getObjectByName(BODY_NODE) ?? null;
    if (!body) warnOnce(`vehicle:${BODY_NODE}`, `vehicle node "${BODY_NODE}" not found; no body lean or lamps`);
    r.body = body;
    if (body) {
      r.basePos.copy(body.position);
      r.baseRot.set(body.rotation.x, body.rotation.y, body.rotation.z);
      r.baseScale.copy(body.scale);
      body.add(lights.group);
    }
    return () => {
      if (body) {
        body.position.copy(r.basePos);
        body.rotation.set(r.baseRot.x, r.baseRot.y, r.baseRot.z);
        body.scale.copy(r.baseScale);
      }
      lights.group.removeFromParent();
      r.body = null;
    };
  }, [model, lights]);

  useEffect(() => () => lights.dispose(), [lights]);
  useEffect(() => lights.setSpotEnabled(quality === "high"), [lights, quality]);

  useEffect(
    () =>
      onGameEvent((e) => {
        if (e.type === "landing") kickSquash(motion, e.strength);
      }),
    [motion],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const r = rig.current;
    const v = vehicleState;
    lights.update(dt, v);
    const body = r.body;
    if (!body) return;

    // Chassis acceleration from the velocity change, in the car's frame (left = +X, forward = +Z)
    let lat = 0;
    let lon = 0;
    if (r.teleportSeen !== v.teleportCount) {
      // A teleport is not an acceleration: settle the body instead of flinging it
      r.teleportSeen = v.teleportCount;
      resetBodyMotion(motion);
    } else if (dt > 0 && v.grounded) {
      r.accel.copy(v.velocity).sub(r.prevVel).divideScalar(dt);
      lat = r.accel.dot(r.axis.set(1, 0, 0).applyQuaternion(v.quaternion));
      lon = r.accel.dot(v.forward);
    }
    r.prevVel.copy(v.velocity);
    stepBodyMotion(motion, lat, lon, dt);

    const k = reduced ? BODY.reducedScale : 1;
    const squash = reduced ? 0 : motion.squash;
    const widen = 1 + squash * BODY.squashWiden;
    body.rotation.set(r.baseRot.x + motion.pitch * k, r.baseRot.y, r.baseRot.z + motion.roll * k);
    body.scale.set(r.baseScale.x * widen, r.baseScale.y * (1 - squash), r.baseScale.z * widen);
  });
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
