"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClientAccessReportForm from "@/components/ClientAccessReportForm";
import ClientPortalInstallPrompt from "@/components/ClientPortalInstallPrompt";
import ElevatorStatusRow from "@/components/ElevatorStatusRow";
import FaultCard from "@/components/FaultCard";
import HistoryList from "@/components/HistoryList";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import { isAfterLiveStart } from "@/lib/building-live";
import { normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  getClientAccessByToken,
  getClientAccessGateMessage,
  resolveClientAccessGate,
  resolveClientWelcomeMessage,
  scopeElevatorsForClientAccess,
  scopeFaultsForClientAccess,
  type ClientAccessSession,
} from "@/lib/client-access";
import {
  computePortalDataLastUpdated,
  formatClientPortalLastUpdated,
} from "@/lib/client-profile";
import {
  CLIENT_PORTAL_BUILDING_NOT_FOUND_MESSAGE,
  CLIENT_PORTAL_BUILDING_NOT_FOUND_TITLE,
  getDemoFaultsForPortalBuilding,
  resolveClientPortalBuilding,
  type ClientPortalBuildingResolve,
} from "@/lib/client-portal-building";
import {
  getClientPermissionsOrDefaults,
  type ClientPermissionFlags,
} from "@/lib/client-permissions";
import {
  CLIENT_PORTAL_ACTIVITY,
  computeClientPortalStats,
  logClientPortalActivity,
} from "@/lib/client-portal";
import { getAllDocuments, formatDocumentDate } from "@/lib/document-center";
import { isClosedFault, isOpenFault } from "@/lib/fault-lifecycle";
import { getAllElevatorFaultCounts } from "@/lib/elevator-stats";
import { getEffectiveElevators } from "@/lib/elevator-status";
import {
  getAllPilotFaults,
  getPilotFaultsForBuilding,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";
import type { Elevator, Fault, FaultStatus, FaultType } from "@/lib/types";

type ClientTab = "home" | "history" | "documents";

const PORTAL_ACCESS_DENIED_MESSAGE = "אין לך הרשאה לגשת לפורטל.";
const LOGOUT_MESSAGE = "יצאתם מהפורטל.";

function mapPilotFaultToClientFault(fault: PilotCloudFault): Fault {
  return {
    id: fault.id,
    elevatorId: fault.elevator_id,
    elevatorName: fault.elevator_name,
    type: fault.fault_type as FaultType,
    description: fault.description,
    status: fault.status as FaultStatus,
    priority: "רגילה",
    reportedAt: fault.created_at,
    resolvedAt: fault.closed_at ?? undefined,
    ticketNumber: fault.ticket_number ?? undefined,
    isDisabled: fault.is_disabled,
  };
}

function mergePortalFaults(
  buildingId: string,
  buildingName: string,
  cloudFaults: PilotCloudFault[]
): PilotCloudFault[] {
  const merged = [...cloudFaults];
  const seen = new Set(merged.map((fault) => fault.id));
  const demoFaults = getDemoFaultsForPortalBuilding(buildingId);

  for (const fault of demoFaults) {
    if (seen.has(fault.id)) continue;
    merged.push({
      id: fault.id,
      building_id: buildingId,
      building_name: buildingName,
      elevator_id: fault.elevatorId,
      elevator_name: fault.elevatorName,
      fault_type: fault.type,
      description: fault.description,
      is_disabled: fault.isDisabled ?? false,
      status: fault.status,
      ticket_number: fault.ticketNumber ?? null,
      image_data: null,
      image_url: null,
      created_at: fault.reportedAt,
      closed_at: fault.resolvedAt ?? null,
      source_device_id: null,
      fault_source: null,
    });
  }

  return merged;
}

interface ClientAccessPageContentProps {
  token: string;
}

export default function ClientAccessPageContent({
  token,
}: ClientAccessPageContentProps) {
  const [tab, setTab] = useState<ClientTab>("home");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ClientAccessSession | null>(null);
  const [permissions, setPermissions] = useState<ClientPermissionFlags | null>(
    null
  );
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [buildingNotFound, setBuildingNotFound] = useState(false);
  const [requestedBuildingId, setRequestedBuildingId] = useState<string | null>(
    null
  );
  const [buildingResolve, setBuildingResolve] =
    useState<ClientPortalBuildingResolve | null>(null);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [scopeLabel, setScopeLabel] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showReportForm, setShowReportForm] = useState(false);
  const [documents, setDocuments] = useState<
    Array<{
      id: string;
      title: string;
      document_type: string;
      file_url: string | null;
      created_at: string;
    }>
  >([]);
  const [dataLastUpdated, setDataLastUpdated] = useState<string | null>(null);

  const loginLoggedRef = useRef(false);
  const faultsViewLoggedRef = useRef(false);
  const documentsViewLoggedRef = useRef(false);
  const availabilityViewLoggedRef = useRef(false);

  const loadScopedData = useCallback(async () => {
    setLoading(true);
    setBuildingNotFound(false);
    setBuildingResolve(null);
    setRequestedBuildingId(null);
    setDataLastUpdated(null);

    const loadedSession = await getClientAccessByToken(token);
    const gate = resolveClientAccessGate(loadedSession);

    if (gate !== "ok" || !loadedSession) {
      setSession(null);
      setPermissions(null);
      setGateMessage(getClientAccessGateMessage(gate));
      setElevators([]);
      setFaults([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    const loadedPermissions = await getClientPermissionsOrDefaults(
      loadedSession.user.id
    );

    if (!loadedPermissions.can_view_building_dashboard) {
      setSession(loadedSession);
      setPermissions(loadedPermissions);
      setGateMessage(PORTAL_ACCESS_DENIED_MESSAGE);
      setElevators([]);
      setFaults([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    const accessBuildingId = loadedSession.access.building_id;
    setRequestedBuildingId(accessBuildingId);

    const resolved = await resolveClientPortalBuilding(accessBuildingId);
    if (!resolved) {
      setSession(loadedSession);
      setPermissions(loadedPermissions);
      setGateMessage(null);
      setBuildingNotFound(true);
      setElevators([]);
      setFaults([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    setSession(loadedSession);
    setPermissions(loadedPermissions);
    setGateMessage(null);
    setBuildingResolve(resolved);

    const { access_level, elevator_id } = loadedSession.access;
    const normalizedBuildingId = normalizeBuildingId(accessBuildingId);

    const scopedElevators = scopeElevatorsForClientAccess(
      resolved.ctx.elevators,
      loadedSession.access
    );

    const cloudFaults =
      (await getPilotFaultsForBuilding(normalizedBuildingId)) ??
      (await getAllPilotFaults()).filter(
        (fault) => normalizeBuildingId(fault.building_id) === normalizedBuildingId
      );

    const mergedFaults = mergePortalFaults(
      normalizedBuildingId,
      resolved.buildingName,
      cloudFaults
    );
    const liveStartedAt = resolved.liveStartedAt;
    const liveFiltered = liveStartedAt
      ? mergedFaults.filter((fault) =>
          isAfterLiveStart(fault.created_at, liveStartedAt)
        )
      : mergedFaults;
    const scopedFaults = scopeFaultsForClientAccess(
      liveFiltered,
      loadedSession.access
    ).map(mapPilotFaultToClientFault);

    setElevators(scopedElevators);
    setFaults(scopedFaults);
    setScopeLabel(
      access_level === "elevator" && elevator_id
        ? scopedElevators[0]?.name ?? elevator_id
        : "כל הבניין"
    );

    if (loadedPermissions.can_view_documents) {
      const { documents: allDocuments } = await getAllDocuments();
      const scopedDocuments = allDocuments
        .filter(
          (doc) => normalizeBuildingId(doc.building_id) === normalizedBuildingId
        )
        .map((doc) => ({
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          file_url: doc.file_url,
          created_at: doc.created_at,
        }));
      setDocuments(scopedDocuments);
      setDataLastUpdated(
        computePortalDataLastUpdated([
          ...scopedFaults.flatMap((fault) => [fault.reportedAt, fault.resolvedAt]),
          ...scopedDocuments.map((doc) => doc.created_at),
          new Date().toISOString(),
        ])
      );
    } else {
      setDocuments([]);
      setDataLastUpdated(
        computePortalDataLastUpdated([
          ...scopedFaults.flatMap((fault) => [fault.reportedAt, fault.resolvedAt]),
          new Date().toISOString(),
        ])
      );
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadScopedData();
  }, [loadScopedData, refreshKey]);

  useEffect(() => {
    if (!session || !permissions?.can_view_building_dashboard) return;
    if (loginLoggedRef.current) return;
    loginLoggedRef.current = true;
    void logClientPortalActivity(
      session.user.id,
      CLIENT_PORTAL_ACTIVITY.LOGIN,
      JSON.stringify({
        building_id: session.access.building_id,
        loaded_building_id: buildingResolve?.loadedBuildingId ?? null,
      })
    );
  }, [session, permissions, buildingResolve]);

  useEffect(() => {
    if (!session || tab !== "history" || !permissions?.can_view_fault_history) {
      return;
    }
    if (faultsViewLoggedRef.current) return;
    faultsViewLoggedRef.current = true;
    void logClientPortalActivity(
      session.user.id,
      CLIENT_PORTAL_ACTIVITY.VIEW_FAULTS,
      JSON.stringify({ view: "history" })
    );
  }, [session, tab, permissions]);

  useEffect(() => {
    if (!session || tab !== "documents" || !permissions?.can_view_documents) {
      return;
    }
    if (documentsViewLoggedRef.current) return;
    documentsViewLoggedRef.current = true;
    void logClientPortalActivity(
      session.user.id,
      CLIENT_PORTAL_ACTIVITY.VIEW_DOCUMENTS,
      JSON.stringify({ count: documents.length })
    );
  }, [session, tab, permissions, documents.length]);

  const stats = useMemo(
    () => computeClientPortalStats(elevators, faults),
    [elevators, faults]
  );

  useEffect(() => {
    if (!session || !permissions?.can_view_availability) return;
    if (availabilityViewLoggedRef.current) return;
    availabilityViewLoggedRef.current = true;
    void logClientPortalActivity(
      session.user.id,
      CLIENT_PORTAL_ACTIVITY.VIEW_AVAILABILITY,
      JSON.stringify({ availability: stats.monthlyAvailabilityPercent })
    );
  }, [session, permissions, stats.monthlyAvailabilityPercent]);

  const effectiveElevators = useMemo(
    () => getEffectiveElevators(elevators, faults.filter((f) => !isClosedFault(f))),
    [elevators, faults]
  );
  const faultCounts = useMemo(
    () => getAllElevatorFaultCounts(effectiveElevators, faults),
    [effectiveElevators, faults]
  );
  const openFaults = useMemo(
    () => faults.filter((fault) => isOpenFault(fault)),
    [faults]
  );
  const historyFaults = useMemo(
    () =>
      permissions?.can_view_fault_history
        ? faults
        : faults.filter((fault) => !isClosedFault(fault)),
    [faults, permissions]
  );

  const welcomeMessage = useMemo(
    () =>
      session
        ? resolveClientWelcomeMessage(session.user.welcome_message)
        : "",
    [session]
  );

  const buildingStatus = useMemo(() => {
    if (effectiveElevators.some((elevator) => elevator.status === "מושבתת")) {
      return "מושבתת";
    }
    if (effectiveElevators.some((elevator) => elevator.status === "בטיפול")) {
      return "בטיפול";
    }
    return "פעילה";
  }, [effectiveElevators]);

  const availableTabs = useMemo(() => {
    const tabs: Array<{ key: ClientTab; label: string }> = [
      { key: "home", label: "בית" },
    ];
    if (permissions?.can_view_fault_history) {
      tabs.push({ key: "history", label: "היסטוריית תקלות" });
    }
    if (permissions?.can_view_documents) {
      tabs.push({ key: "documents", label: "מסמכים" });
    }
    return tabs;
  }, [permissions]);

  function handleLogout() {
    if (!session) return;
    void logClientPortalActivity(session.user.id, CLIENT_PORTAL_ACTIVITY.LOGOUT);
    setGateMessage(LOGOUT_MESSAGE);
    setSession(null);
    setShowReportForm(false);
  }

  function handleOpenReportForm() {
    if (!session) return;
    setShowReportForm(true);
    void logClientPortalActivity(
      session.user.id,
      CLIENT_PORTAL_ACTIVITY.OPEN_FAULT,
      JSON.stringify({ action: "open_form" })
    );
  }

  function handleReportSubmitted(ticketNumber: string) {
    if (!session) return;
    void logClientPortalActivity(
      session.user.id,
      CLIENT_PORTAL_ACTIVITY.OPEN_FAULT,
      JSON.stringify({ action: "submit", ticket_number: ticketNumber })
    );
    setShowReportForm(false);
    setRefreshKey((value) => value + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
        <p className="text-sm text-gray-text">טוען פורטל לקוח...</p>
      </div>
    );
  }

  if (buildingNotFound) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full text-center space-y-3">
          <h1 className="text-lg font-bold text-navy">
            {CLIENT_PORTAL_BUILDING_NOT_FOUND_TITLE}
          </h1>
          <p className="text-sm text-gray-text">
            {CLIENT_PORTAL_BUILDING_NOT_FOUND_MESSAGE}
          </p>
          {requestedBuildingId && (
            <p className="text-xs text-gray-text break-all">
              מזהה בניין: {requestedBuildingId}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (gateMessage) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-bold text-navy">פורטל לקוח</h1>
          <p className="text-sm text-gray-text">{gateMessage}</p>
        </div>
      </div>
    );
  }

  if (!session || !permissions || !buildingResolve) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-light pb-8">
      <PageHeader
        title={buildingResolve.buildingName}
        subtitle={`פורטל לקוח · ${scopeLabel}`}
        badge={buildingStatus}
      />

      <main className="max-w-lg mx-auto px-4 space-y-4 page-content -mt-2">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <p className="text-sm text-gray-text whitespace-pre-line">{welcomeMessage}</p>
          <p className="text-xs text-gray-text">
            עודכן לאחרונה: {formatClientPortalLastUpdated(dataLastUpdated)}
          </p>
        </div>

        {availableTabs.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {availableTabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 min-w-[6rem] rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tab === key
                    ? "bg-navy text-white"
                    : "bg-white border border-gray-200 text-navy"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "home" && (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="מספר מעליות" value={stats.elevatorCount} delay={0} />
              {permissions.can_view_open_faults && (
                <InfoCard
                  label="תקלות פתוחות"
                  value={stats.openFaultCount}
                  accent
                  delay={50}
                />
              )}
              {permissions.can_view_fault_history && (
                <InfoCard
                  label="תקלות שטופלו"
                  value={stats.closedFaultCount}
                  delay={100}
                />
              )}
              {permissions.can_view_availability && (
                <InfoCard
                  label="זמינות חודשית"
                  value={`${stats.monthlyAvailabilityPercent}%`}
                  delay={150}
                />
              )}
            </div>

            <SectionTitle title="סטטוס מעליות" />
            <ElevatorStatusRow
              elevators={effectiveElevators}
              faultCounts={faultCounts}
            />

            {permissions.can_view_open_faults && (
              <section className="space-y-3">
                <SectionTitle title="תקלות פתוחות" />
                {openFaults.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {openFaults.map((fault, index) => (
                      <FaultCard key={fault.id} fault={fault} compact index={index} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                    <p className="text-sm text-gray-text">אין תקלות פתוחות</p>
                  </div>
                )}
              </section>
            )}

            {permissions.can_report_faults && !showReportForm && (
              <button
                type="button"
                onClick={handleOpenReportForm}
                className="btn-primary w-full"
              >
                דווח תקלה
              </button>
            )}

            {permissions.can_report_faults && showReportForm && (
              <section className="space-y-3">
                <SectionTitle title="דיווח תקלה" />
                <ClientAccessReportForm
                  buildingId={buildingResolve.loadedBuildingId}
                  buildingName={buildingResolve.buildingName}
                  elevators={effectiveElevators}
                  lockedElevatorId={
                    session.access.access_level === "elevator"
                      ? session.access.elevator_id
                      : null
                  }
                  allowImageUpload={permissions.can_upload_images}
                  onSubmitSuccess={handleReportSubmitted}
                />
                <button
                  type="button"
                  onClick={() => setShowReportForm(false)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-navy"
                >
                  ביטול
                </button>
              </section>
            )}

            <ClientPortalInstallPrompt />
          </section>
        )}

        {tab === "history" && permissions.can_view_fault_history && (
          <section className="space-y-3">
            <SectionTitle title="היסטוריית תקלות" />
            <HistoryList faults={historyFaults} />
          </section>
        )}

        {tab === "documents" && permissions.can_view_documents && (
          <section className="space-y-3">
            <SectionTitle title="מסמכים" />
            {documents.length === 0 ? (
              <p className="text-sm text-gray-text bg-white rounded-2xl border border-gray-200 p-6 text-center">
                אין מסמכים זמינים לבניין זה.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((document) => (
                  <article
                    key={document.id}
                    className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1"
                  >
                    <p className="text-sm font-bold text-navy">{document.title}</p>
                    <p className="text-xs text-gray-text">
                      {document.document_type} · {formatDocumentDate(document.created_at)}
                    </p>
                    {document.file_url ? (
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-navy underline"
                      >
                        פתיחת מסמך
                      </a>
                    ) : (
                      <p className="text-xs text-gray-text">אין קובץ מצורף</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-text"
        >
          יציאה מהפורטל
        </button>
      </main>
    </div>
  );
}
