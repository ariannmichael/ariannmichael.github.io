"use client";

import { Billboard, Text } from "@react-three/drei";
import { CuboidCollider, RigidBody, type IntersectionEnterPayload } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3, type Group } from "three";
import type { DistrictId } from "@/content/types";
import type { DistrictLayout, Marker } from "@/world/layout/types";
import { tileToWorld } from "@/world/lib/placement";
import { useAppStore } from "@/state/useAppStore";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { ZONE_HEIGHT, ZONE_SIZE, markerLabel } from "./markers";

/** Optional local font for labels. Without one, troika loads its default font from a CDN. */
const LABEL_FONT: string | undefined = "/fonts/kenney-future.ttf"; // Kenney Future, CC0 (kenney.nl), served locally
const LABEL_HEIGHT = 5.2;

// Perspective already shrinks distant labels, so they keep full size far away and only shrink as
// the camera gets close (otherwise they fill the screen). Right next to the camera the "Press E"
// prompt already names the stop, and very far labels only add clutter, so both are hidden.
const LABEL_FULL_SIZE_DISTANCE = 28;
const LABEL_MIN_SCALE = 0.3;
const LABEL_HIDE_NEAR = 7;
const LABEL_HIDE_FAR = 160;

export function labelScale(distance: number): number {
  if (distance < LABEL_HIDE_NEAR || distance > LABEL_HIDE_FAR) return 0;
  return Math.min(1, Math.max(LABEL_MIN_SCALE, distance / LABEL_FULL_SIZE_DISTANCE));
}

const isVehicle = (payload: IntersectionEnterPayload) =>
  payload.other.rigidBody?.handle === vehicleState.bodyHandle;

/** A sensor (6 x 6 m) and a floating label for every marker of every district. */
export function Zones({ layouts }: { layouts: readonly DistrictLayout[] }) {
  return (
    <>
      {layouts.map((l) => (
        <DistrictZones key={l.id} layout={l} />
      ))}
    </>
  );
}

function DistrictZones({ layout }: { layout: DistrictLayout }) {
  if (layout.markers.length === 0) return null;
  return (
    <RigidBody type="fixed" colliders={false} name={`zones-${layout.id}`}>
      {layout.markers.map((m) => (
        <Zone key={m.id} marker={m} district={layout.id} origin={layout.origin} />
      ))}
    </RigidBody>
  );
}

function Zone({ marker, district, origin }: { marker: Marker; district: DistrictId; origin: DistrictLayout["origin"] }) {
  const [x, , z] = tileToWorld(origin, marker.x, marker.z);
  const label = useMemo(() => markerLabel(marker), [marker]);

  const onEnter = (payload: IntersectionEnterPayload) => {
    if (!isVehicle(payload)) return;
    useAppStore.getState().setActiveZone({ id: marker.id, district });
  };
  const onExit = (payload: IntersectionEnterPayload) => {
    if (!isVehicle(payload)) return;
    const { activeZone, setActiveZone } = useAppStore.getState();
    // Only clear if we're leaving the zone that is active (zones may overlap)
    if (activeZone?.id === marker.id && activeZone.district === district) setActiveZone(null);
  };

  return (
    <>
      <CuboidCollider
        sensor
        args={[ZONE_SIZE / 2, ZONE_HEIGHT / 2, ZONE_SIZE / 2]}
        position={[x, ZONE_HEIGHT / 2, z]}
        onIntersectionEnter={onEnter}
        onIntersectionExit={onExit}
      />
      <ZoneMarker x={x} z={z} label={label} />
    </>
  );
}

/** Floating label plus a flat ring on the ground showing where to park. */
function ZoneMarker({ x, z, label }: { x: number; z: number; label: string }) {
  const labelRef = useRef<Group>(null);
  const labelPos = useMemo(() => new Vector3(x, LABEL_HEIGHT, z), [x, z]);

  useFrame(({ camera }) => {
    const g = labelRef.current;
    if (!g) return;
    const s = labelScale(camera.position.distanceTo(labelPos));
    g.visible = s > 0;
    if (s > 0) g.scale.setScalar(s);
  });

  return (
    <group position={[x, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} renderOrder={1}>
        <ringGeometry args={[ZONE_SIZE * 0.36, ZONE_SIZE * 0.42, 48]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <Billboard ref={labelRef} position-y={LABEL_HEIGHT}>
        <Text
          font={LABEL_FONT}
          fontSize={1.1}
          color="#1d1d2b"
          outlineWidth={0.08}
          outlineColor="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={18}
          lineHeight={1.25}
          textAlign="center"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}
