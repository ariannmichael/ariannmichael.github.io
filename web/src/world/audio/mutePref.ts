// The visitor's sound on/off choice, remembered across visits. localStorage can throw (Safari private
// mode, disabled storage, sandboxed iframes), so every access is guarded and failure just means
// "no saved choice".

export const MUTE_STORAGE_KEY = "portfolio.sound.muted";

/** The saved choice, or null when there is none (or storage is unavailable). */
export function loadMutedPref(storage: Pick<Storage, "getItem"> | null = safeStorage()): boolean | null {
  try {
    const v = storage?.getItem(MUTE_STORAGE_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function saveMutedPref(muted: boolean, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // Storage full or blocked: the choice just won't be remembered
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Must match `muted`'s initial value in useAppStore (sound on by default, after the first gesture) */
export const MUTED_DEFAULT = false;
