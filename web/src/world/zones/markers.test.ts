import { describe, expect, it } from "vitest";
import { getContent } from "@/content";
import "@/world/layout/planet";
import { homeLayout } from "@/world/layout/planet/home";
import { lookupModel } from "@/world/lib/models";
import { biomeColliderBoxes } from "@/world/town/colliders";
import { groupByModel } from "@/world/town/group";
import type { BiomeLayout } from "@/world/planet/types";
import { CV_URL, indexMarkers, interactAction, markerLabel, zoneKey } from "./markers";

describe("markers", () => {
  it("labels: explicit label, then kind defaults, then id", () => {
    expect(markerLabel({ id: "x", kind: "job", label: "Custom" })).toBe("Custom");
    expect(markerLabel({ id: "about", kind: "about" })).toBe("About me");
    expect(markerLabel({ id: "contact", kind: "contact" })).toBe("Contact");
    expect(markerLabel({ id: "cv", kind: "cv" })).toBe("Download CV");
  });

  it("cv downloads, everything else opens a card", () => {
    expect(interactAction({ id: "cv", kind: "cv" })).toEqual({ type: "download", url: CV_URL });
    expect(interactAction({ id: "speed-king", kind: "game" })).toEqual({ type: "card", id: "speed-king" });
    expect(CV_URL).toBe("/cv/Ariann_Michael_CV.pdf");
  });

  it("indexes markers by the district of their biome; badlands markers are skipped", () => {
    const race: BiomeLayout = {
      biome: "raceway",
      spawn: { lat: 0, lon: 0, yaw: 0 },
      placements: [],
      markers: [{ id: "speed-king", kind: "game", lat: 0, lon: 0 }],
      pads: [],
    };
    const bad: BiomeLayout = { ...race, biome: "badlands", markers: [{ id: "x", kind: "job", lat: 0, lon: 0 }] };
    const index = indexMarkers([homeLayout, race, bad]);
    for (const m of homeLayout.markers) expect(index.get(zoneKey("home", m.id))).toBe(m);
    expect(index.get(zoneKey("raceway", "speed-king"))).toBe(race.markers[0]);
    expect(index.size).toBe(homeLayout.markers.length + 1);
  });
});

// Small inline fixture with known contents (the integration sandbox was removed once real biomes existed).
const FIXTURE: BiomeLayout = {
  biome: "home",
  spawn: { lat: 10, lon: 0, yaw: 0 },
  pads: [],
  markers: [{ lat: 10.1, lon: 0, id: "about", kind: "about" }],
  placements: [
    { lat: 10, lon: 0.05, model: "city-roads/road-straight" }, // road: drive-through
    { lat: 10, lon: 0.1, model: "city-suburban/building-type-a" }, // solid
    { lat: 10, lon: 0.15, model: "mini-arcade/floor", scale: 2.4 }, // 0.15 m thin: drive-through
    { lat: 10, lon: 0.2, model: "city-commercial/building-a", collider: "none" }, // explicit none
    { lat: 10, lon: 0.25, model: "car-kit/cone", body: "dynamic" },
    { lat: 10, lon: 0.3, model: "car-kit/cone", body: "dynamic" },
  ],
};

describe("layout grouping and colliders", () => {
  it("real home layout only uses manifest models, and its markers resolve to content", () => {
    for (const p of homeLayout.placements) expect(lookupModel(p.model), p.model).toBeDefined();
    for (const m of homeLayout.markers) {
      if (m.kind === "job" || m.kind === "game") expect(getContent(m.id), m.id).toBeDefined();
    }
  });

  it("groups into instanced statics and dynamic props", () => {
    const groups = groupByModel([FIXTURE]);
    const cones = groups.find((g) => g.ref === "car-kit/cone")!;
    expect(cones.dynamics).toHaveLength(2);
    expect(cones.statics).toHaveLength(0);
    const total = groups.reduce((n, g) => n + g.statics.length + g.dynamics.length, 0);
    expect(total).toBe(FIXTURE.placements.length);
  });

  it("colliders: skip roads, thin pieces, collider:none and dynamic props; box everything else", () => {
    expect(biomeColliderBoxes(FIXTURE)).toHaveLength(1); // only the house
  });
});
