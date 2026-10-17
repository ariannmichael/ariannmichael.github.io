import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://ariannmichael.github.io"),
  title,
  description,
  // TODO(phase 7): add images: "/og-image.png" to openGraph and twitter.
  openGraph: {
    type: "website",
    siteName: "Ariann Michael",
    locale: "en_US",
    title,
    description,
  },
  twitter: {
    card: "summary",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
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
