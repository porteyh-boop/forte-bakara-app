"use client";

import { useState } from "react";
import {
  closeInspectorReportByDocumentId,
  computeInspectorFollowUpPhase,
  daysSinceReportDate,
  formatInspectorDeadline,
  formatInspectorReportDate,
  generateUrgentLetterTemplate,
  getInspectorPhaseBadgeClass,
  getInspectorPhaseLabel,
  type InspectorReportRecord,
} from "@/lib/inspector-report-tracking";
import type { DocumentInspectorMetaRecord } from "@/lib/document-inspector-meta";
import type { DocumentRecord } from "@/lib/document-center";
import {
  formatNotificationSentAt,
  getInspectorNotificationSentLabel,
  type DocumentInspectorNotificationRecord,
  type InspectorNotificationType,
} from "@/lib/document-inspector-notifications";

const NOTIFICATION_DISPLAY_ORDER: InspectorNotificationType[] = [
  "day_35",
  "day_40",
  "day_45_plus",
];

interface InspectorCreateFieldsProps {
  reportDate: string;
  inspectorName: string;
  hasRemarks: boolean;
  nextInspectionDate?: string;
  showNextInspectionDate?: boolean;
  onReportDateChange: (value: string) => void;
  onInspectorNameChange: (value: string) => void;
  onHasRemarksChange: (value: boolean) => void;
  onNextInspectionDateChange?: (value: string) => void;
}

export function InspectorCreateFields({
  reportDate,
  inspectorName,
  hasRemarks,
  nextInspectionDate = "",
  showNextInspectionDate = false,
  onReportDateChange,
  onInspectorNameChange,
  onHasRemarksChange,
  onNextInspectionDateChange,
}: InspectorCreateFieldsProps) {
  return (
    <>
      <div>
        <label className="text-xs text-gray-text">תאריך בדיקה</label>
        <input
          type="date"
          value={reportDate}
          onChange={(e) => onReportDateChange(e.target.value)}
          className="form-input mt-1"
          required
        />
      </div>
      <div>
        <label className="text-xs text-gray-text">שם בודק</label>
        <input
          value={inspectorName}
          onChange={(e) => onInspectorNameChange(e.target.value)}
          className="form-input mt-1"
          placeholder="אופציונלי"
        />
      </div>
      {showNextInspectionDate && (
        <div>
          <label className="text-xs text-gray-text">מועד הבדיקה הבאה</label>
          <input
            type="date"
            value={nextInspectionDate}
            onChange={(e) => onNextInspectionDateChange?.(e.target.value)}
            className="form-input mt-1"
          />
          <p className="text-[11px] text-gray-text mt-0.5">אופציונלי — נקבע ידנית</p>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="flex items-start gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={hasRemarks}
            onChange={(e) => onHasRemarksChange(e.target.checked)}
            className="mt-1"
          />
          <span>
            יש הערות לתיקון — פתיחת מעקב ל-45 יום (תזכורת 35 · התראה 40 ·
            מכתב בהול 45+)
          </span>
        </label>
      </div>
    </>
  );
}

interface InspectorDocumentCardProps {
  document: DocumentRecord;
  meta: DocumentInspectorMetaRecord;
  notifications: DocumentInspectorNotificationRecord[];
  buildingName: string;
  buildingAddress?: string;
  actionId: string | null;
  onClosed: (message: string) => void;
  onActionStart: (id: string) => void;
  onActionEnd: () => void;
}

export function InspectorDocumentCard({
  document,
  meta,
  notifications,
  buildingName,
  buildingAddress,
  actionId,
  onClosed,
  onActionStart,
  onActionEnd,
}: InspectorDocumentCardProps) {
  const [closureNotes, setClosureNotes] = useState("");
  const [letterPreview, setLetterPreview] = useState(false);

  const report: InspectorReportRecord = {
    id: document.id,
    document_id: document.id,
    source: "document",
    building_id: document.building_id,
    elevator_id: document.elevator_id,
    report_date: meta.report_date,
    inspector_name: meta.inspector_name,
    document_name: document.title,
    document_url: null,
    file_url: document.file_url,
    document_description: document.description,
    has_remarks: meta.has_remarks,
    deadline_at: meta.deadline_at,
    next_inspection_date: meta.next_inspection_date,
    status: meta.status,
    closed_at: meta.closed_at,
    closure_notes: meta.closure_notes,
    created_at: document.created_at,
  };

  const phase = computeInspectorFollowUpPhase(report);
  const days = daysSinceReportDate(report.report_date);
  const sentByType = Object.fromEntries(
    notifications.map((row) => [row.notification_type, row])
  ) as Partial<
    Record<InspectorNotificationType, DocumentInspectorNotificationRecord>
  >;
  const letterText = letterPreview
    ? generateUrgentLetterTemplate({
        buildingName,
        buildingAddress,
        reportDate: report.report_date,
        deadlineAt: report.deadline_at,
        documentName: report.document_name,
        inspectorName: report.inspector_name,
        daysSinceReport: days,
      })
    : "";

  async function handleClose() {
    onActionStart(document.id);
    const closed = await closeInspectorReportByDocumentId(document.id, closureNotes, {
      buildingName,
      elevatorLabel: document.elevator_id ?? "כל הבניין",
    });
    onActionEnd();
    if (!closed) {
      onClosed("סגירת המעקב נכשלה.");
      return;
    }
    onClosed("המעקב נסגר לאחר טיפול.");
  }

  async function handleCopyLetter() {
    const text = generateUrgentLetterTemplate({
      buildingName,
      buildingAddress,
      reportDate: report.report_date,
      deadlineAt: report.deadline_at,
      documentName: report.document_name,
      inspectorName: report.inspector_name,
      daysSinceReport: days,
    });
    try {
      await navigator.clipboard.writeText(text);
      onClosed("מכתב בהול ודחוף הועתק ללוח.");
    } catch {
      setLetterPreview(true);
      onClosed("לא ניתן להעתיק. השתמשו בתצוגה המקדימה.");
    }
  }

  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-navy">מעקב תסקיר בודק</p>
        <span
          className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${getInspectorPhaseBadgeClass(phase)}`}
        >
          {getInspectorPhaseLabel(phase)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-text">
        <p>תאריך בדיקה: {formatInspectorReportDate(report.report_date)}</p>
        <p>ימים מהתסקיר: {days}</p>
        <p>
          מועד יעד:{" "}
          {report.has_remarks ? formatInspectorDeadline(report.deadline_at) : "—"}
        </p>
        <p>בודק: {report.inspector_name ?? "—"}</p>
      </div>

      {NOTIFICATION_DISPLAY_ORDER.some((type) => sentByType[type]) && (
        <div className="space-y-1 pt-1 border-t border-gold/20">
          {NOTIFICATION_DISPLAY_ORDER.map((type) => {
            const row = sentByType[type];
            if (!row) return null;
            return (
              <p key={type} className="text-xs text-blue-800">
                ✓ {getInspectorNotificationSentLabel(type)} —{" "}
                {formatNotificationSentAt(row.sent_at)}
              </p>
            );
          })}
        </div>
      )}

      {phase === "urgent" && report.status === "open" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopyLetter()}
            className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50"
          >
            העתק מכתב בהול
          </button>
          <button
            type="button"
            onClick={() => setLetterPreview((value) => !value)}
            className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
          >
            {letterPreview ? "הסתר מכתב" : "הצג מכתב"}
          </button>
        </div>
      )}

      {letterText && (
        <pre className="text-xs whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-200 text-navy/90">
          {letterText}
        </pre>
      )}

      {report.status === "open" && report.has_remarks && (
        <div className="space-y-2 pt-1 border-t border-gold/20">
          <input
            value={closureNotes}
            onChange={(e) => setClosureNotes(e.target.value)}
            placeholder="הערות סגירה / תיעוד ביצוע הערות"
            className="form-input"
          />
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={actionId === document.id}
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
    </div>
  );
}
