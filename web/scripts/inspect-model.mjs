// Debug helper: print node tree, materials, textures and bounds of one or more GLBs.
// Usage (from web/): node scripts/inspect-model.mjs <file.glb> [--tree] [more.glb ...]
// Works on both Kenney sources and the optimized outputs in public/models (meshopt-aware).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds } from "@gltf-transform/core";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const args = process.argv.slice(2);
const showTree = args.includes("--tree");
const files = args.filter((a) => !a.startsWith("--"));

const r = (v) => v.map((n) => Math.round(n * 1000) / 1000);

for (const file of files) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const b = getBounds(scene);
  const size = b.max.map((v, i) => v - b.min[i]);
  console.log(`\n${file}`);
  console.log(`  bounds min ${r(b.min)} max ${r(b.max)} size ${r(size)}`);
  console.log(
    `  materials: ${root
      .listMaterials()
      .map((m) => `${m.getName()}[${r(m.getBaseColorFactor())}]${m.getBaseColorTexture() ? "+tex" : ""}`)
      .join(", ")}`,
  );
  console.log(`  textures: ${root.listTextures().map((t) => t.getURI() || t.getName()).join(", ") || "none"}`);
  if (showTree) {
    const walk = (node, depth) => {
      const mesh = node.getMesh();
      const attrs = mesh
        ? mesh
            .listPrimitives()
            .map((p) => p.listSemantics().join("+"))
            .join(" | ")
        : "";
      console.log(
        `  ${"  ".repeat(depth)}- ${node.getName() || "(unnamed)"} t=${r(node.getTranslation())} r=${r(node.getRotation())} s=${r(node.getScale())}${mesh ? ` mesh(${attrs})` : ""}`,
      );
      node.listChildren().forEach((c) => walk(c, depth + 1));
    };
    scene.listChildren().forEach((n) => walk(n, 0));
  }
}
