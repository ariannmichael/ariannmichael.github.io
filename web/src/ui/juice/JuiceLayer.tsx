"use client";

import DistrictToast from "./DistrictToast";
import Speedometer from "./Speedometer";
import TrickPopups from "./TrickPopups";
import styles from "./JuiceHud.module.css";

/** Everything JuiceHud lazy-loads: the speedometer plus the centre column of popups and stamps. */
export default function JuiceLayer() {
  return (
    <>
      {/* Stamp above, trick popups below it: one column, so the two never overlap. */}
      <div className={styles.center}>
        <DistrictToast />
        <TrickPopups />
      </div>
      <Speedometer />
    </>
  );
}
