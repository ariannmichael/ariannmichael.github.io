// Flatten a loaded glTF scene into its mesh primitives, each with its transform relative to the
// scene root, so every primitive can become one InstancedMesh.
import { Matrix4, type BufferGeometry, type Material, type Mesh, type Object3D } from "three";

export interface Primitive {
  name: string;
  geometry: BufferGeometry;
  material: Material;
  /** Node transform relative to the glTF scene root (raw Kenney units) */
  matrix: Matrix4;
}

/** Local transform of `obj` relative to `root`, computed from local matrices (does not trust matrixWorld). */
export function matrixRelativeTo(obj: Object3D, root: Object3D, out = new Matrix4()): Matrix4 {
  out.identity();
  let node: Object3D | null = obj;
  const local = new Matrix4();
  while (node && node !== root) {
    local.compose(node.position, node.quaternion, node.scale);
    out.premultiply(local);
    node = node.parent;
  }
  return out;
}

const cache = new WeakMap<Object3D, Primitive[]>();

export function extractPrimitives(root: Object3D): Primitive[] {
  const cached = cache.get(root);
  if (cached) return cached;
  const out: Primitive[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    out.push({
      name: mesh.name,
      geometry: mesh.geometry,
      material,
      matrix: matrixRelativeTo(mesh, root),
    });
  });
  cache.set(root, out);
  return out;
}
