import {
  getAllCloudBuildings,
  getAllCloudElevators,
  mapElevatorStatus,
  type CloudBuildingRow,
  type CloudElevatorRow,
} from "./buildings-cloud";
import { isPilotCloudConfigured } from "./pilot-cloud";
import type { Building, BuildingDataContext, Elevator, Status } from "./types";

export type CatalogSource = "demo" | "cloud";

export interface BuildingCatalogSnapshot {
  source: CatalogSource;
  buildings: Record<string, BuildingDataContext>;
  allBuildingIds: string[];
  activeBuildingIds: string[];
  liveStartedAtByBuilding: Record<string, string | null>;
}

export const BUILDINGS_CATALOG_UPDATED_EVENT = "forte-buildings-catalog-updated";

let catalogSnapshot: BuildingCatalogSnapshot | null = null;
let catalogLoadPromise: Promise<BuildingCatalogSnapshot> | null = null;

function dispatchCatalogUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUILDINGS_CATALOG_UPDATED_EVENT));
}

export function getCatalogSnapshot(): BuildingCatalogSnapshot | null {
  return catalogSnapshot;
}

export function setCatalogSnapshot(snapshot: BuildingCatalogSnapshot | null): void {
  catalogSnapshot = snapshot;
}

function mapCloudElevatorToApp(e: CloudElevatorRow): Elevator {
  const status: Status = e.is_active ? mapElevatorStatus(e.status) : "מושבתת";
  const stations = e.floors_count ?? 0;
  return {
    id: e.elevator_id,
    name: e.elevator_name,
    status,
    stations,
    floor: stations > 0 ? `${stations} תחנות` : undefined,
  };
}

function mapCloudBuildingToContext(
  building: CloudBuildingRow,
  elevators: CloudElevatorRow[],
  demoCtx?: BuildingDataContext
): BuildingDataContext {
  const activeElevators = elevators.filter((e) => e.is_active);
  return {
    id: building.building_id,
    building: {
      buildingCode: building.building_id.toUpperCase(),
      name: building.name,
      address: building.address ?? "",
      city: building.city ?? "",
      elevatorCount: activeElevators.length,
      elevatorCompany: building.elevator_company ?? "",
      contactPerson: building.contact_name ?? "",
      phone: building.contact_phone ?? "",
      managementCompany: building.management_company ?? "",
      units: building.floors_count ?? 0,
    },
    elevators: activeElevators.map(mapCloudElevatorToApp),
    faults: demoCtx?.faults ?? [],
    activeFaultDowntime: demoCtx?.activeFaultDowntime ?? {},
  };
}

export function buildDemoCatalogSnapshot(
  demoDatasets: Record<string, BuildingDataContext>
): BuildingCatalogSnapshot {
  const ids = Object.keys(demoDatasets);
  return {
    source: "demo",
    buildings: { ...demoDatasets },
    allBuildingIds: ids,
    activeBuildingIds: ids,
    liveStartedAtByBuilding: {},
  };
}

export function buildCloudCatalogSnapshot(
  cloudBuildings: CloudBuildingRow[],
  cloudElevators: CloudElevatorRow[],
  demoDatasets: Record<string, BuildingDataContext>
): BuildingCatalogSnapshot {
  const buildings: Record<string, BuildingDataContext> = {};
  const allBuildingIds: string[] = [];
  const activeBuildingIds: string[] = [];
  const liveStartedAtByBuilding: Record<string, string | null> = {};

  for (const row of cloudBuildings) {
    const elev = cloudElevators.filter((e) => e.building_id === row.building_id);
    const demoCtx = demoDatasets[row.building_id];
    buildings[row.building_id] = mapCloudBuildingToContext(row, elev, demoCtx);
    allBuildingIds.push(row.building_id);
    liveStartedAtByBuilding[row.building_id] = row.live_started_at ?? null;
    if (row.is_active) activeBuildingIds.push(row.building_id);
  }

  return {
    source: "cloud",
    buildings,
    allBuildingIds,
    activeBuildingIds,
    liveStartedAtByBuilding,
  };
}

export async function loadBuildingCatalog(
  demoDatasets: Record<string, BuildingDataContext>
): Promise<BuildingCatalogSnapshot> {
  if (!isPilotCloudConfigured()) {
    const demo = buildDemoCatalogSnapshot(demoDatasets);
    setCatalogSnapshot(demo);
    return demo;
  }

  const [cloudBuildings, cloudElevators] = await Promise.all([
    getAllCloudBuildings(),
    getAllCloudElevators(),
  ]);

  const snapshot =
    cloudBuildings.length === 0
      ? buildDemoCatalogSnapshot(demoDatasets)
      : buildCloudCatalogSnapshot(cloudBuildings, cloudElevators, demoDatasets);

  setCatalogSnapshot(snapshot);
  return snapshot;
}

export async function refreshBuildingCatalog(
  demoDatasets: Record<string, BuildingDataContext>
): Promise<BuildingCatalogSnapshot> {
  catalogLoadPromise = null;
  const snapshot = await loadBuildingCatalog(demoDatasets);
  dispatchCatalogUpdated();
  return snapshot;
}

export function ensureBuildingCatalogLoaded(
  demoDatasets: Record<string, BuildingDataContext>
): Promise<BuildingCatalogSnapshot> {
  if (catalogSnapshot) return Promise.resolve(catalogSnapshot);
  if (!catalogLoadPromise) {
    catalogLoadPromise = loadBuildingCatalog(demoDatasets).finally(() => {
      catalogLoadPromise = null;
    });
  }
  return catalogLoadPromise;
}

export function resolveBuildingDataset(
  id: string,
  demoDatasets: Record<string, BuildingDataContext>,
  defaultBuildingId: string
): BuildingDataContext {
  if (catalogSnapshot) {
    return (
      catalogSnapshot.buildings[id] ??
      demoDatasets[id] ??
      demoDatasets[defaultBuildingId]
    );
  }
  return demoDatasets[id] ?? demoDatasets[defaultBuildingId];
}

export function resolveAllBuildingIds(
  demoDatasets: Record<string, BuildingDataContext>
): string[] {
  if (catalogSnapshot) {
    return catalogSnapshot.activeBuildingIds.length > 0
      ? [...catalogSnapshot.activeBuildingIds]
      : [...catalogSnapshot.allBuildingIds];
  }
  return Object.keys(demoDatasets);
}

export function resolveIsValidBuildingId(
  id: string,
  demoDatasets: Record<string, BuildingDataContext>
): boolean {
  if (catalogSnapshot) {
    return (
      catalogSnapshot.activeBuildingIds.includes(id) ||
      catalogSnapshot.allBuildingIds.includes(id) ||
      id in demoDatasets
    );
  }
  return id in demoDatasets;
}

export function resolveAllBuildingIdsForMaster(
  demoDatasets: Record<string, BuildingDataContext>,
  orphanBuildingIds: string[] = []
): string[] {
  const ids = new Set<string>();
  Object.keys(demoDatasets).forEach((id) => ids.add(id));
  if (catalogSnapshot) {
    catalogSnapshot.allBuildingIds.forEach((id) => ids.add(id));
  }
  orphanBuildingIds.forEach((id) => ids.add(id));
  return Array.from(ids);
}
