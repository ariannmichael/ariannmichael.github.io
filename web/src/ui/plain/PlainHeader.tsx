import Link from "next/link";
import { links, profile } from "@/content";
import styles from "./Plain.module.css";

export function PlainHeader() {
  return (
    <header>
      <nav className={styles.topbar} aria-label="Site">
        <div className={`${styles.container} ${styles.topbarInner}`}>
          <span className={styles.brand}>{profile.name}</span>
          <Link href="/" className={styles.townLink}>
            <span aria-hidden="true">←</span> Explore the 3D town
          </Link>
        </div>
      </nav>

      <div className={`${styles.container} ${styles.hero}`}>
        <h1 className={styles.name}>{profile.name}</h1>
        <p className={styles.headline}>{profile.headline}</p>
        <p className={styles.location}>{profile.location}</p>
        <p className={styles.summary}>{profile.summary}</p>

        <div className={styles.actions}>
          <a className={styles.cta} href={links.cv}>
            Download CV <span className="sr-only">(PDF)</span>
          </a>
          <ul className={styles.inlineLinks} aria-label="Contact links">
            <li>
              <a href={`mailto:${links.email}`}>Email</a>
            </li>
            <li>
              <a href={links.linkedin}>LinkedIn</a>
            </li>
            <li>
              <a href={links.github}>GitHub</a>
            </li>
            <li>
              <a href={links.itch}>itch.io</a>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
