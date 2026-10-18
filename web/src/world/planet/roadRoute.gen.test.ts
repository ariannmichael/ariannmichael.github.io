// Not a real test: `npm run roads` runs it with ROADS_WRITE=1 to (re)bake roads.generated.ts.
// Vitest is the runner because it resolves the "@/…" imports the layouts use.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "vitest";
import { formatRoadData, routeAll } from "./roadRoute";

it.skipIf(!process.env.ROADS_WRITE)("bakes roads.generated.ts", () => {
  const data = routeAll();
  // jsdom gives import.meta.url an http scheme, so resolve from the package root (`npm run` cwd)
  writeFileSync(resolve(process.cwd(), "src/world/planet/roads.generated.ts"), formatRoadData(data));
  for (const r of data) console.log(`${r.from} → ${r.to}: ${r.points.length / 3} points`);
}, 120_000);
