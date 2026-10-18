import { describe, expect, it } from "vitest";
import { getContent } from "@/content";
import { SANDBOX_LAYOUT } from "@/world/layout/planet/_sandbox";
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
    const index = indexMarkers([SANDBOX_LAYOUT, race, bad]);
    for (const m of SANDBOX_LAYOUT.markers) expect(index.get(zoneKey("home", m.id))).toBe(m);
    expect(index.get(zoneKey("raceway", "speed-king"))).toBe(race.markers[0]);
    expect(index.size).toBe(SANDBOX_LAYOUT.markers.length + 1);
  });
});

describe("sandbox layout", () => {
  it("only uses models from the manifest, and its markers resolve to content", () => {
    for (const p of SANDBOX_LAYOUT.placements) expect(lookupModel(p.model), p.model).toBeDefined();
    for (const m of SANDBOX_LAYOUT.markers) {
      if (m.kind === "job" || m.kind === "game") expect(getContent(m.id), m.id).toBeDefined();
    }
  });

  it("groups into instanced statics and dynamic props", () => {
    const groups = groupByModel([SANDBOX_LAYOUT]);
    const cones = groups.find((g) => g.ref === "car-kit/cone")!;
    expect(cones.dynamics.length).toBeGreaterThan(0);
    expect(cones.statics).toHaveLength(0);
    const total = groups.reduce((n, g) => n + g.statics.length + g.dynamics.length, 0);
    expect(total).toBe(SANDBOX_LAYOUT.placements.length);
  });

  it("colliders: skip roads and dynamic props, box everything else", () => {
    const expected = SANDBOX_LAYOUT.placements.filter(
      (p) => p.body !== "dynamic" && !p.model.startsWith("city-roads/road-") && p.collider !== "none",
    ).length;
    expect(biomeColliderBoxes(SANDBOX_LAYOUT)).toHaveLength(expected);
  });
});
