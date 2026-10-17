"use client";

import type { Game } from "@/content/types";
import Modal from "@/ui/Modal";
import styles from "./cards.module.css";

/**
 * Fullscreen itch.io player. It's only mounted after the Play click, so the (heavy) iframe never
 * loads until the visitor asks for it.
 */
export default function PlayModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const headingId = `play-${game.id}-title`;
  return (
    <Modal labelledBy={headingId} onClose={onClose} placement="full">
      <div className={styles.player}>
        <div className={styles.playerBar}>
          <h2 id={headingId} className={styles.playerTitle}>
            {game.title}
          </h2>
          <a className={styles.playerLink} href={game.url} target="_blank" rel="noopener noreferrer">
            Open on itch.io
          </a>
          <button type="button" className={styles.playerClose} onClick={onClose}>
            Close
          </button>
        </div>
        <iframe
          className={styles.playerFrame}
          src={game.embedUrl}
          title={`Play ${game.title}`}
          allow="autoplay; fullscreen; gamepad"
          allowFullScreen
        />
      </div>
    </Modal>
  );
}
