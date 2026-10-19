"use client";

import { Billboard, Text } from "@react-three/drei";
import { CuboidCollider, RigidBody, type IntersectionEnterPayload } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3, type Group, type Mesh } from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import type { DistrictId } from "@/content/types";
import { districtOfBiome } from "@/world/lib/biomeMap";
import { markerPose, markerSensorBox } from "@/world/lib/planetPlacement";
import type { BiomeLayout, PlanetMarker } from "@/world/planet/types";
import { useAppStore } from "@/state/useAppStore";
import { PLANET_RADIUS } from "@/world/planet/config";
import { MARKER_FX, labelPop, markerProximity } from "@/world/fx/juiceRules";
import { vehicleState } from "@/world/vehicle/vehicleState";
import { ZONE_HEIGHT, ZONE_SIZE, markerLabel } from "./markers";
import { bindMarkerUniforms, markerFxAssets, setMarkerDraw, setMarkerTime, type MarkerDrawState } from "./markerFx";

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
// Past one planet radius a marker is over the horizon while driving, and in the intro's globe view
// (≥ ~140 m from every marker) dozens of labels would only clutter the globe: they appear as the
// camera swoops down.
export const LABEL_HIDE_FAR = PLANET_RADIUS;
// Past this distance labels grow again (up to LABEL_FAR_SCALE at LABEL_HIDE_FAR) so stops across
// town stay readable over the curve.
export const LABEL_GROW_FROM = 0.4 * PLANET_RADIUS;
const LABEL_FAR_SCALE = 1.8;

export function labelScale(distance: number): number {
  if (distance < LABEL_HIDE_NEAR || distance > LABEL_HIDE_FAR) return 0;
  if (distance > LABEL_GROW_FROM) {
    const t = (distance - LABEL_GROW_FROM) / (LABEL_HIDE_FAR - LABEL_GROW_FROM);
    return 1 + t * (LABEL_FAR_SCALE - 1);
  }
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
      <ZoneMarker marker={marker} label={label} district={district} />
    </>
  );
}

/**
 * Floating label plus a GTA San Andreas-style marker showing where to park, in the marker's local
 * frame: a red tube of light fading upwards, a glowing ring and disc on the ground and a soft halo
 * (zones/markerFx; shared geometry and materials). Juice: the marker breathes gently, brightens and
 * pulses harder as the car approaches and brighter still while it is the active zone, and the label
 * pops when this zone becomes active (reduced motion: brightness only, no pulse or pop).
 */
function ZoneMarker({ marker, label, district }: { marker: PlanetMarker; label: string; district: DistrictId }) {
  const labelRef = useRef<Group>(null);
  const discRef = useRef<Mesh>(null);
  const fx = markerFxAssets();
  /** One state object shared by this marker's three meshes (read in bindMarkerUniforms) */
  const draw = useMemo<MarkerDrawState>(() => ({ intensity: MARKER_FX.baseIntensity, pulse: 0 }), []);
  const fxData = useMemo(() => ({ marker: draw }), [draw]);
  const reduced = usePrefersReducedMotion();
  /** Seconds (clock) when this zone last became active; -Infinity when it isn't */
  const activeSince = useRef(-Infinity);
  const pose = useMemo(() => markerPose(marker), [marker]);
  const labelPos = useMemo(
    () => pose.position.clone().addScaledVector(new Vector3(0, 1, 0).applyQuaternion(pose.quaternion), LABEL_HEIGHT),
    [pose],
  );

  useFrame(({ camera, clock }) => {
    const now = clock.elapsedTime;
    const zone = useAppStore.getState().activeZone;
    const active = zone?.id === marker.id && zone.district === district;
    if (active && activeSince.current === -Infinity) activeSince.current = now;
    else if (!active) activeSince.current = -Infinity;

    // Reduced motion freezes the shared clock: no drifting bands, no breathing
    if (!reduced) setMarkerTime(now);
    const p = active ? 1 : markerProximity(vehicleState.position.distanceTo(pose.position));
    setMarkerDraw(
      draw,
      active ? MARKER_FX.activeIntensity : MARKER_FX.baseIntensity + (MARKER_FX.litIntensity - MARKER_FX.baseIntensity) * p,
      reduced ? 0 : MARKER_FX.idlePulse + (MARKER_FX.litPulse - MARKER_FX.idlePulse) * p,
    );
    const disc = discRef.current;
    if (disc) {
      const pulse = reduced ? 0 : MARKER_FX.pulseAmp * p * (0.5 + 0.5 * Math.sin(now * MARKER_FX.pulseSpeed));
      disc.scale.setScalar(1 + pulse);
    }

    const g = labelRef.current;
    if (!g) return;
    const s = labelScale(camera.position.distanceTo(labelPos));
    g.visible = s > 0;
    if (s > 0) g.scale.setScalar(s * (reduced ? 1 : labelPop(now - activeSince.current)));
  });

  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      {/* Transparent and depth-write free, drawn after the opaque world: ground disc, then tube, then halo */}
      <mesh
        ref={discRef}
        geometry={fx.discGeometry}
        material={fx.discMaterial}
        rotation-x={-Math.PI / 2}
        position-y={0.08}
        renderOrder={1}
        userData={fxData}
        onBeforeRender={bindMarkerUniforms}
      />
      <mesh
        geometry={fx.beamGeometry}
        material={fx.beamMaterial}
        position-y={0.05}
        renderOrder={2}
        userData={fxData}
        onBeforeRender={bindMarkerUniforms}
      />
      <mesh
        geometry={fx.haloGeometry}
        material={fx.haloMaterial}
        position-y={fx.haloY}
        renderOrder={3}
        userData={fxData}
        onBeforeRender={bindMarkerUniforms}
      />
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
