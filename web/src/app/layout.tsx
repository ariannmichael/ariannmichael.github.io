import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { links, profile } from "@/content";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Ariann Michael · Senior Software Engineer & Game Developer";
const description =
  "Drive through Ariann Michael's portfolio: 7+ years building healthcare and B2B web platforms, plus Speed King on Steam and games on itch.io.";

// Browser chrome tint on phones (sky blue by day, the night-sky navy in dark mode). The game routes
// add viewport-fit=cover and the zoom lock themselves, so Plain view stays pinch-zoomable.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#bfe3ff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b2440" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ariannmichael.github.io"),
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "Ariann Michael",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ariann Michael's 3D portfolio town" }],
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
    title,
    description,
  },
};

// schema.org Person for search engines. Built from content so it never drifts from the page.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: "Senior Software Engineer",
  worksFor: { "@type": "Organization", name: "Afya" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Campina Grande",
    addressCountry: "BR",
  },
  url: links.site,
  email: `mailto:${links.email}`,
  sameAs: [links.github, links.linkedin, links.itch, links.steam],
};

// Typed by hand: Next's generated LayoutProps only exists after a dev/build run, and CI typechecks first
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          // Escape "<" so content can never close the script tag (Next's JSON-LD guidance)
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {/* GoatCounter: privacy-friendly analytics. Custom events go through trackEvent()
            in src/ui/plain/analytics.ts. */}
        <Script
          data-goatcounter="https://ariannmichael.goatcounter.com/count"
          src="//gc.zgo.at/count.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
