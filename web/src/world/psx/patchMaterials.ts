// PSX material patch: PS1 vertex snapping + (subtle) affine texture mapping, injected with
// onBeforeCompile into every material the renderer compiles while PSX is on.
//
// How new materials get patched without per-frame work: `installPsxMaterialPatch()` replaces the
// *default* Material.prototype.onBeforeCompile / customProgramCacheKey, so any material that never
// set its own hook (all built-ins, plain ShaderMaterials) is patched at compile time, whenever it is
// added. Materials that bring their own onBeforeCompile are wrapped by `patchMaterial()`, which
// `applyPsxToScene()` / `refreshPsxMaterials()` run over the scene (on toggle, then every ~30 frames).
// The PSX state is part of the program cache key, so patched and stock programs coexist and a toggle
// is just `material.needsUpdate = true`.
import {
  Material,
  NearestFilter,
  NearestMipmapNearestFilter,
  ShaderChunk,
  Vector2,
  type IUniform,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  type Object3D,
  type Texture,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import { PSX_DEFAULTS } from "./config";

/** Shared uniforms: every patched program references these same objects, so one write updates all. */
export const psxUniforms = {
  /** Vertex snapping grid in pixels (set by PsxPipeline from the internal resolution) */
  psxSnapRes: { value: new Vector2(427, 240) } as IUniform<Vector2>,
  /** 0..1 blend from perspective-correct to affine UVs for `map` */
  psxAffine: { value: PSX_DEFAULTS.affine } as IUniform<number>,
};

const state = {
  enabled: false,
  installed: false,
  /** Bumped on every toggle: materials compiled under an older epoch get recompiled when seen. */
  epoch: 0,
};

/** Epoch each material's program was last evaluated under (recorded in customProgramCacheKey). */
const compiledEpoch = new WeakMap<Material, number>();
const wrapped = new WeakSet<Material>();
const textureFilters = new WeakMap<Texture, { mag: MagnificationTextureFilter; min: MinificationTextureFilter }>();

type AnyMaterial = Material & {
  map?: Texture | null;
  isShaderMaterial?: boolean;
  isRawShaderMaterial?: boolean;
  isMeshDepthMaterial?: boolean;
  isMeshDistanceMaterial?: boolean;
  /** troika-three-text (drei <Text>) derived materials */
  isDerivedMaterial?: boolean;
};

const MAIN_RE = /\bvoid\s+main\s*\(\s*(?:void)?\s*\)/;
const MARKER = "psxOrigMain";

export function isPsxEnabled(): boolean {
  return state.enabled;
}

/**
 * Can this material take the patch? Skipped: shadow-map depth materials (the shadow camera has its own
 * clip space), RawShaderMaterial (its `#version` must stay first), troika text (labels stay crisp), and
 * anything that opts out with `material.userData.psxSkip = true` (the sky, the post pass).
 */
export function isPsxEligible(material: Material): boolean {
  const m = material as AnyMaterial;
  return !(
    m.userData?.psxSkip ||
    m.isMeshDepthMaterial ||
    m.isMeshDistanceMaterial ||
    m.isRawShaderMaterial ||
    m.isDerivedMaterial
  );
}

/** Affine UVs only for built-in materials with a `map` (their shaders use the standard map chunk). */
export function usesAffine(material: Material): boolean {
  const m = material as AnyMaterial;
  return !m.isShaderMaterial && !!m.map;
}

/** The PSX part of the program cache key ("" when PSX is off or the material is skipped). */
export function psxCacheKey(material: Material): string {
  compiledEpoch.set(material, state.epoch);
  if (!state.enabled || !isPsxEligible(material)) return "";
  return usesAffine(material) ? "|psx:a" : "|psx";
}

const SNAP_GLSL = /* glsl */ `
uniform vec2 psxSnapRes;
vec4 psxSnap(vec4 p) {
  // PS1 GTE: screen positions are integers. Quantise NDC to the snap grid, keep w for depth/perspective.
  if (p.w <= 0.0 || psxSnapRes.y < 1.0) return p;
  vec2 grid = psxSnapRes * 0.5;
  p.xy = floor(p.xy / p.w * grid + 0.5) / grid * p.w;
  return p;
}
`;

/**
 * Wraps the shader's main(): the original runs untouched (skinning, instancing, morphs, logdepth all
 * still apply), then gl_Position is snapped. Returns null when there's no main() to wrap.
 */
export function transformVertexShader(source: string, affine: boolean): string | null {
  if (source.includes(MARKER)) return source;
  if (!MAIN_RE.test(source)) return null;
  const affineDecl = affine ? "varying vec3 vPsxAffine;\n" : "";
  // uv * w interpolated perspective-correctly, divided by interpolated w = screen-linear (affine) UVs
  const affineWrite = affine ? "  vPsxAffine = vec3(vMapUv * gl_Position.w, gl_Position.w);\n" : "";
  return (
    affineDecl +
    SNAP_GLSL +
    source.replace(MAIN_RE, `void ${MARKER}()`) +
    `\nvoid main() {\n  ${MARKER}();\n  gl_Position = psxSnap(gl_Position);\n${affineWrite}}\n`
  );
}

/** Swaps the stock map lookup for one using the affine/perspective blend. */
export function transformFragmentShader(source: string, affine: boolean): string {
  if (!affine || source.includes("psxMapUv") || !source.includes("#include <map_fragment>")) return source;
  const chunk =
    "#ifdef USE_MAP\n  vec2 psxMapUv = mix(vMapUv, vPsxAffine.xy / vPsxAffine.z, psxAffine);\n#endif\n" +
    ShaderChunk.map_fragment.replaceAll("vMapUv", "psxMapUv");
  return (
    "varying vec3 vPsxAffine;\nuniform float psxAffine;\n" + source.replace("#include <map_fragment>", chunk)
  );
}

/** The compile-time patch. Safe to run twice on the same shader (marker check). */
export function applyPsxToShader(material: Material, shader: WebGLProgramParametersWithUniforms): void {
  if (!isPsxEligible(material)) return;
  // Always attach the shared uniforms, even when PSX is off: three reuses a material's cached
  // programs by key but keeps the uniforms object of its *latest* compile, so a patched program
  // picked back up after a toggle must still find them.
  shader.uniforms.psxSnapRes = psxUniforms.psxSnapRes;
  shader.uniforms.psxAffine = psxUniforms.psxAffine;
  if (!state.enabled) return;
  const affine = usesAffine(material);
  const vs = transformVertexShader(shader.vertexShader, affine);
  if (vs === null) return;
  shader.vertexShader = vs;
  shader.fragmentShader = transformFragmentShader(shader.fragmentShader, affine);
}

function protoOnBeforeCompile(this: Material, shader: WebGLProgramParametersWithUniforms): void {
  applyPsxToShader(this, shader);
}

function protoCacheKey(this: Material): string {
  // Same as three's default (the hook's source) plus the PSX variant
  return this.onBeforeCompile.toString() + psxCacheKey(this);
}

/** Installs the default hooks on Material.prototype. Idempotent; call once on the client. */
export function installPsxMaterialPatch(): void {
  if (state.installed) return;
  state.installed = true;
  Material.prototype.onBeforeCompile = protoOnBeforeCompile;
  Material.prototype.customProgramCacheKey = protoCacheKey;
}

/**
 * Patches one material. Materials without their own hook are already covered by the prototype hook;
 * materials with their own onBeforeCompile get it wrapped (theirs runs first, then PSX). Idempotent.
 * Returns true if the material is (now) patched.
 */
export function patchMaterial(material: Material): boolean {
  if (!isPsxEligible(material)) return false;
  installPsxMaterialPatch();
  if (wrapped.has(material)) return true;
  if (!Object.prototype.hasOwnProperty.call(material, "onBeforeCompile")) return true;
  const prev = material.onBeforeCompile;
  const prevKey = Object.prototype.hasOwnProperty.call(material, "customProgramCacheKey")
    ? material.customProgramCacheKey
    : null;
  material.onBeforeCompile = function psxWrappedOnBeforeCompile(
    this: Material,
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ) {
    prev.call(this, shader, renderer);
    applyPsxToShader(this, shader);
  };
  material.customProgramCacheKey = function psxWrappedCacheKey(this: Material) {
    return (prevKey ? prevKey.call(this) : prev.toString()) + psxCacheKey(this);
  };
  wrapped.add(material);
  return true;
}

/** Nearest filtering for `map` while PSX is on (original filters restored when off). */
function enforceNearest(material: Material, enabled: boolean): void {
  const map = (material as AnyMaterial).map;
  if (!map) return;
  const saved = textureFilters.get(map);
  if (enabled) {
    const min = map.generateMipmaps ? NearestMipmapNearestFilter : NearestFilter;
    if (map.magFilter === NearestFilter && map.minFilter === min) return;
    if (!saved) textureFilters.set(map, { mag: map.magFilter, min: map.minFilter });
    map.magFilter = NearestFilter;
    map.minFilter = min;
    map.needsUpdate = true;
  } else if (saved) {
    map.magFilter = saved.mag;
    map.minFilter = saved.min;
    map.needsUpdate = true;
    textureFilters.delete(map);
  }
}

function forEachMaterial(root: Object3D, fn: (m: Material) => void): void {
  root.traverse((obj) => {
    const mat = (obj as Object3D & { material?: Material | Material[] }).material;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach(fn);
    else fn(mat);
  });
}

/**
 * Turns the PSX material patch on/off for everything under `root` (normally the R3F scene).
 * Recompiles each material once (three caches both variants, so toggling back is cheap).
 */
export function applyPsxToScene(root: Object3D, enabled: boolean): void {
  installPsxMaterialPatch();
  if (state.enabled !== enabled) {
    state.enabled = enabled;
    state.epoch++;
  }
  forEachMaterial(root, (m) => {
    if (!isPsxEligible(m)) return;
    patchMaterial(m);
    enforceNearest(m, enabled);
    if (compiledEpoch.get(m) !== state.epoch) m.needsUpdate = true;
  });
}

/**
 * Cheap periodic sweep: wraps materials that arrived with their own onBeforeCompile and recompiles
 * materials last compiled under the other PSX state (e.g. shared materials re-added by biome streaming).
 */
export function refreshPsxMaterials(root: Object3D): void {
  forEachMaterial(root, (m) => {
    if (!isPsxEligible(m)) return;
    const own = !wrapped.has(m) && Object.prototype.hasOwnProperty.call(m, "onBeforeCompile");
    if (own) patchMaterial(m);
    enforceNearest(m, state.enabled);
    const seen = compiledEpoch.get(m);
    if (own || (seen !== undefined && seen !== state.epoch)) m.needsUpdate = true;
  });
}

/** Test helper: reset module state. */
export function __resetPsxPatchForTests(): void {
  state.enabled = false;
  state.epoch++;
}
