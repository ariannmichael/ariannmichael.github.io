// Pure marker helpers: label text, zone lookup and the CV download path.
import { getContent, links } from "@/content";
import type { DistrictId } from "@/content/types";
import type { Marker, MarkerKind } from "@/world/layout/types";
import { districtOfBiome } from "@/world/lib/biomeMap";
import type { BiomeLayout, PlanetMarker } from "@/world/planet/types";

/** Sensor footprint around each marker (metres) */
export const ZONE_SIZE = 6;
export const ZONE_HEIGHT = 4;

const DEFAULT_LABELS: Partial<Record<MarkerKind, string>> = {
  about: "About me",
  contact: "Contact",
  cv: "Download CV",
};

/** Floating label: explicit marker label > content title (game title / job company) > kind default > id */
export function markerLabel(marker: Pick<Marker, "id" | "kind" | "label">): string {
  if (marker.label) return marker.label;
  const content = getContent(marker.id);
  if (content?.type === "game") return content.item.title;
  if (content?.type === "job") return content.item.company;
  return DEFAULT_LABELS[marker.kind] ?? marker.id;
}

export function zoneKey(district: DistrictId, id: string): string {
  return `${district}:${id}`;
}

/**
 * Index of every marker by "district:id" (the district its biome stands for), so an ActiveZone can be
 * resolved back to its kind. Markers in biomes without a district (badlands) can't become active zones.
 */
export function indexMarkers(layouts: readonly BiomeLayout[]): Map<string, PlanetMarker> {
  const map = new Map<string, PlanetMarker>();
  for (const l of layouts) {
    const district = districtOfBiome(l.biome);
    if (!district) continue;
    for (const m of l.markers) map.set(zoneKey(district, m.id), m);
  }
  return map;
}

export const CV_URL = links.cv || "/cv/Ariann_Michael_CV.pdf";

export type InteractAction = { type: "card"; id: string } | { type: "download"; url: string };

/** What pressing interact does for a marker. CV markers download the PDF instead of opening a card. */
export function interactAction(marker: Pick<Marker, "id" | "kind">): InteractAction {
  if (marker.kind === "cv") return { type: "download", url: CV_URL };
  return { type: "card", id: marker.id };
}
