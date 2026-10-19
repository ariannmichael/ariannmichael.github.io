import { Suspense } from "react";
import { links, profile } from "@/content";
import type { DistrictId } from "@/content/types";
import CardDeepLink from "./CardDeepLink";
import HudControls from "./HudControls";
import Overlay from "./Overlay";
import TrackedLink from "./TrackedLink";
import styles from "./AppShell.module.css";

/**
 * Server Component. The name, headline, CV download and Plain view link are real HTML in the
 * static export, so recruiters and crawlers get them with no JS and before any 3D loads.
 * Everything interactive (canvas, HUD buttons, dialogs, touch controls) is a client island.
 */
export default function AppShell({ district }: { district: DistrictId }) {
  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <h1 className={styles.name}>{profile.name}</h1>
          <p className={styles.headline}>{profile.headline}</p>
          <TrackedLink
            className={styles.cvButton}
            href={links.cv}
            download
            event="cv_download"
            aria-label="Download CV"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.cvText}>Download CV</span>
          </TrackedLink>
        </div>

        <nav className={styles.hud} aria-label="Town controls">
          <HudControls />
          <TrackedLink className={styles.plainLink} href="/plain/" event="plain_view">
            Plain view
          </TrackedLink>
        </nav>
      </header>

      <Overlay district={district} />

      <Suspense fallback={null}>
        <CardDeepLink />
      </Suspense>
    </main>
  );
}
