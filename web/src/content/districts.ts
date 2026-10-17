import type { District } from "./types";

export const districts: District[] = [
  { id: "home", name: "Home & Campus", blurb: "Where it started: UFCG, Proj4me, and about me.", milestone: 1 },
  { id: "engineering", name: "Engineering District", blurb: "Product engineering for B2B platforms.", milestone: 1 },
  { id: "raceway", name: "Speed King Raceway", blurb: "My game Speed King, out on Steam Nov 10, 2026.", milestone: 1 },
  { id: "healthcare", name: "Healthcare District", blurb: "HIPAA-regulated platforms: Afya and DrChrono.", milestone: 2 },
  { id: "financial", name: "Financial District", blurb: "Payments and subscriptions at GoDaddy.", milestone: 2 },
  { id: "opensource", name: "Open Source Lab", blurb: "Federated learning at OpenMined.", milestone: 2 },
  { id: "gamedev", name: "Game Dev Park", blurb: "My itch.io games, playable in the browser.", milestone: 2 },
];
