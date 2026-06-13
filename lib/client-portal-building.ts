import {
  buildCloudBuildingContext,
  ensureBuildingCatalogLoaded,
  getCatalogSnapshot,
  resolveBuildingDatasetStrict,
} from "./buildings-catalog";
import {
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  normalizeBuildingId,
} from "./buildings-cloud";
import { getDemoDatasets } from "./buildings";
import type { BuildingDataContext } from "./types";

export const CLIENT_PORTAL_BUILDING_NOT_FOUND_TITLE = "בניין לא נמצא";
export const CLIENT_PORTAL_BUILDING_NOT_FOUND_MESSAGE =
  "לא ניתן לטעון את נתוני הבניין. פנו למנהל המערכת.";
export const CLIENT_PORTAL_BUILDING_DATA_MISSING = "לא נמצאו נתוני בניין";

export type ClientPortalBuildingSource = "catalog" | "cloud" | "demo";

export interface ClientPortalBuildingResolve {
  requestedBuildingId: string;
  loadedBuildingId: string;
  buildingName: string;
  ctx: BuildingDataContext;
  source: ClientPortalBuildingSource;
  liveStartedAt: string | null;
}

export async function ensureClientPortalCatalogReady(): Promise<void> {
  await ensureBuildingCatalogLoaded(getDemoDatasets());
}

export async function resolveClientPortalBuilding(
  buildingId: string
): Promise<ClientPortalBuildingResolve | null> {
  const requestedBuildingId = buildingId.trim();
  if (!requestedBuildingId) return null;

  await ensureClientPortalCatalogReady();

  const normalizedId = normalizeBuildingId(requestedBuildingId);
  const demoDatasets = getDemoDatasets();
  const catalog = getCatalogSnapshot();

  const fromCatalog = resolveBuildingDatasetStrict(requestedBuildingId, demoDatasets);
  if (fromCatalog) {
    const source: ClientPortalBuildingSource = catalog?.buildings[normalizedId]
      ? catalog.source === "cloud" && !demoDatasets[normalizedId]
        ? "cloud"
        : demoDatasets[normalizedId]
          ? "demo"
          : "catalog"
      : "demo";

    return {
      requestedBuildingId: normalizedId,
      loadedBuildingId: fromCatalog.id,
      buildingName: fromCatalog.building.name,
      ctx: fromCatalog,
      source,
      liveStartedAt:
        catalog?.liveStartedAtByBuilding[normalizedId] ??
        catalog?.liveStartedAtByBuilding[requestedBuildingId] ??
        null,
    };
  }

  const [{ rows: cloudBuildings }, cloudElevators] = await Promise.all([
    getAllCloudBuildingsWithMeta(),
    getAllCloudElevators(),
  ]);

  const cloudRow = cloudBuildings.find(
    (row) => normalizeBuildingId(row.building_id) === normalizedId
  );

  if (!cloudRow) {
    return null;
  }

  const elevatorsForBuilding = cloudElevators.filter(
    (elevator) => normalizeBuildingId(elevator.building_id) === normalizedId
  );
  const ctx = buildCloudBuildingContext(cloudRow, elevatorsForBuilding, demoDatasets);

  return {
    requestedBuildingId: normalizedId,
    loadedBuildingId: ctx.id,
    buildingName: ctx.building.name,
    ctx,
    source: "cloud",
    liveStartedAt: cloudRow.live_started_at ?? null,
  };
}

export function getDemoFaultsForPortalBuilding(
  buildingId: string
): BuildingDataContext["faults"] {
  const normalizedId = normalizeBuildingId(buildingId);
  const demoDatasets = getDemoDatasets();
  const demoCtx = demoDatasets[normalizedId] ?? demoDatasets[buildingId];
  return demoCtx?.faults ? [...demoCtx.faults] : [];
}
