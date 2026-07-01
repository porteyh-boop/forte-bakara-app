import {
  DEFAULT_BUILDING_ID,
  getAllDemoBuildingIds,
  getBuildingDataset,
  getDemoDatasets,
} from "./buildings";
import {
  readPersistedBuildingId,
  writePersistedBuildingId,
} from "./building-persistence";
import {
  getCatalogSnapshot,
  ensureBuildingCatalogLoaded,
} from "./buildings-catalog";
import { resolveActiveBuildingId, isKnownBuildingId } from "./active-building";
import { normalizeBuildingId } from "./buildings-cloud";

export { SELECTED_BUILDING_KEY } from "./building-persistence";

/**
 * @deprecated Use BuildingProvider / useBuilding(). Prefer readPersistedBuildingId for tests.
 */
export function getStoredBuildingId(): string {
  const persisted = readPersistedBuildingId();
  const catalog = getCatalogSnapshot();
  if (catalog) {
    return resolveActiveBuildingId(
      persisted,
      catalog,
      getAllDemoBuildingIds()
    );
  }
  if (
    persisted &&
    getAllDemoBuildingIds().includes(normalizeBuildingId(persisted))
  ) {
    return normalizeBuildingId(persisted);
  }
  return DEFAULT_BUILDING_ID;
}

/**
 * @deprecated Use BuildingProvider.selectBuilding(). Writes persistence only when catalog knows the id.
 */
export function setStoredBuildingId(buildingId: string): void {
  const normalized = normalizeBuildingId(buildingId);
  const catalog = getCatalogSnapshot();
  if (
    !isKnownBuildingId(normalized, catalog, getAllDemoBuildingIds())
  ) {
    return;
  }
  writePersistedBuildingId(normalized);
  window.dispatchEvent(
    new CustomEvent("forte-building-changed", { detail: { buildingId: normalized } })
  );
}

/** @deprecated Use useBuilding().ctx */
export function getStoredBuildingDataset() {
  return getBuildingDataset(getStoredBuildingId());
}

/** @deprecated Tests / legacy — prefer ensureBuildingCatalogLoaded in app code. */
export async function hydrateStoredBuildingId(): Promise<string> {
  await ensureBuildingCatalogLoaded(getDemoDatasets());
  return getStoredBuildingId();
}
