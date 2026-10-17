// Model manifest contract. `manifest.generated.ts` is written by web/scripts/prepare-models.mjs.

export interface KitInfo {
  /** Kit id used in ModelRef, e.g. "city-roads" */
  id: string;
  /** Uniform scale applied to every model of the kit (already baked into ModelInfo bounds) */
  scale: number;
  /**
   * Public URL of the kit's shared palette texture (e.g. "/models/city-roads/colormap.webp"),
   * or null for kits that use flat material colours. Per-model .glb files do NOT embed the
   * texture: at runtime every textured primitive of the kit shares one material with this map.
   */
  texture: string | null;
}

export interface ModelInfo {
  /** "<kit>/<model>" */
  ref: string;
  kit: string;
  /** Public URL of the optimized .glb, e.g. "/models/city-roads/road-straight.glb" */
  url: string;
  /** Axis-aligned bounds in metres with the kit scale applied, in the model's own frame */
  min: [number, number, number];
  max: [number, number, number];
}
