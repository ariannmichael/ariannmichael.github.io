// Single entry point for all portfolio content. Data files are owned by the content agent.
import type { District, DistrictId, Game, Job } from "./types";
import { districts } from "./districts";
import { games } from "./games";
import { jobs } from "./jobs";

export * from "./types";
export { profile } from "./profile";
export { links } from "./links";
export { jobs } from "./jobs";
export { games } from "./games";
export { skills } from "./skills";
export { districts } from "./districts";

export type ContentItem = { type: "job"; item: Job } | { type: "game"; item: Game };

export function getContent(id: string): ContentItem | undefined {
  const job = jobs.find((j) => j.id === id);
  if (job) return { type: "job", item: job };
  const game = games.find((g) => g.id === id);
  if (game) return { type: "game", item: game };
  return undefined;
}

export function getDistrict(id: DistrictId): District {
  const d = districts.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown district: ${id}`);
  return d;
}
