// Date helpers for job cards. Fixed English month names (not Intl) so server and client
// output always match and tests don't depend on the machine's locale.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-05" -> "May 2025". Unparseable input is returned unchanged rather than throwing. */
export function formatMonth(iso: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return iso;
  return `${MONTHS[month - 1]} ${match[1]}`;
}

/** ("2025-05", "2026-03") -> "May 2025 – Mar 2026"; a null end means "Present". */
export function formatDateRange(start: string, end: string | null): string {
  const from = formatMonth(start);
  if (end === null) return `${from} – Present`;
  const to = formatMonth(end);
  return from === to ? from : `${from} – ${to}`;
}
