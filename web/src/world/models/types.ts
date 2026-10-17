// Model manifest contract. `manifest.generated.ts` is written by tools/prepare-models.mjs.

export interface KitInfo {
  /** Kit id used in ModelRef, e.g. "city-roads" */
  id: string;
  /** Uniform scale applied to every model of the kit so that 1 road tile = TILE metres */
  scale: number;
}

export interface ModelInfo {
  /** "<kit>/<model>" */
  ref: string;
  /** Public URL of the optimized .glb, e.g. "/models/city-roads/road-straight.glb" */
  url: string;
  /** Axis-aligned bounds in metres, kit scale already applied, in the model's own frame */
  min: [number, number, number];
  max: [number, number, number];
}
