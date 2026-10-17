"use client";

import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  BallCollider,
  CoefficientCombineRule,
  RigidBody,
  useBeforePhysicsStep,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useRef, useState } from "react";
import { Vector3, type Group } from "three";
import type { DistrictId } from "@/content/types";
import type { DistrictLayout } from "@/world/layout/types";
import { spawnPose } from "@/world/lib/area";
import { clamp, damp, dampAngle, springStep } from "@/world/lib/damping";
import { lookupKit, lookupModel, warnOnce } from "@/world/lib/models";
import { ModelErrorBoundary } from "@/world/town/ModelErrorBoundary";
import { useAppStore } from "@/state/useAppStore";
import { useInputStore } from "@/state/useInputStore";
import type { Control } from "@/world/controls";
import { DEFAULT_CAR_SCALE, SEDAN_REF, VEHICLE } from "./constants";
import { combineAxis, driveStep, forwardOf } from "./drive";
import { BoxCar, SedanModel, emptySedanNodes, type SedanNodes } from "./SedanModel";
import { vehicleState } from "./vehicleState";

const R = VEHICLE.ballRadius;
const now = () => performance.now() / 1000;

interface Props {
  /** District to spawn in on first mount (the page's district) */
  initialDistrict: DistrictId;
  layouts: readonly DistrictLayout[];
}

export function Vehicle({ initialDistrict, layouts }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const anchor = useRef<Group>(null);
  const visual = useRef<Group>(null);
  const nodes = useRef<SedanNodes>(emptySedanNodes());
  const spawnDistrict = useRef<DistrictId>(initialDistrict);
  const setNodes = useCallback((n: SedanNodes) => {
    nodes.current = n;
  }, []);
  const [subscribeKeys, getKeys] = useKeyboardControls<Control>();

  const info = lookupModel(SEDAN_REF);
  const kit = info ? lookupKit(info.kit) : undefined;
  const carScale = kit?.scale ?? DEFAULT_CAR_SCALE;
  if (!info) warnOnce(SEDAN_REF, `"${SEDAN_REF}" missing from the manifest; using a placeholder car`);

  // Initial pose is computed once; later spawns go through teleport()
  const [initial] = useState(() => spawnPose(layouts, initialDistrict));

  // Simulation state, mutated in the physics step (never React state)
  const sim = useRef({
    yaw: initial.yaw,
    steer: 0,
    forwardSpeed: 0,
    accel: 0,
    // visual-only
    visualYaw: initial.yaw,
    roll: 0,
    pitch: 0,
    wheelSpin: 0,
    wheelSteer: 0,
    bounce: 0,
    bounceVel: 0,
    prevVy: 0,
  });

  // Scratch vectors reused every step (no per-frame allocations)
  const [scratch] = useState(() => ({ impulse: new Vector3(), zero: new Vector3(), spawn: new Vector3() }));

  const teleport = useCallback(
    (district: DistrictId, now: number) => {
      const rb = body.current;
      if (!rb) return;
      const pose = spawnPose(layouts, district);
      scratch.spawn.set(pose.position[0], R + VEHICLE.spawnDrop, pose.position[2]);
      rb.setTranslation(scratch.spawn, true);
      rb.setLinvel(scratch.zero, true);
      rb.setAngvel(scratch.zero, true);
      const s = sim.current;
      s.yaw = pose.yaw;
      s.visualYaw = pose.yaw;
      s.steer = 0;
      s.forwardSpeed = 0;
      s.accel = 0;
      s.bounce = 0;
      s.bounceVel = 0;
      vehicleState.teleportCount += 1;
      vehicleState.teleportedAt = now;
    },
    [layouts, scratch],
  );

  // Reset (R key, on-screen button) and teleports (GPS)
  useEffect(() => {
    const resetHere = () => {
      if (useAppStore.getState().mode !== "card") teleport(spawnDistrict.current, now());
    };
    const unsubKeys = subscribeKeys(
      (s) => s.reset,
      (pressed) => pressed && resetHere(),
    );
    const unsubInput = useInputStore.subscribe((s, prev) => {
      if (s.resetNonce !== prev.resetNonce) resetHere();
    });
    const unsubApp = useAppStore.subscribe((s, prev) => {
      if (s.teleportNonce !== prev.teleportNonce) {
        spawnDistrict.current = s.spawnDistrict;
        teleport(s.spawnDistrict, now());
      }
    });
    return () => {
      unsubKeys();
      unsubInput();
      unsubApp();
    };
  }, [subscribeKeys, teleport]);

  // Register the body handle so sensors can recognise the car
  useEffect(() => {
    vehicleState.bodyHandle = body.current?.handle ?? -1;
    vehicleState.yaw = initial.yaw;
    vehicleState.forwardSpeed = 0;
    return () => {
      vehicleState.bodyHandle = -1;
    };
  }, [initial.yaw]);

  // Driving: runs once per fixed physics step, so handling is identical at any frame rate
  useBeforePhysicsStep((world) => {
    const rb = body.current;
    if (!rb) return;
    const dt = world.timestep;
    const s = sim.current;

    const keys = getKeys();
    const touch = useInputStore.getState();
    const throttle = combineAxis((keys.forward ? 1 : 0) - (keys.back ? 1 : 0), touch.throttle);
    const steerIn = combineAxis((keys.right ? 1 : 0) - (keys.left ? 1 : 0), touch.steer);
    const brake = keys.brake || touch.brake;

    if (throttle !== 0 || steerIn !== 0 || brake) {
      const app = useAppStore.getState();
      if (app.mode === "intro") app.setMode("drive");
    }

    s.steer = damp(s.steer, steerIn, VEHICLE.steerResponse, dt);

    const v = rb.linvel();
    const t = rb.translation();
    const grounded = t.y <= R + VEHICLE.groundedTolerance;
    const [fx, fz] = forwardOf(s.yaw);
    const vfBefore = v.x * fx + v.z * fz;

    const next = driveStep({ vx: v.x, vz: v.z, yaw: s.yaw }, { throttle, steer: s.steer, brake }, dt, grounded);
    s.yaw = next.yaw;

    // Velocity change -> impulse (impulse = mass * dv), so mass tuning doesn't change the handling
    const m = rb.mass();
    scratch.impulse.set((next.vx - v.x) * m, 0, (next.vz - v.z) * m);
    rb.applyImpulse(scratch.impulse, true);

    const [nfx, nfz] = forwardOf(s.yaw);
    s.forwardSpeed = next.vx * nfx + next.vz * nfz;
    s.accel = (s.forwardSpeed - vfBefore) / dt;
  });

  // Visual sync + juice: every rendered frame, after the physics step (Physics runs at a lower priority)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = sim.current;
    const ballObj = anchor.current?.parent;
    const car = visual.current;
    if (!ballObj || !car) return;

    // Interpolated ball position (the RigidBody group sits directly in world space)
    const p = ballObj.position;
    if (p.y < VEHICLE.fallResetY) {
      teleport(spawnDistrict.current, now());
      return;
    }

    vehicleState.position.copy(p);
    vehicleState.ground.set(p.x, p.y - R, p.z);
    vehicleState.forwardSpeed = s.forwardSpeed;

    // Smooth the 60 Hz yaw for high-refresh displays
    s.visualYaw = dampAngle(s.visualYaw, s.yaw, 30, dt);
    vehicleState.yaw = s.visualYaw;
    car.position.set(p.x, p.y - R, p.z);
    car.rotation.set(0, s.visualYaw, 0);

    const speedRatio = clamp(Math.abs(s.forwardSpeed) / VEHICLE.maxSpeed, 0, 1);
    const n = nodes.current;

    // Body roll (outwards in a turn) and pitch (nose up when accelerating)
    s.roll = damp(s.roll, -s.steer * VEHICLE.maxRoll * speedRatio, VEHICLE.tiltResponse, dt);
    s.pitch = damp(
      s.pitch,
      clamp(-s.accel * VEHICLE.pitchPerAccel, -VEHICLE.maxPitch, VEHICLE.maxPitch),
      VEHICLE.tiltResponse,
      dt,
    );

    // Suspension bounce, kicked by sudden vertical speed changes (landing, bumps)
    const vy = body.current?.linvel().y ?? 0;
    s.bounceVel -= (vy - s.prevVy) * VEHICLE.bounceKick;
    s.prevVy = vy;
    [s.bounce, s.bounceVel] = springStep(s.bounce, s.bounceVel, 0, VEHICLE.bounceStiffness, VEHICLE.bounceDamping, dt);
    s.bounce = clamp(s.bounce, -VEHICLE.maxBounce, VEHICLE.maxBounce);

    if (n.body) {
      n.body.rotation.set(s.pitch, 0, s.roll);
      // Node positions are in raw model units; the bounce is in metres
      n.body.position.y = n.bodyBaseY + s.bounce / carScale;
    }

    // Wheels: spin by distance / radius, front wheels steer
    const wheelRadius = VEHICLE.wheelRadiusRaw * carScale;
    s.wheelSpin = (s.wheelSpin + (s.forwardSpeed * dt) / wheelRadius) % (Math.PI * 2);
    s.wheelSteer = s.steer * VEHICLE.maxWheelSteer;
    for (const w of n.wheelsFront) w.rotation.set(s.wheelSpin, -s.wheelSteer, 0);
    for (const w of n.wheelsBack) w.rotation.set(s.wheelSpin, 0, 0);
  });

  return (
    <>
      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={[initial.position[0], R + VEHICLE.spawnDrop, initial.position[2]]}
        lockRotations
        canSleep={false}
        ccd
        linearDamping={VEHICLE.linearDamping}
        angularDamping={VEHICLE.angularDamping}
        name="vehicle"
      >
        {/* Frictionless ball: traction comes from drive.ts, so the car slides cleanly along walls */}
        <BallCollider
          args={[R]}
          mass={VEHICLE.mass}
          friction={0}
          frictionCombineRule={CoefficientCombineRule.Min}
          restitution={VEHICLE.restitution}
        />
        <group ref={anchor} />
      </RigidBody>

      <group ref={visual} position={[initial.position[0], 0, initial.position[2]]} rotation={[0, initial.yaw, 0]}>
        {info ? (
          <ModelErrorBoundary name={SEDAN_REF} fallback={<BoxCar />}>
            <group scale={carScale}>
              <SedanModel url={info.url} kit={info.kit} texture={kit?.texture ?? null} onNodes={setNodes} />
            </group>
          </ModelErrorBoundary>
        ) : (
          <BoxCar />
        )}
      </group>
    </>
  );
}
