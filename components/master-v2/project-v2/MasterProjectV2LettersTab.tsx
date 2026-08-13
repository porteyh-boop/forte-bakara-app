"use client";

import MasterLettersSection from "@/components/MasterLettersSection";
import {
  ForteV2Panel,
  ForteV2TabShell,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface MasterProjectV2LettersTabProps {
  buildingId: string;
}

export default function MasterProjectV2LettersTab({
  buildingId,
}: MasterProjectV2LettersTabProps) {
  return (
    <ForteV2TabShell
      workspace="project-v2-letters"
      title="מכתבים"
      description="ניהול מכתבי מעקב, תזכורות ותכתובות ללקוח"
    >
      <ForteV2Panel className="fv2-legacy-panel">
        <div className={fv2.legacyEmbed}>
          <MasterLettersSection fixedBuildingId={buildingId} embedded />
        </div>
      </ForteV2Panel>
    </ForteV2TabShell>
  );
}
