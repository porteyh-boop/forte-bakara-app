import { getProjectProgress, getProjectStage } from "@/lib/get-project-stage";
import type { MasterBuildingEntry } from "@/lib/master-buildings-list";
import {
  getProjectTypeLabel,
  normalizeProjectType,
  shouldShowProjectTypeInList,
} from "@/lib/project-type-config";

import { resolveDisplayProjectNumber } from "@/lib/project-number";

export interface MasterProjectTableRow {
  buildingId: string;
  projectNumber: string;
  buildingName: string;
  client: string;
  city: string;
  projectTypeLabel: string | null;
  stage: string;
  projectStage: string;
  progress: number | null;
  updatedAt: string | null;
}

export function resolveProjectClient(entry: MasterBuildingEntry): string {
  const row = entry.cloudRow;
  if (!row) return "—";
  return row.contact_name?.trim() || row.management_company?.trim() || "—";
}

export function resolveProjectStage(entry: MasterBuildingEntry): string {
  if (entry.liveStartedAt) return "שימוש אמיתי";
  if (entry.sources.includes("דמו")) return "דמו";
  if (entry.sources.includes("ענן")) return "פיילוט";
  return "מדיווחים";
}

export function resolveProjectStageValue(entry: MasterBuildingEntry): string {
  const row = entry.cloudRow;
  if (!row) return "—";
  return getProjectStage(row.building_id, {
    storedStage: row.project_stage,
    liveStartedAt: row.live_started_at,
    projectType: normalizeProjectType(row.project_type),
    workflowState: row.project_workflow_state,
    storedProgress: row.project_progress,
  });
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

export function resolveProjectTypeLabel(entry: MasterBuildingEntry): string | null {
  const row = entry.cloudRow;
  if (!row) return null;
  const type = normalizeProjectType(row.project_type);
  return shouldShowProjectTypeInList(type) ? getProjectTypeLabel(type) : null;
}

export function buildMasterProjectTableRow(
  entry: MasterBuildingEntry,
  dossierLastFaultDate: string | null | undefined
): MasterProjectTableRow {
  const row = entry.cloudRow;
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
    projectTypeLabel: resolveProjectTypeLabel(entry),
    stage: resolveProjectStage(entry),
    projectStage: resolveProjectStageValue(entry),
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
