import {
  getAllCloudBuildings,
  getAllCloudElevators,
  mapElevatorStatus,
  normalizeBuildingId,
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

function cloneDemoContext(demo: BuildingDataContext): BuildingDataContext {
  return {
    ...demo,
    building: { ...demo.building },
    elevators: [...demo.elevators],
    faults: [...demo.faults],
    activeFaultDowntime: { ...demo.activeFaultDowntime },
  };
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
  const activeCloudElevators = elevators.filter((e) => e.is_active);
  const cloudAppElevators = activeCloudElevators.map(mapCloudElevatorToApp);
  const appElevators =
    cloudAppElevators.length > 0
      ? cloudAppElevators
      : [...(demoCtx?.elevators ?? [])];
  const demoBuilding = demoCtx?.building;

  const buildingMeta: Building = {
    buildingCode: demoBuilding?.buildingCode ?? building.building_id.toUpperCase(),
    name: building.name || demoBuilding?.name || building.building_id,
    address: building.address ?? demoBuilding?.address ?? "",
    city: building.city ?? demoBuilding?.city ?? "",
    elevatorCount:
      appElevators.length > 0
        ? appElevators.length
        : (demoBuilding?.elevatorCount ?? 0),
    elevatorCompany:
      building.elevator_company ?? demoBuilding?.elevatorCompany ?? "",
    contactPerson: building.contact_name ?? demoBuilding?.contactPerson ?? "",
    phone: building.contact_phone ?? demoBuilding?.phone ?? "",
    managementCompany:
      building.management_company ?? demoBuilding?.managementCompany ?? "",
    units: building.floors_count ?? demoBuilding?.units ?? 0,
    contractNumber: demoBuilding?.contractNumber,
    serviceLevel: demoBuilding?.serviceLevel,
    serviceStartDate: demoBuilding?.serviceStartDate,
    lastInspectionDate: demoBuilding?.lastInspectionDate,
  };

  return {
    id: normalizeBuildingId(building.building_id),
    building: buildingMeta,
    elevators: appElevators,
    faults: demoCtx?.faults ? [...demoCtx.faults] : [],
    activeFaultDowntime: { ...(demoCtx?.activeFaultDowntime ?? {}) },
  };
}

export function buildDemoCatalogSnapshot(
  demoDatasets: Record<string, BuildingDataContext>
): BuildingCatalogSnapshot {
  const ids = Object.keys(demoDatasets);
  const buildings: Record<string, BuildingDataContext> = {};
  for (const id of ids) {
    buildings[id] = cloneDemoContext(demoDatasets[id]);
  }
  return {
    source: "demo",
    buildings,
    allBuildingIds: ids,
    activeBuildingIds: ids,
    liveStartedAtByBuilding: {},
  };
}

/** Client catalog: always keep all demo buildings; overlay cloud metadata and live_started_at. */
export function buildMergedClientCatalogSnapshot(
  cloudBuildings: CloudBuildingRow[],
  cloudElevators: CloudElevatorRow[],
  demoDatasets: Record<string, BuildingDataContext>
): BuildingCatalogSnapshot {
  const buildings: Record<string, BuildingDataContext> = {};
  const allBuildingIds: string[] = [];
  const activeBuildingIds: string[] = [];
  const liveStartedAtByBuilding: Record<string, string | null> = {};

  for (const id of Object.keys(demoDatasets)) {
    buildings[id] = cloneDemoContext(demoDatasets[id]);
    allBuildingIds.push(id);
    activeBuildingIds.push(id);
    liveStartedAtByBuilding[id] = null;
  }

  for (const row of cloudBuildings) {
    const id = normalizeBuildingId(row.building_id);
    const elev = cloudElevators.filter(
      (e) => normalizeBuildingId(e.building_id) === id
    );
    const demoCtx = demoDatasets[id];
    buildings[id] = mapCloudBuildingToContext(row, elev, demoCtx);

    if (!allBuildingIds.includes(id)) {
      allBuildingIds.push(id);
    }

    const activeIdx = activeBuildingIds.indexOf(id);
    if (row.is_active) {
      if (activeIdx === -1) activeBuildingIds.push(id);
    } else if (activeIdx !== -1) {
      activeBuildingIds.splice(activeIdx, 1);
    }

    liveStartedAtByBuilding[id] = row.live_started_at ?? null;
  }

  return {
    source: "cloud",
    buildings,
    allBuildingIds,
    activeBuildingIds,
    liveStartedAtByBuilding,
  };
}

/** @deprecated Alias — client catalog is always merged with demo buildings. */
export const buildCloudCatalogSnapshot = buildMergedClientCatalogSnapshot;

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
      : buildMergedClientCatalogSnapshot(
          cloudBuildings,
          cloudElevators,
          demoDatasets
        );

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

/** ללא fallback — מחזיר null אם הבניין לא קיים בקטלוג או בדמו. */
export function resolveBuildingDatasetStrict(
  id: string,
  demoDatasets: Record<string, BuildingDataContext>
): BuildingDataContext | null {
  const normalizedId = normalizeBuildingId(id);
  if (catalogSnapshot) {
    const fromCatalog =
      catalogSnapshot.buildings[normalizedId] ?? catalogSnapshot.buildings[id];
    if (fromCatalog) return fromCatalog;
  }
  return demoDatasets[normalizedId] ?? demoDatasets[id] ?? null;
}

export function buildCloudBuildingContext(
  building: CloudBuildingRow,
  elevators: CloudElevatorRow[],
  demoDatasets: Record<string, BuildingDataContext>
): BuildingDataContext {
  const normalizedId = normalizeBuildingId(building.building_id);
  const demoCtx = demoDatasets[normalizedId] ?? demoDatasets[building.building_id];
  return mapCloudBuildingToContext(building, elevators, demoCtx);
}

export function resolveBuildingDataset(
  id: string,
  demoDatasets: Record<string, BuildingDataContext>,
  defaultBuildingId: string
): BuildingDataContext {
  const normalizedId = normalizeBuildingId(id);
  if (catalogSnapshot) {
    return (
      catalogSnapshot.buildings[normalizedId] ??
      catalogSnapshot.buildings[id] ??
      demoDatasets[normalizedId] ??
      demoDatasets[id] ??
      demoDatasets[defaultBuildingId]
    );
  }
  return (
    demoDatasets[normalizedId] ??
    demoDatasets[id] ??
    demoDatasets[defaultBuildingId]
  );
}

export function resolveAllBuildingIds(
  demoDatasets: Record<string, BuildingDataContext>
): string[] {
  if (catalogSnapshot) {
    if (catalogSnapshot.activeBuildingIds.length > 0) {
      return [...catalogSnapshot.activeBuildingIds];
    }
    return [...catalogSnapshot.allBuildingIds];
  }
  return Object.keys(demoDatasets);
}

export function resolveIsValidBuildingId(
  id: string,
  demoDatasets: Record<string, BuildingDataContext>
): boolean {
  const normalizedId = normalizeBuildingId(id);
  if (catalogSnapshot) {
    return (
      catalogSnapshot.activeBuildingIds.includes(normalizedId) ||
      catalogSnapshot.activeBuildingIds.includes(id) ||
      catalogSnapshot.allBuildingIds.includes(normalizedId) ||
      catalogSnapshot.allBuildingIds.includes(id) ||
      normalizedId in demoDatasets ||
      id in demoDatasets
    );
  }
  return normalizedId in demoDatasets || id in demoDatasets;
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
