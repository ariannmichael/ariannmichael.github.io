// Plain View: the static, no-3D résumé. A Server Component on purpose (no "use client",
// nothing from @/world or three), so it pre-renders to /plain/index.html and works without JS.
import type { Metadata } from "next";
import { profile } from "@/content";
import { ContactSection } from "@/ui/plain/ContactSection";
import { EducationSection, ExperienceSection } from "@/ui/plain/ExperienceSection";
import { GamesSection } from "@/ui/plain/GamesSection";
import { PlainFooter } from "@/ui/plain/PlainFooter";
import { PlainHeader } from "@/ui/plain/PlainHeader";
import { SkillsSection } from "@/ui/plain/SkillsSection";
import styles from "@/ui/plain/Plain.module.css";

export const metadata: Metadata = {
  title: "Ariann Michael · Résumé",
  description: `${profile.headline}. ${profile.yearsOfExperience} years building healthcare and B2B web platforms, plus Speed King on Steam.`,
  alternates: { canonical: "/plain/" },
  // Nested openGraph objects replace the layout's (no deep merge), so repeat the shared fields.
  openGraph: {
    type: "website",
    siteName: "Ariann Michael",
    locale: "en_US",
    title: "Ariann Michael · Résumé",
    url: "/plain/",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ariann Michael's 3D portfolio town" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ariann Michael · Résumé",
    images: ["/og-image.png"],
  },
};

export default function PlainPage() {
  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <PlainHeader />
      <main id="main" tabIndex={-1}>
        <ExperienceSection />
        <GamesSection />
        <SkillsSection />
        <EducationSection />
        <ContactSection />
      </main>
      <PlainFooter />
    </div>
  );
}
