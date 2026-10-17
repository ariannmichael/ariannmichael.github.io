"use client";

import { Billboard, Text } from "@react-three/drei";
import { CuboidCollider, RigidBody, type IntersectionEnterPayload } from "@react-three/rapier";
import { useMemo } from "react";
import type { DistrictId } from "@/content/types";
import type { DistrictLayout, Marker } from "@/world/layout/types";
import { tileToWorld } from "@/world/lib/placement";
import { useAppStore } from "@/state/useAppStore";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { ZONE_HEIGHT, ZONE_SIZE, markerLabel } from "./markers";

/** Optional local font for labels. Without one, troika loads its default font from a CDN. */
const LABEL_FONT: string | undefined = undefined;
const LABEL_HEIGHT = 5.2;

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
  return (
    <group position={[x, 0, z]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.05} renderOrder={1}>
        <ringGeometry args={[ZONE_SIZE * 0.36, ZONE_SIZE * 0.42, 48]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <Billboard position-y={LABEL_HEIGHT}>
        <Text
          font={LABEL_FONT}
          fontSize={1.1}
          color="#1d1d2b"
          outlineWidth={0.08}
          outlineColor="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={14}
          textAlign="center"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}
