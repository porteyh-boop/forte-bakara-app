import { SELECTED_BUILDING_KEY } from "./building-storage";
import { isValidBuildingId } from "./buildings";
import { isExpert } from "./roles";
import {
  CLOSURES_STORAGE_PREFIX,
  REPORTS_STORAGE_PREFIX,
  getClosuresStorageKey,
  getReportsStorageKey,
  notifyFaultsUpdated,
} from "./report-storage";

export const PILOT_RESET_CONFIRM_ALL =
  "האם לאפס את כל נתוני הבדיקה? פעולה זו תמחק דיווחים וסגירות שנשמרו בדפדפן זה.";

export const PILOT_RESET_CONFIRM_BUILDING =
  "האם לאפס את נתוני הבדיקה של הבניין הנבחר? פעולה זו תמחק דיווחים וסגירות של בניין זה בלבד.";

export const PILOT_RESET_SUCCESS_MESSAGE = "הנתונים אופסו בהצלחה.";

export type PilotStorageLike = Pick<
  Storage,
  "length" | "key" | "removeItem" | "getItem"
>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** כפתורי איפוס — רק למומחה (APP_ROLE === expert) */
export function shouldShowPilotResetControls(): boolean {
  return isExpert();
}

/** מפתחות localStorage לאיפוס — לבדיקות ולמימוש */
export function getPilotStorageKeysToRemove(
  storage: PilotStorageLike,
  buildingId?: string
): string[] {
  if (buildingId) {
    if (!isValidBuildingId(buildingId)) return [];
    return [
      getReportsStorageKey(buildingId),
      getClosuresStorageKey(buildingId),
    ];
  }

  const keys = new Set<string>();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (
      key.startsWith(`${REPORTS_STORAGE_PREFIX}-`) ||
      key.startsWith(`${CLOSURES_STORAGE_PREFIX}-`)
    ) {
      keys.add(key);
    }
  }
  keys.add(SELECTED_BUILDING_KEY);
  return Array.from(keys);
}

export function removePilotStorageKeys(
  storage: PilotStorageLike,
  keys: string[]
): void {
  for (const key of keys) {
    storage.removeItem(key);
  }
}

/** איפוס כל נתוני הפיילוט בדפדפן — לא נוגע ב-lib/buildings.ts */
export function resetAllPilotData(): boolean {
  if (!isBrowser()) return false;
  const keys = getPilotStorageKeysToRemove(localStorage);
  removePilotStorageKeys(localStorage, keys);
  notifyFaultsUpdated();
  window.dispatchEvent(new CustomEvent("forte-building-changed"));
  return true;
}

/** איפוס נתוני בניין בודד בלבד */
export function resetBuildingPilotData(buildingId: string): boolean {
  if (!isBrowser() || !isValidBuildingId(buildingId)) return false;
  const keys = getPilotStorageKeysToRemove(localStorage, buildingId);
  removePilotStorageKeys(localStorage, keys);
  notifyFaultsUpdated(buildingId);
  return true;
}
