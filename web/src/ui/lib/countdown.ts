// Release countdown for Speed King.
// Steam unlocks at 10:00 PT; on Nov 10 that is PST (UTC-8), i.e. 18:00 UTC.
export const RELEASE_TIME_UTC = "T18:00:00Z";

/** "2026-11-10" -> epoch ms of 2026-11-10T18:00:00Z. */
export function releaseInstant(releaseDate: string): number {
  return Date.parse(`${releaseDate}${RELEASE_TIME_UTC}`);
}

export interface Countdown {
  released: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Remaining time from `now` to `release` (both epoch ms). At or after the release it reports `released`. */
export function getCountdown(now: number, release: number): Countdown {
  const remaining = release - now;
  if (remaining <= 0) return { released: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  // Round up to whole seconds so the display never shows 0s while still counting down.
  const total = Math.ceil(remaining / 1000);
  return {
    released: false,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
