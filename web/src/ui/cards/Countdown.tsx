"use client";

import { getCountdown, releaseInstant } from "@/ui/lib/countdown";
import { useNowSeconds } from "@/ui/lib/hooks";
import styles from "./cards.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return m ? `${MONTHS[m - 1]} ${d}, ${y}` : isoDate;
}

/** Ticks every second and flips to the "Out now" badge by itself once the release instant passes. */
export default function Countdown({ releaseDate }: { releaseDate: string }) {
  const now = useNowSeconds();
  const release = releaseInstant(releaseDate);
  const label = formatDay(releaseDate);

  // Server render / first paint: no clock yet, show the static date.
  if (now === null || Number.isNaN(release)) {
    return <p className={styles.releaseLine}>Releasing {label}</p>;
  }

  const c = getCountdown(now, release);
  if (c.released) {
    return (
      <p className={styles.outNow}>
        <span aria-hidden="true">🏁</span> Out now on Steam
      </p>
    );
  }

  const units: [number, string][] = [
    [c.days, "days"],
    [c.hours, "hrs"],
    [c.minutes, "min"],
    [c.seconds, "sec"],
  ];
  return (
    <div className={styles.countdown}>
      <p className={styles.releaseLine}>Launching on Steam · {label}</p>
      {/* Visually ticking digits are hidden from screen readers; the summary below is static per day. */}
      <ol className={styles.countdownUnits} aria-hidden="true">
        {units.map(([value, unit]) => (
          <li key={unit}>
            <span className={styles.countdownValue}>{String(value).padStart(2, "0")}</span>
            <span className={styles.countdownUnit}>{unit}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only">
        {c.days} days and {c.hours} hours until release
      </p>
    </div>
  );
}
