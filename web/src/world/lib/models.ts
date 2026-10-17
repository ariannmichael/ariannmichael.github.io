// Thin, forgiving access to the generated model manifest. A missing model must never crash the
// world: callers get `undefined` and render a placeholder, and we warn once per ref.
import { KITS, MODELS } from "@/world/models/manifest.generated";
import type { KitInfo, ModelInfo } from "@/world/models/types";

export function lookupModel(ref: string): ModelInfo | undefined {
  return MODELS[ref];
}

export function lookupKit(id: string): KitInfo | undefined {
  return KITS[id];
}

export function kitOf(ref: string): string {
  return ref.slice(0, ref.indexOf("/"));
}

const warned = new Set<string>();

export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[world] ${message}`);
}
