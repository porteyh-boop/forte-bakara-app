"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import MasterBuildingDetailsForm from "@/components/MasterBuildingDetailsForm";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2DetailGrid,
  ForteV2Panel,
  ForteV2TabShell,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { getProjectStage } from "@/lib/get-project-stage";
import {
  buildSaveBuildingPayload,
  masterBuildingFormFromRow,
  type MasterBuildingFormState,
} from "@/lib/master-building-form";
import {
  PROJECT_STAGE_OPTIONS,
  findCloudBuildingWithProjectNumberConflict,
  updateCloudBuilding,
  type CloudBuildingRow,
  type ProjectStage,
} from "@/lib/buildings-cloud";
import {
  isValidProjectNumberFormat,
  PROJECT_NUMBER_DUPLICATE_ERROR,
  PROJECT_NUMBER_INVALID_FORMAT_ERROR,
  resolveDisplayProjectNumber,
  resolveEditableProjectNumber,
} from "@/lib/project-number";
import { MASTER_PROJECTS_V2_LIST_PATH } from "@/lib/master-project-v2-routes";
import ProjectDocumentsPanel from "@/components/master-v2/project-v2/ProjectDocumentsPanel";
import { deleteBuildingProject } from "@/lib/buildings-delete-cloud";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

export interface MasterProjectV2Details {
  buildingId: string;
  projectNumber: string;
  buildingName: string;
  client: string;
  city: string;
  elevatorCount: string;
  projectStage: string;
  address: string;
  managementCompany: string;
  elevatorCompany: string;
  maintenanceCompany: string;
  certifiedInspector: string;
  projectStartDate: string;
  projectDeliveryDate: string;
  projectNotes: string;
}

interface ProjectExtrasState {
  projectStage: ProjectStage | "";
  maintenanceCompany: string;
  certifiedInspector: string;
  projectStartDate: string;
  projectDeliveryDate: string;
  projectNotes: string;
}

interface MasterProjectV2DetailsTabProps {
  details: MasterProjectV2Details;
  cloudRow: CloudBuildingRow | null;
  onSaved?: (row: CloudBuildingRow) => void;
}

export default function MasterProjectV2DetailsTab({
  details,
  cloudRow,
  onSaved,
}: MasterProjectV2DetailsTabProps) {
  const router = useRouter();
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MasterBuildingFormState>(() =>
    cloudRow ? masterBuildingFormFromRow(cloudRow) : emptyFormFromDetails(details)
  );
  const [projectExtras, setProjectExtras] = useState<ProjectExtrasState>(() =>
    projectExtrasFromRow(cloudRow)
  );
  const [projectNumberInput, setProjectNumberInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (cloudRow) {
      setForm(masterBuildingFormFromRow(cloudRow));
      setProjectExtras(projectExtrasFromRow(cloudRow));
      setProjectNumberInput(
        resolveEditableProjectNumber({
          projectNumber: cloudRow.project_number,
          buildingId: cloudRow.building_id,
        })
      );
    } else {
      setForm(emptyFormFromDetails(details));
      setProjectExtras(projectExtrasFromDetails(details));
      setProjectNumberInput(
        details.projectNumber === "—" ? "" : details.projectNumber
      );
    }
  }, [cloudRow, details]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudRow || saving) return;
    if (!guardSensitiveAction()) return;

    const payload = buildSaveBuildingPayload(form);
    if (!payload.name.trim()) {
      setError("שם בניין הוא שדה חובה.");
      return;
    }

    const trimmedProjectNumber = projectNumberInput.trim();
    if (trimmedProjectNumber) {
      if (!isValidProjectNumberFormat(trimmedProjectNumber)) {
        setError(PROJECT_NUMBER_INVALID_FORMAT_ERROR);
        return;
      }

      const duplicate = await findCloudBuildingWithProjectNumberConflict(
        trimmedProjectNumber,
        cloudRow.id
      );
      if (duplicate) {
        setError(PROJECT_NUMBER_DUPLICATE_ERROR);
        return;
      }
    }

    setSaving(true);
    setError(null);
    const updated = await updateCloudBuilding(cloudRow.id, {
      ...payload,
      projectNumber: trimmedProjectNumber || null,
      maintenanceCompany: projectExtras.maintenanceCompany,
      certifiedInspector: projectExtras.certifiedInspector,
      projectStage: projectExtras.projectStage || null,
      projectStartDate: projectExtras.projectStartDate || null,
      projectDeliveryDate: projectExtras.projectDeliveryDate || null,
      projectNotes: projectExtras.projectNotes,
    });
    setSaving(false);

    if (!updated) {
      setError("שמירת פרטי הפרויקט נכשלה.");
      return;
    }

    setMessage("פרטי הפרויקט נשמרו.");
    setEditing(false);
    onSaved?.(updated);

    if (updated.project_stage === "פרויקט סגור") {
      router.push(MASTER_PROJECTS_V2_LIST_PATH);
    }
  }

  const deleteConfirmMatches =
    cloudRow != null && deleteConfirmInput.trim() === cloudRow.building_id;

  async function handleDeleteProject() {
    if (!cloudRow || deleting || !deleteConfirmMatches) return;
    if (!guardSensitiveAction()) return;

    setDeleting(true);
    setDeleteError(null);
    const result = await deleteBuildingProject(
      cloudRow.building_id,
      deleteConfirmInput.trim()
    );
    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.error ?? "מחיקת הפרויקט נכשלה.");
      return;
    }

    setDeleteModalOpen(false);
    setDeleteConfirmInput("");
    router.push(MASTER_PROJECTS_V2_LIST_PATH);
  }

  if (editing && cloudRow && cloudReady) {
    return (
      <ForteV2TabShell
        workspace="project-v2-details"
        title="עריכת פרטי פרויקט"
        description="עדכון נתוני הבניין, שלב ומסמכים"
        actions={
          <MasterProjectV2SecondaryButton
            onClick={() => {
              setEditing(false);
              setError(null);
              if (cloudRow) {
                setForm(masterBuildingFormFromRow(cloudRow));
                setProjectExtras(projectExtrasFromRow(cloudRow));
                setProjectNumberInput(
                  resolveEditableProjectNumber({
                    projectNumber: cloudRow.project_number,
                    buildingId: cloudRow.building_id,
                  })
                );
              }
            }}
            size="sm"
          >
            ביטול
          </MasterProjectV2SecondaryButton>
        }
      >
        <ForteV2Panel large>
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          {error && <MasterProjectV2StatusBanner tone="error">{error}</MasterProjectV2StatusBanner>}
          <MasterBuildingDetailsForm
            form={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            isEdit
            showBuildingId={false}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-forte-border/60">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-forte-text-secondary">מספר פרויקט</span>
              <input
                value={projectNumberInput}
                onChange={(e) => setProjectNumberInput(e.target.value)}
                dir="ltr"
                inputMode="numeric"
                placeholder="826101"
                className="form-input text-sm py-2 font-mono"
              />
              <span className="text-[11px] text-forte-text-secondary">
                נוצר אוטומטית וניתן לשינוי ידני
              </span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-forte-border/60">
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">שלב הפרויקט</span>
              <select
                value={projectExtras.projectStage}
                onChange={(e) =>
                  setProjectExtras((current) => ({
                    ...current,
                    projectStage: e.target.value as ProjectStage | "",
                  }))
                }
                className="form-input text-sm py-2"
              >
                <option value="">—</option>
                {PROJECT_STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">חברת תחזוקה</span>
              <input
                value={projectExtras.maintenanceCompany}
                onChange={(e) =>
                  setProjectExtras((current) => ({
                    ...current,
                    maintenanceCompany: e.target.value,
                  }))
                }
                className="form-input text-sm py-2"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">בודק מוסמך</span>
              <input
                value={projectExtras.certifiedInspector}
                onChange={(e) =>
                  setProjectExtras((current) => ({
                    ...current,
                    certifiedInspector: e.target.value,
                  }))
                }
                className="form-input text-sm py-2"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">תאריך התחלה</span>
              <input
                type="date"
                value={projectExtras.projectStartDate}
                onChange={(e) =>
                  setProjectExtras((current) => ({
                    ...current,
                    projectStartDate: e.target.value,
                  }))
                }
                className="form-input text-sm py-2"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-forte-text-secondary">תאריך מסירה</span>
              <input
                type="date"
                value={projectExtras.projectDeliveryDate}
                onChange={(e) =>
                  setProjectExtras((current) => ({
                    ...current,
                    projectDeliveryDate: e.target.value,
                  }))
                }
                className="form-input text-sm py-2"
              />
            </label>
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs text-forte-text-secondary">הערות</span>
              <textarea
                value={projectExtras.projectNotes}
                onChange={(e) =>
                  setProjectExtras((current) => ({
                    ...current,
                    projectNotes: e.target.value,
                  }))
                }
                rows={3}
                className="form-input text-sm py-2 min-h-[72px]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t border-forte-border/60">
            <MasterProjectV2PrimaryButton type="submit" disabled={saving} size="sm">
              {saving ? "שומר..." : "שמור שינויים"}
            </MasterProjectV2PrimaryButton>
          </div>

          <ProjectDocumentsPanel
            buildingId={details.buildingId}
            section="details"
          />

          <div className="fv2-danger-zone">
            <p className="fv2-danger-zone-title">אזור מסוכן</p>
            <p className="text-[11px] text-forte-text-secondary mt-1">
              מחיקת פרויקט היא פעולה בלתי הפיכה. נתונים משויכים (מסמכים, אנשי
              קשר, משימות, מעליות ועוד) עלולים להימחק יחד עם הפרויקט.
            </p>
            <div className="mt-3">
              <ForteV2DangerButton
                onClick={() => {
                  setDeleteModalOpen(true);
                  setDeleteConfirmInput("");
                  setDeleteError(null);
                }}
              >
                מחיקת פרויקט
              </ForteV2DangerButton>
            </div>
          </div>
        </form>
        </ForteV2Panel>

        {deleteModalOpen && (
          <ForteV2DialogOverlay onClose={() => setDeleteModalOpen(false)}>
            <ForteV2Dialog
              title="מחיקת פרויקט לצמיתות"
              onClose={() => setDeleteModalOpen(false)}
            >
              <div className="space-y-4">
              <div className="space-y-2 text-xs text-forte-text-secondary">
                <p>
                  <span className="font-semibold text-forte-text">שם הפרויקט: </span>
                  {cloudRow.name}
                </p>
                <p dir="ltr" className="text-right">
                  <span className="font-semibold text-forte-text">מספר פרויקט: </span>
                  {cloudRow.building_id}
                </p>
                <p className="text-red-700 font-medium">
                  פעולה זו בלתי הפיכה. לא ניתן לשחזר את הפרויקט לאחר המחיקה.
                </p>
                <p>
                  נתונים משויכים לפרויקט — מסמכים, מכתבים, תסקירים, אנשי קשר,
                  משימות, מעליות והרשאות לקוח — עלולים להימחק יחד איתו.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-forte-text-secondary">
                  הקלידו את מספר הפרויקט לאישור:{" "}
                  <span dir="ltr" className="font-mono text-forte-text">
                    {cloudRow.building_id}
                  </span>
                </span>
                <input
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  dir="ltr"
                  className="form-input text-sm py-2 font-mono"
                  placeholder={cloudRow.building_id}
                  autoComplete="off"
                />
              </label>
              {deleteError && (
                <MasterProjectV2StatusBanner tone="error">{deleteError}</MasterProjectV2StatusBanner>
              )}
              <div className="flex gap-2">
                <ForteV2DangerButton
                  onClick={() => void handleDeleteProject()}
                  disabled={!deleteConfirmMatches || deleting}
                >
                  {deleting ? "מוחק..." : "מחק פרויקט לצמיתות"}
                </ForteV2DangerButton>
                <MasterProjectV2SecondaryButton
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setDeleteConfirmInput("");
                    setDeleteError(null);
                  }}
                >
                  ביטול
                </MasterProjectV2SecondaryButton>
              </div>
              </div>
            </ForteV2Dialog>
          </ForteV2DialogOverlay>
        )}
      </ForteV2TabShell>
    );
  }

  return (
    <ForteV2TabShell
      workspace="project-v2-details"
      title="פרטי הפרויקט"
      description="מידע מרכזי, שלב ומסמכים"
      actions={
        cloudRow && cloudReady ? (
          <MasterProjectV2PrimaryButton onClick={() => setEditing(true)} size="sm">
            עריכה
          </MasterProjectV2PrimaryButton>
        ) : undefined
      }
    >
      {message && (
        <MasterProjectV2StatusBanner tone="success">{message}</MasterProjectV2StatusBanner>
      )}
      {!cloudReady && (
        <MasterProjectV2StatusBanner tone="warning">
          Supabase לא מוגדר — מוצגים נתונים לקריאה בלבד.
        </MasterProjectV2StatusBanner>
      )}

      <ForteV2Panel>
        <ForteV2DetailGrid
          items={DETAIL_FIELDS.map(({ label, key }) => ({
            label,
            value: details[key] || "—",
            dir: key === "projectNumber" ? "ltr" : undefined,
          }))}
        />
      </ForteV2Panel>

      <ProjectDocumentsPanel buildingId={details.buildingId} section="details" />
    </ForteV2TabShell>
  );
}

const DETAIL_FIELDS = [
  { label: "מספר פרויקט", key: "projectNumber" as const },
  { label: "שם הבניין", key: "buildingName" as const },
  { label: "לקוח", key: "client" as const },
  { label: "עיר", key: "city" as const },
  { label: "מספר מעליות", key: "elevatorCount" as const },
  { label: "שלב הפרויקט", key: "projectStage" as const },
  { label: "כתובת", key: "address" as const },
  { label: "חברת ניהול", key: "managementCompany" as const },
  { label: "יצרן מעליות", key: "elevatorCompany" as const },
  { label: "חברת תחזוקה", key: "maintenanceCompany" as const },
  { label: "בודק מוסמך", key: "certifiedInspector" as const },
  { label: "תאריך התחלה", key: "projectStartDate" as const },
  { label: "תאריך מסירה", key: "projectDeliveryDate" as const },
  { label: "הערות", key: "projectNotes" as const },
];

function emptyFormFromDetails(details: MasterProjectV2Details): MasterBuildingFormState {
  return {
    buildingId: details.buildingId,
    name: details.buildingName === "—" ? "" : details.buildingName,
    city: details.city === "—" ? "" : details.city,
    address: details.address === "—" ? "" : details.address,
    managementCompany:
      details.managementCompany === "—" ? "" : details.managementCompany,
    elevatorCompany:
      details.elevatorCompany === "—" ? "" : details.elevatorCompany,
    customElevatorCompany: "",
    contactName: details.client === "—" ? "" : details.client,
    contactPhone: "",
    floorsCount: "",
  };
}

function projectExtrasFromRow(row: CloudBuildingRow | null): ProjectExtrasState {
  if (!row) {
    return {
      projectStage: "",
      maintenanceCompany: "",
      certifiedInspector: "",
      projectStartDate: "",
      projectDeliveryDate: "",
      projectNotes: "",
    };
  }
  return {
    projectStage: row.project_stage ?? "",
    maintenanceCompany: row.maintenance_company ?? "",
    certifiedInspector: row.certified_inspector ?? "",
    projectStartDate: row.project_start_date ?? "",
    projectDeliveryDate: row.project_delivery_date ?? "",
    projectNotes: row.project_notes ?? "",
  };
}

function projectExtrasFromDetails(details: MasterProjectV2Details): ProjectExtrasState {
  return {
    projectStage: "",
    maintenanceCompany:
      details.maintenanceCompany === "—" ? "" : details.maintenanceCompany,
    certifiedInspector:
      details.certifiedInspector === "—" ? "" : details.certifiedInspector,
    projectStartDate:
      details.projectStartDate === "—" ? "" : details.projectStartDate,
    projectDeliveryDate:
      details.projectDeliveryDate === "—" ? "" : details.projectDeliveryDate,
    projectNotes: details.projectNotes === "—" ? "" : details.projectNotes,
  };
}

function formatDateDisplay(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export function emptyMasterProjectV2Details(buildingId: string): MasterProjectV2Details {
  return {
    buildingId: buildingId || "—",
    projectNumber: "—",
    buildingName: "—",
    client: "—",
    city: "—",
    elevatorCount: "—",
    projectStage: getProjectStage(buildingId),
    address: "—",
    managementCompany: "—",
    elevatorCompany: "—",
    maintenanceCompany: "—",
    certifiedInspector: "—",
    projectStartDate: "—",
    projectDeliveryDate: "—",
    projectNotes: "—",
  };
}

export function detailsFromCloudRow(
  row: CloudBuildingRow,
  elevatorCount: number | null
): MasterProjectV2Details {
  return {
    buildingId: row.building_id,
    projectNumber: resolveDisplayProjectNumber({
      projectNumber: row.project_number,
      buildingId: row.building_id,
    }),
    buildingName: row.name,
    client: row.contact_name?.trim() || "—",
    city: row.city?.trim() || "—",
    elevatorCount:
      elevatorCount != null && elevatorCount > 0 ? String(elevatorCount) : "—",
    projectStage: getProjectStage(row.building_id, {
      storedStage: row.project_stage,
      liveStartedAt: row.live_started_at,
    }),
    address: row.address?.trim() || "—",
    managementCompany: row.management_company?.trim() || "—",
    elevatorCompany: row.elevator_company?.trim() || "—",
    maintenanceCompany: row.maintenance_company?.trim() || "—",
    certifiedInspector: row.certified_inspector?.trim() || "—",
    projectStartDate: formatDateDisplay(row.project_start_date),
    projectDeliveryDate: formatDateDisplay(row.project_delivery_date),
    projectNotes: row.project_notes?.trim() || "—",
  };
}
