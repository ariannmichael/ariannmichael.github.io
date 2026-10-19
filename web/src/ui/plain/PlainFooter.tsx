import Link from "next/link";
import { profile } from "@/content";
import styles from "./Plain.module.css";

export function PlainFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p>
          © {profile.name}. Prefer to drive? <Link href="/">Explore the 3D town</Link>.
        </p>
        <p>
          3D assets by Kenney (<a href="https://kenney.nl">kenney.nl</a>), CC0
        </p>
      </div>
    </footer>
  );
}
