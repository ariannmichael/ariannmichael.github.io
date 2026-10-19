// The cozy pass: the whole frame through one warm grade. No EffectComposer, no dependencies — a
// render target, one fullscreen triangle and a shader. The positive-priority useFrame below is what
// makes this "post" processing: r3f stops auto-rendering the moment any callback has priority > 0,
// so this callback owns the frame — scene → target, then graded target → screen.
//
// The grade: shadows lean amber (candlelight), a gentle S-curve, a touch of saturation, a soft
// brown-not-black vignette, and grain that steps at 8 fps (chunky, PSX-style) while hiding the
// banding the fog gradients would otherwise show. Cozy = candlelight, not filters stacked deep.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { useAppStore } from "@/state/useAppStore";

/** Tuning table — everything the grade does, in one place. Tune by eye, in dev, with ?debug off. */
const COZY = {
  /** How far shadows lean toward amber (0 = off, 1 = full) */
  warm: 0.65,
  /** The amber the shadows lean toward (multipliers around white) */
  warmTint: [1.06, 0.99, 0.88] as const,
  /** S-curve mix: soft contrast without crushing */
  curve: 0.18,
  /** Saturation (1 = untouched) */
  saturation: 1.07,
  /** Vignette strength, and where it starts (0 = centre, 1 = corner) */
  vignette: 0.26,
  vignetteStart: 0.45,
  /** Grain amplitude */
  grain: 0.028,
} as const;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// The COZY constants are baked into the string once at module load — no per-frame uniforms for
// things that only change when you edit the file.
const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uRes;
  uniform float uTime;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  // Hoskins hash (no sin): the classic sin-hash fed pixel coordinates in the thousands makes a diagonal
  // lattice, not noise, and the dark-weighted grain made it show at dusk
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb;
    float l = luma(col);

    // Candlelight: the darker the pixel, the more it leans amber
    col *= mix(vec3(1.0), vec3(${COZY.warmTint}), (1.0 - smoothstep(0.0, 0.45, l)) * ${COZY.warm});

    // Gentle S-curve: soft contrast, blacks stay soft
    col = mix(col, col * col * (3.0 - 2.0 * col), ${COZY.curve});

    // A touch richer
    col = mix(vec3(l), col, ${COZY.saturation});

    // Vignette toward warm brown, never black (blue falls most, red least)
    float d = distance(vUv, vec2(0.5)) * 1.4142;
    float v = smoothstep(${COZY.vignetteStart}, 1.25, d);
    col *= 1.0 - v * ${COZY.vignette} * vec3(0.88, 1.0, 1.18);

    // Grain: stepped at 8 fps (chunky, not film-smooth), louder in the shadows
    float t = mod(floor(uTime * 8.0), 64.0) * 71.7;
    float n = hash(vUv * uRes + vec2(t, t * 1.3)) - 0.5;
    col += n * ${COZY.grain} * (1.3 - l);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface PassBundle {
  rt: WebGLRenderTarget;
  scene: Scene;
  camera: OrthographicCamera;
  mat: ShaderMaterial;
  dispose(): void;
}

function buildPass(high: boolean): PassBundle {
  // The scene normally renders to the screen, where the canvas provides MSAA and the sRGB encode.
  // Rendering to a target loses both, so: samples on the target (WebGL2), and SRGBColorSpace on its
  // texture — the encode happens into the target, the sampler decodes it back to linear for us.
  const rt = new WebGLRenderTarget(2, 2, { samples: high ? 4 : 0 });
  rt.texture.colorSpace = SRGBColorSpace;
  const geo = new BufferGeometry();
  // One triangle stretched past the screen: cheaper than a quad, and no seam
  geo.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { tDiffuse: { value: rt.texture }, uRes: { value: new Vector2() }, uTime: { value: 0 } },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(geo, mat);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  return {
    rt,
    scene,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    mat,
    dispose: () => {
      rt.dispose();
      mat.dispose();
      geo.dispose();
    },
  };
}

export function CozyPass() {
  const high = useAppStore((s) => s.quality) === "high";
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  // Mutable three state lives behind a ref (the house style for per-frame mutation)
  const pass = useRef<PassBundle | null>(null);

  // Built in an effect (not useMemo): the bundle is mutated every frame, and rebuilt on quality
  // switches when the target's sample count changes
  useEffect(() => {
    const bundle = buildPass(high);
    pass.current = bundle;
    return () => {
      bundle.dispose();
      if (pass.current === bundle) pass.current = null;
    };
  }, [high]);

  // Track the drawing buffer (size × dpr): resize the target and the grain's pixel grid. `high` is
  // in the deps so a fresh bundle gets sized too (effect order: build runs first, above).
  useEffect(() => {
    const b = pass.current;
    if (!b) return;
    const w = Math.max(2, Math.floor(size.width * dpr));
    const h = Math.max(2, Math.floor(size.height * dpr));
    b.rt.setSize(w, h);
    b.mat.uniforms.uRes.value.set(w, h);
  }, [high, size, dpr]);

  useFrame(({ gl, scene, camera }) => {
    const b = pass.current;
    if (!b) return;
    gl.setRenderTarget(b.rt);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    b.mat.uniforms.uTime.value = performance.now() / 1000;
    gl.render(b.scene, b.camera);
  }, 1);

  return null;
}
