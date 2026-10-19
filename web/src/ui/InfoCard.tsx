"use client";

import { useEffect, useId, useState } from "react";
import { useAppStore } from "@/state/useAppStore";
import { usePrefersReducedMotion } from "./lib/hooks";
import Modal, { CloseButton } from "./Modal";
import GameCard from "./cards/GameCard";
import JobCard from "./cards/JobCard";
import { AboutCard, ContactCard, CvCard } from "./cards/ProfileCards";
import { resolveCard, type CardData } from "./cards/resolveCard";
import styles from "./InfoCard.module.css";

/** Presentational card dialog: render any CardData. Used directly by tests. */
export function InfoCardView({
  card,
  onClose,
  closing = false,
}: {
  card: CardData;
  onClose: () => void;
  /** Playing the quick exit animation (see InfoCard) */
  closing?: boolean;
}) {
  const headingId = useId();
  return (
    <Modal labelledBy={headingId} onClose={onClose} placement="side" closing={closing}>
      <CloseButton onClick={onClose} label="Close card" />
      <div className={styles.scroll}>
        {card.type === "job" && <JobCard job={card.job} headingId={headingId} />}
        {card.type === "game" && <GameCard game={card.game} headingId={headingId} />}
        {card.type === "about" && <AboutCard profile={card.profile} links={card.links} headingId={headingId} />}
        {card.type === "contact" && (
          <ContactCard profile={card.profile} links={card.links} headingId={headingId} />
        )}
        {card.type === "cv" && <CvCard profile={card.profile} links={card.links} headingId={headingId} />}
      </div>
    </Modal>
  );
}

/** Matches the Modal's exit animation (Modal.module.css, `[data-closing]`) */
const CLOSE_MS = 150;

/**
 * Store-connected card: shows whatever `openCardId` points at. Unknown ids render nothing.
 * On close it stays mounted for CLOSE_MS so the panel can animate out (instantly with reduced motion).
 */
export default function InfoCard() {
  const openCardId = useAppStore((s) => s.openCardId);
  const closeCard = useAppStore((s) => s.closeCard);
  const reducedMotion = usePrefersReducedMotion();
  // The card that just closed and is animating out. Derived while rendering (React's "adjust state
  // when a prop changes" pattern) so the exit frame is the very next render, with no blank flash.
  const [leaving, setLeaving] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(openCardId);
  if (prevOpen !== openCardId) {
    setPrevOpen(openCardId);
    setLeaving(openCardId === null && !reducedMotion ? prevOpen : null);
  }

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const id = openCardId ?? leaving;
  const card = id ? resolveCard(id) : undefined;
  if (!id || !card) return null;
  // key: switching cards remounts the dialog so focus handling restarts cleanly.
  return <InfoCardView key={id} card={card} onClose={closeCard} closing={openCardId === null} />;
}
