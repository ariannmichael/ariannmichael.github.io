// PSX look public API. See PsxPipeline (mount once in <Canvas>) and patchMaterials (shader patch).
export { PSX_DEFAULTS, PSX_FOG, SMOOTH_FOG, type PsxConfig } from "./config";
export { PsxPipeline, usePsxMaterials, PSX_RENDER_PRIORITY, type PsxPipelineProps } from "./PsxPipeline";
export {
  applyPsxToScene,
  installPsxMaterialPatch,
  isPsxEnabled,
  patchMaterial,
  psxUniforms,
  refreshPsxMaterials,
} from "./patchMaterials";
