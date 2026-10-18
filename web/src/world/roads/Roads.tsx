"use client";

// The road network between the biomes: one asphalt ribbon over the flattened road beds, and a
// two-faced sign at every road end. The face toward arriving traffic names the town and what is in
// it; the face toward departing traffic names where the road goes and how far it is.

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, Vector3, type Group } from "three";
import { PLANET_LAYOUTS } from "@/world/layout/planet";
import type { BiomeId } from "@/world/planet/types";
import { LABEL_LAYER } from "@/world/psx/config";
import { markerLabel } from "@/world/zones/markers";
import { SIGN_POST_X as POST_X, biomeName, buildRoadRibbon, roadSigns, type RoadSign } from "./roadGeometry";

const LABEL_FONT = "/fonts/kenney-mini-square-mono.ttf";

const BOARD_W = 7.2;
const BOARD_H = 3.4;
const BOARD_BOTTOM = 2.4;
/** Signs further than this from the camera are hidden (they are unreadable and cost draw calls) */
const SIGN_HIDE_FAR = 110;

/** What each town holds, as it appears on its welcome sign: the stops' names, without their role. */
function contents(biome: BiomeId): string {
  const layout = PLANET_LAYOUTS.find((l) => l.biome === biome);
  const names = [...new Set((layout?.markers ?? []).map((m) => markerLabel(m).split(" · ")[0]))];
  return names.length ? names.join(" · ") : "Off-road playground: jumps, bowls, wrecks";
}

/** 32×64 PSX-ish asphalt: speckled grey, white edge lines, a dashed yellow centre line (repeats along v). */
function asphaltTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 64;
  const g = c.getContext("2d")!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 32; x++) {
      const v = 70 + Math.floor(rnd() * 14);
      g.fillStyle = `rgb(${v},${v},${v + 6})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = "#e8e8e0";
  g.fillRect(1, 0, 1, 64);
  g.fillRect(30, 0, 1, 64);
  g.fillStyle = "#f2c230";
  g.fillRect(15, 0, 2, 32);
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = NearestFilter;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function Roads() {
  const geometry = useMemo(() => buildRoadRibbon(), []);
  const texture = useMemo(() => asphaltTexture(), []);
  const signs = useMemo(() => roadSigns(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );

  return (
    <>
      <mesh geometry={geometry} name="roads" receiveShadow>
        {/* Polygon offset on top of the lift: the ground is faceted and PSX-snapped under the road */}
        <meshLambertMaterial map={texture} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
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
        <SignFace z={0.09} rotationY={0} y={boardY} {...welcome} />
        <SignFace z={-0.09} rotationY={Math.PI} y={boardY} {...onward} />
      </group>
    </>
  );
}

/** One face of a board: a big title on top and the town's stops below, on the label layer. */
function SignFace({ z, y, rotationY, title, body }: { z: number; y: number; rotationY: number; title: string; body: string }) {
  // Same label layer as the stop labels: drawn crisp at full resolution after the PSX pass
  const common = {
    layers: LABEL_LAYER,
    font: LABEL_FONT,
    color: "#ffffff",
    anchorX: "center" as const,
    textAlign: "center" as const,
    maxWidth: BOARD_W - 1.2,
  };
  return (
    <group position={[0, y, z]} rotation-y={rotationY}>
      <Text {...common} position-y={BOARD_H / 2 - 0.25} anchorY="top" fontSize={0.56}>
        {title.toUpperCase()}
      </Text>
      <Text {...common} position-y={BOARD_H / 2 - 1.05} anchorY="top" fontSize={0.34} lineHeight={1.3} color="#d8f0e0">
        {body}
      </Text>
    </group>
  );
}
