import { describe, expect, it } from "vitest";
import { districts, games, getContent, jobs, links, profile, skills } from "./index";

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const districtIds = new Set(districts.map((d) => d.id));

describe("ids", () => {
  it("are unique across jobs and games", () => {
    const ids = [...jobs.map((j) => j.id), ...games.map((g) => g.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("are unique across skills", () => {
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("are all found by getContent", () => {
    for (const j of jobs) expect(getContent(j.id)).toEqual({ type: "job", item: j });
    for (const g of games) expect(getContent(g.id)).toEqual({ type: "game", item: g });
    expect(getContent("does-not-exist")).toBeUndefined();
  });
});

describe("districts", () => {
  it("exist for every job and game", () => {
    for (const item of [...jobs, ...games]) expect(districtIds).toContain(item.district);
  });
});

describe("jobs", () => {
  it("use YYYY-MM dates with start <= end", () => {
    for (const j of jobs) {
      expect(j.start, j.id).toMatch(ISO_MONTH);
      if (j.end !== null) {
        expect(j.end, j.id).toMatch(ISO_MONTH);
        // ISO months compare correctly as strings
        expect(j.start <= j.end, j.id).toBe(true);
      }
    }
  });

  it("have exactly one current job, which has no end date", () => {
    const current = jobs.filter((j) => j.current);
    expect(current).toHaveLength(1);
    expect(current[0].end).toBeNull();
    expect(jobs.filter((j) => j.end === null)).toHaveLength(1);
  });

  it("are ordered newest first", () => {
    const starts = jobs.map((j) => j.start);
    expect(starts).toEqual([...starts].sort().reverse());
  });

  it("have 2-5 highlights (or at least one for minor entries)", () => {
    for (const j of jobs) {
      expect(j.highlights.length, j.id).toBeGreaterThan(0);
      expect(j.highlights.length, j.id).toBeLessThanOrEqual(5);
      if (j.kind === "job") expect(j.highlights.length, j.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("never include the GoDaddy CV-only numbers (reconciliation C3)", () => {
    const fullstack = jobs.find((j) => j.id === "fullstack");
    expect(fullstack?.client).toBe("GoDaddy");
    const text = JSON.stringify(fullstack);
    expect(text).not.toContain("12%");
    expect(text).not.toContain("0.2s");
    for (const m of fullstack?.metrics ?? []) {
      expect(`${m.value} ${m.label}`).not.toMatch(/12%|0\.2s/);
    }
  });
});

describe("games", () => {
  it("feature Speed King on Steam with its release date", () => {
    const sk = games.find((g) => g.id === "speed-king");
    expect(sk?.platform).toBe("steam");
    expect(sk?.steamAppId).toBe(4669300);
    expect(sk?.releaseDate).toBe("2026-11-10");
  });

  it("link itch games to Ariann's itch page", () => {
    for (const g of games.filter((x) => x.platform === "itch")) {
      expect(g.url.startsWith(links.itch)).toBe(true);
    }
  });
});

describe("profile", () => {
  it("is filled in", () => {
    expect(profile.name).toBe("Ariann Michael");
    expect(profile.summary.length).toBeGreaterThan(0);
    expect(profile.languages.length).toBeGreaterThan(0);
  });
});
