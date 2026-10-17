"use client";

import { useId } from "react";
import { useAppStore } from "@/state/useAppStore";
import Modal, { CloseButton } from "./Modal";
import GameCard from "./cards/GameCard";
import JobCard from "./cards/JobCard";
import { AboutCard, ContactCard, CvCard } from "./cards/ProfileCards";
import { resolveCard, type CardData } from "./cards/resolveCard";
import styles from "./InfoCard.module.css";

/** Presentational card dialog: render any CardData. Used directly by tests. */
export function InfoCardView({ card, onClose }: { card: CardData; onClose: () => void }) {
  const headingId = useId();
  return (
    <Modal labelledBy={headingId} onClose={onClose} placement="side">
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

/** Store-connected card: shows whatever `openCardId` points at. Unknown ids render nothing. */
export default function InfoCard() {
  const openCardId = useAppStore((s) => s.openCardId);
  const closeCard = useAppStore((s) => s.closeCard);
  const card = openCardId ? resolveCard(openCardId) : undefined;
  if (!card) return null;
  // key: switching cards remounts the dialog so focus handling restarts cleanly.
  return <InfoCardView key={openCardId} card={card} onClose={closeCard} />;
}
