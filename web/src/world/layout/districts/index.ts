// Every district rendered in the town (Milestone 1). Each district is authored in town tile
// coordinates in its own file; helpers.ts documents the grid and road-piece conventions.
//
//   home         Home & Campus (north end of the avenue, spawn)
//   engineering  Engineering District (south of the roundabout, plus the Game Dev corner)
//   raceway      Speed King Raceway (east of the roundabout)
import type { DistrictLayout } from "@/world/layout/types";
import { engineering } from "./engineering";
import { home } from "./home";
import { raceway } from "./raceway";

export const DISTRICT_LAYOUTS: DistrictLayout[] = [home, engineering, raceway];
