import type { Job } from "@/content";
import { jobs } from "@/content";
import { formatRange } from "./format";
import styles from "./Plain.module.css";

const KIND_LABEL: Partial<Record<Job["kind"], string>> = {
  "open-source": "Open source",
  teaching: "Teaching",
};

function JobCard({ job }: { job: Job }) {
  const kindLabel = KIND_LABEL[job.kind];
  return (
    <article className={styles.card} aria-labelledby={`job-${job.id}`}>
      <div className={styles.cardHeader}>
        <div>
          <h3 id={`job-${job.id}`} className={styles.role}>
            {job.role}
          </h3>
          <p className={styles.company}>
            {job.company}
            {job.client && <span className={styles.client}>{` · for ${job.client}`}</span>}
          </p>
        </div>
        <p className={styles.dates}>{formatRange(job.start, job.end)}</p>
      </div>

      {job.location && <p className={styles.meta}>{job.location}</p>}

      {(job.current || kindLabel) && (
        <div className={styles.badges}>
          {job.current && (
            <span className={`${styles.badge} ${styles.badgeCurrent}`}>Current role</span>
          )}
          {kindLabel && <span className={`${styles.badge} ${styles.badgeKind}`}>{kindLabel}</span>}
        </div>
      )}

      <p className={styles.cardSummary}>{job.summary}</p>

      {job.highlights.length > 0 && (
        <ul className={styles.highlights}>
          {job.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      {job.metrics.length > 0 && (
        <ul className={styles.metrics} aria-label="Key results">
          {job.metrics.map((m) => (
            <li key={m.value + m.label} className={styles.metric}>
              <span className={styles.metricValue}>{m.value}</span>
              <span>{m.label}</span>
            </li>
          ))}
        </ul>
      )}

      {job.stack.length > 0 && (
        <ul className={styles.stack} aria-label="Tech stack">
          {job.stack.map((s) => (
            <li key={s} className={styles.tag}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ExperienceSection() {
  // Education gets its own section; everything else (jobs, open source, teaching) is the timeline.
  const timeline = jobs.filter((j) => j.kind !== "education");
  return (
    <section className={`${styles.container} ${styles.section}`} aria-labelledby="experience">
      <h2 id="experience" className={styles.sectionTitle}>
        Experience
      </h2>
      <ol className={styles.timeline}>
        {timeline.map((job) => (
          <li
            key={job.id}
            className={`${styles.timelineItem} ${job.current ? styles.timelineItemCurrent : ""}`}
          >
            <JobCard job={job} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EducationSection() {
  const education = jobs.filter((j) => j.kind === "education");
  if (education.length === 0) return null;
  return (
    <section className={`${styles.container} ${styles.section}`} aria-labelledby="education">
      <h2 id="education" className={styles.sectionTitle}>
        Education
      </h2>
      {education.map((e) => (
        <article key={e.id} className={styles.card} aria-labelledby={`edu-${e.id}`}>
          <div className={styles.cardHeader}>
            <div>
              <h3 id={`edu-${e.id}`} className={styles.role}>
                {e.role}
              </h3>
              <p className={styles.company}>{e.company}</p>
            </div>
            <p className={styles.dates}>{formatRange(e.start, e.end)}</p>
          </div>
          {e.location && <p className={styles.meta}>{e.location}</p>}
        </article>
      ))}
    </section>
  );
}
