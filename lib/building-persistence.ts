/** Persistence layer for active building — not a source of truth. */

export const SELECTED_BUILDING_KEY = "forte-selected-building";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Raw read — no catalog validation. */
export function readPersistedBuildingId(): string | null {
  if (!isBrowser()) return null;
  try {
    const stored = localStorage.getItem(SELECTED_BUILDING_KEY);
    return stored?.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

/** Raw write — no catalog validation. */
export function writePersistedBuildingId(buildingId: string): void {
  if (!isBrowser() || !buildingId.trim()) return;
  try {
    localStorage.setItem(SELECTED_BUILDING_KEY, buildingId.trim());
  } catch {
    /* ignore */
  }
}

export function clearPersistedBuildingId(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(SELECTED_BUILDING_KEY);
  } catch {
    /* ignore */
  }
}
