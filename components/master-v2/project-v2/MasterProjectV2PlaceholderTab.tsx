"use client";

import {
  ForteV2Panel,
  ForteV2TabShell,
  MasterProjectV2EmptyState,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";

interface MasterProjectV2PlaceholderTabProps {
  stationLabel: string;
  description?: string;
}

export default function MasterProjectV2PlaceholderTab({
  stationLabel,
  description,
}: MasterProjectV2PlaceholderTabProps) {
  return (
    <ForteV2TabShell
      workspace={`project-v2-${stationLabel}`}
      title={stationLabel}
      description={description ?? "תחנת עבודה זו תושלם בשלב הבא של המערכת"}
    >
      <ForteV2Panel>
        <MasterProjectV2EmptyState
          icon="🚧"
          title={`${stationLabel} — בקרוב`}
          description={description ?? "תחנת עבודה זו תושלם בשלב הבא של המערכת."}
        />
      </ForteV2Panel>
    </ForteV2TabShell>
  );
}
