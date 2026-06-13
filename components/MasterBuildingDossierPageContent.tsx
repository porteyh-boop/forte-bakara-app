"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import MasterProfessionalAssessmentPanel from "@/components/MasterProfessionalAssessmentPanel";
import {
  BuildingDossierPanel,
  DossierKpi,
  ElevatorDossierLink,
  FaultHistoryTable,
} from "@/components/MasterBuildingDossierShared";
import {
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  normalizeBuildingId,
  type CloudBuildingRow,
  type CloudElevatorRow,
} from "@/lib/buildings-cloud";
import { resolveLiveStartedAt } from "@/lib/building-live";
import {
  getAllDemoBuildingIds,
  getBuildingDataset,
  getStaticDemoBuildingMeta,
} from "@/lib/buildings";
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
  getAllPilotFaults,
  isMasterAuthenticated,
  isMasterCodeConfigured,
  isPilotCloudConfigured,
  setMasterAuthenticated,
  verifyMasterCode,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";
import { mergeMasterBuildingPilotFaults } from "@/lib/master-live-faults";

const OPEN_FAULT_STATUSES = new Set(["פתוחה", "בטיפול", "מושבתת"]);

function MasterCodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isMasterCodeConfigured()) {
      setError("קוד גישה לא הוגדר במערכת (NEXT_PUBLIC_MASTER_CODE).");
      return;
    }
    if (!verifyMasterCode(code)) {
      setError("קוד גישה שגוי.");
      return;
    }
    setMasterAuthenticated(true);
    onSuccess();
  }

  return (
    <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
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
        <button type="submit" className="btn-primary w-full">
          כניסה
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

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-light pb-8">
      <PageHeader title="תיק בניין" subtitle={buildingName} master />

      <main className="mx-auto w-full max-w-lg px-5 pb-8 md:max-w-7xl md:px-8 -mt-2 space-y-4 md:space-y-6">
        <Link
          href="/master"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline cursor-pointer"
        >
          ← חזרה ל-Master
        </Link>

        {loading ? (
          <p className="text-sm text-gray-text">טוען תיק בניין...</p>
        ) : !hasBuildingData ? (
          <p className="text-sm text-gray-text">לא נמצאו נתוני בניין.</p>
        ) : (
          <>
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

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-bold text-navy">פרטי בניין</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <DossierKpi
                  label="חברת ניהול"
                  value={managementCompany ?? "—"}
                  small
                />
                <DossierKpi
                  label="חברת מעליות"
                  value={elevatorCompany ?? "—"}
                  small
                />
                <DossierKpi label="איש קשר" value={contactName ?? "—"} small />
                <DossierKpi label="טלפון" value={contactPhone ?? "—"} small />
                <DossierKpi
                  label="מספר קומות"
                  value={floorsCount ?? "—"}
                />
              </div>
            </div>

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
