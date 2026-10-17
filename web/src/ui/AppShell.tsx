import type { DistrictId } from "@/content/types";
import WorldLoader from "@/world/WorldLoader";

// Placeholder: the UI agent replaces this with the overlay (name, CV, GPS, Plain view) around the world.
export default function AppShell({ district }: { district: DistrictId }) {
  return (
    <main style={{ position: "fixed", inset: 0 }}>
      <WorldLoader district={district} />
      <h1 style={{ position: "absolute", top: 16, left: 16, margin: 0 }}>Ariann Michael</h1>
    </main>
  );
}
