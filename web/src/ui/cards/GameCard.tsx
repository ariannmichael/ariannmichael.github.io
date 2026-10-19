"use client";

import { useState } from "react";
import type { Game } from "@/content/types";
import { trackEvent } from "@/ui/plain/analytics";
import { getCountdown, releaseInstant } from "@/ui/lib/countdown";
import { useNowSeconds } from "@/ui/lib/hooks";
import Countdown from "./Countdown";
import PlayModal from "./PlayModal";
import styles from "./cards.module.css";

export default function GameCard({ game, headingId }: { game: Game; headingId: string }) {
  return (
    <article className={styles.card}>
      {game.cover && (
        // Plain <img>: static export has no image optimizer, and covers are already sized.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.cover} src={game.cover} alt="" loading="lazy" decoding="async" />
      )}
      <header className={styles.header}>
        <p className={styles.kicker}>Game · {game.platform === "steam" ? "Steam" : "itch.io"}</p>
        <h2 id={headingId} className={styles.title}>
          {game.title}
        </h2>
        {game.tagline && <p className={styles.role}>{game.tagline}</p>}
        {game.genre && (
          <ul className={styles.chips}>
            <li className={styles.chip}>{game.genre}</li>
          </ul>
        )}
      </header>
      {game.platform === "steam" ? <SteamSection game={game} /> : <ItchSection game={game} />}
    </article>
  );
}

function SteamSection({ game }: { game: Game }) {
  const now = useNowSeconds();
  const released =
    !game.releaseDate || (now !== null && getCountdown(now, releaseInstant(game.releaseDate)).released);

  return (
    <>
      {game.releaseDate && <Countdown releaseDate={game.releaseDate} />}
      {game.steamAppId && (
        <div className={styles.steamWidget}>
          <iframe
            src={`https://store.steampowered.com/widget/${game.steamAppId}/`}
            title={`${game.title} on Steam`}
            width={646}
            height={190}
            loading="lazy"
          />
        </div>
      )}
      {game.publisher && (
        <p className={styles.meta}>
          Published by <strong>{game.publisher}</strong>
        </p>
      )}
      <div className={styles.actions}>
        <a
          className={styles.primary}
          href={game.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("steam_click")}
        >
          {released ? "Buy on Steam" : "Wishlist on Steam"}
        </a>
      </div>
    </>
  );
}

function ItchSection({ game }: { game: Game }) {
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <div className={styles.actions}>
        {game.embedUrl ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              trackEvent("itch_play");
              setPlaying(true);
            }}
          >
            ▶ Play in browser
          </button>
        ) : (
          <a
            className={styles.primary}
            href={game.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("itch_play")}
          >
            ▶ Play on itch.io
          </a>
        )}
        {game.embedUrl && (
          <a className={styles.secondary} href={game.url} target="_blank" rel="noopener noreferrer">
            itch.io page
          </a>
        )}
      </div>
      {playing && <PlayModal game={game} onClose={() => setPlaying(false)} />}
    </>
  );
}
