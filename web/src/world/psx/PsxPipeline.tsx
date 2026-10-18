"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  HalfFloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type WebGLRenderer,
} from "three";
import { useAppStore } from "@/state/useAppStore";
import { PSX_DEFAULTS, internalResolution, snapGrid, targetHeight, type PsxConfig } from "./config";
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
    });
    this.target.texture.name = "psx-scene";

    this.material = new ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tScene: { value: this.target.texture },
        uRes: { value: new Vector2(1, 1) },
        uLevels: { value: 31 },
        uDither: { value: 1 },
        uScanlines: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
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

  /** Scene → low-res target → dither/quantise → screen. */
  render(renderer: WebGLRenderer, scene: Object3D, camera: Camera): void {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prev);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
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
