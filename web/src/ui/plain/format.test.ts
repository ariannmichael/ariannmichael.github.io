import { describe, expect, it } from "vitest";
import { formatDate, formatMonth, formatRange } from "./format";

describe("formatMonth", () => {
  it("formats ISO months", () => {
    expect(formatMonth("2025-05")).toBe("May 2025");
    expect(formatMonth("2016-01")).toBe("Jan 2016");
    expect(formatMonth("2021-12")).toBe("Dec 2021");
  });

  it("rejects malformed input", () => {
    expect(() => formatMonth("2025-13")).toThrow();
    expect(() => formatMonth("May 2025")).toThrow();
  });
});

describe("formatRange", () => {
  it("formats closed ranges", () => {
    expect(formatRange("2025-05", "2026-03")).toBe("May 2025 – Mar 2026");
  });

  it("uses Present for a null end", () => {
    expect(formatRange("2026-04", null)).toBe("Apr 2026 – Present");
  });
});

describe("formatDate", () => {
  it("formats ISO dates", () => {
    expect(formatDate("2026-11-10")).toBe("Nov 10, 2026");
    expect(formatDate("2026-01-05")).toBe("Jan 5, 2026");
  });
});
