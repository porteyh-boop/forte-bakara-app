import { getCatalogSnapshot } from "./buildings-catalog";
import type { Fault } from "./types";

export const LIVE_STARTED_STORAGE_PREFIX = "forte-live-started-at";

export function getLiveStartedStorageKey(buildingId: string): string {
  return `${LIVE_STARTED_STORAGE_PREFIX}-${buildingId}`;
}

export function isAfterLiveStart(
  reportedAt: string,
  liveStartedAt: string
): boolean {
  return new Date(reportedAt).getTime() >= new Date(liveStartedAt).getTime();
}

export function filterFaultsForLiveStart(
  faults: Fault[],
  liveStartedAt: string | null | undefined
): Fault[] {
  if (!liveStartedAt) return faults;
  return faults.filter((fault) => isAfterLiveStart(fault.reportedAt, liveStartedAt));
}

export function getCachedLiveStartedAt(buildingId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(getLiveStartedStorageKey(buildingId));
  } catch {
    return null;
  }
}

export function setCachedLiveStartedAt(
  buildingId: string,
  liveStartedAt: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getLiveStartedStorageKey(buildingId), liveStartedAt);
  } catch {
    /* ignore */
  }
}

export function resolveLiveStartedAt(buildingId: string): string | null {
  const fromCatalog =
    getCatalogSnapshot()?.liveStartedAtByBuilding?.[buildingId] ?? null;
  if (fromCatalog) return fromCatalog;
  return getCachedLiveStartedAt(buildingId);
}

export function resolveAllLiveStartedAt(
  buildingIds: string[]
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const id of buildingIds) {
    map[id] = resolveLiveStartedAt(id);
  }
  return map;
}
