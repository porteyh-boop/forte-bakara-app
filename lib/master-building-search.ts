import { getBuildingDataset, getStaticDemoBuildingMeta } from "./buildings";
import { normalizeBuildingId } from "./buildings-cloud";
import type { MasterBuildingEntry } from "./master-buildings-list";

export type MasterBuildingSearchProfile = {
  buildingId: string;
  name: string;
  city: string | null;
  address: string | null;
  managementCompany: string | null;
  elevatorCompany: string | null;
  elevatorCount: number;
};

export function normalizeBuildingSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveMasterBuildingSearchProfile(
  entry: MasterBuildingEntry,
  elevatorCount: number
): MasterBuildingSearchProfile {
  const row = entry.cloudRow;
  if (row) {
    return {
      buildingId: entry.buildingId,
      name: row.name,
      city: row.city,
      address: row.address,
      managementCompany: row.management_company,
      elevatorCompany: row.elevator_company,
      elevatorCount,
    };
  }

  try {
    const dataset = getBuildingDataset(entry.buildingId);
    return {
      buildingId: entry.buildingId,
      name: dataset.building.name,
      city: dataset.building.city ?? entry.city,
      address: dataset.building.address ?? null,
      managementCompany: dataset.building.managementCompany ?? null,
      elevatorCompany: dataset.building.elevatorCompany ?? null,
      elevatorCount: dataset.elevators.length || elevatorCount,
    };
  } catch {
    const demo = getStaticDemoBuildingMeta(entry.buildingId);
    return {
      buildingId: entry.buildingId,
      name: demo.name || entry.name,
      city: demo.city ?? entry.city,
      address: null,
      managementCompany: null,
      elevatorCompany: null,
      elevatorCount,
    };
  }
}

export function masterBuildingMatchesSearch(
  entry: MasterBuildingEntry,
  profile: MasterBuildingSearchProfile,
  query: string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const normalizedId = normalizeBuildingId(trimmed);
  if (normalizedId && normalizedId === entry.buildingId) {
    return true;
  }

  const q = normalizeBuildingSearchQuery(trimmed);
  const fields = [
    entry.buildingId,
    entry.name,
    profile.city ?? "",
    profile.address ?? "",
  ].map((field) => field.toLowerCase());

  return fields.some((field) => field.includes(q));
}

export type MasterBuildingSearchHit = {
  entry: MasterBuildingEntry;
  profile: MasterBuildingSearchProfile;
};

export function searchMasterBuildings(
  entries: MasterBuildingEntry[],
  query: string,
  resolveElevatorCount: (buildingId: string) => number,
  limit = 12
): MasterBuildingSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return entries
    .map((entry) => {
      const elevatorCount = resolveElevatorCount(entry.buildingId);
      const profile = resolveMasterBuildingSearchProfile(entry, elevatorCount);
      return { entry, profile };
    })
    .filter(({ entry, profile }) =>
      masterBuildingMatchesSearch(entry, profile, trimmed)
    )
    .slice(0, limit);
}

export function findMasterBuildingById(
  entries: MasterBuildingEntry[],
  buildingId: string,
  resolveElevatorCount: (buildingId: string) => number
): MasterBuildingSearchHit | null {
  const id = normalizeBuildingId(buildingId);
  if (!id) return null;

  const entry = entries.find((item) => item.buildingId === id);
  if (!entry) return null;

  const elevatorCount = resolveElevatorCount(id);
  return {
    entry,
    profile: resolveMasterBuildingSearchProfile(entry, elevatorCount),
  };
}

export function cloudBuildingIdExists(
  cloudBuildings: { building_id: string }[],
  buildingId: string
): boolean {
  const id = normalizeBuildingId(buildingId);
  if (!id) return false;
  return cloudBuildings.some((row) => row.building_id === id);
}
