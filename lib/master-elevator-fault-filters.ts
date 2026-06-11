import type { PilotCloudFault } from "./pilot-cloud";

export type ElevatorFaultStatusFilter =
  | "all"
  | "פתוחה"
  | "בטיפול"
  | "טופלה"
  | "סגורה";

export type ElevatorFaultPeriodFilter = "all" | "30d" | "90d" | "365d";

export interface ElevatorFaultFilters {
  status: ElevatorFaultStatusFilter;
  faultType: string;
  period: ElevatorFaultPeriodFilter;
  searchQuery: string;
}

export const DEFAULT_ELEVATOR_FAULT_FILTERS: ElevatorFaultFilters = {
  status: "all",
  faultType: "all",
  period: "all",
  searchQuery: "",
};

export const ELEVATOR_FAULT_STATUS_OPTIONS: {
  value: ElevatorFaultStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "הכל" },
  { value: "פתוחה", label: "פתוחה" },
  { value: "בטיפול", label: "בטיפול" },
  { value: "טופלה", label: "טופלה" },
  { value: "סגורה", label: "סגורה" },
];

export const ELEVATOR_FAULT_PERIOD_OPTIONS: {
  value: ElevatorFaultPeriodFilter;
  label: string;
}[] = [
  { value: "all", label: "הכל" },
  { value: "30d", label: "30 יום אחרונים" },
  { value: "90d", label: "90 יום אחרונים" },
  { value: "365d", label: "שנה אחרונה" },
];

export function getUniqueFaultTypesFromFaults(
  faults: PilotCloudFault[]
): string[] {
  const types = new Set<string>();
  for (const fault of faults) {
    if (fault.fault_type) types.add(fault.fault_type);
  }
  return Array.from(types).sort((a, b) => a.localeCompare(b, "he"));
}

export function isElevatorFaultFilterActive(
  filters: ElevatorFaultFilters
): boolean {
  return (
    filters.status !== "all" ||
    filters.faultType !== "all" ||
    filters.period !== "all" ||
    filters.searchQuery.trim() !== ""
  );
}

export function clearElevatorFaultFilters(): ElevatorFaultFilters {
  return { ...DEFAULT_ELEVATOR_FAULT_FILTERS };
}

function getPeriodCutoff(
  period: ElevatorFaultPeriodFilter,
  now: Date
): Date | null {
  if (period === "all") return null;
  const cutoff = new Date(now);
  if (period === "30d") {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (period === "90d") {
    cutoff.setDate(cutoff.getDate() - 90);
  } else if (period === "365d") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  }
  return cutoff;
}

export function filterElevatorDossierFaults(
  faults: PilotCloudFault[],
  filters: ElevatorFaultFilters,
  now: Date = new Date()
): PilotCloudFault[] {
  const cutoff = getPeriodCutoff(filters.period, now);
  const search = filters.searchQuery.trim().toLowerCase();

  return faults.filter((fault) => {
    if (filters.status !== "all" && fault.status !== filters.status) {
      return false;
    }
    if (filters.faultType !== "all" && fault.fault_type !== filters.faultType) {
      return false;
    }
    if (cutoff && new Date(fault.created_at) < cutoff) {
      return false;
    }
    if (search && !fault.description.toLowerCase().includes(search)) {
      return false;
    }
    return true;
  });
}
