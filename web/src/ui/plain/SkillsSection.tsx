import type { Skill } from "@/content";
import { profile, skills } from "@/content";
import styles from "./Plain.module.css";

const CATEGORIES: { id: Skill["category"]; title: string }[] = [
  { id: "frontend", title: "Frontend" },
  { id: "backend", title: "Backend & data" },
  { id: "architecture", title: "Architecture & domain" },
  { id: "testing", title: "Testing" },
  { id: "infra", title: "Infra & DevOps" },
  { id: "gamedev", title: "Game dev" },
];

export function SkillsSection() {
  return (
    <section className={`${styles.container} ${styles.section}`} aria-labelledby="skills">
      <h2 id="skills" className={styles.sectionTitle}>
        Skills
      </h2>
      <div className={styles.skillGroups}>
        {CATEGORIES.map((cat) => {
          const items = skills.filter((s) => s.category === cat.id);
          if (items.length === 0) return null;
          return (
            <div key={cat.id}>
              <h3 className={styles.skillGroupTitle}>{cat.title}</h3>
              <ul className={styles.skillList}>
                {items.map((s) => (
                  <li key={s.id} className={styles.skill}>
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {profile.languages.length > 0 && (
          <div>
            <h3 className={styles.skillGroupTitle}>Languages</h3>
            <ul className={styles.skillList}>
              {profile.languages.map((l) => (
                <li key={l} className={styles.skill}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
