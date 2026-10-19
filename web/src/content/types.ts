// Shared content contract. The 3D world and the Plain View both render from these types.

export type DistrictId =
  | "home"
  | "engineering"
  | "healthcare"
  | "financial"
  | "opensource"
  | "gamedev"
  | "raceway";

export interface Metric {
  label: string;
  value: string;
}

export interface Job {
  id: string;
  company: string;
  /** End client when working through a contractor, e.g. "PlanetBids", "GoDaddy". */
  client?: string;
  role: string;
  /** Milestone 2 home of this job. Until a district exists, the card is shown in "engineering". */
  district: DistrictId;
  /** ISO month, "2025-05" */
  start: string;
  /** ISO month, or null when current */
  end: string | null;
  current?: boolean;
  location?: string;
  kind: "job" | "open-source" | "education" | "teaching";
  summary: string;
  highlights: string[];
  metrics: Metric[];
  stack: string[];
}

export interface Game {
  id: string;
  title: string;
  platform: "steam" | "itch";
  tagline: string;
  genre: string;
  url: string;
  /** itch.io HTML5 embed URL, when the game can be played in an iframe */
  embedUrl?: string;
  steamAppId?: number;
  /** ISO date, "2026-11-10" */
  releaseDate?: string;
  publisher?: string;
  /** Path under /public, e.g. "/media/speed-king/cover.jpg" */
  cover?: string;
  /** Short muted gameplay loop under /public */
  clip?: string;
  district: DistrictId;
}

export interface Skill {
  id: string;
  name: string;
  category: "frontend" | "backend" | "architecture" | "testing" | "infra" | "gamedev";
}

export interface District {
  id: DistrictId;
  name: string;
  blurb: string;
  /** Milestone in which the district gets its own geometry */
  milestone: 1 | 2;
}

export interface Links {
  email: string;
  github: string;
  linkedin: string;
  itch: string;
  steam: string;
  cv: string;
  site: string;
}

export interface Profile {
  name: string;
  headline: string;
  location: string;
  summary: string;
  yearsOfExperience: string;
  languages: string[];
}
