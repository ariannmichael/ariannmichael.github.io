"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AlwaysDepth,
  BufferGeometry,
  DepthTexture,
  Float32BufferAttribute,
  HalfFloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type WebGLRenderer,
} from "three";
import { useAppStore } from "@/state/useAppStore";
import { LABEL_LAYER, PSX_DEFAULTS, internalResolution, snapGrid, targetHeight, type PsxConfig } from "./config";
import { applyPsxToScene, psxUniforms, refreshPsxMaterials } from "./patchMaterials";
import { POST_FRAGMENT, POST_VERTEX } from "./postShader";

/** Takes over R3F rendering: any useFrame with priority > 0 disables the automatic render. */
export const PSX_RENDER_PRIORITY = 1;
/** Frames between material sweeps (new own-hook materials, re-added stale materials). */
const REFRESH_FRAMES = 30;

/**
 * Keeps scene materials in sync with the PSX flag: patches/unpatches on toggle, then sweeps every
 * REFRESH_FRAMES frames while on. PsxPipeline already calls it; use it directly only without the pipeline.
 */
export function usePsxMaterials(enabled: boolean): void {
  const scene = useThree((s) => s.scene);
  const frames = useRef(0);

  useEffect(() => {
    applyPsxToScene(scene, enabled);
    return () => {
      if (enabled) applyPsxToScene(scene, false);
    };
  }, [scene, enabled]);

  useFrame(() => {
    if (!enabled) return;
    frames.current++;
    if (frames.current % REFRESH_FRAMES === 0) refreshPsxMaterials(scene);
  });
}

/**
 * Labels live on LABEL_LAYER only, so the default camera must see that layer for smooth mode's normal
 * render. Re-applied every frame because the active camera can be swapped (FollowCamera, makeDefault).
 */
function useLabelLayer(): void {
  useFrame(({ camera }) => {
    camera.layers.enable(LABEL_LAYER);
  });
}

export interface PsxPipelineProps extends Partial<PsxConfig> {
  /** Override the store's `psx` flag (default: follow useAppStore.psx) */
  enabled?: boolean;
}

/**
 * The PSX look. Mount once inside <Canvas>. While `psx` is on it renders the scene into a small
 * nearest-filtered render target and draws it full screen through the dither/quantise pass, and
 * keeps every material vertex-snapped. When off it renders nothing and R3F's normal render resumes.
 */
export function PsxPipeline({ enabled, ...overrides }: PsxPipelineProps) {
  const storePsx = useAppStore((s) => s.psx);
  const on = enabled ?? storePsx;
  usePsxMaterials(on);
  useLabelLayer();
  return on ? <PsxRenderPass {...overrides} /> : null;
}

/** Linear colour precision for the low-res target: half float avoids 8-bit-linear banding in darks. */
function pickTargetType(gl: WebGLRenderer) {
  const ext = gl.extensions;
  return ext.has("EXT_color_buffer_half_float") || ext.has("EXT_color_buffer_float") ? HalfFloatType : UnsignedByteType;
}

/**
 * The imperative half of the pipeline (render target, post material, full-screen triangle).
 * A class so React only holds a handle and calls methods on it.
 */
export class PsxPass {
  readonly target: WebGLRenderTarget;
  readonly material: ShaderMaterial;
  private readonly geometry: BufferGeometry;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(gl: WebGLRenderer) {
    this.target = new WebGLRenderTarget(1, 1, {
      type: pickTargetType(gl),
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
      // Kept as a texture so the post pass can hand it to the full-res label pass (see render())
      depthTexture: new DepthTexture(1, 1, UnsignedIntType),
    });
    this.target.texture.name = "psx-scene";

    this.material = new ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tScene: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uRes: { value: new Vector2(1, 1) },
        uLevels: { value: 31 },
        uDither: { value: 1 },
        uScanlines: { value: 0 },
      },
      // Writes the upscaled scene depth (gl_FragDepth). depthTest must stay on for GL to write depth
      // at all, so the test is made a no-op instead.
      depthTest: true,
      depthFunc: AlwaysDepth,
      depthWrite: true,
    });
    this.material.userData.psxSkip = true;

    // One oversized triangle covers the screen (no diagonal seam, fewer vertices than a quad)
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const tri = new Mesh(this.geometry, this.material);
    tri.frustumCulled = false;
    this.scene.add(tri);
  }

  /** Resize the low-res target and the shared vertex-snap grid. */
  setResolution(width: number, height: number, snapHeight: number): void {
    this.target.setSize(width, height);
    this.material.uniforms.uRes.value.set(width, height);
    const grid = snapGrid(width, height, snapHeight);
    psxUniforms.psxSnapRes.value.set(grid.x, grid.y);
  }

  setLook(c: Pick<PsxConfig, "colorBits" | "dither" | "scanlines" | "scanlineStrength" | "affine">): void {
    const u = this.material.uniforms;
    u.uLevels.value = Math.pow(2, Math.max(1, Math.min(8, Math.round(c.colorBits)))) - 1;
    u.uDither.value = c.dither;
    u.uScanlines.value = c.scanlines ? c.scanlineStrength : 0;
    psxUniforms.psxAffine.value = c.affine;
  }

  /**
   * 1. Scene minus LABEL_LAYER → low-res target (colour + depth).
   * 2. Dither/quantise to the screen, writing the nearest-upscaled depth alongside.
   * 3. LABEL_LAYER only, straight to the screen at full resolution, depth-tested against step 2.
   * Labels therefore render exactly once per frame, crisp, and still hide behind buildings.
   */
  render(renderer: WebGLRenderer, scene: Scene | Object3D, camera: Camera): void {
    const prevTarget = renderer.getRenderTarget();
    const prevMask = camera.layers.mask;

    camera.layers.disable(LABEL_LAYER);
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);
    renderer.render(this.scene, this.camera);

    camera.layers.set(LABEL_LAYER);
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false; // keep the blitted colour and depth
    // A Color background is only applied on clear, but a texture/cube background would draw a
    // full-screen mesh over the blit, so hide it. PSX fog is short (60-180 m) and would wash the
    // labels out at intro-orbit distances; they are a UI overlay here, so draw them unfogged.
    // Matrices were already updated by the first pass.
    const s = scene as Scene;
    const prevBackground = s.isScene ? s.background : null;
    const prevFog = s.isScene ? s.fog : null;
    const prevAutoUpdate = scene.matrixWorldAutoUpdate;
    if (s.isScene) {
      s.background = null;
      s.fog = null;
    }
    scene.matrixWorldAutoUpdate = false;
    try {
      renderer.render(scene, camera);
    } finally {
      scene.matrixWorldAutoUpdate = prevAutoUpdate;
      if (s.isScene) {
        s.background = prevBackground;
        s.fog = prevFog;
      }
      renderer.autoClear = prevAutoClear;
      camera.layers.mask = prevMask;
    }
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}

function PsxRenderPass(overrides: Partial<PsxConfig>) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const quality = useAppStore((s) => s.quality);
  const config = { ...PSX_DEFAULTS, ...overrides };
  const { heightDesktop, heightMobile, snapHeight, colorBits, dither, affine, scanlines, scanlineStrength } = config;

  // Disposed on unmount (PSX toggled off) or renderer change. three re-creates GL resources if a
  // disposed pass is used again (React StrictMode re-runs effects), so this is safe.
  const pass = useMemo(() => new PsxPass(gl), [gl]);
  useEffect(() => () => pass.dispose(), [pass]);

  const res = useMemo(
    () =>
      internalResolution(
        size.width,
        size.height,
        targetHeight(size.width, size.height, quality, { heightDesktop, heightMobile }),
      ),
    [size.width, size.height, quality, heightDesktop, heightMobile],
  );

  useEffect(() => {
    pass.setResolution(res.width, res.height, snapHeight);
  }, [pass, res, snapHeight]);

  useEffect(() => {
    pass.setLook({ colorBits, dither, scanlines, scanlineStrength, affine });
  }, [pass, colorBits, dither, scanlines, scanlineStrength, affine]);

  useFrame(({ gl: renderer, scene, camera }) => pass.render(renderer, scene, camera), PSX_RENDER_PRIORITY);

  return null;
}
