import Image from "next/image";
import { games } from "@/content";
import { formatDate } from "./format";
import styles from "./Plain.module.css";

export function GamesSection() {
  const featured = games.find((g) => g.platform === "steam");
  const itch = games.filter((g) => g.platform === "itch");

  return (
    <section
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="games"
    >
      <h2 id="games" className={styles.sectionTitle}>
        Games
      </h2>

      {featured && (
        <article
          className={styles.featured}
          aria-labelledby={`game-${featured.id}`}
        >
          {featured.cover && (
            <Image
              className={styles.featuredCover}
              src={featured.cover}
              alt={`${featured.title} key art`}
              width={460}
              height={215}
              priority
            />
          )}
          <div>
            <p className={styles.eyebrow}>
              Steam
              {featured.releaseDate &&
                ` · Release date ${formatDate(featured.releaseDate)}`}
            </p>
            <h3 id={`game-${featured.id}`} className={styles.featuredTitle}>
              {featured.title}
            </h3>
            <p className={styles.meta}>
              {featured.genre}
              {featured.publisher && ` · Published by ${featured.publisher}`}
            </p>
            <p className={styles.cardSummary}>{featured.tagline}</p>
            <div className={styles.actions}>
              <a className={styles.cta} href={featured.url}>
                View {featured.title} on Steam
              </a>
            </div>
          </div>
        </article>
      )}

      {itch.length > 0 && (
        <>
          <h3 className={styles.subTitle}>More games on itch.io</h3>
          <ul className={styles.gameGrid}>
            {itch.map((g) => (
              <li key={g.id}>
                <article className={`${styles.card} ${styles.gameCard}`}>
                  {g.cover && (
                    <Image
                      className={styles.gameCover}
                      src={g.cover}
                      alt={`${g.title} cover art`}
                      width={480}
                      height={270}
                    />
                  )}
                  <h4 className={styles.gameTitle}>{g.title}</h4>
                  <p className={styles.meta}>{g.genre}</p>
                  <p className={styles.gameTagline}>{g.tagline}</p>
                  <a href={g.url}>
                    Open on itch.io<span className="sr-only">: {g.title}</span>
                  </a>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
