// Car lamps: brake/tail, reverse and headlights as ONE additive mesh (a bright core quad plus a soft
// halo quad per lamp, all in one geometry; the shader picks each lamp's level from a per-vertex kind),
// plus one small headlight SpotLight on night-side biomes. Lives under the model's "body" node, so the
// lamps lean and squash with the body. Coordinates are raw model units (the car group scales them).
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  Object3D,
  ShaderMaterial,
  SpotLight,
  Vector3,
} from "three";
import { damp } from "@/world/lib/damping";
import { skyState } from "@/world/scene/skyState";
import type { VehicleState } from "@/world/vehicle/vehicleState";
import { brakeLightLevel, headlightLevel, reverseLightLevel, tailLevel } from "./juiceRules";

/** Lamp kinds (vertex attribute aKind) */
const KIND = { tail: 0, reverse: 1, head: 2 } as const;

export const CAR_LIGHTS = {
  /**
   * Lamp centres in the SUV's "body" node frame (model units; +Z nose, +X left). The body mesh spans
   * x ±0.75, y 0–1.1, z -1.2…1.35; lamps sit a hair outside the end faces.
   */
  tail: { x: 0.6, y: 0.62, z: -1.215, w: 0.2, h: 0.12 },
  reverse: { x: 0.42, y: 0.62, z: -1.215, w: 0.1, h: 0.08 },
  head: { x: 0.55, y: 0.5, z: 1.365, w: 0.22, h: 0.12 },
  /** Halo quad size relative to the lamp, and its peak strength */
  haloScale: 3,
  haloStrength: 0.45,
  colors: { tail: "#ff2a1a", reverse: "#f4f7ff", head: "#fff3c4" },
  /** How fast lamps switch (1/s): quick, but not a one-frame pop */
  lambda: 22,
  /** Headlight spot: position/target in body units, intensity (cd) at full night, cone */
  spot: {
    position: [0, 0.6, 1.4] as const,
    target: [0, -1.2, 12] as const,
    intensity: 30,
    distance: 28,
    decay: 1.2,
    angle: 0.55,
    penumbra: 0.6,
  },
} as const;

type Lamp = { x: number; y: number; z: number; w: number; h: number };

/** Build the lamp geometry: per lamp side (±x), a core quad and a halo quad. */
export function buildLampGeometry(): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const kind: number[] = [];
  const halo: number[] = [];
  const index: number[] = [];
  const quad = (cx: number, cy: number, z: number, w: number, h: number, k: number, isHalo: number) => {
    const base = pos.length / 3;
    const hw = w / 2;
    const hh = h / 2;
    pos.push(cx - hw, cy - hh, z, cx + hw, cy - hh, z, cx + hw, cy + hh, z, cx - hw, cy + hh, z);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) {
      kind.push(k);
      halo.push(isHalo);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const lamp = (l: Lamp, k: number) => {
    // Halo slightly further out than the core so the two never z-fight
    const out = Math.sign(l.z) * 0.004;
    for (const side of [1, -1]) {
      quad(l.x * side, l.y, l.z, l.w, l.h, k, 0);
      quad(l.x * side, l.y, l.z + out, l.w * CAR_LIGHTS.haloScale, l.h * CAR_LIGHTS.haloScale, k, 1);
    }
  };
  lamp(CAR_LIGHTS.tail, KIND.tail);
  lamp(CAR_LIGHTS.reverse, KIND.reverse);
  lamp(CAR_LIGHTS.head, KIND.head);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute("aKind", new BufferAttribute(new Float32Array(kind), 1));
  g.setAttribute("aHalo", new BufferAttribute(new Float32Array(halo), 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

const vertexShader = /* glsl */ `
  attribute float aKind;
  attribute float aHalo;
  uniform vec3 uLevels; // tail, reverse, head
  varying vec2 vUv;
  varying float vLevel;
  varying float vHalo;
  varying float vKind;
  void main() {
    vUv = uv;
    vHalo = aHalo;
    vKind = aKind;
    vLevel = aKind < 0.5 ? uLevels.x : (aKind < 1.5 ? uLevels.y : uLevels.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTail;
  uniform vec3 uReverse;
  uniform vec3 uHead;
  uniform float uHaloStrength;
  varying vec2 vUv;
  varying float vLevel;
  varying float vHalo;
  varying float vKind;
  void main() {
    if (vLevel < 0.01) discard;
    vec3 col = vKind < 0.5 ? uTail : (vKind < 1.5 ? uReverse : uHead);
    float mask;
    if (vHalo > 0.5) {
      // Soft, chunky (4-step) falloff: a PS1-style glow without bloom
      float d = length(vUv - 0.5) * 2.0;
      mask = floor((1.0 - smoothstep(0.0, 1.0, d)) * 4.0) / 4.0 * uHaloStrength;
    } else {
      mask = 1.0;
    }
    float a = vLevel * mask;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`;

export class CarLights {
  readonly group = new Group();
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  readonly spot: SpotLight;
  private readonly target = new Object3D();
  private readonly levels = { tail: 0, reverse: 0, head: 0 };

  constructor() {
    this.group.name = "car-lights";
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uLevels: { value: new Vector3() },
        uTail: { value: new Color(CAR_LIGHTS.colors.tail) },
        uReverse: { value: new Color(CAR_LIGHTS.colors.reverse) },
        uHead: { value: new Color(CAR_LIGHTS.colors.head) },
        uHaloStrength: { value: CAR_LIGHTS.haloStrength },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    this.mesh = new Mesh(buildLampGeometry(), this.material);
    this.mesh.name = "car-lamps";
    this.mesh.renderOrder = 5;
    // VehicleModel re-materials every mesh under the car; this flag opts the lamps out
    this.mesh.userData.keepMaterial = true;
    this.group.add(this.mesh);

    const s = CAR_LIGHTS.spot;
    this.spot = new SpotLight(CAR_LIGHTS.colors.head, 0, s.distance, s.angle, s.penumbra, s.decay);
    this.spot.position.set(...s.position);
    this.target.position.set(...s.target);
    this.spot.target = this.target;
    this.group.add(this.target);
  }

  /**
   * The spot costs per-pixel lighting on every lit material, and adding/removing a light recompiles
   * shaders, so it is only attached in "high" quality (a rare toggle) and dimmed to 0 by day.
   */
  setSpotEnabled(enabled: boolean): void {
    if (enabled && !this.spot.parent) this.group.add(this.spot);
    else if (!enabled && this.spot.parent) this.group.remove(this.spot);
  }

  update(dt: number, v: VehicleState): void {
    const brake = brakeLightLevel(v.throttle, v.forwardSpeed, v.handbrake);
    const head = headlightLevel(skyState.night);
    const l = this.levels;
    l.tail = damp(l.tail, tailLevel(brake, head), CAR_LIGHTS.lambda, dt);
    l.reverse = damp(l.reverse, reverseLightLevel(v.throttle, v.forwardSpeed), CAR_LIGHTS.lambda, dt);
    l.head = damp(l.head, head, CAR_LIGHTS.lambda, dt);
    (this.material.uniforms.uLevels.value as Vector3).set(l.tail, l.reverse, l.head);
    this.spot.intensity = CAR_LIGHTS.spot.intensity * l.head;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.spot.dispose();
  }
}
