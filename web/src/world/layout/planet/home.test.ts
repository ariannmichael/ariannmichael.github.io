// Load the layout index first: frame → terrain → layouts is an import cycle, and layouts call
// offsetLatLon at module top level, so frame must finish initialising before any layout runs.
import "@/world/layout/planet";
import { describe, it } from "vitest";
import { checkLayout } from "./a/check";
import { homeLayout } from "./home";

describe("home layout (Hometown Meadow)", () => {
  it("passes the biome authoring checks", () => {
    checkLayout(homeLayout, ["about", "contact", "cv", "ufcg", "ufcg-monitor", "proj4me"]);
  });
});
