// "District discovered" rules. Pure, so tested without the store.
import type { DistrictId } from "@/content/types";

/**
 * The district that was just discovered when the visited list goes from `prev` to `next`, or null.
 * The very first entry is skipped: that's where the car spawns, and "discovering" the place you were
 * dropped into would greet every visitor with a toast before they've touched anything.
 */
export function newlyDiscovered(prev: readonly DistrictId[], next: readonly DistrictId[]): DistrictId | null {
  if (prev.length === 0 || next.length <= prev.length) return null;
  for (let i = next.length - 1; i >= 0; i--) {
    if (!prev.includes(next[i])) return next[i];
  }
  return null;
}

export interface Discovery {
  id: DistrictId;
  name: string;
  /** "3/7" */
  progress: string;
  /** Screen-reader sentence ("District discovered: Downtown Plateau, 3 of 7") */
  announcement: string;
  /** Every district found */
  complete: boolean;
}

export function describeDiscovery(id: DistrictId, name: string, visited: number, total: number): Discovery {
  const complete = visited >= total;
  return {
    id,
    name,
    progress: `${visited}/${total}`,
    announcement: `District discovered: ${name}, ${visited} of ${total}${complete ? ". Every district found!" : ""}`,
    complete,
  };
}
