import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/state/useAppStore";
import GpsMenu from "../GpsMenu";
import InfoCard from "../InfoCard";
import DistrictToast from "./DistrictToast";

const initial = useAppStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState(initial, true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DistrictToast", () => {
  it("announces newly discovered districts, but not the spawn district", async () => {
    render(<DistrictToast />);
    const region = screen.getByRole("status");
    act(() => useAppStore.getState().markVisited("home"));
    expect(region.textContent).toBe("");
    act(() => useAppStore.getState().markVisited("engineering"));
    expect(region.textContent).toContain("District discovered: Downtown Plateau, 2 of 7");
    expect(region.textContent).toContain("2/7");
    // Clears itself after the stamp animation (no WAAPI in jsdom: a timer stands in)
    // async act: also flushes the promise that resolves when the "animation" ends
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(region.textContent).toBe("");
  });
});

describe("InfoCard exit", () => {
  it("keeps the closed card mounted briefly, inert, then removes it", () => {
    render(<InfoCard />);
    act(() => useAppStore.getState().openCard("about"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => useAppStore.getState().closeCard());
    const backdrop = screen.getByTestId("modal-backdrop");
    expect(backdrop.hasAttribute("data-closing")).toBe(true);
    expect(backdrop.hasAttribute("inert")).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByTestId("modal-backdrop")).toBeNull();
  });
});

describe("GpsMenu pick", () => {
  it("flashes the destination, then teleports once", () => {
    useAppStore.setState({ gpsOpen: true });
    render(<GpsMenu />);
    const button = screen.getByRole("button", { name: /Desert Mesa/ });
    fireEvent.click(button);
    fireEvent.click(button); // double click is ignored
    expect(button.hasAttribute("data-picked")).toBe(true);
    expect(useAppStore.getState().teleportNonce).toBe(0);
    act(() => vi.advanceTimersByTime(400));
    expect(useAppStore.getState().spawnDistrict).toBe("financial");
    expect(useAppStore.getState().teleportNonce).toBe(1);
    expect(useAppStore.getState().gpsOpen).toBe(false);
  });
});
