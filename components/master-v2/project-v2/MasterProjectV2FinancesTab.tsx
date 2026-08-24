"use client";

import ProjectFinancialCard from "@/components/master-v2/project-v2/ProjectFinancialCard";
import { ForteV2TabShell } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { CloudBuildingRow } from "@/lib/buildings-cloud";

interface MasterProjectV2FinancesTabProps {
  cloudRow: CloudBuildingRow;
  onSaved?: (row: CloudBuildingRow) => void;
}

export default function MasterProjectV2FinancesTab({
  cloudRow,
  onSaved,
}: MasterProjectV2FinancesTabProps) {
  return (
    <ForteV2TabShell
      workspace="project-v2-finances"
      title="כספים"
      description="נתוני הזמנה, תשלומים וסטטוס גבייה"
    >
      <ProjectFinancialCard cloudRow={cloudRow} onSaved={onSaved} />
    </ForteV2TabShell>
  );
}
