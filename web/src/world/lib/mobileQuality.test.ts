import { describe, expect, it } from "vitest";
import { initialQuality, pickDpr, type DisplayInfo } from "./mobileQuality";

const phone: DisplayInfo = { width: 390, height: 844, devicePixelRatio: 3, coarse: true };
const tablet: DisplayInfo = { width: 768, height: 1024, devicePixelRatio: 2, coarse: true };
const desktop: DisplayInfo = { width: 1280, height: 800, devicePixelRatio: 2, coarse: false };

describe("initialQuality", () => {
  it("starts touch devices and small screens on Lite", () => {
    expect(initialQuality(phone)).toBe("low");
    expect(initialQuality(tablet)).toBe("low");
    expect(initialQuality({ ...desktop, width: 800, height: 600 })).toBe("low");
  });
  it("keeps desktops on HQ", () => {
    expect(initialQuality(desktop)).toBe("high");
  });
});

describe("pickDpr", () => {
  it("leaves desktop ranges alone", () => {
    expect(pickDpr("high", desktop)).toEqual([1, 2]);
    expect(pickDpr("low", desktop)).toBe(1);
  });
  it("caps a 3x phone on Lite at 1.5", () => {
    expect(pickDpr("low", phone)).toBe(1.5);
  });
  it("lets HQ on a phone go up to 2 within the pixel budget", () => {
    expect(pickDpr("high", phone) as number).toBeCloseTo(2, 1);
  });
  it("never goes below 1 and respects the pixel budget on tablets", () => {
    expect(pickDpr("low", tablet) as number).toBeCloseTo(1, 1);
    const w = 768, h = 1024;
    const dpr = pickDpr("high", tablet) as number;
    expect(w * h * dpr * dpr).toBeLessThanOrEqual(1_300_000 * 1.01);
  });
  it("does not upscale a 1x device", () => {
    expect(pickDpr("high", { ...phone, devicePixelRatio: 1 })).toBe(1);
  });
});
