"use client";

import StatisticsContent from "@/components/statistics/StatisticsContent";
import {
  ForteV2Panel,
  ForteV2TabShell,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface MasterProjectV2ReportsTabProps {
  buildingId: string;
  buildingName: string;
}

export default function MasterProjectV2ReportsTab({
  buildingId,
  buildingName,
}: MasterProjectV2ReportsTabProps) {
  return (
    <ForteV2TabShell
      workspace="project-v2-reports"
      title="דוחות"
      description="סטטיסטיקות, מגמות וניתוח נתונים לפרויקט"
    >
      <ForteV2Panel className="fv2-legacy-panel">
        <div className={fv2.legacyEmbed}>
          <StatisticsContent buildingId={buildingId} buildingName={buildingName} />
        </div>
      </ForteV2Panel>
    </ForteV2TabShell>
  );
}
