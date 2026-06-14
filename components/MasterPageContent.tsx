"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import MasterCloudFaultCard from "@/components/MasterCloudFaultCard";
import MasterAnalyticsSection from "@/components/MasterAnalyticsSection";
import MasterBuildingsSection from "@/components/MasterBuildingsSection";
import MasterClientAccessSection from "@/components/MasterClientAccessSection";
import MasterDocumentCenterSection from "@/components/MasterDocumentCenterSection";
import PageHeader from "@/components/PageHeader";
import {
  closePilotFault,
  deletePilotFault,
  getAllPilotFaults,
  getAllPilotFeedback,
  isMasterAuthenticated,
  isMasterCodeConfigured,
  isPilotCloudConfigured,
  logPilotCloudConfigDebug,
  reopenPilotFault,
  resetPilotCloudData,
  resetPilotCloudDataByBuilding,
  setMasterAuthenticated,
  verifyMasterCode,
  type PilotCloudFault,
  type PilotCloudFeedback,
} from "@/lib/pilot-cloud";
import {
  formatFeedbackNotes,
  getMasterFeedbackEmptyMessage,
} from "@/lib/master-feedback-view";
import { getAllBuildingIds, getBuildingDataset } from "@/lib/buildings";
import { getAllCloudBuildingsWithMeta } from "@/lib/buildings-cloud";
import {
  buildLiveStartedAtByBuilding,
  filterPilotFaultsByBuildingLiveStart,
} from "@/lib/building-live";
import { BUILDING_LIVE_STARTED_EVENT } from "@/hooks/useBuildingLiveStarted";
import { buildMasterBuildingDossierPath } from "@/lib/master-building-routes";
type Tab = "faults" | "feedback" | "buildings" | "clientAccess" | "documentCenter";

const MASTER_TABS: readonly Tab[] = [
  "faults",
  "feedback",
  "buildings",
  "clientAccess",
  "documentCenter",
];

function isMasterTab(value: string | null): value is Tab {
  return Boolean(value && MASTER_TABS.includes(value as Tab));
}

function formatCloudDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

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
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}
        <button type="submit" className="btn-primary w-full">
          כניסה
        </button>
      </form>
    </div>
  );
}

export default function MasterPageContent() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("faults");
  const [faults, setFaults] = useState<PilotCloudFault[]>([]);
  const [feedback, setFeedback] = useState<PilotCloudFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [liveStartedAtByBuilding, setLiveStartedAtByBuilding] = useState<
    Record<string, string | null>
  >({});

  const [cloudReady, setCloudReady] = useState(false);
  const [resetBuildingId, setResetBuildingId] = useState(
    () => getAllBuildingIds()[0] ?? ""
  );

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
    logPilotCloudConfigDebug();
    setCloudReady(isPilotCloudConfigured());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (isMasterTab(requestedTab)) {
      setTab(requestedTab);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!cloudReady) return;
    setLoading(true);
    const [f, fb, cloudResult] = await Promise.all([
      getAllPilotFaults(),
      getAllPilotFeedback(),
      getAllCloudBuildingsWithMeta(),
    ]);
    setFaults(f);
    setFeedback(fb);
    const cloudLiveMap: Record<string, string | null> = {};
    for (const row of cloudResult.rows) {
      cloudLiveMap[row.building_id] = row.live_started_at ?? null;
    }
    setLiveStartedAtByBuilding(
      buildLiveStartedAtByBuilding(getAllBuildingIds(), cloudLiveMap)
    );
    setLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    if (authed && cloudReady) void refresh();
  }, [authed, cloudReady, refresh]);

  useEffect(() => {
    if (!authed || !cloudReady) return;
    function onLiveStarted() {
      void refresh();
    }
    window.addEventListener(BUILDING_LIVE_STARTED_EVENT, onLiveStarted);
    return () => {
      window.removeEventListener(BUILDING_LIVE_STARTED_EVENT, onLiveStarted);
    };
  }, [authed, cloudReady, refresh]);

  useEffect(() => {
    if (authed && cloudReady && tab === "feedback") {
      void refresh();
    }
  }, [tab, authed, cloudReady, refresh]);

  const buildingOptions = useMemo(() => {
    const ids = new Set<string>();
    getAllBuildingIds().forEach((id) => ids.add(id));
    faults.forEach((f) => ids.add(f.building_id));
    feedback.forEach((f) => ids.add(f.building_id));
    return Array.from(ids).map((id) => {
      const ctx = getBuildingDataset(id);
      return { id, label: `${ctx.building.name} (${ctx.building.buildingCode})` };
    });
  }, [faults, feedback]);

  function inDateRange(iso: string): boolean {
    const d = new Date(iso);
    if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  }

  const faultsForDisplay = useMemo(
    () =>
      filterPilotFaultsByBuildingLiveStart(faults, liveStartedAtByBuilding),
    [faults, liveStartedAtByBuilding]
  );

  const filteredFaults = useMemo(
    () =>
      faultsForDisplay.filter((f) => {
        if (buildingFilter !== "all" && f.building_id !== buildingFilter) return false;
        if (statusFilter !== "all" && f.status !== statusFilter) return false;
        if (!inDateRange(f.created_at)) return false;
        return true;
      }),
    [faultsForDisplay, buildingFilter, statusFilter, dateFrom, dateTo]
  );

  const filteredFeedback = useMemo(
    () =>
      feedback.filter((f) => {
        if (buildingFilter !== "all" && f.building_id !== buildingFilter) return false;
        if (!inDateRange(f.created_at)) return false;
        return true;
      }),
    [feedback, buildingFilter, dateFrom, dateTo]
  );

  const feedbackEmptyMessage = getMasterFeedbackEmptyMessage(
    feedback.length,
    filteredFeedback.length,
    cloudReady
  );

  const feedbackTabLabel =
    feedback.length === filteredFeedback.length
      ? `משובים (${feedback.length})`
      : `משובים (${filteredFeedback.length}/${feedback.length})`;

  async function handleClose(id: string) {
    setActionId(id);
    await closePilotFault(id);
    await refresh();
    setActionId(null);
  }

  async function handleReopen(id: string) {
    setActionId(id);
    await reopenPilotFault(id);
    await refresh();
    setActionId(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("למחוק דיווח זה מהענן?")) return;
    setActionId(id);
    await deletePilotFault(id);
    await refresh();
    setActionId(null);
  }

  async function handleReset() {
    if (
      !window.confirm(
        "לאפס את כל נתוני הפיילוט בענן? פעולה זו תמחק את כל הדיווחים והמשובים מכל הבניינים."
      )
    ) {
      return;
    }
    setLoading(true);
    await resetPilotCloudData();
    await refresh();
  }

  async function handleResetByBuilding() {
    if (!resetBuildingId) return;

    const ctx = getBuildingDataset(resetBuildingId);
    const buildingLabel = `${ctx.building.name} (${ctx.building.buildingCode})`;
    const faultCount = faults.filter((f) => f.building_id === resetBuildingId).length;
    const feedbackCount = feedback.filter(
      (f) => f.building_id === resetBuildingId
    ).length;

    if (
      !window.confirm(
        `לאפס נתוני פיילוט בענן לבניין "${buildingLabel}"?\n\n` +
          `יימחקו לצמיתות מ-Supabase:\n` +
          `• ${faultCount} דיווחים (pilot_faults)\n` +
          `• ${feedbackCount} משובים (pilot_feedback)\n\n` +
          `רק רשומות שבהן building_id = "${resetBuildingId}".\n` +
          `נתוני בניינים אחרים לא יושפעו.\n\n` +
          `האם להמשיך?`
      )
    ) {
      return;
    }

    setLoading(true);
    await resetPilotCloudDataByBuilding(resetBuildingId);
    await refresh();
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="ניהול פיילוט"
        subtitle="יהודה פורטה — דיווחים ומשובים מכל המכשירים"
        badge="פנימי"
        master
      />

      <main className="mx-auto w-full max-w-lg px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:max-w-7xl md:px-8 -mt-2 space-y-4">
        {!cloudReady && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Supabase לא מוגדר. הגדירו NEXT_PUBLIC_SUPABASE_URL ו-
            NEXT_PUBLIC_SUPABASE_ANON_KEY ב-Vercel. עד אז הנתונים נשמרים רק
            ב-localStorage במכשירי המשתמשים.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 space-y-3">
          <p className="text-xs font-semibold text-gold">סינון (דיווחים ומשובים)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="flex gap-2 items-stretch">
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="form-input flex-1 min-w-0"
              >
                <option value="all">כל הבניינים</option>
                {buildingOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={buildingFilter === "all"}
                onClick={() =>
                  router.push(buildMasterBuildingDossierPath(buildingFilter))
                }
                className="text-sm font-semibold bg-navy text-white px-4 py-2 rounded-xl whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                פתח תיק בניין
              </button>
            </div>

            {tab === "faults" ? (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-input"
              >
                <option value="all">כל הסטטוסים</option>
                <option value="פתוחה">פתוחה</option>
                <option value="בטיפול">בטיפול</option>
                <option value="סגורה">סגורה</option>
                <option value="מושבתת">מושבתת</option>
              </select>
            ) : (
              <div className="hidden xl:block" aria-hidden="true" />
            )}

            <div>
              <label className="text-xs text-gray-text">מתאריך</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="form-input mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-text">עד תאריך</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="form-input mt-1"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={!cloudReady || loading}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-navy hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "טוען..." : "רענון"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMasterAuthenticated(false);
                setAuthed(false);
              }}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-text hover:bg-gray-50"
            >
              יציאה
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => setTab("faults")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === "faults"
                ? "bg-navy text-white"
                : "bg-white border border-gray-200 text-navy"
            }`}
          >
            דיווחים ({filteredFaults.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("feedback")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === "feedback"
                ? "bg-navy text-white"
                : "bg-white border border-gray-200 text-navy"
            }`}
          >
            {feedbackTabLabel}
          </button>
          <button
            type="button"
            onClick={() => setTab("buildings")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === "buildings"
                ? "bg-navy text-white"
                : "bg-white border border-gray-200 text-navy"
            }`}
          >
            ניהול בניינים
          </button>
          <button
            type="button"
            onClick={() => setTab("clientAccess")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === "clientAccess"
                ? "bg-navy text-white"
                : "bg-white border border-gray-200 text-navy"
            }`}
          >
            גישות לקוח
          </button>
          <button
            type="button"
            onClick={() => setTab("documentCenter")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === "documentCenter"
                ? "bg-navy text-white"
                : "bg-white border border-gray-200 text-navy"
            }`}
          >
            מאגר מסמכים
          </button>
        </div>

        {tab === "faults" && (
          <div className="space-y-3">
            {filteredFaults.length === 0 ? (
              <p className="text-sm text-gray-text text-center py-8 bg-white rounded-2xl border border-gray-200">
                {cloudReady ? "אין דיווחים בענן" : "Supabase לא מחובר"}
              </p>
            ) : (
              <div className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
                {filteredFaults.map((f) => (
                  <MasterCloudFaultCard
                    key={f.id}
                    fault={f}
                    actionId={actionId}
                    formatDate={formatCloudDate}
                    onClose={(faultId) => void handleClose(faultId)}
                    onReopen={(faultId) => void handleReopen(faultId)}
                    onDelete={(faultId) => void handleDelete(faultId)}
                  />
                ))}
              </div>
            )}

            <MasterAnalyticsSection
              faults={faultsForDisplay}
              buildingOptions={buildingOptions}
              dateFrom={dateFrom}
              dateTo={dateTo}
              cloudReady={cloudReady}
            />
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-3">
            {cloudReady && feedback.length > 0 && (
              <p className="text-xs text-gray-text bg-gray-light rounded-xl px-3 py-2">
                נטענו {feedback.length} משובים מ-pilot_feedback
                {filteredFeedback.length !== feedback.length
                  ? ` · מוצגים ${filteredFeedback.length} לאחר סינון`
                  : ""}
              </p>
            )}

            {filteredFeedback.length === 0 ? (
              <p className="text-sm text-gray-text text-center py-8 bg-white rounded-2xl border border-gray-200">
                {feedbackEmptyMessage}
              </p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="text-xs text-gray-text border-b border-gray-200">
                      <th className="text-right py-2 px-2 font-semibold">תאריך</th>
                      <th className="text-right py-2 px-2 font-semibold">בניין</th>
                      <th className="text-right py-2 px-2 font-semibold">שם שולח</th>
                      <th className="text-right py-2 px-2 font-semibold">תפקיד</th>
                      <th className="text-right py-2 px-2 font-semibold">דירוג</th>
                      <th className="text-right py-2 px-2 font-semibold">המלצה</th>
                      <th className="text-right py-2 px-2 font-semibold">שימוש שוטף</th>
                      <th className="text-right py-2 px-2 font-semibold">הערות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeedback.map((fb) => (
                      <tr
                        key={fb.id}
                        className="border-b border-gray-100 align-top"
                      >
                        <td className="py-2 px-2 text-xs whitespace-nowrap">
                          {formatCloudDate(fb.created_at)}
                        </td>
                        <td className="py-2 px-2 text-xs">{fb.building_name}</td>
                        <td className="py-2 px-2 text-xs font-semibold text-navy">
                          {fb.sender_name}
                        </td>
                        <td className="py-2 px-2 text-xs">{fb.sender_role}</td>
                        <td className="py-2 px-2 text-xs font-semibold text-gold">
                          {fb.rating}/5
                        </td>
                        <td className="py-2 px-2 text-xs">{fb.would_recommend}</td>
                        <td className="py-2 px-2 text-xs">
                          {fb.would_use_regularly}
                        </td>
                        <td className="py-2 px-2 text-xs text-navy/80 max-w-[14rem]">
                          {formatFeedbackNotes(
                            fb.unclear_or_missing,
                            fb.expected_feature
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "buildings" && (
          <MasterBuildingsSection
            cloudReady={cloudReady}
            faults={faults}
            liveStartedAtByBuilding={liveStartedAtByBuilding}
            onDataChanged={refresh}
          />
        )}

        {tab === "clientAccess" && (
          <MasterClientAccessSection
            pilotCloudReady={cloudReady}
            pilotLoading={loading}
            resetBuildingId={resetBuildingId}
            onResetBuildingIdChange={setResetBuildingId}
            resetBuildingOptions={buildingOptions}
            onResetAllPilotData={handleReset}
            onResetPilotDataByBuilding={handleResetByBuilding}
          />
        )}

        {tab === "documentCenter" && <MasterDocumentCenterSection />}
      </main>
    </div>
  );
}
