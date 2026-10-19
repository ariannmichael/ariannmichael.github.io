// GTA San Andreas-style mission marker: a translucent red tube of light rising off the ground and
// fading out upwards, a bright ring and soft disc on the ground, and a camera-facing glow at the base.
// The tube and ground disc are alpha-blended (additive red over the bright green ground turns
// yellow, so they paint red instead); the halo is additive light on top. Nothing writes depth (so
// markers never hide each other or the car), and everything is built once: every marker shares the same three geometries and three materials. Per-marker brightness
// and pulse live in mesh.userData and are pushed into the shared uniforms just before each draw
// (bindMarkerUniforms), which is the standard three.js way to vary a shared ShaderMaterial per object.
import {
  AdditiveBlending,
  NormalBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  PlaneGeometry,
  ShaderMaterial,
  Sphere,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import { MARKER_FX } from "@/world/fx/juiceRules";
import { ZONE_SIZE } from "./markers";

/** Ground ring radii (m): the same footprint the old yellow ring had */
export const MARKER_RING_INNER = ZONE_SIZE * 0.36;
export const MARKER_RING_OUTER = ZONE_SIZE * 0.42;
/** Soft ground glow reaches this far out (m) */
const GLOW_OUTER = ZONE_SIZE * 0.58;
/** The light tube: radius (m, mid-ring) and height (m; the label floats above it) */
export const MARKER_BEAM_RADIUS = (MARKER_RING_INNER + MARKER_RING_OUTER) / 2;
export const MARKER_BEAM_HEIGHT = 3.4;
/** Base glow: centre height (m) and full size (m) of the camera-facing halo */
const HALO_Y = 0.9;
const HALO_SIZE = 7.5;

export const MARKER_COLOR = new Color("#ff1a1a");
/** The ring core is pushed towards this, so it reads as "hot" rather than flat red */
const MARKER_CORE = new Color("#ff9a9a");

/** Per-mesh state (mesh.userData.marker), copied into the shared uniforms before each draw */
export interface MarkerDrawState {
  /** Overall brightness multiplier (0 = invisible, ~1 = calm, more = lit/active) */
  intensity: number;
  /** Brightness pulse amplitude (0 = steady) */
  pulse: number;
}

/** Set a marker's brightness and pulse for its next draw. */
export function setMarkerDraw(state: MarkerDrawState, intensity: number, pulse: number): void {
  state.intensity = intensity;
  state.pulse = pulse;
}

/** Time uniform shared by all three materials: one write per frame drives every marker */
const sharedTime = { value: 0 };

export function setMarkerTime(seconds: number): void {
  sharedTime.value = seconds;
}

function makeUniforms() {
  return {
    uTime: sharedTime,
    uColor: { value: MARKER_COLOR.clone() },
    uCore: { value: MARKER_CORE.clone() },
    uIntensity: { value: 1 },
    uPulse: { value: 0 },
  };
}

const COMMON_FRAGMENT_HEAD = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uIntensity;
  uniform float uPulse;
  // A slow breathing pulse shared by every part of the marker
  float pulse() { return 1.0 + uPulse * sin(uTime * ${MARKER_FX.pulseSpeed.toFixed(2)}); }
`;

/** Open tube; uv.y runs 0 at the ground to 1 at the top */
const BEAM_VERTEX = /* glsl */ `
  varying float vH;
  varying float vRim;
  void main() {
    vH = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    // 0 facing the camera, 1 at the silhouette: the tube's edges glow like a lit glass wall
    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  ${COMMON_FRAGMENT_HEAD}
  varying float vH;
  varying float vRim;
  void main() {
    // Bright at the base, gone at the top
    float fade = pow(1.0 - vH, 1.7);
    // Faint bands drifting upwards, so the column reads as light rather than a plastic tube
    float bands = 0.88 + 0.12 * sin(vH * 14.0 - uTime * 2.2);
    float a = 0.5 * fade * bands * mix(0.55, 1.0, vRim) * uIntensity * pulse();
    // Extra heat right at the foot of the tube
    vec3 col = mix(uColor, uCore, 0.35 * pow(1.0 - vH, 6.0));
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

/** Flat plane in its own XY (metres), laid on the ground by the mesh rotation */
const DISC_VERTEX = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISC_FRAGMENT = /* glsl */ `
  ${COMMON_FRAGMENT_HEAD}
  varying vec2 vP;
  const float RIN = ${MARKER_RING_INNER.toFixed(3)};
  const float ROUT = ${MARKER_RING_OUTER.toFixed(3)};
  const float RGLOW = ${GLOW_OUTER.toFixed(3)};
  void main() {
    float r = length(vP);
    if (r > RGLOW) discard;
    // Crisp ring with soft edges
    float ring = smoothstep(RIN - 0.1, RIN + 0.02, r) * (1.0 - smoothstep(ROUT - 0.02, ROUT + 0.1, r));
    // Translucent disc inside, brightening towards the ring
    float fill = (1.0 - step(RIN, r)) * (0.16 + 0.22 * pow(r / RIN, 3.0));
    // Glow bleeding off both sides of the ring
    float inner = (1.0 - step(RIN, r)) * pow(clamp(1.0 - (RIN - r) / 0.9, 0.0, 1.0), 2.0) * 0.35;
    float outer = step(ROUT, r) * pow(clamp(1.0 - (r - ROUT) / (RGLOW - ROUT), 0.0, 1.0), 2.0) * 0.55;
    float a = (ring + fill + inner + outer) * uIntensity * pulse();
    vec3 col = mix(uColor, uCore, ring * 0.45);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

/** A quad expanded in view space, so it always faces the camera whatever the planet's local up is */
const HALO_VERTEX = /* glsl */ `
  varying vec2 vQ;
  void main() {
    vQ = position.xy * 2.0; // -1..1
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * ${HALO_SIZE.toFixed(2)};
    gl_Position = projectionMatrix * mv;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  ${COMMON_FRAGMENT_HEAD}
  varying vec2 vQ;
  void main() {
    float d = length(vQ);
    if (d > 1.0) discard;
    float a = pow(1.0 - d, 2.4) * 0.38 * uIntensity * pulse();
    gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

function glowMaterial(
  vertexShader: string,
  fragmentShader: string,
  doubleSided: boolean,
  additive: boolean,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: makeUniforms(),
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
    side: doubleSided ? DoubleSide : FrontSide,
    // Marker light ignores fog, like GTA's markers that read across the map
    fog: false,
    toneMapped: false,
  });
}

export interface MarkerFxAssets {
  beamGeometry: BufferGeometry;
  discGeometry: BufferGeometry;
  haloGeometry: BufferGeometry;
  beamMaterial: ShaderMaterial;
  discMaterial: ShaderMaterial;
  haloMaterial: ShaderMaterial;
  haloY: number;
}

let assets: MarkerFxAssets | null = null;

/** The shared geometry and materials, built on first use and kept for the page's lifetime. */
export function markerFxAssets(): MarkerFxAssets {
  if (assets) return assets;
  const beamGeometry = new CylinderGeometry(MARKER_BEAM_RADIUS, MARKER_BEAM_RADIUS, MARKER_BEAM_HEIGHT, 40, 1, true);
  beamGeometry.translate(0, MARKER_BEAM_HEIGHT / 2, 0);
  const discGeometry = new PlaneGeometry(GLOW_OUTER * 2, GLOW_OUTER * 2);
  const haloGeometry = new PlaneGeometry(1, 1);
  // The quad is resized in the shader: give culling its real extent
  haloGeometry.boundingSphere = new Sphere(new Vector3(), HALO_SIZE * 0.75);
  assets = {
    beamGeometry,
    discGeometry,
    haloGeometry,
    beamMaterial: glowMaterial(BEAM_VERTEX, BEAM_FRAGMENT, true, false),
    discMaterial: glowMaterial(DISC_VERTEX, DISC_FRAGMENT, false, false),
    haloMaterial: glowMaterial(HALO_VERTEX, HALO_FRAGMENT, false, true),
    haloY: HALO_Y,
  };
  return assets;
}

/**
 * mesh.onBeforeRender for every marker mesh: copies this mesh's MarkerDrawState into its (shared)
 * material and flags the uniforms for re-upload, since three only uploads uniforms automatically
 * when the material changes between draws.
 */
export function bindMarkerUniforms(
  this: Object3D,
  _renderer: unknown,
  _scene: unknown,
  _camera: unknown,
  _geometry: unknown,
  material: Material,
): void {
  const state = this.userData.marker as MarkerDrawState | undefined;
  const m = material as ShaderMaterial;
  if (!state || !m.uniforms) return;
  m.uniforms.uIntensity.value = state.intensity;
  m.uniforms.uPulse.value = state.pulse;
  m.uniformsNeedUpdate = true;
}
