import type { Metadata, Viewport } from "next";
import AppShell from "@/ui/AppShell";

// Canonical lives here, not in the root layout: metadata merges shallowly, so a layout canonical
// would leak onto every page that doesn't override it.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// viewport-fit=cover lets the overlay use env(safe-area-inset-*) on notched phones.
export const viewport: Viewport = {
  viewportFit: "cover",
  // Steering with two thumbs must never turn into a pinch-zoom of the page (iOS Safari ignores this
  // flag and relies on touch-action: none on the controls, see globals.css / AppShell.module.css)
  maximumScale: 1,
  userScalable: false,
};

export default function Home() {
  return <AppShell district="home" />;
}
