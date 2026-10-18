import { describe, expect, it } from "vitest";
import { Color, Fog, Layers, PerspectiveCamera, Scene, type WebGLRenderer } from "three";
import { LABEL_LAYER } from "./config";
import { PsxPass } from "./PsxPipeline";

interface Call {
  scene: Scene;
  mask: number;
  target: unknown;
  autoClear: boolean;
  background: unknown;
  fog: unknown;
}

/** Just enough of WebGLRenderer for PsxPass: records each render() with the state it saw. */
function fakeRenderer() {
  const calls: Call[] = [];
  let target: unknown = null;
  const renderer = {
    autoClear: true,
    extensions: { has: () => true },
    getRenderTarget: () => target,
    setRenderTarget: (t: unknown) => {
      target = t;
    },
    render(scene: Scene, camera: PerspectiveCamera) {
      calls.push({
        scene,
        mask: camera.layers.mask,
        target,
        autoClear: renderer.autoClear,
        background: scene.background,
        fog: scene.fog,
      });
    },
  };
  return { renderer, calls };
}

const layerMask = (...layers: number[]) => {
  const l = new Layers();
  l.disableAll();
  layers.forEach((n) => l.enable(n));
  return l.mask;
};

describe("PsxPass.render", () => {
  it("renders the scene low-res without labels, blits, then labels alone at full res", () => {
    const { renderer, calls } = fakeRenderer();
    const pass = new PsxPass(renderer as unknown as WebGLRenderer);
    const scene = new Scene();
    scene.background = new Color("red");
    scene.fog = new Fog("red", 60, 180);
    const camera = new PerspectiveCamera();
    camera.layers.enable(LABEL_LAYER);

    pass.render(renderer as unknown as WebGLRenderer, scene, camera);

    expect(calls).toHaveLength(3);
    const [low, blit, labels] = calls;
    expect(low.scene).toBe(scene);
    expect(low.target).toBe(pass.target);
    expect(low.mask).toBe(layerMask(0));
    expect(low.fog).toBe(scene.fog);

    expect(blit.scene).not.toBe(scene);
    expect(blit.target).toBeNull();

    expect(labels.scene).toBe(scene);
    expect(labels.target).toBeNull();
    expect(labels.mask).toBe(layerMask(LABEL_LAYER));
    expect(labels.autoClear).toBe(false);
    expect(labels.background).toBeNull();
    expect(labels.fog).toBeNull();
  });

  it("restores the camera layers, autoClear, background, fog and matrix auto-update", () => {
    const { renderer } = fakeRenderer();
    const pass = new PsxPass(renderer as unknown as WebGLRenderer);
    const scene = new Scene();
    const bg = new Color("blue");
    scene.background = bg;
    const fog = new Fog("white", 1, 2);
    scene.fog = fog;
    const camera = new PerspectiveCamera();
    camera.layers.enable(LABEL_LAYER);
    camera.layers.enable(5);
    const mask = camera.layers.mask;

    pass.render(renderer as unknown as WebGLRenderer, scene, camera);

    expect(camera.layers.mask).toBe(mask);
    expect(renderer.autoClear).toBe(true);
    expect(scene.background).toBe(bg);
    expect(scene.fog).toBe(fog);
    expect(scene.matrixWorldAutoUpdate).toBe(true);
  });

  it("feeds the low-res depth texture to the post pass, which writes it to the screen depth", () => {
    const { renderer } = fakeRenderer();
    const pass = new PsxPass(renderer as unknown as WebGLRenderer);
    expect(pass.target.depthTexture).toBeTruthy();
    expect(pass.material.uniforms.tDepth.value).toBe(pass.target.depthTexture);
    expect(pass.material.depthWrite).toBe(true);
    expect(pass.material.depthTest).toBe(true);
    expect(pass.material.fragmentShader).toContain("gl_FragDepth");
  });
});
