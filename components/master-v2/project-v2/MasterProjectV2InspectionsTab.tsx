"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import InspectorFollowUpAlertBanner from "@/components/master-v2/project-v2/InspectorFollowUpAlertBanner";
import MasterProjectV2InspectorReportDialog from "@/components/master-v2/project-v2/MasterProjectV2InspectorReportDialog";
import ProjectDocumentsPanel from "@/components/master-v2/project-v2/ProjectDocumentsPanel";
import {
  ForteV2Panel,
  ForteV2TabShell,
  MasterProjectV2EmptyState,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { getAllCloudElevators } from "@/lib/buildings-cloud";
import {
  formatNextInspectionDate,
  formatNextInspectionStatusLabel,
  getNextInspectionDisplayStatus,
  listAllDocumentInspectorMeta,
  type DocumentInspectorMetaRecord,
} from "@/lib/document-inspector-meta";
import {
  getInspectorNotificationSentLabel,
  groupNotificationsByDocumentId,
  isInspectorLegacyNotificationType,
  listAllDocumentInspectorNotifications,
  type DocumentInspectorNotificationRecord,
} from "@/lib/document-inspector-notifications";
import {
  buildInspectorFollowUpStatusSummary,
  computeInspectorFollowUpAlerts,
  getInspectorLetterStageLabel,
  getNextRequiredInspectorLetterStage,
  type InspectorFollowUpLetterAlert,
} from "@/lib/inspector-follow-up-letters";
import {
  buildPreparedStagesByReportTrackingId,
  getPreparedStagesForReport,
  resolveInspectorReportTrackingId,
} from "@/lib/inspector-follow-up-prepared-stages";
import { listMasterDocumentsByBuilding } from "@/lib/master-documents-api";
import {
  closeInspectorReport,
  deleteInspectorReport,
  formatInspectorDeadline,
  formatInspectorReportDate,
  getAllInspectorReports,
  getInspectorReportDocumentUrl,
  isInspectorReportTrackingConfigured,
  type InspectorReportRecord,
} from "@/lib/inspector-report-tracking";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";
import type { DocumentRecord } from "@/lib/document-center";

interface MasterProjectV2InspectionsTabProps {
  buildingId: string;
}

interface ElevatorOption {
  id: string;
  name: string;
}

function elevatorKey(elevatorId: string | null): string {
  return elevatorId?.trim() || "__building__";
}

function elevatorLabel(
  elevatorId: string | null,
  elevatorNameById: Map<string, string>
): string {
  if (!elevatorId) return "כל הבניין";
  return elevatorNameById.get(elevatorId) ?? elevatorId;
}

function pickLatestByElevator(
  reports: InspectorReportRecord[]
): Map<string, InspectorReportRecord> {
  const latest = new Map<string, InspectorReportRecord>();
  for (const report of reports) {
    const key = elevatorKey(report.elevator_id);
    const existing = latest.get(key);
    if (!existing || report.report_date.localeCompare(existing.report_date) > 0) {
      latest.set(key, report);
    }
  }
  return latest;
}

function pickActiveFollowUpReports(
  reports: InspectorReportRecord[]
): InspectorReportRecord[] {
  return reports.filter(
    (report) => report.status === "open" && report.has_remarks
  );
}

function resolveNextInspectionDate(
  report: InspectorReportRecord,
  metaByDocumentId: Record<string, DocumentInspectorMetaRecord>
): string | null {
  if (report.document_id && metaByDocumentId[report.document_id]) {
    return metaByDocumentId[report.document_id].next_inspection_date;
  }
  return report.next_inspection_date;
}

export default function MasterProjectV2InspectionsTab({
  buildingId,
}: MasterProjectV2InspectionsTabProps) {
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isInspectorReportTrackingConfigured();

  const [reports, setReports] = useState<InspectorReportRecord[]>([]);
  const [metaByDocumentId, setMetaByDocumentId] = useState<
    Record<string, DocumentInspectorMetaRecord>
  >({});
  const [notificationsByDocumentId, setNotificationsByDocumentId] = useState<
    Record<string, DocumentInspectorNotificationRecord[]>
  >({});
  const [savedLetters, setSavedLetters] = useState<DocumentRecord[]>([]);
  const [elevatorOptions, setElevatorOptions] = useState<ElevatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [closureNotes, setClosureNotes] = useState<Record<string, string>>({});

  const loadElevators = useCallback(async () => {
    if (!isPilotCloudConfigured()) {
      setElevatorOptions([]);
      return;
    }
    const rows = await getAllCloudElevators();
    setElevatorOptions(
      rows
        .filter((row) => row.building_id === buildingId && row.is_active)
        .map((row) => ({
          id: row.elevator_id,
          name: row.elevator_name,
        }))
    );
  }, [buildingId]);

  const refresh = useCallback(async () => {
    if (!cloudReady) {
      setReports([]);
      setMetaByDocumentId({});
      setNotificationsByDocumentId({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const [reportRows, metaRows, notificationRows, savedLetterDocuments] =
      await Promise.all([
      getAllInspectorReports(),
      listAllDocumentInspectorMeta(),
      listAllDocumentInspectorNotifications(),
      listMasterDocumentsByBuilding(buildingId),
    ]);

    const metaMap: Record<string, DocumentInspectorMetaRecord> = {};
    for (const row of metaRows) {
      metaMap[row.document_id] = row;
    }

    setMetaByDocumentId(metaMap);
    setNotificationsByDocumentId(
      groupNotificationsByDocumentId(notificationRows)
    );
    setSavedLetters(savedLetterDocuments);
    setReports(
      reportRows.filter((report) => report.building_id === buildingId)
    );
    setLoading(false);
  }, [buildingId, cloudReady]);

  useEffect(() => {
    void loadElevators();
  }, [loadElevators]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const elevatorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const elevator of elevatorOptions) {
      map.set(elevator.id, elevator.name);
    }
    return map;
  }, [elevatorOptions]);

  const preparedByReportTrackingId = useMemo(
    () =>
      buildPreparedStagesByReportTrackingId({
        notifications: Object.values(notificationsByDocumentId).flat(),
        savedLetters,
      }),
    [notificationsByDocumentId, savedLetters]
  );

  const elevatorLabelByReportId = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const report of reports) {
      labels[report.id] = elevatorLabel(report.elevator_id, elevatorNameById);
    }
    return labels;
  }, [reports, elevatorNameById]);

  const followUpAlerts = useMemo(
    () =>
      computeInspectorFollowUpAlerts({
        reports,
        preparedByDocumentId: preparedByReportTrackingId,
        elevatorLabelByReportId,
      }),
    [reports, preparedByReportTrackingId, elevatorLabelByReportId]
  );

  const alertsByReportId = useMemo(() => {
    const map = new Map<string, InspectorFollowUpLetterAlert>();
    for (const alert of followUpAlerts) {
      map.set(alert.report.id, alert);
    }
    return map;
  }, [followUpAlerts]);

  const activeFollowUpReports = useMemo(
    () => pickActiveFollowUpReports(reports),
    [reports]
  );

  const latestByElevator = useMemo(
    () => pickLatestByElevator(reports),
    [reports]
  );

  const sortedReports = useMemo(
    () =>
      [...reports].sort((a, b) => b.report_date.localeCompare(a.report_date)),
    [reports]
  );

  async function handleDelete(reportId: string) {
    if (!window.confirm("למחוק את התסקיר ואת הקובץ המצורף?")) return;
    if (!guardSensitiveAction()) return;

    setActionId(reportId);
    const ok = await deleteInspectorReport(reportId);
    setActionId(null);
    setMessage(ok ? "התסקיר נמחק." : "מחיקת התסקיר נכשלה.");
    if (ok) await refresh();
  }

  async function handleClose(reportId: string) {
    if (!guardSensitiveAction()) return;
    setActionId(reportId);
    const ok = await closeInspectorReport({
      reportId,
      closureNotes: closureNotes[reportId] ?? "",
    });
    setActionId(null);
    setMessage(ok ? "המעקב נסגר לאחר טיפול." : "סגירת המעקב נכשלה.");
    if (ok) await refresh();
  }

  function renderActiveFollowUpCard(report: InspectorReportRecord) {
    const documentId = resolveInspectorReportTrackingId(report);
    const prepared = getPreparedStagesForReport(report, preparedByReportTrackingId);
    const summary = buildInspectorFollowUpStatusSummary({
      report,
      prepared,
      elevatorLabel: elevatorLabel(report.elevator_id, elevatorNameById),
    });
    const alert = alertsByReportId.get(report.id);

    if (!summary) return null;

    return (
      <div
        key={report.id}
        className="rounded-md border-2 border-amber-300 bg-amber-50/80 p-3 space-y-2"
      >
        <p className="text-xs font-bold text-amber-950">מעקב הערות פעיל</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-forte-text/90">
          <p>
            <span className="text-forte-text/70">תאריך תסקיר: </span>
            {summary.reportDateLabel}
          </p>
          <p>
            <span className="text-forte-text/70">בודק: </span>
            {summary.inspectorName}
          </p>
          <p>
            <span className="text-forte-text/70">מעלית: </span>
            {summary.elevatorLabel}
          </p>
          <p>
            <span className="text-forte-text/70">מועד אחרון לטיפול: </span>
            {summary.deadlineLabel}
          </p>
          <p>
            <span className="text-forte-text/70">ימים: </span>
            {summary.daysRemainingLabel}
          </p>
          <p>
            <span className="text-forte-text/70">המכתב הבא: </span>
            {summary.nextLetterLabel}
          </p>
        </div>
        {alert && (
          <InspectorFollowUpAlertBanner
            buildingId={buildingId}
            alert={alert}
            compact
          />
        )}
      </div>
    );
  }

  function renderLatestStatusCard(
    label: string,
    report: InspectorReportRecord
  ) {
    const nextDate = resolveNextInspectionDate(report, metaByDocumentId);
    const nextStatus = getNextInspectionDisplayStatus(nextDate);

    return (
      <div
        key={label}
        className="rounded-md border border-forte-border bg-forte-blue-light/50 p-3 space-y-2"
      >
        <p className="text-xs font-semibold text-forte-text">{label}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-forte-text-secondary">
          <p>
            <span className="text-forte-text/70">תאריך בדיקה אחרונה: </span>
            {formatInspectorReportDate(report.report_date)}
          </p>
          <p>
            <span className="text-forte-text/70">בודק: </span>
            {report.inspector_name ?? "—"}
          </p>
          <p>
            <span className="text-forte-text/70">הערות לתיקון: </span>
            {report.has_remarks ? "כן" : "לא"}
          </p>
          <p>
            <span className="text-forte-text/70">מועד יעד: </span>
            {report.has_remarks
              ? formatInspectorDeadline(report.deadline_at)
              : "—"}
          </p>
          <p>
            <span className="text-forte-text/70">מועד הבדיקה הבאה: </span>
            <span
              className={
                nextStatus === "overdue"
                  ? "font-semibold text-red-700"
                  : nextStatus === "due_soon"
                    ? "font-semibold text-amber-800"
                    : ""
              }
            >
              {formatNextInspectionDate(nextDate)}
              {nextStatus === "overdue" && " · בדיקה נדרשת"}
              {nextStatus === "due_soon" &&
                nextDate &&
                ` · ${formatNextInspectionStatusLabel(nextDate)}`}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <ForteV2TabShell
      workspace="project-v2-inspections"
      title="בדיקות"
      description="תסקיר בודק, מעקב 45 יום להערות, ומועד הבדיקה הבאה"
      actions={
        cloudReady ? (
          <MasterProjectV2PrimaryButton onClick={() => setUploadOpen(true)} size="sm">
            + תסקיר בודק
          </MasterProjectV2PrimaryButton>
        ) : undefined
      }
    >

      {!cloudReady && (
        <MasterProjectV2StatusBanner tone="error">
          Supabase לא מוגדר. הריצו migrations 006, 008, 011, 027 ו-028.
        </MasterProjectV2StatusBanner>
      )}

      {message && (
        <MasterProjectV2StatusBanner tone="info">{message}</MasterProjectV2StatusBanner>
      )}

      {followUpAlerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {followUpAlerts.map((alert) => (
            <InspectorFollowUpAlertBanner
              key={`${alert.report.id}:${alert.stage}`}
              buildingId={buildingId}
              alert={alert}
            />
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-forte-text-secondary py-4">טוען בדיקות...</p>
      ) : latestByElevator.size === 0 ? (
        <MasterProjectV2EmptyState
          title="אין תסקירי בודק לפרויקט"
          description="לחצו «+ תסקיר בודק» כדי להעלות תסקיר ולפתוח מעקב."
          actions={
            cloudReady ? (
              <MasterProjectV2PrimaryButton onClick={() => setUploadOpen(true)}>
                + תסקיר בודק
              </MasterProjectV2PrimaryButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-forte-text">מצב בדיקה</p>
          {activeFollowUpReports.length > 0 ? (
            activeFollowUpReports.map((report) => renderActiveFollowUpCard(report))
          ) : latestByElevator.size === 1 ? (
            renderLatestStatusCard(
              elevatorLabel(
                [...latestByElevator.values()][0].elevator_id,
                elevatorNameById
              ),
              [...latestByElevator.values()][0]
            )
          ) : (
            [...latestByElevator.entries()].map(([key, report]) =>
              renderLatestStatusCard(
                key === "__building__"
                  ? "כל הבניין"
                  : elevatorLabel(report.elevator_id, elevatorNameById),
                report
              )
            )
          )}
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-forte-text">תסקירים ומעקבים</p>
          <MasterProjectV2SecondaryButton
            onClick={() => void refresh()}
            disabled={!cloudReady || loading}
          >
            רענון
          </MasterProjectV2SecondaryButton>
        </div>

        {sortedReports.length === 0 && !loading ? null : (
          <div className="space-y-3">
            {sortedReports.map((report) => {
              const documentUrl = getInspectorReportDocumentUrl(report);
              const nextDate = resolveNextInspectionDate(
                report,
                metaByDocumentId
              );
              const nextStatus = getNextInspectionDisplayStatus(nextDate);
              const documentId = resolveInspectorReportTrackingId(report);
              const prepared = getPreparedStagesForReport(
                report,
                preparedByReportTrackingId
              );
              const nextStage = getNextRequiredInspectorLetterStage(
                report,
                prepared
              );
              const alert = alertsByReportId.get(report.id);
              const notificationRows =
                notificationsByDocumentId[documentId] ?? [];

              return (
                <article
                  key={report.id}
                  className="rounded-md border border-forte-border p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-forte-text">
                        {report.document_name ?? "תסקיר בודק"}
                      </p>
                      <p className="text-[11px] text-forte-text-secondary mt-0.5">
                        {formatInspectorReportDate(report.report_date)}
                        {report.inspector_name
                          ? ` · ${report.inspector_name}`
                          : ""}
                        {" · "}
                        {elevatorLabel(report.elevator_id, elevatorNameById)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                        report.status === "open" && report.has_remarks
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : report.status === "closed"
                            ? "bg-green-50 text-green-800 border-green-200"
                            : "bg-forte-blue-light/40 text-forte-text-secondary border-forte-border"
                      }`}
                    >
                      {report.status === "open" && report.has_remarks
                        ? "מעקב הערות פעיל"
                        : report.status === "closed"
                          ? "נסגר לאחר טיפול"
                          : "ללא מעקב הערות"}
                    </span>
                  </div>

                  {alert && (
                    <InspectorFollowUpAlertBanner
                      buildingId={buildingId}
                      alert={alert}
                      compact
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-forte-text-secondary">
                    <p>
                      מועד יעד:{" "}
                      {report.has_remarks
                        ? formatInspectorDeadline(report.deadline_at)
                        : "—"}
                    </p>
                    <p>
                      מועד הבדיקה הבאה:{" "}
                      <span
                        className={
                          nextStatus === "overdue"
                            ? "font-semibold text-red-700"
                            : ""
                        }
                      >
                        {formatNextInspectionDate(nextDate)}
                        {nextStatus === "overdue" && " · בדיקה נדרשת"}
                      </span>
                    </p>
                    <p>
                      הערות לתיקון: {report.has_remarks ? "כן" : "לא"}
                    </p>
                    {nextStage && (
                      <p>
                        מכתב נדרש: {getInspectorLetterStageLabel(nextStage)}
                      </p>
                    )}
                  </div>

                  {notificationRows.length > 0 && (
                    <div className="text-[10px] text-forte-text-secondary space-y-0.5">
                      {notificationRows.map((row) => (
                        <p key={row.id}>
                          {getInspectorNotificationSentLabel(row.notification_type)}
                          {isInspectorLegacyNotificationType(
                            row.notification_type
                          )
                            ? " (היסטורי)"
                            : ""}
                        </p>
                      ))}
                    </div>
                  )}

                  {documentUrl && (
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex text-xs font-semibold text-forte-text border border-forte-border rounded-md px-2.5 py-1 hover:bg-forte-blue-light/40"
                    >
                      פתח מסמך
                    </a>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleDelete(report.id)}
                      disabled={actionId === report.id}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      מחק
                    </button>
                  </div>

                  {report.status === "open" && report.has_remarks && (
                    <div className="space-y-2 pt-1 border-t border-forte-border/60">
                      <input
                        value={closureNotes[report.id] ?? ""}
                        onChange={(event) =>
                          setClosureNotes((prev) => ({
                            ...prev,
                            [report.id]: event.target.value,
                          }))
                        }
                        placeholder="הערות סגירה (אופציונלי)"
                        className="form-input text-xs py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() => void handleClose(report.id)}
                        disabled={actionId === report.id}
                        className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        סגור מעקב לאחר טיפול
                      </button>
                    </div>
                  )}

                  {report.status === "closed" && (
                    <p className="text-[11px] text-emerald-800">
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

      <ProjectDocumentsPanel
        buildingId={buildingId}
        section="inspections"
        title="מסמכי בדיקה נוספים"
        uploadButtonLabel="+ מסמך בדיקה נוסף"
        emptyMessage="אין מסמכי בדיקה נוספים. ניתן להעלות אישור בודק, התכתבות וכו׳."
        additionalInspectionOnly
        compact
      />

      <MasterProjectV2InspectorReportDialog
        open={uploadOpen}
        buildingId={buildingId}
        elevatorOptions={elevatorOptions}
        onClose={() => setUploadOpen(false)}
        onCreated={(createdMessage) => {
          setMessage(createdMessage);
          void refresh();
        }}
      />
    </ForteV2TabShell>
  );
}
