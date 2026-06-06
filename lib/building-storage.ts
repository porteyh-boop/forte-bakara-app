import {
  DEFAULT_BUILDING_ID,
  getBuildingDataset,
  isValidBuildingId,
} from "./buildings";

export const SELECTED_BUILDING_KEY = "forte-selected-building";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getStoredBuildingId(): string {
  if (!isBrowser()) return DEFAULT_BUILDING_ID;
  try {
    const stored = localStorage.getItem(SELECTED_BUILDING_KEY);
    if (stored && isValidBuildingId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_BUILDING_ID;
}

export function setStoredBuildingId(buildingId: string): void {
  if (!isBrowser() || !isValidBuildingId(buildingId)) return;
  localStorage.setItem(SELECTED_BUILDING_KEY, buildingId);
  window.dispatchEvent(
    new CustomEvent("forte-building-changed", { detail: { buildingId } })
  );
}

export function getStoredBuildingDataset() {
  return getBuildingDataset(getStoredBuildingId());
}
