import { afterEach, describe, expect, it } from "vitest";
import {
  Material,
  Mesh,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  ShaderLib,
  ShaderMaterial,
  Texture,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";
import {
  __resetPsxPatchForTests,
  applyPsxToScene,
  installPsxMaterialPatch,
  isPsxEligible,
  patchMaterial,
  psxUniforms,
  transformFragmentShader,
  transformVertexShader,
} from "./patchMaterials";

const renderer = {} as WebGLRenderer;

function compile(m: Material, lib: { vertexShader: string; fragmentShader: string }) {
  const shader = {
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  const key = m.customProgramCacheKey();
  m.onBeforeCompile(shader, renderer);
  return { shader, key };
}

afterEach(() => __resetPsxPatchForTests());

describe("shader transforms", () => {
  it("wraps main and snaps gl_Position once (idempotent)", () => {
    const src = "void main() {\n  gl_Position = vec4(0.0);\n}";
    const once = transformVertexShader(src, false)!;
    expect(once).toContain("void psxOrigMain()");
    expect(once).toContain("gl_Position = psxSnap(gl_Position);");
    expect(once.match(/void main\(\)/g)).toHaveLength(1);
    expect(transformVertexShader(once, false)).toBe(once);
    expect(transformVertexShader("// no entry point", false)).toBeNull();
  });
  it("affine: writes uv*w in the vertex and replaces the map lookup in the fragment", () => {
    const vs = transformVertexShader(ShaderLib.standard.vertexShader, true)!;
    expect(vs).toContain("vPsxAffine = vec3(vMapUv * gl_Position.w, gl_Position.w);");
    const fs = transformFragmentShader(ShaderLib.standard.fragmentShader, true);
    expect(fs).not.toContain("#include <map_fragment>");
    expect(fs).toContain("texture2D( map, psxMapUv )");
    expect(transformFragmentShader(fs, true)).toBe(fs);
    expect(transformFragmentShader(ShaderLib.standard.fragmentShader, false)).toBe(ShaderLib.standard.fragmentShader);
  });
});

describe("material patch", () => {
  it("prototype hook patches built-ins only while enabled, with distinct cache keys", () => {
    installPsxMaterialPatch();
    const m = new MeshStandardMaterial({ map: new Texture() });
    const off = compile(m, ShaderLib.standard);
    expect(off.shader.vertexShader).not.toContain("psxSnap");
    expect(off.shader.uniforms.psxSnapRes).toBe(psxUniforms.psxSnapRes); // attached even when off

    applyPsxToScene(new Scene(), true);
    const on = compile(m, ShaderLib.standard);
    expect(on.shader.vertexShader).toContain("psxSnap");
    expect(on.shader.fragmentShader).toContain("psxMapUv");
    expect(on.key).not.toBe(off.key);
    expect(on.key).toContain("|psx:a");

    const lambert = compile(new MeshLambertMaterial({ vertexColors: true }), ShaderLib.lambert);
    expect(lambert.key).toContain("|psx");
    expect(lambert.key).not.toContain(":a"); // no map → no affine
  });

  it("custom ShaderMaterials get snapping (no affine)", () => {
    applyPsxToScene(new Scene(), true);
    const m = new ShaderMaterial({ vertexShader: "void main(){ gl_Position = vec4(position,1.0); }", fragmentShader: "void main(){}" });
    const { shader } = compile(m, m);
    expect(shader.vertexShader).toContain("psxOrigMain");
    expect(shader.vertexShader).not.toContain("vPsxAffine");
  });

  it("wraps a material's own onBeforeCompile, keeps calling it, and is idempotent", () => {
    applyPsxToScene(new Scene(), true);
    const m = new MeshStandardMaterial();
    let calls = 0;
    m.onBeforeCompile = () => {
      calls++;
    };
    expect(patchMaterial(m)).toBe(true);
    const hook = m.onBeforeCompile;
    const keyFn = m.customProgramCacheKey;
    expect(Object.prototype.hasOwnProperty.call(m, "customProgramCacheKey")).toBe(true);
    patchMaterial(m);
    expect(m.onBeforeCompile).toBe(hook);
    expect(m.customProgramCacheKey).toBe(keyFn);
    const { shader, key } = compile(m, ShaderLib.standard);
    expect(calls).toBe(1);
    expect(key).toContain("|psx");
    expect(shader.vertexShader.match(/void psxOrigMain\(\)/g)).toHaveLength(1);
  });

  it("skips depth, troika-style and opted-out materials", () => {
    expect(isPsxEligible(new MeshDepthMaterial())).toBe(false);
    const sky = new ShaderMaterial();
    sky.userData.psxSkip = true;
    expect(isPsxEligible(sky)).toBe(false);
    const text = Object.assign(new MeshStandardMaterial(), { isDerivedMaterial: true });
    expect(isPsxEligible(text)).toBe(false);
    expect(patchMaterial(text)).toBe(false);
  });

  it("toggling marks scene materials for recompile and enforces nearest filtering", () => {
    installPsxMaterialPatch();
    const map = new Texture();
    const m = new MeshStandardMaterial({ map });
    const scene = new Scene();
    scene.add(new Mesh(new PlaneGeometry(), m));
    m.customProgramCacheKey(); // "compiled" under the current epoch
    const v0 = m.version;
    applyPsxToScene(scene, true);
    expect(m.version).toBeGreaterThan(v0);
    expect(map.magFilter).toBe(1003); // NearestFilter
    applyPsxToScene(scene, false);
    expect(map.magFilter).toBe(1006); // LinearFilter restored
  });
});
