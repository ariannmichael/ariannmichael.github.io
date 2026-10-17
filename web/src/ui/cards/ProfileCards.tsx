"use client";

import type { Links, Profile } from "@/content/types";
import TrackedLink from "@/ui/TrackedLink";
import styles from "./cards.module.css";

interface Props {
  profile: Profile;
  links: Links;
  headingId: string;
}

export function AboutCard({ profile, links, headingId }: Props) {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <p className={styles.kicker}>About me</p>
        <h2 id={headingId} className={styles.title}>
          {profile.name}
        </h2>
        <p className={styles.role}>{profile.headline}</p>
        <p className={styles.meta}>
          {profile.location}
          {profile.yearsOfExperience && <span> · {profile.yearsOfExperience} years of experience</span>}
        </p>
      </header>
      {profile.summary && <p className={styles.summary}>{profile.summary}</p>}
      {profile.languages.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Languages</h3>
          <ul className={styles.chips}>
            {profile.languages.map((l) => (
              <li key={l} className={styles.chip}>
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className={styles.actions}>
        <TrackedLink className={styles.primary} href={links.cv} download event="cv_download">
          Download CV
        </TrackedLink>
        <TrackedLink className={styles.secondary} href="/plain/" event="plain_view">
          Plain view
        </TrackedLink>
      </div>
    </article>
  );
}

export function ContactCard({ links, headingId }: Props) {
  const items: { label: string; href: string; text: string }[] = [
    { label: "Email", href: `mailto:${links.email}`, text: links.email },
    { label: "LinkedIn", href: links.linkedin, text: stripProtocol(links.linkedin) },
    { label: "GitHub", href: links.github, text: stripProtocol(links.github) },
    { label: "itch.io", href: links.itch, text: stripProtocol(links.itch) },
    { label: "Steam", href: links.steam, text: "Speed King on Steam" },
  ].filter((i) => i.href && !i.href.endsWith(":"));

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <p className={styles.kicker}>Contact</p>
        <h2 id={headingId} className={styles.title}>
          Let&apos;s talk
        </h2>
      </header>
      <ul className={styles.contactList}>
        {items.map((i) => (
          <li key={i.label}>
            <span className={styles.contactLabel}>{i.label}</span>
            <a
              href={i.href}
              {...(i.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {i.text}
            </a>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <TrackedLink className={styles.primary} href={links.cv} download event="cv_download">
          Download CV
        </TrackedLink>
      </div>
    </article>
  );
}

export function CvCard({ profile, links, headingId }: Props) {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <p className={styles.kicker}>Résumé</p>
        <h2 id={headingId} className={styles.title}>
          {profile.name}&apos;s CV
        </h2>
        <p className={styles.role}>{profile.headline}</p>
      </header>
      <p className={styles.summary}>Grab the PDF, or read everything as a simple page.</p>
      <div className={styles.actions}>
        <TrackedLink className={styles.primary} href={links.cv} download event="cv_download">
          Download CV (PDF)
        </TrackedLink>
        <TrackedLink className={styles.secondary} href="/plain/" event="plain_view">
          Plain view
        </TrackedLink>
      </div>
    </article>
  );
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
