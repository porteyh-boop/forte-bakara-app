"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getAllBuildingIds, getBuildingDataset } from "@/lib/buildings";
type Tab = "faults" | "feedback";

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

  const [cloudReady, setCloudReady] = useState(false);
  const [resetBuildingId, setResetBuildingId] = useState(
    () => getAllBuildingIds()[0] ?? ""
  );

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
    logPilotCloudConfigDebug();
    setCloudReady(isPilotCloudConfigured());
  }, []);

  const refresh = useCallback(async () => {
    if (!cloudReady) return;
    setLoading(true);
    const [f, fb] = await Promise.all([
      getAllPilotFaults(),
      getAllPilotFeedback(),
    ]);
    setFaults(f);
    setFeedback(fb);
    setLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    if (authed && cloudReady) void refresh();
  }, [authed, cloudReady, refresh]);

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

  const filteredFaults = useMemo(
    () =>
      faults.filter((f) => {
        if (buildingFilter !== "all" && f.building_id !== buildingFilter) return false;
        if (statusFilter !== "all" && f.status !== statusFilter) return false;
        if (!inDateRange(f.created_at)) return false;
        return true;
      }),
    [faults, buildingFilter, statusFilter, dateFrom, dateTo]
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
      />

      <main className="page-content -mt-2 space-y-4">
        {!cloudReady && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Supabase לא מוגדר. הגדירו NEXT_PUBLIC_SUPABASE_URL ו-
            NEXT_PUBLIC_SUPABASE_ANON_KEY ב-Vercel. עד אז הנתונים נשמרים רק
            ב-localStorage במכשירי המשתמשים.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gold">סינון</p>
          <div className="grid grid-cols-1 gap-3">
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="form-input"
            >
              <option value="all">כל הבניינים</option>
              {buildingOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>

            {tab === "faults" && (
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
            )}

            <div className="grid grid-cols-2 gap-2">
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
              onClick={() => void handleReset()}
              disabled={!cloudReady || loading}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              איפוס כל הבניינים
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

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-text w-full">
              איפוס לפי בניין (Supabase בלבד)
            </p>
            <select
              value={resetBuildingId}
              onChange={(e) => setResetBuildingId(e.target.value)}
              className="form-input flex-1 min-w-[12rem]"
              disabled={!cloudReady || loading}
            >
              {buildingOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleResetByBuilding()}
              disabled={!cloudReady || loading || !resetBuildingId}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              איפוס לבניין הנבחר
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("faults")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
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
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
              tab === "feedback"
                ? "bg-navy text-white"
                : "bg-white border border-gray-200 text-navy"
            }`}
          >
            משובים ({filteredFeedback.length})
          </button>
        </div>

        {tab === "faults" && (
          <div className="space-y-3">
            {filteredFaults.length === 0 ? (
              <p className="text-sm text-gray-text text-center py-8 bg-white rounded-2xl border border-gray-200">
                {cloudReady ? "אין דיווחים בענן" : "Supabase לא מחובר"}
              </p>
            ) : (
              filteredFaults.map((f) => (
                <article
                  key={f.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-navy text-sm">{f.fault_type}</p>
                      <p className="text-xs text-gray-text">
                        {f.building_name} · {f.elevator_name}
                      </p>
                      {f.ticket_number && (
                        <p className="text-xs text-gold font-medium mt-0.5">
                          {f.ticket_number}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-light text-navy shrink-0">
                      {f.status}
                    </span>
                  </div>
                  <p className="text-sm text-navy/80 leading-relaxed">{f.description}</p>
                  {f.image_data && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.image_data}
                        alt="תמונה מצורפת"
                        className="w-full h-36 object-cover"
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-text mt-2">
                    {formatCloudDate(f.created_at)}
                    {f.source_device_id && (
                      <span className="mr-2"> · מכשיר: {f.source_device_id.slice(0, 12)}…</span>
                    )}
                    {f.closed_at && (
                      <span className="mr-2"> · נסגר: {formatCloudDate(f.closed_at)}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {f.status !== "סגורה" ? (
                      <button
                        type="button"
                        disabled={actionId === f.id}
                        onClick={() => void handleClose(f.id)}
                        className="text-xs font-semibold bg-navy text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        סגור תקלה
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionId === f.id}
                        onClick={() => void handleReopen(f.id)}
                        className="text-xs font-semibold border border-gold text-navy px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        פתח מחדש
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actionId === f.id}
                      onClick={() => void handleDelete(f.id)}
                      className="text-xs font-semibold border border-red-200 text-red-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      מחק
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {tab === "feedback" && (
          <div className="space-y-3">
            {filteredFeedback.length === 0 ? (
              <p className="text-sm text-gray-text text-center py-8 bg-white rounded-2xl border border-gray-200">
                {cloudReady ? "אין משובים בענן" : "Supabase לא מחובר"}
              </p>
            ) : (
              filteredFeedback.map((fb) => (
                <article
                  key={fb.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
                >
                  <div className="flex justify-between gap-2 mb-1">
                    <p className="font-semibold text-navy text-sm">{fb.sender_name}</p>
                    <span className="text-xs font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-lg">
                      {fb.rating}/5
                    </span>
                  </div>
                  <p className="text-xs text-gray-text">
                    {fb.building_name} · {fb.sender_role}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs mt-2">
                    <span className="bg-gray-light px-2 py-1 rounded-lg">
                      שימוש שוטף: {fb.would_use_regularly}
                    </span>
                    <span className="bg-gray-light px-2 py-1 rounded-lg">
                      המלצה: {fb.would_recommend}
                    </span>
                  </div>
                  {fb.unclear_or_missing && (
                    <p className="text-sm text-navy/80 mt-2">
                      <span className="font-semibold">חסר/לא ברור: </span>
                      {fb.unclear_or_missing}
                    </p>
                  )}
                  {fb.expected_feature && (
                    <p className="text-sm text-navy/80 mt-1">
                      <span className="font-semibold">פעולה מצופה: </span>
                      {fb.expected_feature}
                    </p>
                  )}
                  <p className="text-xs text-gray-text mt-2">
                    {formatCloudDate(fb.created_at)}
                  </p>
                </article>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
