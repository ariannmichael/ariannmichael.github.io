// Pure date helpers for the Plain View. A fixed month table (not Intl/Date) keeps the
// output identical at build time and in every browser timezone.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO_DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** "2025-05" -> "May 2025" */
export function formatMonth(iso: string): string {
  const m = ISO_MONTH.exec(iso);
  if (!m) throw new Error(`Expected an ISO month (YYYY-MM), got "${iso}"`);
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** ("2025-05", "2026-03") -> "May 2025 – Mar 2026"; a null end means "Present". */
export function formatRange(start: string, end: string | null): string {
  return `${formatMonth(start)} – ${end === null ? "Present" : formatMonth(end)}`;
}

/** "2026-11-10" -> "Nov 10, 2026" */
export function formatDate(iso: string): string {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Expected an ISO date (YYYY-MM-DD), got "${iso}"`);
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
