"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import MasterBuildingDetailsPanel from "@/components/MasterBuildingDetailsPanel";
import MasterProfessionalAssessmentPanel from "@/components/MasterProfessionalAssessmentPanel";
import {
  BuildingDossierPanel,
  ElevatorDossierLink,
  FaultHistoryTable,
} from "@/components/MasterBuildingDossierShared";
import { BUILDINGS_CATALOG_UPDATED_EVENT } from "@/lib/buildings-catalog";
import {
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  normalizeBuildingId,
  updateCloudBuilding,
  type CloudBuildingRow,
  type CloudElevatorRow,
} from "@/lib/buildings-cloud";
import { resolveLiveStartedAt } from "@/lib/building-live";
import {
  getAllDemoBuildingIds,
  getBuildingDataset,
  getDemoDatasets,
  getStaticDemoBuildingMeta,
  refreshBuildingCatalog,
} from "@/lib/buildings";
import {
  buildSaveBuildingPayload,
  emptyMasterBuildingForm,
  masterBuildingFormFromRow,
  type MasterBuildingFormState,
} from "@/lib/master-building-form";
import {
  buildBuildingDossier,
  formatDossierDate,
} from "@/lib/master-building-dossier";
import { buildMasterBuildingDossierPath } from "@/lib/master-building-routes";
import {
  formatDocumentDate,
  getAllDocuments,
  getDocumentTypeLabel,
  isDocumentCenterConfigured,
  type DocumentRecord,
} from "@/lib/document-center";
import {
  authenticateMasterWithCode,
  masterAuthErrorMessage,
} from "@/lib/master-auth-client";
import {
  getAllPilotFaults,
  isMasterAuthenticated,
  isPilotCloudConfigured,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";
import { mergeMasterBuildingPilotFaults } from "@/lib/master-live-faults";

const OPEN_FAULT_STATUSES = new Set(["פתוחה", "בטיפול", "מושבתת"]);

function MasterCodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await authenticateMasterWithCode(code);
    setSubmitting(false);

    if (!result.ok) {
      setError(masterAuthErrorMessage(result.error));
      return;
    }

    onSuccess();
  }

  return (
    <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-navy mb-1">גישה למסך ניהול פיילוט</h1>
        <p className="text-sm text-gray-text mb-4">הזינו קוד גישה פנימי</p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="קוד גישה"
          className="form-input mb-3"
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "מאמת..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}

interface MasterBuildingDossierPageContentProps {
  buildingId: string;
}

export default function MasterBuildingDossierPageContent({
  buildingId,
}: MasterBuildingDossierPageContentProps) {
  const normalizedBuildingId = normalizeBuildingId(buildingId);
  const [authed, setAuthed] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [documentCenterReady, setDocumentCenterReady] = useState(false);
  const [faults, setFaults] = useState<PilotCloudFault[]>([]);
  const [cloudBuilding, setCloudBuilding] = useState<CloudBuildingRow | null>(
    null
  );
  const [cloudElevators, setCloudElevators] = useState<CloudElevatorRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDetails, setEditingDetails] = useState(false);
  const [buildingForm, setBuildingForm] = useState<MasterBuildingFormState>(
    emptyMasterBuildingForm
  );
  const [savingBuildingDetails, setSavingBuildingDetails] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const demoBuildingIds = useMemo(() => getAllDemoBuildingIds(), []);
  const isDemoBuilding = demoBuildingIds.includes(normalizedBuildingId);

  const demoDataset = useMemo(() => {
    if (!isDemoBuilding) return null;
    try {
      return getBuildingDataset(normalizedBuildingId);
    } catch {
      return null;
    }
  }, [isDemoBuilding, normalizedBuildingId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    let loaded: PilotCloudFault[] = [];
    let building: CloudBuildingRow | null = null;
    let elevators: CloudElevatorRow[] = [];
    let buildingDocuments: DocumentRecord[] = [];

    if (isPilotCloudConfigured()) {
      const [faultRows, cloudResult, allElevators, docResult] =
        await Promise.all([
          getAllPilotFaults(),
          getAllCloudBuildingsWithMeta(),
          getAllCloudElevators(),
          isDocumentCenterConfigured()
            ? getAllDocuments()
            : Promise.resolve({ documents: [], error: null }),
        ]);

      loaded = faultRows;
      building =
        cloudResult.rows.find(
          (row) => row.building_id === normalizedBuildingId
        ) ?? null;
      elevators = allElevators.filter(
        (e) => e.building_id === normalizedBuildingId
      );
      buildingDocuments = docResult.documents.filter(
        (doc) => doc.building_id.toLowerCase() === normalizedBuildingId
      );
    }

    const liveStartedAt =
      building?.live_started_at ?? resolveLiveStartedAt(normalizedBuildingId);
    const buildingNameForMerge =
      building?.name ??
      demoDataset?.building.name ??
      getStaticDemoBuildingMeta(normalizedBuildingId).name;

    loaded = mergeMasterBuildingPilotFaults({
      cloudFaults: loaded,
      buildingId: normalizedBuildingId,
      buildingName: buildingNameForMerge,
      demoFaults: isDemoBuilding && demoDataset ? demoDataset.faults : [],
      liveStartedAt,
    });

    setFaults(loaded);
    setCloudBuilding(building);
    setCloudElevators(elevators);
    setDocuments(buildingDocuments);
    setLoading(false);
  }, [demoDataset, isDemoBuilding, normalizedBuildingId]);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
    setCloudReady(isPilotCloudConfigured());
    setDocumentCenterReady(isDocumentCenterConfigured());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void refresh();
  }, [authed, refresh]);

  const staticDemoMeta = useMemo(
    () => getStaticDemoBuildingMeta(normalizedBuildingId),
    [normalizedBuildingId]
  );

  const buildingName =
    cloudBuilding?.name ??
    demoDataset?.building.name ??
    faults.find((f) => f.building_id === normalizedBuildingId)
      ?.building_name ??
    (staticDemoMeta.name !== normalizedBuildingId
      ? staticDemoMeta.name
      : normalizedBuildingId);

  const buildingCity =
    cloudBuilding?.city ?? demoDataset?.building.city ?? staticDemoMeta.city;

  const buildingAddress =
    cloudBuilding?.address ?? demoDataset?.building.address ?? null;

  const managementCompany =
    cloudBuilding?.management_company ??
    demoDataset?.building.managementCompany ??
    null;

  const elevatorCompany =
    cloudBuilding?.elevator_company ??
    demoDataset?.building.elevatorCompany ??
    null;

  const contactName =
    cloudBuilding?.contact_name ?? demoDataset?.building.contactPerson ?? null;

  const contactPhone =
    cloudBuilding?.contact_phone ?? demoDataset?.building.phone ?? null;

  const floorsCount =
    cloudBuilding?.floors_count ??
    (demoDataset?.elevators.length
      ? Math.max(...demoDataset.elevators.map((e) => e.stations ?? 0))
      : null);

  const buildingStatus = cloudBuilding
    ? cloudBuilding.is_active
      ? "פעיל"
      : "מושבת"
    : isDemoBuilding
      ? "דמו"
      : faults.some((f) => f.building_id === normalizedBuildingId)
        ? "מדיווחים"
        : null;

  const hasBuildingData =
    Boolean(cloudBuilding) ||
    isDemoBuilding ||
    faults.some((f) => f.building_id === normalizedBuildingId);

  const dossier = useMemo(
    () =>
      buildBuildingDossier({
        buildingId: normalizedBuildingId,
        buildingName,
        faults,
        registeredElevatorIds: cloudElevators.map((e) => e.elevator_id),
      }),
    [normalizedBuildingId, buildingName, faults, cloudElevators]
  );

  const openFaults = useMemo(
    () => dossier.faults.filter((f) => OPEN_FAULT_STATUSES.has(f.status)),
    [dossier.faults]
  );

  const demoElevators = demoDataset?.elevators ?? [];

  const liveStartedAt =
    cloudBuilding?.live_started_at ??
    resolveLiveStartedAt(normalizedBuildingId);

  const buildingDetails = useMemo(
    () => ({
      buildingId: normalizedBuildingId,
      name: buildingName,
      city: buildingCity ?? null,
      address: buildingAddress,
      managementCompany,
      elevatorCompany,
      contactName,
      contactPhone,
      floorsCount,
    }),
    [
      normalizedBuildingId,
      buildingName,
      buildingCity,
      buildingAddress,
      managementCompany,
      elevatorCompany,
      contactName,
      contactPhone,
      floorsCount,
    ]
  );

  function startEditBuildingDetails() {
    if (!cloudBuilding) return;
    setBuildingForm(masterBuildingFormFromRow(cloudBuilding));
    setEditingDetails(true);
    setError(null);
  }

  function cancelEditBuildingDetails() {
    setEditingDetails(false);
    setBuildingForm(emptyMasterBuildingForm());
    setError(null);
  }

  async function handleUpdateBuildingDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudReady || !cloudBuilding) return;
    setError(null);
    setSavingBuildingDetails(true);

    const payload = buildSaveBuildingPayload(buildingForm);
    if (!payload.name.trim()) {
      setError("שם בניין הוא שדה חובה.");
      setSavingBuildingDetails(false);
      return;
    }

    const updated = await updateCloudBuilding(cloudBuilding.id, payload);
    setSavingBuildingDetails(false);
    if (!updated) {
      setError("עדכון פרטי בניין נכשל.");
      return;
    }

    setEditingDetails(false);
    setBuildingForm(emptyMasterBuildingForm());
    await refreshBuildingCatalog(getDemoDatasets());
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(BUILDINGS_CATALOG_UPDATED_EVENT));
    }
    await refresh();
    setMessage("פרטי הבניין עודכנו בהצלחה.");
    setTimeout(() => setMessage(null), 3000);
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-light pb-8">
      <PageHeader title="תיק בניין" subtitle={buildingName} master />

      <main className="mx-auto w-full max-w-lg px-5 pb-8 md:max-w-7xl md:px-8 -mt-2 space-y-4 md:space-y-6">
        {loading ? (
          <p className="text-sm text-gray-text">טוען תיק בניין...</p>
        ) : !hasBuildingData ? (
          <p className="text-sm text-gray-text">לא נמצאו נתוני בניין.</p>
        ) : (
          <>
            {message && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                {message}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="bg-white rounded-2xl border border-gold/30 p-4 space-y-3">
              <div>
                <h2 className="text-base font-bold text-navy">{buildingName}</h2>
                <p className="text-xs text-gray-text mt-0.5">
                  {buildingCity ? `${buildingCity}` : ""}
                  {buildingCity && buildingAddress ? " · " : ""}
                  {buildingAddress ?? ""}
                  {(buildingCity || buildingAddress) && buildingStatus
                    ? " · "
                    : ""}
                  {buildingStatus ? `סטטוס: ${buildingStatus}` : ""}
                </p>
                <p className="text-xs text-gray-text mt-0.5" dir="ltr">
                  {normalizedBuildingId}
                </p>
              </div>
            </div>

            <MasterBuildingDetailsPanel
              details={buildingDetails}
              canEdit={Boolean(cloudBuilding)}
              editing={editingDetails}
              form={buildingForm}
              onStartEdit={startEditBuildingDetails}
              onCancelEdit={cancelEditBuildingDetails}
              onChange={(patch) => setBuildingForm((f) => ({ ...f, ...patch }))}
              onSubmit={(e) => void handleUpdateBuildingDetails(e)}
              saving={savingBuildingDetails}
            />

            <BuildingDossierPanel dossier={dossier} />

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-navy">
                  מעליות — {buildingName}
                </h3>
                <p className="text-xs text-gray-text">
                  {dossier.elevatorCount} מעליות
                </p>
              </div>

              {cloudElevators.length === 0 &&
              demoElevators.length === 0 &&
              dossier.faultsByElevator.length === 0 ? (
                <p className="text-sm text-gray-text">אין מעליות רשומות לבניין זה.</p>
              ) : (
                <ul className="space-y-2">
                  {cloudElevators.map((e) => (
                    <li
                      key={e.id}
                      className="border rounded-xl px-3 py-2 border-gray-200"
                    >
                      <p className="font-semibold text-navy text-sm">
                        {e.elevator_name}
                      </p>
                      <p className="text-xs text-gray-text">
                        {e.elevator_id} · {e.status}
                        {!e.is_active ? " · מושבתת" : ""}
                        {e.floors_count ? ` · ${e.floors_count} קומות` : ""}
                      </p>
                      <ElevatorDossierLink
                        buildingId={normalizedBuildingId}
                        elevatorId={e.elevator_id}
                      />
                    </li>
                  ))}

                  {demoElevators
                    .filter(
                      (demo) =>
                        !cloudElevators.some((e) => e.elevator_id === demo.id)
                    )
                    .map((demo) => (
                      <li
                        key={demo.id}
                        className="border rounded-xl px-3 py-2 border-gray-200"
                      >
                        <p className="font-semibold text-navy text-sm">
                          {demo.name}
                        </p>
                        <p className="text-xs text-gray-text">
                          {demo.id} · {demo.status}
                          {demo.stations ? ` · ${demo.stations} קומות` : ""}
                        </p>
                        <ElevatorDossierLink
                          buildingId={normalizedBuildingId}
                          elevatorId={demo.id}
                        />
                      </li>
                    ))}

                  {dossier.faultsByElevator
                    .filter(
                      (item) =>
                        !cloudElevators.some(
                          (e) => e.elevator_id === item.elevatorId
                        ) &&
                        !demoElevators.some((d) => d.id === item.elevatorId)
                    )
                    .map((item) => (
                      <li
                        key={item.elevatorId}
                        className="border rounded-xl px-3 py-2 border-dashed border-gray-200"
                      >
                        <p className="font-semibold text-navy text-sm">
                          {item.elevatorName}
                        </p>
                        <p className="text-xs text-gray-text">
                          {item.elevatorId} · מדיווחים בלבד · {item.count} תקלות
                        </p>
                        <ElevatorDossierLink
                          buildingId={normalizedBuildingId}
                          elevatorId={item.elevatorId}
                        />
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <FaultHistoryTable title="תקלות פתוחות" faults={openFaults} compact />

            <FaultHistoryTable
              title="היסטוריית תקלות הבניין"
              faults={dossier.faults}
            />

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-bold text-navy">מסמכים</h3>
              {!documentCenterReady ? (
                <p className="text-sm text-gray-text">
                  מרכז המסמכים אינו מוגדר במערכת.
                </p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-gray-text">
                  אין מסמכים המשויכים לבניין זה.
                </p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="border border-gray-100 rounded-xl px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-navy">
                        {doc.title}
                      </p>
                      <p className="text-xs text-gray-text">
                        {getDocumentTypeLabel(doc.document_type)} ·{" "}
                        {formatDocumentDate(doc.created_at)}
                        {doc.elevator_id ? ` · ${doc.elevator_id}` : ""}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-navy/80 mt-1">
                          {doc.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <MasterProfessionalAssessmentPanel
              buildingId={normalizedBuildingId}
              buildingName={buildingName}
              faults={faults}
              elevators={cloudElevators}
              liveStartedAt={liveStartedAt}
            />

            <p className="text-[11px] text-gray-text">
              נתיב: {buildMasterBuildingDossierPath(normalizedBuildingId)}
              {!cloudReady ? " · מצב דמו" : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
