import type { Job } from "@/content/types";
import { formatDateRange } from "@/ui/lib/format";
import styles from "./cards.module.css";

// Section labels change with the kind of entry so education/teaching don't read like jobs.
const LABELS: Record<Job["kind"], { kicker: string; highlights: string; stack: string; current: string }> = {
  job: { kicker: "Experience", highlights: "Highlights", stack: "Stack", current: "Current role" },
  "open-source": { kicker: "Open source", highlights: "Contributions", stack: "Stack", current: "Active" },
  education: { kicker: "Education", highlights: "Highlights", stack: "Studied", current: "In progress" },
  teaching: { kicker: "Teaching", highlights: "What I taught", stack: "Tools", current: "Current" },
};

export default function JobCard({ job, headingId }: { job: Job; headingId: string }) {
  const labels = LABELS[job.kind] ?? LABELS.job;
  const isCurrent = job.current ?? job.end === null;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {labels.kicker}
          {isCurrent && <span className={styles.badge}>{labels.current}</span>}
        </p>
        <h2 id={headingId} className={styles.title}>
          {job.company}
          {job.client && <span className={styles.client}> for {job.client}</span>}
        </h2>
        <p className={styles.role}>{job.role}</p>
        <p className={styles.meta}>
          <time dateTime={job.start}>{formatDateRange(job.start, job.end)}</time>
          {job.location && <span> · {job.location}</span>}
        </p>
      </header>

      {job.summary && <p className={styles.summary}>{job.summary}</p>}

      {job.metrics.length > 0 && (
        <ul className={styles.metrics} aria-label="Impact">
          {job.metrics.map((m) => (
            <li key={m.label} className={styles.metric}>
              <span className={styles.metricValue}>{m.value}</span>
              <span className={styles.metricLabel}>{m.label}</span>
            </li>
          ))}
        </ul>
      )}

      {job.highlights.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{labels.highlights}</h3>
          <ul className={styles.highlights}>
            {job.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
      )}

      {job.stack.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{labels.stack}</h3>
          <ul className={styles.chips}>
            {job.stack.map((s) => (
              <li key={s} className={styles.chip}>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
