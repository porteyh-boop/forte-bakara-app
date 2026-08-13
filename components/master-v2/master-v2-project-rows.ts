import { PROJECT_STAGE_OPTIONS } from "@/lib/buildings-cloud";
import { getProjectStage } from "@/lib/get-project-stage";
import type { MasterBuildingEntry } from "@/lib/master-buildings-list";

import { resolveDisplayProjectNumber } from "@/lib/project-number";

export interface MasterProjectTableRow {
  buildingId: string;
  projectNumber: string;
  buildingName: string;
  client: string;
  city: string;
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
  });
}

export function resolveProjectProgress(entry: MasterBuildingEntry): number | null {
  const value = entry.cloudRow?.project_progress;
  if (value == null) return null;
  return value;
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
