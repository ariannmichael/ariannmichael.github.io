import type { District } from "./types";

// v2 planet: every career district is a biome you can drive to (names match world/planet/biomes.ts).
export const districts: District[] = [
  { id: "home", name: "Hometown Meadow", blurb: "Where it started: UFCG, Proj4me, and about me.", milestone: 1 },
  { id: "engineering", name: "Downtown Plateau", blurb: "Product engineering for B2B platforms.", milestone: 1 },
  { id: "healthcare", name: "Clinic Lakeside", blurb: "HIPAA-regulated platforms: Afya and DrChrono.", milestone: 1 },
  { id: "financial", name: "Desert Mesa", blurb: "Payments and subscriptions at GoDaddy.", milestone: 1 },
  { id: "opensource", name: "Alien Crater", blurb: "Federated learning at OpenMined.", milestone: 1 },
  { id: "gamedev", name: "Game Dev Park", blurb: "My itch.io games, playable in the browser.", milestone: 1 },
  { id: "raceway", name: "Speed King Canyon", blurb: "My game Speed King, out on Steam Nov 10, 2026.", milestone: 1 },
];
