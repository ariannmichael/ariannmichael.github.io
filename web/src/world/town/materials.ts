// Shared materials. Textured kits get ONE MeshStandardMaterial per palette texture; flat-colour kits
// reuse the glTF material, deduplicated by kit + material name so every model of the kit shares it.
import {
  CanvasTexture,
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

// --- The CV billboard ---------------------------------------------------------------------------------

// The home billboard is the CV download's landmark, but its kit texture is a generic ad ("Tankco
// Outdoor"). Swapped at runtime for a chunky PSX "DOWNLOAD MY CV" panel, drawn once. Scoped by model
// in ModelGroupView (racing-kit/billboard only), so the raceway billboards keep their own ads.
let cvBanner: MeshStandardMaterial | null = null;

export function cvBillboardMaterial(): MeshStandardMaterial {
  cvBanner ??= new MeshStandardMaterial({
    map: configurePalette(drawCvBanner()),
    roughness: 0.85,
    metalness: 0,
    side: DoubleSide,
  });
  return cvBanner;
}

/**
 * 256×128 canvas: cream panel, brick-red rails, two text lines and a down arrow. Low-res on
 * purpose — nearest filtering (via configurePalette) keeps the pixels chunky like the kits.
 */
function drawCvBanner(): CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f2e4c2"; // cream
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#8a2f2f"; // brick red rails
  g.fillRect(0, 0, w, 10);
  g.fillRect(0, h - 10, w, 10);
  g.fillStyle = "#2b2521";
  g.textAlign = "center";
  g.font = "bold 34px monospace";
  g.fillText("DOWNLOAD", w / 2, 52);
  g.fillText("MY CV", w / 2, 90);
  // chunky down arrow
  g.fillRect(w / 2 - 5, 98, 10, 14);
  g.beginPath();
  g.moveTo(w / 2 - 14, 110);
  g.lineTo(w / 2 + 14, 110);
  g.lineTo(w / 2, 123);
  g.closePath();
  g.fill();
  return new CanvasTexture(canvas);
}
