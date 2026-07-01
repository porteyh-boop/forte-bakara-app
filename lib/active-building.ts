import { normalizeBuildingId } from "./buildings-cloud";
import type { BuildingCatalogSnapshot } from "./buildings-catalog";
import { DEFAULT_BUILDING_ID } from "./buildings";

export function isKnownBuildingId(
  id: string,
  catalog: BuildingCatalogSnapshot | null,
  demoBuildingIds: readonly string[]
): boolean {
  const trimmed = id.trim();
  if (!trimmed) return false;

  const normalizedId = normalizeBuildingId(trimmed);
  if (catalog) {
    if (
      catalog.activeBuildingIds.includes(normalizedId) ||
      catalog.activeBuildingIds.includes(trimmed) ||
      catalog.allBuildingIds.includes(normalizedId) ||
      catalog.allBuildingIds.includes(trimmed)
    ) {
      return true;
    }
  }

  return (
    demoBuildingIds.includes(normalizedId) || demoBuildingIds.includes(trimmed)
  );
}

export function pickFallbackBuildingId(
  catalog: BuildingCatalogSnapshot | null,
  demoBuildingIds: readonly string[]
): string {
  if (catalog?.activeBuildingIds.length) {
    return catalog.activeBuildingIds[0];
  }
  if (catalog?.allBuildingIds.length) {
    return catalog.allBuildingIds[0];
  }
  if (demoBuildingIds.includes(DEFAULT_BUILDING_ID)) {
    return DEFAULT_BUILDING_ID;
  }
  return demoBuildingIds[0] ?? DEFAULT_BUILDING_ID;
}

/**
 * Resolve the active building after catalog is available.
 * persistedId comes from readPersistedBuildingId() — may be unknown until sync.
 */
export function resolveActiveBuildingId(
  persistedId: string | null,
  catalog: BuildingCatalogSnapshot | null,
  demoBuildingIds: readonly string[]
): string {
  if (persistedId?.trim()) {
    const normalized = normalizeBuildingId(persistedId);
    if (isKnownBuildingId(normalized, catalog, demoBuildingIds)) {
      return normalized;
    }
  }

  return pickFallbackBuildingId(catalog, demoBuildingIds);
}
