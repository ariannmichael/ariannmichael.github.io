import { links } from "@/content";
import styles from "./Plain.module.css";

// Show the readable address/handle, not just a generic "click here".
const strip = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

const CONTACTS = [
  { label: "Email", href: `mailto:${links.email}`, text: links.email },
  { label: "LinkedIn", href: links.linkedin, text: strip(links.linkedin) },
  { label: "GitHub", href: links.github, text: strip(links.github) },
  { label: "itch.io", href: links.itch, text: strip(links.itch) },
  { label: "Steam", href: links.steam, text: "Speed King on Steam" },
];

export function ContactSection() {
  return (
    <section className={`${styles.container} ${styles.section}`} aria-labelledby="contact">
      <h2 id="contact" className={styles.sectionTitle}>
        Contact
      </h2>
      <p className={styles.lead}>
        Want to talk engineering, healthcare platforms or games? Email is the fastest way to
        reach me.
      </p>
      <ul className={styles.contactList}>
        {CONTACTS.map((c) => (
          <li key={c.label} className={styles.card}>
            <span className={styles.contactLabel}>{c.label}</span>
            <a className={styles.contactValue} href={c.href}>
              {c.text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
