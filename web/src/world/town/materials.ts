// Shared materials. Textured kits get ONE MeshStandardMaterial per palette texture; flat-colour kits
// reuse the glTF material, deduplicated by kit + material name so every model of the kit shares it.
import {
  DoubleSide,
  MeshStandardMaterial,
  NearestFilter,
  SRGBColorSpace,
  type Material,
  type Texture,
} from "three";

const paletteMaterials = new Map<string, MeshStandardMaterial>();
const flatMaterials = new Map<string, Material>();

/** Configure a Kenney palette texture: sRGB, glTF UV convention (no flip), crisp swatches. */
export function configurePalette(texture: Texture): Texture {
  if (texture.userData.paletteConfigured) return texture;
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  // The palette is a grid of flat colour swatches: nearest filtering keeps edges crisp and
  // skipping mipmaps stops distant swatches bleeding into their neighbours.
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.userData.paletteConfigured = true;
  texture.needsUpdate = true;
  return texture;
}

export function paletteMaterial(url: string, texture: Texture): MeshStandardMaterial {
  let m = paletteMaterials.get(url);
  if (!m) {
    m = new MeshStandardMaterial({
      map: configurePalette(texture),
      roughness: 0.85,
      metalness: 0,
      // The Kenney "colormap" material is double-sided (some thin pieces are single planes)
      side: DoubleSide,
    });
    m.name = `palette:${url}`;
    paletteMaterials.set(url, m);
  }
  return m;
}

export function flatMaterial(kit: string, material: Material): Material {
  // A few racing-kit models (billboards, flags, pits) keep a small embedded texture: two such
  // materials can share a name but not a map, so never merge textured materials.
  if ((material as MeshStandardMaterial).map) return material;
  const key = `${kit}/${material.name || material.uuid}`;
  let m = flatMaterials.get(key);
  if (!m) {
    m = material;
    flatMaterials.set(key, m);
  }
  return m;
}
