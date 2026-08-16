"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import {
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PageHeader,
  ForteV2Panel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  getAllCloudBuildingsWithMeta,
  createCloudBuildingWithElevators,
  PROJECT_STAGE_OPTIONS,
  type ProjectTypeId,
} from "@/lib/buildings-cloud";
import {
  isPilotCloudConfigured,
  isMasterAuthenticated,
  setMasterAuthenticated,
} from "@/lib/pilot-cloud";
import {
  emptyNewBuildingElevatorDraft,
  toSaveElevatorInputs,
  validateNewBuildingElevators,
} from "@/lib/master-building-create";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  mapNewProjectStage,
  validateNewProjectForm,
} from "@/lib/project-v2-create";
import { generateNextProjectBuildingId } from "@/lib/project-number";
import {
  buildMasterProjectV2Path,
  MASTER_PROJECTS_V2_LIST_PATH,
} from "@/lib/master-project-v2-routes";
import {
  DEFAULT_PROJECT_TYPE,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_IDS,
} from "@/lib/project-type-config";

const emptyForm = {
  projectType: DEFAULT_PROJECT_TYPE as ProjectTypeId,
  projectName: "",
  client: "",
  managementCompany: "",
  city: "",
  address: "",
  elevatorCount: "",
  elevatorManufacturer: "",
  maintenanceCompany: "",
  certifiedInspector: "",
  projectStage: "",
  startDate: "",
  deliveryDate: "",
  notes: "",
};

export default function MasterProjectV2NewPageContent() {
  const router = useRouter();
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();

  const [authed, setAuthed] = useState(() => isMasterAuthenticated());
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!guardSensitiveAction()) return;

    const validationError = validateNewProjectForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const isHomeInspection = form.projectType === "home_inspection";

    if (!cloudReady) {
      setError("Supabase לא מוגדר — לא ניתן לשמור פרויקט.");
      return;
    }

    setSaving(true);
    setError(null);

    const buildingsResult = await getAllCloudBuildingsWithMeta();
    const existingIds = buildingsResult.rows.map((row) => row.building_id);
    const existingProjectNumbers = buildingsResult.rows
      .map((row) => row.project_number)
      .filter((value): value is string => Boolean(value?.trim()));
    const buildingId = generateNextProjectBuildingId(
      existingIds,
      existingProjectNumbers
    );

    const elevatorCount = isHomeInspection
      ? 0
      : Math.max(1, Number(form.elevatorCount) || 1);
    const elevatorDrafts = Array.from({ length: elevatorCount }, (_, index) => ({
      ...emptyNewBuildingElevatorDraft(),
      elevatorName: `מעלית ${index + 1}`,
    }));

    if (!isHomeInspection) {
      const elevatorValidation = validateNewBuildingElevators(elevatorDrafts);
      if (!elevatorValidation.ok) {
        setSaving(false);
        setError(elevatorValidation.message);
        return;
      }
    }

    const projectStage = mapNewProjectStage(form.projectStage);

    const result = await createCloudBuildingWithElevators(
      {
        buildingId,
        projectNumber: buildingId,
        name: form.projectName.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        managementCompany: form.managementCompany.trim(),
        elevatorCompany: form.elevatorManufacturer.trim(),
        maintenanceCompany: form.maintenanceCompany.trim(),
        certifiedInspector: form.certifiedInspector.trim(),
        contactName: form.client.trim(),
        contactPhone: "",
        floorsCount: null,
        projectStage,
        projectStartDate: form.startDate || null,
        projectDeliveryDate: form.deliveryDate || null,
        projectNotes: form.notes.trim(),
        projectType: form.projectType,
      },
      toSaveElevatorInputs(buildingId, elevatorDrafts)
    );

    setSaving(false);

    if (!result.building) {
      setError("שמירת הפרויקט נכשלה.");
      return;
    }

    window.location.assign(
      buildMasterProjectV2Path(result.building.building_id)
    );
  }

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <MasterShellLayout onLogout={handleLogout}>
      <div className={fv2.pageBody}>
        <ForteV2PageHeader
          title="פרויקט חדש"
          subtitle="יצירת תיק פרויקט חדש במערכת FORTE"
          actions={
            <Link href={MASTER_PROJECTS_V2_LIST_PATH} className="fv2-btn-secondary fv2-btn-sm">
              ← חזרה לרשימה
            </Link>
          }
        />

        <div className={fv2.workspaceContent}>
          <ForteV2Panel large className="max-w-4xl mx-auto">
            <form className="space-y-6" onSubmit={(e) => void handleSave(e)}>
              {error && <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner>}
              {!cloudReady && (
                <ForteV2StatusBanner tone="warning">
                  Supabase לא מוגדר — לא ניתן לשמור פרויקט.
                </ForteV2StatusBanner>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField label="סוג פרויקט">
                  <select
                    value={form.projectType}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        projectType: e.target.value as ProjectTypeId,
                      }))
                    }
                    className="form-input text-sm py-2"
                  >
                    {PROJECT_TYPE_IDS.map((typeId) => (
                      <option key={typeId} value={typeId}>
                        {PROJECT_TYPE_LABELS[typeId]}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="שם הפרויקט">
                  <input
                    type="text"
                    value={form.projectName}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        projectName: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="לקוח">
                  <input
                    type="text"
                    value={form.client}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        client: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="חברת ניהול">
                  <input
                    type="text"
                    value={form.managementCompany}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        managementCompany: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="עיר">
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        city: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="כתובת" className="md:col-span-2">
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        address: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                {form.projectType === "standard" && (
                  <>
                <FormField label="מספר מעליות">
                  <input
                    type="number"
                    min={0}
                    value={form.elevatorCount}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        elevatorCount: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="יצרן מעליות">
                  <input
                    type="text"
                    value={form.elevatorManufacturer}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        elevatorManufacturer: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="חברת תחזוקה">
                  <input
                    type="text"
                    value={form.maintenanceCompany}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        maintenanceCompany: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="בודק מוסמך">
                  <input
                    type="text"
                    value={form.certifiedInspector}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        certifiedInspector: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                  </>
                )}
                <FormField label="שלב הפרויקט">
                  <select
                    value={form.projectStage}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        projectStage: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  >
                    <option value="">בחר שלב</option>
                    {PROJECT_STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="תאריך התחלה">
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        startDate: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="תאריך מסירה">
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        deliveryDate: e.target.value,
                      }))
                    }
                    className="form-input text-sm py-2"
                  />
                </FormField>
                <FormField label="הערות" className="md:col-span-2">
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        notes: e.target.value,
                      }))
                    }
                    rows={4}
                    className="form-input text-sm py-2 min-h-[96px] resize-y"
                  />
                </FormField>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-forte-border/60">
                <ForteV2SecondaryButton size="sm" onClick={() => router.push(MASTER_PROJECTS_V2_LIST_PATH)}>
                  ביטול
                </ForteV2SecondaryButton>
                <ForteV2PrimaryButton type="submit" disabled={saving || !cloudReady}>
                  {saving ? "שומר..." : "שמור פרויקט"}
                </ForteV2PrimaryButton>
              </div>
            </form>
          </ForteV2Panel>
        </div>
      </div>
    </MasterShellLayout>
  );
}

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <ForteV2FormLabel>{label}</ForteV2FormLabel>
      {children}
    </div>
  );
}
