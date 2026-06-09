import {
  calculateBuildingHealthScore,
  calculateBuildingKpis,
  detectRecurringFaults,
  getHealthLevelClasses,
  type HealthLevel,
} from "./master-analytics";
import type { PilotCloudFault } from "./pilot-cloud";

export interface ElevatorFaultCount {
  elevatorId: string;
  elevatorName: string;
  count: number;
}

export interface BuildingDossier {
  buildingId: string;
  buildingName: string;
  totalFaults: number;
  openFaults: number;
  closedFaults: number;
  elevatorCount: number;
  faultsByElevator: ElevatorFaultCount[];
  lastFaultDate: string | null;
  healthScore: number;
  healthLevel: HealthLevel;
  recurringCount: number;
  faults: PilotCloudFault[];
}

export interface ElevatorDossier {
  elevatorId: string;
  elevatorName: string;
  totalFaults: number;
  openFaults: number;
  closedFaults: number;
  lastFaultDate: string | null;
  faults: PilotCloudFault[];
}

const OPEN_STATUSES = new Set(["פתוחה", "בטיפול", "מושבתת"]);

function isOpenFault(fault: PilotCloudFault): boolean {
  return OPEN_STATUSES.has(fault.status);
}

function isClosedFault(fault: PilotCloudFault): boolean {
  return fault.status === "סגורה";
}

function sortFaultsNewestFirst(faults: PilotCloudFault[]): PilotCloudFault[] {
  return [...faults].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function getLastFaultDate(faults: PilotCloudFault[]): string | null {
  if (faults.length === 0) return null;
  return sortFaultsNewestFirst(faults)[0]?.created_at ?? null;
}

function countFaultsByElevator(faults: PilotCloudFault[]): ElevatorFaultCount[] {
  const map = new Map<string, ElevatorFaultCount>();
  for (const f of faults) {
    const existing = map.get(f.elevator_id);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(f.elevator_id, {
        elevatorId: f.elevator_id,
        elevatorName: f.elevator_name,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function resolveElevatorCount(
  buildingId: string,
  faults: PilotCloudFault[],
  registeredElevatorIds: string[] = []
): number {
  const fromFaults = new Set(
    faults.filter((f) => f.building_id === buildingId).map((f) => f.elevator_id)
  );
  const merged = new Set([...registeredElevatorIds, ...fromFaults]);
  return merged.size;
}

export function filterFaultsForBuilding(
  faults: PilotCloudFault[],
  buildingId: string
): PilotCloudFault[] {
  return faults.filter((f) => f.building_id === buildingId);
}

export function buildBuildingDossier(params: {
  buildingId: string;
  buildingName: string;
  faults: PilotCloudFault[];
  registeredElevatorIds?: string[];
}): BuildingDossier {
  const { buildingId, buildingName, faults, registeredElevatorIds = [] } =
    params;
  const buildingFaults = sortFaultsNewestFirst(
    filterFaultsForBuilding(faults, buildingId)
  );
  const recurring = detectRecurringFaults(buildingFaults);
  const kpis = calculateBuildingKpis(buildingFaults);
  const health = calculateBuildingHealthScore(buildingFaults, recurring);

  return {
    buildingId,
    buildingName,
    totalFaults: kpis.totalFaults,
    openFaults: kpis.openFaults,
    closedFaults: kpis.closedFaults,
    elevatorCount: resolveElevatorCount(
      buildingId,
      faults,
      registeredElevatorIds
    ),
    faultsByElevator: countFaultsByElevator(buildingFaults),
    lastFaultDate: getLastFaultDate(buildingFaults),
    healthScore: health.score,
    healthLevel: health.level,
    recurringCount: recurring.length,
    faults: buildingFaults,
  };
}

export function buildElevatorDossier(params: {
  buildingId: string;
  elevatorId: string;
  elevatorName: string;
  faults: PilotCloudFault[];
}): ElevatorDossier {
  const { buildingId, elevatorId, elevatorName, faults } = params;
  const elevatorFaults = sortFaultsNewestFirst(
    faults.filter(
      (f) => f.building_id === buildingId && f.elevator_id === elevatorId
    )
  );

  return {
    elevatorId,
    elevatorName,
    totalFaults: elevatorFaults.length,
    openFaults: elevatorFaults.filter(isOpenFault).length,
    closedFaults: elevatorFaults.filter(isClosedFault).length,
    lastFaultDate: getLastFaultDate(elevatorFaults),
    faults: elevatorFaults,
  };
}

export function formatDossierDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export { getHealthLevelClasses };
