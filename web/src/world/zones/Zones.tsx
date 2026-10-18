"use client";

import { Billboard, Text } from "@react-three/drei";
import { CuboidCollider, RigidBody, type IntersectionEnterPayload } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3, type Group } from "three";
import type { DistrictId } from "@/content/types";
import { districtOfBiome } from "@/world/lib/biomeMap";
import { markerPose, markerSensorBox } from "@/world/lib/planetPlacement";
import type { BiomeLayout, PlanetMarker } from "@/world/planet/types";
import { useAppStore } from "@/state/useAppStore";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { ZONE_HEIGHT, ZONE_SIZE, markerLabel } from "./markers";

/** Optional local font for labels. Without one, troika loads its default font from a CDN. */
// Kenney Mini Square Mono (CC0, kenney.nl), served locally: the only Kenney font whose "K" does not read as "H"
const LABEL_FONT: string | undefined = "/fonts/kenney-mini-square-mono.ttf";
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

/**
 * Sensors, ground rings and floating labels for one biome's markers. Everything hangs off the marker's
 * surface pose, so on the sphere the sensor box, the ring and the label all follow local up.
 */
export function BiomeZones({ layout }: { layout: BiomeLayout }) {
  const district = districtOfBiome(layout.biome);
  // A marker needs a district to become an ActiveZone (the badlands have none, by design)
  if (!district || layout.markers.length === 0) return null;
  return (
    <RigidBody type="fixed" colliders={false} name={`zones-${layout.biome}`}>
      {layout.markers.map((m) => (
        <Zone key={m.id} marker={m} district={district} />
      ))}
    </RigidBody>
  );
}

function Zone({ marker, district }: { marker: PlanetMarker; district: DistrictId }) {
  const label = useMemo(() => markerLabel(marker), [marker]);
  const box = useMemo(() => markerSensorBox(marker, ZONE_SIZE, ZONE_HEIGHT), [marker]);

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
        args={box.halfExtents}
        position={box.center}
        quaternion={box.quaternion}
        onIntersectionEnter={onEnter}
        onIntersectionExit={onExit}
      />
      <ZoneMarker marker={marker} label={label} />
    </>
  );
}

/** Floating label plus a flat ring on the ground showing where to park, in the marker's local frame. */
function ZoneMarker({ marker, label }: { marker: PlanetMarker; label: string }) {
  const labelRef = useRef<Group>(null);
  const pose = useMemo(() => markerPose(marker), [marker]);
  const labelPos = useMemo(
    () => pose.position.clone().addScaledVector(new Vector3(0, 1, 0).applyQuaternion(pose.quaternion), LABEL_HEIGHT),
    [pose],
  );

  useFrame(({ camera }) => {
    const g = labelRef.current;
    if (!g) return;
    const s = labelScale(camera.position.distanceTo(labelPos));
    g.visible = s > 0;
    if (s > 0) g.scale.setScalar(s);
  });

  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.08} renderOrder={1}>
        <ringGeometry args={[ZONE_SIZE * 0.36, ZONE_SIZE * 0.42, 48]} />
        {/* No PSX vertex snapping: the thin ring hovers just over the ground and would flicker into it */}
        <meshBasicMaterial
          color="#ffd23f"
          transparent
          opacity={0.85}
          depthWrite={false}
          userData={{ psxSkip: true }}
        />
      </mesh>
      {/* Billboard copies the camera's world rotation (minus the parent's), so the text is upright
          on screen whatever the local up is, as long as the follow camera's `up` is the local up. */}
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
