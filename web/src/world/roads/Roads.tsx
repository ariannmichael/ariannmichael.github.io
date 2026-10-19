"use client";

// The road network between the biomes: one paved ribbon over the flattened road beds (the Kenney
// city-roads tile's cross-section, drawn with the tiles' own palette material, roadGeometry.ts), and a
// two-faced sign at every road end. The face toward arriving traffic names the town and what is in
// it; the face toward departing traffic names where the road goes and how far it is.

import { Text } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { TextureLoader, Vector3, type Group } from "three";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import type { BiomeId } from "@/world/planet/types";
import { paletteMaterial } from "@/world/town/materials";
import { markerLabel } from "@/world/zones/markers";
import {
  RIBBON_PALETTE,
  SIGN_POST_X as POST_X,
  biomeName,
  buildRoadRibbon,
  roadSigns,
  type RoadSign,
} from "./roadGeometry";

const LABEL_FONT = "/fonts/kenney-mini-square-mono.ttf";

const BOARD_W = 7.2;
const BOARD_H = 3.4;
const BOARD_BOTTOM = 2.4;
/** Text faces stand this far from the board's centre (its faces are at ±0.07): far enough, with a
 * depth offset, that distant boards never z-fight their lettering */
const FACE_Z = 0.11;
/** Title font size, shrunk so the longest name stays on one line (the font advances 0.75 em) */
const TITLE_SIZE = 0.56;
const FONT_ADVANCE = 0.75;
const TEXT_WIDTH = BOARD_W - 1.2;
/** Signs further than this from the camera are hidden (they are unreadable and cost draw calls) */
const SIGN_HIDE_FAR = 110;

/** What each town holds, as it appears on its welcome sign: the stops' names, without their role. */
function contents(biome: BiomeId): string {
  const layout = PLANET_LAYOUTS.find((l) => l.biome === biome);
  const names = [...new Set((layout?.markers ?? []).map((m) => markerLabel(m).split(" · ")[0]))];
  return names.length ? names.join(" · ") : "Off-road playground: jumps, bowls, wrecks";
}

export function Roads() {
  const geometry = useMemo(() => buildRoadRibbon(), []);
  // The street tiles' own material (same palette texture and shading), plus a polygon offset: the
  // ground is faceted under the ribbon
  const palette = useLoader(TextureLoader, RIBBON_PALETTE);
  const material = useMemo(() => {
    const m = paletteMaterial(RIBBON_PALETTE, palette).clone();
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -4;
    return m;
  }, [palette]);
  const signs = useMemo(() => roadSigns(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <>
      <mesh geometry={geometry} material={material} name="roads" receiveShadow />
      <RigidBody type="fixed" colliders={false} name="road-signs">
        {signs.map((s) => (
          <Sign key={s.key} sign={s} />
        ))}
      </RigidBody>
    </>
  );
}

function Sign({ sign }: { sign: RoadSign }) {
  const ref = useRef<Group>(null);
  const welcome = useMemo(() => ({ title: biomeName(sign.here), body: contents(sign.here) }), [sign.here]);
  const onward = useMemo(
    () => ({
      title: `> ${biomeName(sign.there)}`,
      body: `${Math.round(sign.distance / 10) * 10} m · ${contents(sign.there)}`,
    }),
    [sign.there, sign.distance],
  );

  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.distanceTo(sign.position) < SIGN_HIDE_FAR;
  });

  // Colliders on a fixed body take world poses (like the zone sensors), not nested group transforms
  const posts = useMemo(
    () =>
      [-POST_X, POST_X].map((x) => {
        const c = new Vector3(x, (BOARD_BOTTOM + BOARD_H) / 2, 0).applyQuaternion(sign.quaternion).add(sign.position);
        return [c.x, c.y, c.z] as [number, number, number];
      }),
    [sign],
  );
  const q = sign.quaternion;

  const boardY = BOARD_BOTTOM + BOARD_H / 2;
  return (
    <>
      {/* Posts collide; the board is overhead, out of the car's way */}
      {posts.map((p, k) => (
        <CuboidCollider
          key={k}
          args={[0.12, (BOARD_BOTTOM + BOARD_H) / 2, 0.12]}
          position={p}
          quaternion={[q.x, q.y, q.z, q.w]}
        />
      ))}
      <group ref={ref} position={sign.position} quaternion={sign.quaternion}>
        {[-POST_X, POST_X].map((x) => (
          <mesh key={x} position={[x, (BOARD_BOTTOM + BOARD_H) / 2, 0]} castShadow>
            <boxGeometry args={[0.24, BOARD_BOTTOM + BOARD_H, 0.24]} />
            <meshLambertMaterial color="#8a8f96" />
          </mesh>
        ))}
        <mesh position={[0, boardY, 0]} castShadow>
          <boxGeometry args={[BOARD_W + 0.24, BOARD_H + 0.24, 0.1]} />
          <meshLambertMaterial color="#f4f4ee" />
        </mesh>
        <mesh position={[0, boardY, 0]}>
          <boxGeometry args={[BOARD_W, BOARD_H, 0.14]} />
          <meshLambertMaterial color="#1f6a45" />
        </mesh>
        <SignFace z={FACE_Z} rotationY={0} y={boardY} {...welcome} />
        <SignFace z={-FACE_Z} rotationY={Math.PI} y={boardY} {...onward} />
      </group>
    </>
  );
}

/**
 * One face of a board: a big title on top and the town's stops below. The title never wraps (a second
 * line ran into the body): its size shrinks to fit the board instead.
 */
function SignFace({ z, y, rotationY, title, body }: { z: number; y: number; rotationY: number; title: string; body: string }) {
  const common = {
    font: LABEL_FONT,
    color: "#ffffff",
    anchorX: "center" as const,
    textAlign: "center" as const,
    maxWidth: TEXT_WIDTH,
    depthOffset: -4,
  };
  const titleSize = Math.min(TITLE_SIZE, TEXT_WIDTH / (title.length * FONT_ADVANCE));
  return (
    <group position={[0, y, z]} rotation-y={rotationY}>
      <Text
        {...common}
        position-y={BOARD_H / 2 - 0.25 - (TITLE_SIZE - titleSize) / 2}
        anchorY="top"
        fontSize={titleSize}
        whiteSpace="nowrap"
        lineHeight={1.25}
      >
        {title.toUpperCase()}
      </Text>
      <Text {...common} position-y={BOARD_H / 2 - 1.05} anchorY="top" fontSize={0.34} lineHeight={1.3} color="#d8f0e0">
        {body}
      </Text>
    </group>
  );
}
