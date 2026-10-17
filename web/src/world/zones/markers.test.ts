import { describe, expect, it } from "vitest";
import { DISTRICT_LAYOUTS } from "@/world/layout/districts";
import { districtColliderBoxes } from "@/world/town/colliders";
import { CV_URL, indexMarkers, interactAction, markerLabel, zoneKey } from "./markers";

describe("markers", () => {
  it("labels: explicit label, then kind defaults, then id", () => {
    expect(markerLabel({ id: "x", kind: "job", x: 0, z: 0, label: "Custom" })).toBe("Custom");
    expect(markerLabel({ id: "about", kind: "about", x: 0, z: 0 })).toBe("About me");
    expect(markerLabel({ id: "contact", kind: "contact", x: 0, z: 0 })).toBe("Contact");
    expect(markerLabel({ id: "cv", kind: "cv", x: 0, z: 0 })).toBe("Download CV");
  });

  it("cv downloads, everything else opens a card", () => {
    expect(interactAction({ id: "cv", kind: "cv" })).toEqual({ type: "download", url: CV_URL });
    expect(interactAction({ id: "speed-king", kind: "game" })).toEqual({ type: "card", id: "speed-king" });
    expect(CV_URL).toBe("/cv/Ariann_Michael_CV.pdf");
  });

  it("indexes markers by district and id", () => {
    const index = indexMarkers(DISTRICT_LAYOUTS);
    for (const l of DISTRICT_LAYOUTS) for (const m of l.markers) expect(index.get(zoneKey(l.id, m.id))).toBe(m);
  });
});

describe("district colliders", () => {
  it("skip road tiles and dynamic props, box everything else", () => {
    for (const l of DISTRICT_LAYOUTS) {
      const expected = l.placements.filter(
        (p) => p.body !== "dynamic" && !p.model.startsWith("city-roads/road-") && p.collider !== "none",
      ).length;
      expect(districtColliderBoxes(l)).toHaveLength(expected);
    }
  });
});
