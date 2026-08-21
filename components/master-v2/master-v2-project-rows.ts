import { getProjectProgress } from "@/lib/get-project-stage";
import type { MasterBuildingEntry } from "@/lib/master-buildings-list";
import { normalizeProjectType } from "@/lib/project-type-config";
import { resolveDisplayProjectNumber } from "@/lib/project-number";
import {
  normalizeServiceType,
  resolveServiceTypeDisplayLabel,
  type ServiceType,
} from "@/lib/service-type";

export interface MasterProjectTableRow {
  buildingId: string;
  projectNumber: string;
  buildingName: string;
  client: string;
  city: string;
  serviceType: ServiceType | null;
  serviceTypeOther: string | null;
  serviceTypeLabel: string | null;
  progress: number | null;
  updatedAt: string | null;
}

export function resolveProjectClient(entry: MasterBuildingEntry): string {
  const row = entry.cloudRow;
  if (!row) return "—";
  return row.contact_name?.trim() || row.management_company?.trim() || "—";
}

export function resolveProjectServiceType(
  entry: MasterBuildingEntry
): ServiceType | null {
  const row = entry.cloudRow;
  if (!row) return null;
  return normalizeServiceType(row.service_type);
}

export function resolveProjectServiceTypeOther(
  entry: MasterBuildingEntry
): string | null {
  const row = entry.cloudRow;
  if (!row?.service_type_other) return null;
  const trimmed = row.service_type_other.trim();
  return trimmed || null;
}

export function resolveProjectServiceTypeLabel(
  entry: MasterBuildingEntry
): string | null {
  const type = resolveProjectServiceType(entry);
  if (!type) return null;
  return resolveServiceTypeDisplayLabel(type, resolveProjectServiceTypeOther(entry));
}

export function resolveProjectProgress(entry: MasterBuildingEntry): number | null {
  const row = entry.cloudRow;
  if (!row) return null;
  return getProjectProgress({
    storedStage: row.project_stage,
    liveStartedAt: row.live_started_at,
    projectType: normalizeProjectType(row.project_type),
    workflowState: row.project_workflow_state,
    storedProgress: row.project_progress,
  });
}

export function resolveProjectUpdatedAt(
  entry: MasterBuildingEntry,
  dossierLastFaultDate: string | null | undefined
): string | null {
  const dates: string[] = [];
  if (entry.cloudRow?.created_at) dates.push(entry.cloudRow.created_at);
  if (dossierLastFaultDate) dates.push(dossierLastFaultDate);
  if (dates.length === 0) return null;
  return dates.sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )[0];
}

export function buildMasterProjectTableRow(
  entry: MasterBuildingEntry,
  dossierLastFaultDate: string | null | undefined
): MasterProjectTableRow {
  const row = entry.cloudRow;
  const serviceType = resolveProjectServiceType(entry);
  const serviceTypeOther = resolveProjectServiceTypeOther(entry);
  return {
    buildingId: entry.buildingId,
    projectNumber: row
      ? resolveDisplayProjectNumber({
          projectNumber: row.project_number,
          buildingId: row.building_id,
        })
      : "—",
    buildingName: entry.name,
    client: resolveProjectClient(entry),
    city: entry.city?.trim() || "—",
    serviceType,
    serviceTypeOther,
    serviceTypeLabel: resolveProjectServiceTypeLabel(entry),
    progress: resolveProjectProgress(entry),
    updatedAt: resolveProjectUpdatedAt(entry, dossierLastFaultDate),
  };
}

export function formatMasterProjectDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function projectUpdatedYear(iso: string | null): number | null {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  return Number.isFinite(year) ? year : null;
}

export type ProjectNumberSortDirection = "asc" | "desc";

/** Numeric value for display sort; null when missing or not a whole number. */
export function parseProjectNumberSortValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) ? num : null;
}

export function compareMasterProjectRowsByProjectNumber(
  a: MasterProjectTableRow,
  b: MasterProjectTableRow,
  direction: ProjectNumberSortDirection
): number {
  const aNum = parseProjectNumberSortValue(a.projectNumber);
  const bNum = parseProjectNumberSortValue(b.projectNumber);

  if (aNum == null && bNum == null) return 0;
  if (aNum == null) return 1;
  if (bNum == null) return -1;

  const diff = aNum - bNum;
  return direction === "asc" ? diff : -diff;
}

export function sortMasterProjectTableRowsByProjectNumber(
  rows: MasterProjectTableRow[],
  direction: ProjectNumberSortDirection
): MasterProjectTableRow[] {
  return [...rows].sort((a, b) =>
    compareMasterProjectRowsByProjectNumber(a, b, direction)
  );
}
