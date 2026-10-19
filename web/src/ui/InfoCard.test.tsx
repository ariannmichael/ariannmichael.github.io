import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Game, Job } from "@/content/types";
import { InfoCardView } from "./InfoCard";

// Fixtures, so these tests don't depend on the real content arrays.
const job: Job = {
  id: "acme",
  company: "Acme Corp",
  client: "Globex",
  role: "Senior Software Engineer",
  district: "engineering",
  start: "2025-05",
  end: null,
  current: true,
  kind: "job",
  summary: "Built the thing.",
  highlights: ["Shipped onboarding", "Cut build time in half"],
  metrics: [{ label: "profiles", value: "+20%" }],
  stack: ["React", "TypeScript"],
};

const steamGame: Game = {
  id: "speed-king",
  title: "Speed King",
  platform: "steam",
  tagline: "Party racing",
  genre: "Racing",
  url: "https://store.steampowered.com/app/4669300/",
  steamAppId: 4669300,
  releaseDate: "2026-11-10",
  publisher: "OutOfBoundsGames",
  district: "raceway",
};

const itchGame: Game = {
  id: "rat",
  title: "Rat Catcher",
  platform: "itch",
  tagline: "Catch rats",
  genre: "Arcade",
  url: "https://example.itch.io/rat",
  embedUrl: "https://itch.io/embed-upload/1",
  district: "gamedev",
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("InfoCardView", () => {
  it("renders a job card", () => {
    render(<InfoCardView card={{ type: "job", job }} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Acme Corp for Globex");
    expect(screen.getByText("Senior Software Engineer")).toBeTruthy();
    expect(screen.getByText("May 2025 – Present")).toBeTruthy();
    expect(screen.getByText("Current role")).toBeTruthy();
    expect(screen.getByText("+20%")).toBeTruthy();
    expect(screen.getByText("Shipped onboarding")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
  });

  it("renders a Steam game card with the widget, countdown and store link", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    render(<InfoCardView card={{ type: "game", game: steamGame }} onClose={() => {}} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Speed King");
    const iframe = screen.getByTitle("Speed King on Steam");
    expect(iframe.getAttribute("src")).toBe("https://store.steampowered.com/widget/4669300/");
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(screen.getByText(/Launching on Steam/)).toBeTruthy();
    expect(screen.getByText("OutOfBoundsGames")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Wishlist on Steam" })).toBeTruthy();
  });

  it("shows Out now after the release", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T00:00:00Z"));
    render(<InfoCardView card={{ type: "game", game: steamGame }} onClose={() => {}} />);
    expect(screen.getByText(/Out now on Steam/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Buy on Steam" })).toBeTruthy();
  });

  it("loads the itch iframe only after Play is clicked", () => {
    render(<InfoCardView card={{ type: "game", game: itchGame }} onClose={() => {}} />);
    expect(screen.queryByTitle("Play Rat Catcher")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Play in browser/ }));
    expect(screen.getByTitle("Play Rat Catcher").getAttribute("src")).toBe(itchGame.embedUrl);
    expect(screen.getByRole("link", { name: "Open on itch.io" })).toBeTruthy();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<InfoCardView card={{ type: "job", job }} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a backdrop click but not on a click inside the card", () => {
    const onClose = vi.fn();
    render(<InfoCardView card={{ type: "job", job }} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog and returns it on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<InfoCardView card={{ type: "job", job }} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Close card" })).toBe(document.activeElement);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
