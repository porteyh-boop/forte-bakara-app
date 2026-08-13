"use client";

import MasterDocumentCenterSection from "@/components/MasterDocumentCenterSection";
import {
  ForteV2Panel,
  ForteV2TabShell,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface MasterProjectV2DocumentsTabProps {
  buildingId: string;
}

export default function MasterProjectV2DocumentsTab({
  buildingId,
}: MasterProjectV2DocumentsTabProps) {
  return (
    <ForteV2TabShell
      workspace="project-v2-documents"
      title="מסמכים"
      description="מרכז מסמכים, העלאות וארגון קבצים לפרויקט"
    >
      <ForteV2Panel className="fv2-legacy-panel">
        <div className={fv2.legacyEmbed}>
          <MasterDocumentCenterSection
            fixedBuildingId={buildingId}
            embedded
            compactUpload
          />
        </div>
      </ForteV2Panel>
    </ForteV2TabShell>
  );
}
