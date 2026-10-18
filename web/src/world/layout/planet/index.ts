// Biome layouts on the planet: one file per biome (owned by biome agents), collected here (coordinator).
import type { BiomeLayout } from "@/world/planet/types";
import { badlandsLayout } from "./badlands";
import { engineeringLayout } from "./engineering";
import { financialLayout } from "./financial";
import { gamedevLayout } from "./gamedev";
import { healthcareLayout } from "./healthcare";
import { homeLayout } from "./home";
import { opensourceLayout } from "./opensource";
import { racewayLayout } from "./raceway";

export const PLANET_LAYOUTS: BiomeLayout[] = [
  homeLayout,
  engineeringLayout,
  healthcareLayout,
  financialLayout,
  opensourceLayout,
  gamedevLayout,
  racewayLayout,
  badlandsLayout,
];
