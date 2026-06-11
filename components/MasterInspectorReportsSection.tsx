"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closeInspectorReport,
  computeInspectorFollowUpPhase,
  createInspectorReport,
  daysSinceReportDate,
  formatInspectorDeadline,
  formatInspectorReportDate,
  generateUrgentLetterTemplate,
  getAllInspectorReports,
  getInspectorPhaseBadgeClass,
  getInspectorPhaseLabel,
  isInspectorReportTrackingConfigured,
  validateInspectorReportInput,
  type InspectorReportRecord,
} from "@/lib/inspector-report-tracking";
import {
  buildMasterBuildingList,
} from "@/lib/master-buildings-list";
import { getAllBuildingIds, getBuildingDataset } from "@/lib/buildings";

function resolveBuildingName(buildingId: string): string {
  try {
    return getBuildingDataset(buildingId).building.name;
  } catch {
    return buildingId;
  }
}

function resolveBuildingAddress(buildingId: string): string | undefined {
  try {
    const { building } = getBuildingDataset(buildingId);
    return `${building.address}, ${building.city}`;
  } catch {
    return undefined;
  }
}

export default function MasterInspectorReportsSection() {
  const cloudReady = isInspectorReportTrackingConfigured();
  const [reports, setReports] = useState<InspectorReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [letterPreviewId, setLetterPreviewId] = useState<string | null>(null);
  const [closureNotes, setClosureNotes] = useState<Record<string, string>>({});

  const [buildingId, setBuildingId] = useState(() => getAllBuildingIds()[0] ?? "");
  const [elevatorId, setElevatorId] = useState("");
  const [reportDate, setReportDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [inspectorName, setInspectorName] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [hasRemarks, setHasRemarks] = useState(false);

  const buildingOptions = useMemo(
    () =>
      buildMasterBuildingList({
        cloudBuildings: [],
        demoBuildingIds: getAllBuildingIds(),
        resolveDemoName: (id) => getBuildingDataset(id).building.name,
        resolveDemoCity: (id) => getBuildingDataset(id).building.city,
        faultBuildings: [],
      }),
    []
  );

  const elevatorOptions = useMemo(() => {
    if (!buildingId) return [];
    try {
      return getBuildingDataset(buildingId).elevators.map((elevator) => ({
        id: elevator.id,
        name: elevator.name,
      }));
    } catch {
      return [];
    }
  }, [buildingId]);

  const refresh = useCallback(async () => {
    if (!cloudReady) {
      setReports([]);
      return;
    }
    setLoading(true);
    const rows = await getAllInspectorReports();
    setReports(rows);
    setLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const input = {
      buildingId,
      elevatorId: elevatorId || null,
      reportDate,
      inspectorName,
      documentName,
      documentUrl,
      documentDescription,
      hasRemarks,
    };

    const validationError = validateInspectorReportInput(input);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    if (!cloudReady) {
      setMessage("Supabase לא מוגדר. הריצו migration 006.");
      return;
    }

    setCreating(true);
    const created = await createInspectorReport(input);
    setCreating(false);

    if (!created) {
      setMessage("יצירת תסקיר נכשלה. ודאו ש-migration 006 הורץ ב-Supabase.");
      return;
    }

    setInspectorName("");
    setDocumentName("");
    setDocumentUrl("");
    setDocumentDescription("");
    setHasRemarks(false);
    setElevatorId("");
    setMessage(
      created.has_remarks
        ? "תסקיר נשמר ודוח מעקב נפתח — מעקב 45 יום פעיל."
        : "תסקיר נשמר ללא מעקב הערות."
    );
    await refresh();
  }

  async function handleClose(reportId: string) {
    setActionId(reportId);
    setMessage(null);
    const ok = await closeInspectorReport({
      reportId,
      closureNotes: closureNotes[reportId] ?? "",
    });
    setActionId(null);
    if (!ok) {
      setMessage("סגירת המעקב נכשלה.");
      return;
    }
    setMessage("המעקב נסגר לאחר טיפול.");
    await refresh();
  }

  async function handleCopyLetter(report: InspectorReportRecord) {
    const text = generateUrgentLetterTemplate({
      buildingName: resolveBuildingName(report.building_id),
      buildingAddress: resolveBuildingAddress(report.building_id),
      reportDate: report.report_date,
      deadlineAt: report.deadline_at,
      documentName: report.document_name,
      inspectorName: report.inspector_name,
      daysSinceReport: daysSinceReportDate(report.report_date),
    });
    try {
      await navigator.clipboard.writeText(text);
      setMessage("מכתב בהול ודחוף הועתק ללוח.");
    } catch {
      setMessage("לא ניתן להעתיק. השתמשו בתצוגה המקדימה.");
      setLetterPreviewId(report.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gold/30 p-4 space-y-2">
        <h2 className="text-base font-bold text-navy">תסקירי בודק ומעקב</h2>
        <p className="text-sm text-gray-text">
          העלאת תסקיר, סימון הערות לתיקון תוך 45 יום, ומעקב אוטומטי:
          תזכורת (35) · התראה (40) · מכתב בהול (45+).
        </p>
        {!cloudReady && (
          <p className="text-sm text-red-600">
            Supabase לא מוגדר. הריצו migration 006 ב-SQL Editor.
          </p>
        )}
        {message && (
          <p className="text-sm font-semibold text-navy bg-gray-light rounded-lg px-3 py-2">
            {message}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
      >
        <h3 className="text-sm font-bold text-navy">העלאת תסקיר בודק</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gray-text">בניין</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="form-input mt-1"
              required
            >
              {buildingOptions.map((building) => (
                <option key={building.buildingId} value={building.buildingId}>
                  {building.name} ({building.buildingId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-text">מעלית (אופציונלי)</label>
            <select
              value={elevatorId}
              onChange={(e) => setElevatorId(e.target.value)}
              className="form-input mt-1"
            >
              <option value="">כל הבניין</option>
              {elevatorOptions.map((elevator) => (
                <option key={elevator.id} value={elevator.id}>
                  {elevator.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-text">תאריך תסקיר</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="form-input mt-1"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-text">שם בודק</label>
            <input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              className="form-input mt-1"
              placeholder="אופציונלי"
            />
          </div>
          <div>
            <label className="text-xs text-gray-text">שם מסמך</label>
            <input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="form-input mt-1"
              placeholder="תסקיר בודק שנתי 2026"
            />
          </div>
          <div>
            <label className="text-xs text-gray-text">קישור חיצוני למסמך</label>
            <input
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              className="form-input mt-1"
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-text">תיאור / הערות על המסמך</label>
            <textarea
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
              className="form-input mt-1 min-h-[4rem]"
              placeholder="תיאור קצר אם אין קישור"
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={hasRemarks}
            onChange={(e) => setHasRemarks(e.target.checked)}
            className="mt-1"
          />
          <span>
            יש הערות לתיקון — פתיחת דוח מעקב ל-45 יום (תזכורת 35 · התראה 40 ·
            מכתב בהול 45+)
          </span>
        </label>

        <button
          type="submit"
          disabled={!cloudReady || creating}
          className="btn-primary w-full sm:w-auto disabled:opacity-50"
        >
          {creating ? "שומר..." : "שמור תסקיר ופתח מעקב"}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-navy">דוחות מעקב פעילים</h3>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={!cloudReady || loading}
            className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "טוען..." : "רענון"}
          </button>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-gray-text">
            {cloudReady ? "אין תסקירי בודק רשומים." : "Supabase לא מחובר."}
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const phase = computeInspectorFollowUpPhase(report);
              const days = daysSinceReportDate(report.report_date);
              const buildingName = resolveBuildingName(report.building_id);
              const letterText =
                letterPreviewId === report.id
                  ? generateUrgentLetterTemplate({
                      buildingName,
                      buildingAddress: resolveBuildingAddress(report.building_id),
                      reportDate: report.report_date,
                      deadlineAt: report.deadline_at,
                      documentName: report.document_name,
                      inspectorName: report.inspector_name,
                      daysSinceReport: days,
                    })
                  : "";

              return (
                <article
                  key={report.id}
                  className="rounded-xl border border-gray-200 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-navy">
                        {report.document_name ?? "תסקיר בודק"} · {buildingName}
                      </p>
                      <p className="text-xs text-gray-text mt-0.5">
                        תאריך תסקיר: {formatInspectorReportDate(report.report_date)}
                        {report.inspector_name
                          ? ` · ${report.inspector_name}`
                          : ""}
                        {report.elevator_id ? ` · ${report.elevator_id}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${getInspectorPhaseBadgeClass(phase)}`}
                    >
                      {getInspectorPhaseLabel(phase)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-text">
                    <p>ימים מהתסקיר: {days}</p>
                    <p>
                      מועד יעד:{" "}
                      {report.has_remarks
                        ? formatInspectorDeadline(report.deadline_at)
                        : "—"}
                    </p>
                  </div>

                  {report.document_url && (
                    <a
                      href={report.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-navy underline break-all"
                    >
                      {report.document_url}
                    </a>
                  )}
                  {report.document_description && (
                    <p className="text-xs text-navy/80">{report.document_description}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {phase === "urgent" && report.status === "open" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleCopyLetter(report)}
                          className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
                        >
                          העתק מכתב בהול
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLetterPreviewId(
                              letterPreviewId === report.id ? null : report.id
                            )
                          }
                          className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                        >
                          {letterPreviewId === report.id
                            ? "הסתר מכתב"
                            : "הצג מכתב"}
                        </button>
                      </>
                    )}
                  </div>

                  {letterText && (
                    <pre className="text-xs whitespace-pre-wrap bg-gray-light rounded-lg p-3 border border-gray-200 text-navy/90">
                      {letterText}
                    </pre>
                  )}

                  {report.status === "open" && report.has_remarks && (
                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <input
                        value={closureNotes[report.id] ?? ""}
                        onChange={(e) =>
                          setClosureNotes((prev) => ({
                            ...prev,
                            [report.id]: e.target.value,
                          }))
                        }
                        placeholder="הערות סגירה (אופציונלי)"
                        className="form-input"
                      />
                      <button
                        type="button"
                        onClick={() => void handleClose(report.id)}
                        disabled={actionId === report.id}
                        className="text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 disabled:opacity-50"
                      >
                        סגור מעקב לאחר טיפול
                      </button>
                    </div>
                  )}

                  {report.status === "closed" && (
                    <p className="text-xs text-green-700">
                      נסגר ב-{formatInspectorDeadline(report.closed_at)}
                      {report.closure_notes ? ` · ${report.closure_notes}` : ""}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
