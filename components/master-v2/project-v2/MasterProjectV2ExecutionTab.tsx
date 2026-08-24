"use client";

import ProjectWorkflowProgress from "@/components/master-v2/project-v2/ProjectWorkflowProgress";
import { ForteV2TabShell } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { CloudBuildingRow } from "@/lib/buildings-cloud";

interface MasterProjectV2ExecutionTabProps {
  cloudRow: CloudBuildingRow;
  onSaved?: (row: CloudBuildingRow) => void;
}

export default function MasterProjectV2ExecutionTab({
  cloudRow,
  onSaved,
}: MasterProjectV2ExecutionTabProps) {
  return (
    <ForteV2TabShell
      workspace="project-v2-execution"
      title="שלב ביצוע"
      description="מעקב שלבי ביצוע והתקדמות הפרויקט"
    >
      <ProjectWorkflowProgress cloudRow={cloudRow} onSaved={onSaved} />
    </ForteV2TabShell>
  );
}
