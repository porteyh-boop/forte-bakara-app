"use client";

import StatisticsContent from "@/components/statistics/StatisticsContent";
import { ForteV2Panel } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { isTabAllowedForProjectType, normalizeProjectType } from "@/lib/project-type-config";
import type { CloudBuildingRow } from "@/lib/buildings-cloud";

interface ProjectDashboardFaultAnalysisProps {
  buildingId: string;
  buildingName: string;
  cloudRow: CloudBuildingRow | null;
}

export default function ProjectDashboardFaultAnalysis({
  buildingId,
  buildingName,
  cloudRow,
}: ProjectDashboardFaultAnalysisProps) {
  const projectType = normalizeProjectType(cloudRow?.project_type);

  if (!isTabAllowedForProjectType(projectType, "faults")) {
    return null;
  }

  return (
    <ForteV2Panel className="mt-4 fv2-legacy-panel">
      <h3 className="text-sm font-bold text-forte-text mb-1">ניתוח תקלות</h3>
      <p className="text-xs text-forte-text-secondary mb-4">
        מגמות ותצוגה ויזואלית לפי תקופה — לפרויקט הנוכחי בלבד
      </p>
      <StatisticsContent
        buildingId={buildingId}
        buildingName={buildingName}
        showBuildingLabel={false}
        showSummaryCard={false}
        layout="compact"
      />
    </ForteV2Panel>
  );
}
