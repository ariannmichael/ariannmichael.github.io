"use client";

import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type ContactForcePayload,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useRef, useState } from "react";
import { Vector3, type Group } from "three";
import type { DistrictId } from "@/content/types";
import { addTrauma } from "@/world/camera/shake";
import type { Control } from "@/world/controls";
import { lookupKit, lookupModel, warnOnce } from "@/world/lib/models";
import { PLANET_GRAVITY } from "@/world/planet/config";
import { surfaceRadius } from "@/world/planet/frame";
import { ModelErrorBoundary } from "@/world/town/ModelErrorBoundary";
import { useAppStore } from "@/state/useAppStore";
import { useInputStore } from "@/state/useInputStore";
import { DEFAULT_CAR_SCALE, VEHICLE, VEHICLE_REF } from "./constants";
import { VehicleDriver } from "./controller";
import { combineAxis, contactTrauma, type DriveInput } from "./drive";
import { chassisInertia, configureVehicleController, wheelLayout } from "./setup";
import { onTeleportRequest, spawnPointAt, vehicleSpawnPose, yawOfHeading, type SpawnPoint } from "./spawn";
import { BoxCar, VehicleModel, emptyVehicleNodes, type VehicleNodes } from "./VehicleModel";
import { vehicleState } from "./vehicleState";

const now = () => performance.now() / 1000;
const IDLE: DriveInput = { throttle: 0, steer: 0, handbrake: false };
const LAYOUT = wheelLayout();
const [HX, HY, HZ] = VEHICLE.chassisHalf;
const MASS_PROPS = {
  mass: VEHICLE.mass,
  // Relative to the collider centre
  centerOfMass: { x: 0, y: VEHICLE.centerOfMassY - VEHICLE.chassisCenterY, z: VEHICLE.centerOfMassZ },
  principalAngularInertia: chassisInertia(),
  angularInertiaLocalFrame: { x: 0, y: 0, z: 0, w: 1 },
};

export interface VehicleProps {
  /** Where the car appears on mount (lat/lon in degrees, yaw = degrees CCW from local north). */
  spawn: SpawnPoint;
  /**
   * Spawn point for a district, used when the store's `teleportNonce` bumps (GPS teleport). Return
   * undefined to ignore. Usually `(d) => PLANET_LAYOUTS.find((l) => l.biome === d)?.spawn`.
   */
  spawnFor: (district: DistrictId) => SpawnPoint | undefined;
}

/**
 * The off-road car: a Rapier DynamicRayCastVehicleController on a dynamic chassis. Mount inside
 * <Physics> (and inside drei <KeyboardControls map={KEYMAP}>). Planet gravity is applied by VehicleDriver (the chassis has gravityScale 0, so PlanetGravity skips it). Publishes telemetry to
 * `vehicleState` every frame.
 *
 * Controls: W/S throttle & brake/reverse, A/D steer, Space handbrake, R reset upright in place;
 * touch via useInputStore. In the air, W/S pitch and A/D roll. Teleports: store `teleportTo(district)`
 * or `requestVehicleTeleport(spawn)`.
 */
export function Vehicle({ spawn, spawnFor }: VehicleProps) {
  const { world } = useRapier();
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const anchor = useRef<Group>(null);
  const driverRef = useRef<VehicleDriver | null>(null);
  const nodes = useRef<VehicleNodes>(emptyVehicleNodes());
  const lastSpawn = useRef<SpawnPoint>(spawn);
  const spawnForRef = useRef(spawnFor);
  useEffect(() => {
    spawnForRef.current = spawnFor;
  }, [spawnFor]);
  const setNodes = useCallback((n: VehicleNodes) => {
    nodes.current = n;
  }, []);
  const [subscribeKeys, getKeys] = useKeyboardControls<Control>();

  const info = lookupModel(VEHICLE_REF);
  const kit = info ? lookupKit(info.kit) : undefined;
  const carScale = kit?.scale ?? DEFAULT_CAR_SCALE;
  if (!info) warnOnce(VEHICLE_REF, `"${VEHICLE_REF}" missing from the manifest; using a placeholder car`);

  // Initial pose is computed once; later moves go through teleport()
  const [initial] = useState(() => {
    const pose = vehicleSpawnPose(spawn);
    return {
      position: pose.position.toArray() as [number, number, number],
      quaternion: pose.quaternion.toArray() as [number, number, number, number],
    };
  });
  // Scratch (no per-frame allocation)
  const [scratch] = useState(() => ({ zero: new Vector3(), v: new Vector3() }));

  const teleport = useCallback(
    (target: SpawnPoint) => {
      const rb = body.current;
      if (!rb) return;
      const pose = vehicleSpawnPose(target);
      rb.setTranslation(pose.position, true);
      rb.setRotation(pose.quaternion, true);
      rb.setLinvel(scratch.zero, true);
      rb.setAngvel(scratch.zero, true);
      driverRef.current?.reset();
      vehicleState.teleportCount += 1;
      vehicleState.teleportedAt = now();
    },
    [scratch],
  );

  // Create the ray-cast vehicle controller once the chassis body exists
  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    const vc = world.createVehicleController(rb);
    configureVehicleController(vc);
    driverRef.current = new VehicleDriver(vc);
    vehicleState.bodyHandle = rb.handle;
    // QA hook: `?debug` exposes the live telemetry to the screenshot harness / devtools
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __vehicleState?: typeof vehicleState }).__vehicleState = vehicleState;
    }
    // Contact-force events only above a few g, so resting/scraping contacts stay quiet
    collider.current?.setContactForceEventThreshold(VEHICLE.mass * PLANET_GRAVITY * VEHICLE.contactForceMinG);
    return () => {
      driverRef.current = null;
      vehicleState.bodyHandle = -1;
      try {
        world.removeVehicleController(vc);
      } catch {
        // The world may already be torn down with the Physics provider
      }
    };
  }, [world]);

  // Reset (R / on-screen button): upright in place, same heading. Teleports: GPS store + requests
  useEffect(() => {
    const resetHere = () => {
      if (useAppStore.getState().mode === "card") return;
      teleport(spawnPointAt(vehicleState.position, vehicleState.heading));
    };
    const goTo = (target: SpawnPoint) => {
      lastSpawn.current = target;
      teleport(target);
    };
    const unsubKeys = subscribeKeys(
      (s) => s.reset,
      (pressed) => pressed && resetHere(),
    );
    const unsubInput = useInputStore.subscribe((s, prev) => {
      if (s.resetNonce !== prev.resetNonce) resetHere();
    });
    const unsubApp = useAppStore.subscribe((s, prev) => {
      if (s.teleportNonce === prev.teleportNonce) return;
      const target = spawnForRef.current(s.spawnDistrict);
      if (target) goTo(target);
    });
    const unsubRequests = onTeleportRequest(goTo);
    return () => {
      unsubKeys();
      unsubInput();
      unsubApp();
      unsubRequests();
    };
  }, [subscribeKeys, teleport]);

  // Driving: once per fixed physics step (not called while <Physics paused>), so handling is
  // identical at any frame rate and nothing accumulates across a pause
  useBeforePhysicsStep((w) => {
    const driver = driverRef.current;
    const rb = body.current;
    if (!driver || !rb) return;

    const app = useAppStore.getState();
    let input = IDLE;
    if (app.mode !== "card" && !app.gpsOpen) {
      const keys = getKeys();
      const touch = useInputStore.getState();
      input = {
        throttle: combineAxis((keys.forward ? 1 : 0) - (keys.back ? 1 : 0), touch.throttle),
        steer: combineAxis((keys.right ? 1 : 0) - (keys.left ? 1 : 0), touch.steer),
        handbrake: keys.brake || touch.brake,
      };
      if (app.mode === "intro" && (input.throttle !== 0 || input.steer !== 0 || input.handbrake)) {
        app.setMode("drive");
      }
    }

    driver.step(input, w.timestep);

    const ev = driver.events;
    if (ev.trauma > 0) {
      addTrauma(ev.trauma);
      ev.trauma = 0;
    }
    if (ev.landingSpeed > 0) {
      vehicleState.landingCount += 1;
      vehicleState.landingSpeed = ev.landingSpeed;
    }

    // Tunnelled through the ground (or fell out of the world): back to the last spawn
    const t = rb.translation();
    scratch.v.set(t.x, t.y, t.z);
    const r = scratch.v.length();
    if (r < 1 || r < surfaceRadius(scratch.v.normalize()) - VEHICLE.fallBelowSurface) {
      teleport(lastSpawn.current);
    }
  });

  const onContactForce = useCallback((p: ContactForcePayload) => {
    addTrauma(contactTrauma(p.totalForceMagnitude));
  }, []);

  // Visual sync + telemetry: every rendered frame, after the physics step (Physics runs at a
  // lower priority). The RigidBody group holds the interpolated pose.
  useFrame(() => {
    const obj = anchor.current?.parent;
    const driver = driverRef.current;
    const rb = body.current;
    if (!obj || !driver || !rb) return;
    const s = vehicleState;

    s.position.copy(obj.position);
    s.quaternion.copy(obj.quaternion);
    s.up.copy(obj.position).normalize();
    s.chassisUp.set(0, 1, 0).applyQuaternion(obj.quaternion);
    s.forward.set(0, 0, 1).applyQuaternion(obj.quaternion);
    // Heading: nose projected onto the tangent plane; keep the last one if pointing straight up/down
    scratch.v.copy(s.forward).addScaledVector(s.up, -s.forward.dot(s.up));
    if (scratch.v.lengthSq() > 1e-4) s.heading.copy(scratch.v.normalize());
    else s.heading.addScaledVector(s.up, -s.heading.dot(s.up)).normalize();
    s.yawDeg = yawOfHeading(s.up, s.heading);
    s.ground.copy(s.up).multiplyScalar(surfaceRadius(s.up));

    const lv = rb.linvel();
    s.velocity.set(lv.x, lv.y, lv.z);
    s.forwardSpeed = driver.forwardSpeed;
    s.speed = driver.speed;
    s.grounded = driver.grounded;
    s.wheelsInContact = driver.wheelsInContact;
    s.airTime = driver.airTime;
    s.suspensionActivity = driver.suspensionActivity;

    const wheels = nodes.current.wheels;
    for (let i = 0; i < driver.wheels.length; i++) {
      const src = driver.wheels[i];
      const dst = s.wheels[i];
      dst.contact.copy(src.contact);
      dst.inContact = src.inContact;
      dst.slip = src.slip;

      // Wheel visuals: hub at the suspension length below the hard point; spin and steer from Rapier.
      // Node coordinates are raw model units (the model group is scaled by carScale).
      const node = wheels[i];
      if (node) {
        node.position.y = (LAYOUT[i].y - src.suspensionLength) / carScale;
        node.rotation.set(src.rotation, src.steer, 0);
      }
    }
  });

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={initial.position}
      quaternion={initial.quaternion}
      canSleep={false}
      ccd
      // PlanetGravity skips this body: VehicleDriver applies the same gravity itself, so its parking
      // hold can cancel it exactly (step-callback order is not guaranteed)
      gravityScale={0}
      linearDamping={VEHICLE.linearDamping}
      angularDamping={VEHICLE.angularDamping}
      name="vehicle"
    >
      <CuboidCollider
        ref={collider}
        args={[HX, HY, HZ]}
        position={[0, VEHICLE.chassisCenterY, 0]}
        massProperties={MASS_PROPS}
        friction={VEHICLE.friction}
        restitution={VEHICLE.restitution}
        onContactForce={onContactForce}
      />
      <group ref={anchor} />
      {info ? (
        <ModelErrorBoundary name={VEHICLE_REF} fallback={<BoxCar />}>
          <group scale={carScale}>
            <VehicleModel url={info.url} kit={info.kit} texture={kit?.texture ?? null} onNodes={setNodes} />
          </group>
        </ModelErrorBoundary>
      ) : (
        <BoxCar />
      )}
    </RigidBody>
  );
}
