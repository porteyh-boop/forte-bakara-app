"use client";

import { useEffect, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import {
  ForteV2Panel,
  ForteV2SectionHeader,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import ServiceTypeFields, {
  serviceTypeFieldsFromRow,
  type ServiceTypeFieldValues,
} from "@/components/master-v2/project-v2/ServiceTypeFields";
import { updateCloudBuilding, type CloudBuildingRow } from "@/lib/buildings-cloud";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";
import {
  formatServiceTypeDisplay,
  normalizeServiceTypePersistence,
  validateServiceTypeFields,
} from "@/lib/service-type";

interface ProjectServiceTypePanelProps {
  cloudRow: CloudBuildingRow;
  onSaved?: (row: CloudBuildingRow) => void;
}

export default function ProjectServiceTypePanel({
  cloudRow,
  onSaved,
}: ProjectServiceTypePanelProps) {
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ServiceTypeFieldValues>(() =>
    serviceTypeFieldsFromRow(cloudRow.service_type, cloudRow.service_type_other)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(
      serviceTypeFieldsFromRow(cloudRow.service_type, cloudRow.service_type_other)
    );
  }, [cloudRow]);

  async function handleSave() {
    if (saving || !cloudReady) return;
    if (!guardSensitiveAction()) return;

    const validationError = validateServiceTypeFields(
      draft.serviceType,
      draft.serviceTypeOther
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    const normalized = normalizeServiceTypePersistence({
      serviceType: draft.serviceType || null,
      serviceTypeOther: draft.serviceTypeOther,
    });

    setSaving(true);
    setError(null);
    const updated = await updateCloudBuilding(cloudRow.id, {
      serviceType: normalized.serviceType,
      serviceTypeOther: normalized.serviceTypeOther,
    });
    setSaving(false);

    if (!updated) {
      setError("שמירת סוג השירות נכשלה.");
      return;
    }

    setMessage("סוג השירות נשמר.");
    setEditing(false);
    onSaved?.(updated);
  }

  function handleCancel() {
    setDraft(
      serviceTypeFieldsFromRow(cloudRow.service_type, cloudRow.service_type_other)
    );
    setEditing(false);
    setError(null);
  }

  const displayLabel = formatServiceTypeDisplay(
    cloudRow.service_type,
    cloudRow.service_type_other
  );

  return (
    <ForteV2Panel>
      <ForteV2SectionHeader
        title="סוג שירות"
        actions={
          editing ? (
            <div className="flex flex-wrap gap-2">
              <MasterProjectV2SecondaryButton
                type="button"
                size="sm"
                onClick={handleCancel}
                disabled={saving}
              >
                ביטול
              </MasterProjectV2SecondaryButton>
              <MasterProjectV2PrimaryButton
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !cloudReady}
              >
                {saving ? "שומר..." : "שמירה"}
              </MasterProjectV2PrimaryButton>
            </div>
          ) : (
            <MasterProjectV2SecondaryButton
              type="button"
              size="sm"
              onClick={() => {
                setMessage(null);
                setError(null);
                setEditing(true);
              }}
              disabled={!cloudReady}
            >
              עריכה
            </MasterProjectV2SecondaryButton>
          )
        }
      />

      {error && (
        <MasterProjectV2StatusBanner tone="error">{error}</MasterProjectV2StatusBanner>
      )}
      {message && !editing && (
        <MasterProjectV2StatusBanner tone="success">{message}</MasterProjectV2StatusBanner>
      )}

      {editing ? (
        <ServiceTypeFields
          values={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        />
      ) : (
        <p className="text-sm text-forte-text">{displayLabel}</p>
      )}
    </ForteV2Panel>
  );
}
