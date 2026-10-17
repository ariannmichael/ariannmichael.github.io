// Kenney (CC0) model pipeline: source GLBs -> web/public/models/<kit>/<model>.glb + manifest.
//
// Run from web/ (Node 24):
//   npm run models
// Optional: KENNEY_DIR=/path/to/Kenney npm run models   (default ~/Documents/Personal/Kenney)
//           npm run models -- city-roads car-kit       (only these kits; the manifest keeps the
//                                                       other kits' current entries)
//
// Per kit (table and scale rationale in scripts/kits.config.mjs):
//   - Cleans public/models/<kit>/ and rewrites it (idempotent).
//   - Writes the shared palette once as public/models/<kit>/colormap.webp (512 px, lossless, no resize,
//     so palette swatches never bleed into each other).
// Per model:
//   - Removes the external colormap texture but keeps the material (name, baseColorFactor) and UVs.
//     At runtime the world assigns the kit's colormap.webp to those materials.
//   - Drops the KHR_materials_unlit declaration (racing/space kits) and makes every material matte
//     (metallicFactor 0; the space kit ships metal 1, which renders near-black without an env map).
//   - Keeps the node hierarchy and node names (no join/flatten/instance). Positions stay float32, because
//     position quantization rewrites node transforms (it would rescale the car's wheel nodes).
//     Normals/UVs are quantized, then everything is meshopt-compressed (EXT_meshopt_compression,
//     so the loader needs the meshopt decoder, which drei's useGLTF enables by default).
//   - Bakes the optional kit `offset` (raw units) into the root nodes. The kit `scale` is NOT baked in.
//   - Computes bounds (all nodes, kit scale applied) for src/world/models/manifest.generated.ts.
import { readdir, mkdir, rm, writeFile, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, weld, reorder, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { KITS } from "./kits.config.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = path.join(WEB, "public", "models");
const MANIFEST = path.join(WEB, "src", "world", "models", "manifest.generated.ts");
const KENNEY_DIR = process.env.KENNEY_DIR ?? path.join(homedir(), "Documents", "Personal", "Kenney");
const PALETTE = "colormap.png";

const round = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
// Keep the log quiet about expected noise: Kenney's Unity exporter declares extensions we drop anyway,
// and the flat-colour kits have UVs outside [0,1] (unused), which quantize() then leaves as float.
const QUIET = ["Missing optional extension", "Skipping TEXCOORD"];
io.setLogger({
  debug() {},
  info() {},
  warn: (m) => !QUIET.some((q) => m.includes(q)) && console.warn(m),
  error: console.error,
});

/** Remove an extension declaration once nothing in the document uses it. */
function disposeExtension(doc, name, stillUsed) {
  const ext = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === name);
  if (ext && !stillUsed) ext.dispose();
}

async function processModel(kit, srcFile, outFile) {
  const doc = await io.read(srcFile);
  const root = doc.getRoot();

  // 1. Materials: drop the shared palette (served once per kit), un-unlit the flat-colour kits.
  for (const mat of root.listMaterials()) {
    const tex = mat.getBaseColorTexture();
    if (tex && (tex.getURI() ?? "").endsWith(PALETTE)) mat.setBaseColorTexture(null);
    if (mat.getExtension("KHR_materials_unlit")) {
      mat.setExtension("KHR_materials_unlit", null);
      mat.setRoughnessFactor(1);
    }
    // The space kit marks its flat greys metallicFactor 1, which renders near-black without an env
    // map. Kenney's look is matte everywhere, so make every untextured-metal material dielectric.
    if (!mat.getMetallicRoughnessTexture()) mat.setMetallicFactor(0);
  }
  for (const tex of root.listTextures()) {
    if ((tex.getURI() ?? "").endsWith(PALETTE)) tex.dispose();
  }
  disposeExtension(doc, "KHR_materials_unlit", root.listMaterials().some((m) => m.getExtension("KHR_materials_unlit")));
  // Kenney only uses KHR_texture_transform as a no-op on the palette texture.
  disposeExtension(doc, "KHR_texture_transform", root.listTextures().length > 0);

  // Tangents are only useful with normal maps, and Kenney models have none.
  const hasNormalMap = root.listMaterials().some((m) => m.getNormalTexture());
  if (!hasNormalMap) {
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const t = prim.getAttribute("TANGENT");
        if (t) prim.setAttribute("TANGENT", null);
      }
    }
  }

  // 2. Kit-specific node fixes (hierarchy untouched).
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (kit.offset) {
    for (const node of scene.listChildren()) {
      const t = node.getTranslation();
      node.setTranslation([t[0] + kit.offset[0], t[1] + kit.offset[1], t[2] + kit.offset[2]]);
    }
  }
  for (const node of root.listNodes()) {
    // Unity export noise in the racing kit: "raceCarRed %8angles(Clone)" -> "raceCarRed".
    const clean = node.getName().replace(/\(Clone\)$/, "").replace(/\s*%\w+$/, "").trim();
    if (clean !== node.getName()) node.setName(clean);
  }

  // 3. Bounds in metres (all nodes' world transforms, then kit scale).
  const b = getBounds(scene);
  const min = b.min.map((v) => round(v * kit.scale));
  const max = b.max.map((v) => round(v * kit.scale));

  // 4. Optimize without touching nodes: no join/flatten/instance/position quantization.
  await doc.transform(
    dedup(),
    prune({ keepAttributes: true, keepLeaves: true, keepIndices: true }),
    weld(),
    reorder({ encoder: MeshoptEncoder, target: "size" }),
    quantize({ pattern: /^(NORMAL|TEXCOORD_\d+)$/, quantizeNormal: 8, quantizeTexcoord: 12 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });

  const bytes = await io.writeBinary(doc);
  await writeFile(outFile, bytes);
  return { min, max, size: bytes.byteLength };
}

async function processKit(kit) {
  const srcDir = path.join(KENNEY_DIR, kit.folder, kit.subdir ?? path.join("Models", "GLB format"));
  if (!existsSync(srcDir)) throw new Error(`Kit "${kit.id}": source folder not found: ${srcDir}`);
  const outDir = path.join(OUT_ROOT, kit.id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let texture = null;
  let textureSize = 0;
  const palette = path.join(srcDir, "Textures", PALETTE);
  if (existsSync(palette)) {
    const outTex = path.join(outDir, "colormap.webp");
    // Lossless: lossy WebP subsamples chroma (4:2:0), which bleeds colour across swatch edges.
    await sharp(await readFile(palette)).webp({ lossless: true, effort: 6 }).toFile(outTex);
    textureSize = (await stat(outTex)).size;
    texture = `/models/${kit.id}/colormap.webp`;
  }

  const files = (await readdir(srcDir)).filter((f) => f.toLowerCase().endsWith(".glb")).sort();
  const models = {};
  let total = textureSize;
  let largest = { name: "", size: 0 };
  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    const { min, max, size } = await processModel(kit, path.join(srcDir, file), path.join(outDir, `${name}.glb`));
    const ref = `${kit.id}/${name}`;
    models[ref] = { ref, kit: kit.id, url: `/models/${kit.id}/${name}.glb`, min, max };
    total += size;
    if (size > largest.size) largest = { name, size };
  }
  console.log(
    `${kit.id.padEnd(18)} ${String(files.length).padStart(4)} models  ${mb(total).padStart(9)}  ` +
      `texture: ${texture ? kb(textureSize) : "none (flat colours)"}  largest: ${largest.name} ${kb(largest.size)}`,
  );
  return { info: { id: kit.id, scale: kit.scale, texture }, models, total };
}

/** Read the current manifest so a partial run (only some kits) keeps the other kits' entries. */
async function readExistingManifest() {
  if (!existsSync(MANIFEST)) return { KITS: {}, MODELS: {} };
  const src = await readFile(MANIFEST, "utf8");
  const KITS_ = {};
  const MODELS_ = {};
  const kitRe = /^ {2}"([^"]+)": \{ id: "[^"]+", scale: ([\d.]+), texture: (null|"[^"]*") \},$/gm;
  for (const [, id, scale, texture] of src.matchAll(kitRe)) {
    KITS_[id] = { id, scale: Number(scale), texture: JSON.parse(texture) };
  }
  const modelRe = /^ {2}"([^"]+)": m\("([^"]+)", "([^"]+)", (\[[^\]]*\]), (\[[^\]]*\])\),$/gm;
  for (const [, ref, kit, name, min, max] of src.matchAll(modelRe)) {
    MODELS_[ref] = { ref, kit, url: `/models/${kit}/${name}.glb`, min: JSON.parse(min), max: JSON.parse(max) };
  }
  return { KITS: KITS_, MODELS: MODELS_ };
}

function sortObject(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

async function main() {
  const only = process.argv.slice(2);
  const unknown = only.filter((id) => !KITS.some((k) => k.id === id));
  if (unknown.length) throw new Error(`Unknown kit id(s): ${unknown.join(", ")}`);
  const selected = only.length ? KITS.filter((k) => only.includes(k.id)) : KITS;

  console.log(`Kenney source: ${KENNEY_DIR}\n`);
  const existing = only.length ? await readExistingManifest() : { KITS: {}, MODELS: {} };
  const kits = { ...existing.KITS };
  let models = { ...existing.MODELS };
  let total = 0;
  let count = 0;
  for (const kit of selected) {
    const res = await processKit(kit);
    // Drop stale entries of this kit before merging (models may have been removed).
    models = Object.fromEntries(Object.entries(models).filter(([, m]) => m.kit !== kit.id));
    kits[kit.id] = res.info;
    Object.assign(models, res.models);
    total += res.total;
    count += Object.keys(res.models).length;
  }

  // Deterministic output: sorted keys, numbers already rounded to 3 decimals. One line per model
  // (built through a tiny helper) keeps the file greppable and ~4x smaller than pretty JSON.
  const vec = (v) => `[${v.join(", ")}]`;
  const kitLines = Object.values(sortObject(kits)).map(
    (k) => `  ${JSON.stringify(k.id)}: { id: ${JSON.stringify(k.id)}, scale: ${k.scale}, texture: ${JSON.stringify(k.texture)} },`,
  );
  const modelLines = Object.values(sortObject(models)).map((m) => {
    const name = m.ref.slice(m.kit.length + 1);
    return `  ${JSON.stringify(m.ref)}: m(${JSON.stringify(m.kit)}, ${JSON.stringify(name)}, ${vec(m.min)}, ${vec(m.max)}),`;
  });
  const compact = [
    "// GENERATED by web/scripts/prepare-models.mjs (`npm run models`). Do not edit by hand.",
    "// Kenney assets, CC0. Kit scales and rationale: web/scripts/kits.config.mjs.",
    "// Bounds are in metres with the kit scale applied; the .glb files themselves are NOT scaled.",
    'import type { KitInfo, ModelInfo } from "./types";',
    "",
    "type Vec3 = [number, number, number];",
    "const m = (kit: string, name: string, min: Vec3, max: Vec3): ModelInfo => ({",
    "  ref: `${kit}/${name}`,",
    "  kit,",
    "  url: `/models/${kit}/${name}.glb`,",
    "  min,",
    "  max,",
    "});",
    "",
    "export const KITS: Record<string, KitInfo> = {",
    ...kitLines,
    "};",
    "",
    "export const MODELS: Record<string, ModelInfo> = {",
    ...modelLines,
    "};",
    "",
  ].join("\n");
  await writeFile(MANIFEST, compact);

  // Whole-folder size (includes kits from earlier partial runs).
  let folderTotal = 0;
  for (const dir of await readdir(OUT_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of await readdir(path.join(OUT_ROOT, dir.name))) folderTotal += (await stat(path.join(OUT_ROOT, dir.name, f))).size;
  }
  console.log(`\nProcessed ${count} models in ${selected.length} kits: ${mb(total)}`);
  console.log(`public/models total: ${mb(folderTotal)} (budget 30 MB)`);
  console.log(`Manifest: ${path.relative(WEB, MANIFEST)} (${Object.keys(models).length} models, ${Object.keys(kits).length} kits)`);
  if (folderTotal > 30 * 1024 * 1024) {
    console.error("Over the 30 MB budget for public/models.");
    process.exitCode = 1;
  }
}

await main();
