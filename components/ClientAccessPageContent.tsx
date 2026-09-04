"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClientAccessReportForm from "@/components/ClientAccessReportForm";
import ClientPortalInstallPrompt from "@/components/ClientPortalInstallPrompt";
import ClientPortalStatisticsSection from "@/components/ClientPortalStatisticsSection";
import ElevatorStatusRow from "@/components/ElevatorStatusRow";
import FaultCard from "@/components/FaultCard";
import FeedbackForm from "@/components/FeedbackForm";
import HistoryList from "@/components/HistoryList";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import {
  getClientAccessGateMessage,
  resolveClientWelcomeMessage,
  type ClientAccessSession,
} from "@/lib/client-access";
import {
  formatClientPortalLastUpdated,
} from "@/lib/client-profile";
import {
  CLIENT_PORTAL_BUILDING_NOT_FOUND_MESSAGE,
  CLIENT_PORTAL_BUILDING_NOT_FOUND_TITLE,
  type ClientPortalBuildingResolve,
} from "@/lib/client-portal-building";
import type { ClientPermissionFlags } from "@/lib/client-permissions";
import {
  CLIENT_PORTAL_ACTIVITY,
  computeClientPortalStats,
} from "@/lib/client-portal";
import {
  fetchClientPortalBootstrap,
  logClientPortalActivityApi,
} from "@/lib/client-portal-api-client";
import type { ClientPortalBootstrapDto } from "@/lib/client-portal-dto";
import { formatDocumentDate } from "@/lib/document-center";
import { isClosedFault, isOpenFault } from "@/lib/fault-lifecycle";
import { getAllElevatorFaultCounts } from "@/lib/elevator-stats";
import { getEffectiveElevators } from "@/lib/elevator-status";
import type { Elevator, Fault } from "@/lib/types";

type ClientTab = "home" | "history" | "documents" | "statistics";

const PORTAL_ACCESS_DENIED_MESSAGE = "אין לך הרשאה לגשת לפורטל.";
const LOGOUT_MESSAGE = "יצאתם מהפורטל.";

function buildBuildingResolveFromBootstrap(
  data: ClientPortalBootstrapDto
): ClientPortalBuildingResolve {
  return {
    requestedBuildingId: data.building.id,
    loadedBuildingId: data.building.id,
    buildingName: data.building.name,
    source: "cloud",
    liveStartedAt: data.building.liveStartedAt,
    ctx: {
      id: data.building.id,
      building: {
        buildingCode: data.building.buildingCode,
        name: data.building.name,
        address: "",
        city: "",
        elevatorCount: data.elevators.length,
        elevatorCompany: "",
        contactPerson: "",
        phone: "",
        managementCompany: "",
        units: 0,
      },
      elevators: data.elevators,
      faults: data.faults,
      activeFaultDowntime: {},
    },
  };
}

function buildSessionFromBootstrap(
  token: string,
  data: ClientPortalBootstrapDto
): ClientAccessSession {
  return {
    user: {
      id: data.user.id,
      name: data.user.name,
      phone: null,
      email: null,
      client_type: data.user.clientType,
      welcome_message: data.user.welcomeMessage,
      access_token: token,
      is_active: true,
      expires_at: null,
      created_at: "",
    },
    access: {
      id: "",
      client_user_id: data.user.id,
      building_id: data.building.id,
      elevator_id: data.access.elevatorId,
      access_level: data.access.accessLevel,
      created_at: "",
    },
  };
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
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
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

    const result = await fetchClientPortalBootstrap(token);

    if (!result.ok) {
      setSession(null);
      setPermissions(null);
      setElevators([]);
      setFaults([]);
      setDocuments([]);
      if (result.gate === "access_denied") {
        setGateMessage(result.message ?? PORTAL_ACCESS_DENIED_MESSAGE);
      } else if (result.gate === "building_not_found") {
        setGateMessage(null);
        setBuildingNotFound(true);
      } else {
        setGateMessage(
          result.message ??
            getClientAccessGateMessage(
              result.gate === "expired"
                ? "expired"
                : result.gate === "deactivated"
                  ? "deactivated"
                  : "invalid"
            )
        );
      }
      setLoading(false);
      return;
    }

    const data = result.data;
    const loadedSession = buildSessionFromBootstrap(token, data);
    setSession(loadedSession);
    setPermissions(data.permissions);
    setGateMessage(null);
    setRequestedBuildingId(data.building.id);
    setBuildingResolve(buildBuildingResolveFromBootstrap(data));
    setElevators(data.elevators);
    setFaults(data.faults);
    setScopeLabel(data.scopeLabel);
    setDocuments(data.documents);
    setDataLastUpdated(data.dataLastUpdated);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadScopedData();
  }, [loadScopedData, refreshKey]);

  useEffect(() => {
    if (!session || !permissions?.can_view_building_dashboard) return;
    if (loginLoggedRef.current) return;
    loginLoggedRef.current = true;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.LOGIN,
      actionDetails: JSON.stringify({
        building_id: session.access.building_id,
        loaded_building_id: buildingResolve?.loadedBuildingId ?? null,
      }),
    });
  }, [session, permissions, buildingResolve, token]);

  useEffect(() => {
    if (!session || tab !== "history" || !permissions?.can_view_fault_history) {
      return;
    }
    if (faultsViewLoggedRef.current) return;
    faultsViewLoggedRef.current = true;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.VIEW_FAULTS,
      actionDetails: JSON.stringify({ view: "history" }),
    });
  }, [session, tab, permissions, token]);

  useEffect(() => {
    if (!session || tab !== "documents" || !permissions?.can_view_documents) {
      return;
    }
    if (documentsViewLoggedRef.current) return;
    documentsViewLoggedRef.current = true;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.VIEW_DOCUMENTS,
      actionDetails: JSON.stringify({ count: documents.length }),
    });
  }, [session, tab, permissions, documents.length, token]);

  const stats = useMemo(
    () => computeClientPortalStats(elevators, faults),
    [elevators, faults]
  );

  useEffect(() => {
    if (!session || !permissions?.can_view_availability) return;
    if (availabilityViewLoggedRef.current) return;
    availabilityViewLoggedRef.current = true;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.VIEW_AVAILABILITY,
      actionDetails: JSON.stringify({
        availability: stats.monthlyAvailabilityPercent,
      }),
    });
  }, [session, permissions, stats.monthlyAvailabilityPercent, token]);

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
        ? resolveClientWelcomeMessage(
            session.user.welcome_message,
            session.user.client_type
          )
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
    if (permissions?.can_view_statistics) {
      tabs.push({ key: "statistics", label: "סטטיסטיקות" });
    }
    return tabs;
  }, [permissions]);

  useEffect(() => {
    if (tab === "statistics" && !permissions?.can_view_statistics) {
      setTab("home");
    }
  }, [tab, permissions]);

  function handleLogout() {
    if (!session) return;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.LOGOUT,
    });
    setGateMessage(LOGOUT_MESSAGE);
    setSession(null);
    setShowReportForm(false);
    setShowFeedbackForm(false);
    setFeedbackSubmitted(false);
  }

  function handleOpenReportForm() {
    if (!session) return;
    setShowReportForm(true);
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.OPEN_FAULT,
      actionDetails: JSON.stringify({ action: "open_form" }),
    });
  }

  function handleReportSubmitted(ticketNumber: string) {
    if (!session) return;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.OPEN_FAULT,
      actionDetails: JSON.stringify({
        action: "submit",
        ticket_number: ticketNumber,
      }),
    });
    setShowReportForm(false);
    setRefreshKey((value) => value + 1);
  }

  function handleOpenFeedbackForm() {
    setFeedbackSubmitted(false);
    setShowFeedbackForm(true);
  }

  function handleFeedbackSubmitted() {
    if (!session) return;
    void logClientPortalActivityApi(token, {
      actionType: CLIENT_PORTAL_ACTIVITY.SUBMIT_FEEDBACK,
      actionDetails: JSON.stringify({
        building_id: buildingResolve?.loadedBuildingId ?? null,
      }),
    });
    setShowFeedbackForm(false);
    setFeedbackSubmitted(true);
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
        wide
      />

      <main className="max-w-lg md:max-w-6xl mx-auto px-4 space-y-4 page-content -mt-2">
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
          <section className="flex flex-col gap-4">
            {permissions.can_report_faults && !showReportForm && (
              <button
                type="button"
                onClick={handleOpenReportForm}
                className="order-1 md:order-2 btn-primary w-full text-lg font-bold py-4 min-h-[3.75rem] rounded-2xl shadow-md md:text-base md:font-semibold md:py-3 md:min-h-0 md:max-w-xs"
              >
                דווח תקלה
              </button>
            )}

            {permissions.can_report_faults && showReportForm && (
              <section className="order-1 md:order-2 space-y-3 md:max-w-2xl">
                <SectionTitle title="דיווח תקלה" />
                <ClientAccessReportForm
                  token={token}
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

            {permissions.can_submit_feedback &&
              !showFeedbackForm &&
              !feedbackSubmitted && (
                <button
                  type="button"
                  onClick={handleOpenFeedbackForm}
                  className="order-1 md:order-2 w-full rounded-2xl border-2 border-gold/40 bg-gold/5 text-navy font-bold py-4 min-h-[3.75rem] text-lg shadow-sm md:text-base md:font-semibold md:py-3 md:min-h-0 md:max-w-xs"
                >
                  שלח משוב
                </button>
              )}

            {permissions.can_submit_feedback && showFeedbackForm && (
              <section className="order-1 md:order-2 space-y-3 md:max-w-2xl">
                <SectionTitle title="שליחת משוב" />
                <FeedbackForm
                  portalToken={token}
                  buildingId={buildingResolve.loadedBuildingId}
                  buildingName={buildingResolve.buildingName}
                  buildingCode={buildingResolve.ctx.building.buildingCode}
                  onSubmitted={handleFeedbackSubmitted}
                />
                <button
                  type="button"
                  onClick={() => setShowFeedbackForm(false)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-navy"
                >
                  ביטול
                </button>
              </section>
            )}

            {permissions.can_submit_feedback && feedbackSubmitted && (
              <div className="order-1 md:order-2 bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-center md:max-w-2xl">
                <h3 className="text-lg font-bold text-navy">תודה על המשוב</h3>
                <p className="text-sm text-gray-text">
                  המשוב שלך נקלט במערכת ויסייע לנו לשפר את השירות.
                </p>
                <button
                  type="button"
                  onClick={handleOpenFeedbackForm}
                  className="btn-primary w-full"
                >
                  שליחת משוב נוסף
                </button>
              </div>
            )}

            <div
              className={`order-2 md:order-3 flex flex-col gap-4 ${
                permissions.can_view_open_faults
                  ? "md:grid md:grid-cols-3 md:gap-6 md:items-start"
                  : ""
              }`}
            >
              {permissions.can_view_open_faults && (
                <section className="space-y-3 md:col-span-2">
                  <SectionTitle title="תקלות פתוחות" />
                  {openFaults.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {openFaults.map((fault, index) => (
                        <FaultCard
                          key={fault.id}
                          fault={fault}
                          compact
                          index={index}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                      <p className="text-sm text-gray-text">אין תקלות פתוחות</p>
                    </div>
                  )}
                </section>
              )}

              <div
                className={`space-y-3 ${
                  permissions.can_view_open_faults ? "md:col-span-1" : ""
                }`}
              >
                <SectionTitle title="סטטוס מעליות" />
                <ElevatorStatusRow
                  elevators={effectiveElevators}
                  faultCounts={faultCounts}
                />
              </div>
            </div>

            <div className="order-4 md:order-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <InfoCard
                label="מספר מעליות"
                value={stats.elevatorCount}
                delay={0}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                }
              />
              {permissions.can_view_open_faults && (
                <InfoCard
                  label="תקלות פתוחות"
                  value={stats.openFaultCount}
                  accent
                  delay={50}
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  }
                />
              )}
              {permissions.can_view_fault_history && (
                <InfoCard
                  label="תקלות שטופלו"
                  value={stats.closedFaultCount}
                  delay={100}
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
              )}
              {permissions.can_view_availability && (
                <InfoCard
                  label="זמינות חודשית"
                  value={`${stats.monthlyAvailabilityPercent}%`}
                  delay={150}
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  }
                />
              )}
            </div>

            <div className="order-5">
              <ClientPortalInstallPrompt token={token} />
            </div>
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
              <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
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

        {tab === "statistics" && permissions.can_view_statistics && (
          <ClientPortalStatisticsSection
            portalToken={token}
            buildingId={buildingResolve.loadedBuildingId}
            buildingName={buildingResolve.buildingName}
            access={session.access}
            elevators={elevators}
          />
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
