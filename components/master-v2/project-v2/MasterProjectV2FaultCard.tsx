"use client";

import { useState } from "react";
import {
  FaultReportImageThumbnails,
  useFaultReportImageViewer,
} from "@/components/FaultReportImageSection";
import StatusBadge from "@/components/StatusBadge";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  canStartPilotFaultTreatment,
  isPilotFaultClosedStatus,
} from "@/lib/fault-lifecycle";
import { resolveFaultReportImagesFromCloud } from "@/lib/fault-images";
import {
  FAULT_NOTIFICATION_EVENT_LABELS,
  formatFaultNotificationTimestamp,
  type FaultNotificationRecord,
} from "@/lib/fault-notifications";
import type { PilotCloudFault } from "@/lib/pilot-cloud";
import type { FaultStatus } from "@/lib/types";

function formatFaultSource(source: string | null): string {
  if (!source?.trim()) return "דיווח ישיר";
  return source.trim();
}

function faultStatusForBadge(status: string): FaultStatus {
  if (
    status === "פתוחה" ||
    status === "בטיפול" ||
    status === "סגורה" ||
    status === "טופלה" ||
    status === "מושבתת" ||
    status === "פעילה"
  ) {
    return status;
  }
  return "פתוחה";
}

interface MasterProjectV2FaultCardProps {
  fault: PilotCloudFault;
  highlighted?: boolean;
  notifications?: FaultNotificationRecord[];
  actionId: string | null;
  formatDate: (iso: string) => string;
  onStartTreatment: (faultId: string, treatmentNote?: string | null) => void;
  onUpdateTreatmentNote: (faultId: string, treatmentNote: string) => void;
  onClose: (faultId: string, closureNote?: string | null) => void;
  onReopen: (faultId: string) => void;
  onDelete: (faultId: string) => void;
}

export default function MasterProjectV2FaultCard({
  fault,
  highlighted = false,
  notifications = [],
  actionId,
  formatDate,
  onStartTreatment,
  onUpdateTreatmentNote,
  onClose,
  onReopen,
  onDelete,
}: MasterProjectV2FaultCardProps) {
  const reportImages = resolveFaultReportImagesFromCloud(fault);
  const imageViewer = useFaultReportImageViewer(reportImages);

  const [treatmentModalOpen, setTreatmentModalOpen] = useState(false);
  const [treatmentModalMode, setTreatmentModalMode] = useState<
    "start" | "update"
  >("start");
  const [treatmentNoteDraft, setTreatmentNoteDraft] = useState("");
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closureNoteDraft, setClosureNoteDraft] = useState("");

  const isClosed = isPilotFaultClosedStatus(fault.status);
  const inTreatment = fault.status === "בטיפול";
  const canStartTreatment = canStartPilotFaultTreatment(fault.status);
  const busy = actionId === fault.id;

  function openStartTreatmentModal() {
    setTreatmentModalMode("start");
    setTreatmentNoteDraft("");
    setTreatmentModalOpen(true);
  }

  function openUpdateTreatmentModal() {
    setTreatmentModalMode("update");
    setTreatmentNoteDraft(fault.treatment_note ?? "");
    setTreatmentModalOpen(true);
  }

  function confirmTreatmentModal() {
    if (treatmentModalMode === "start") {
      onStartTreatment(fault.id, treatmentNoteDraft);
    } else {
      onUpdateTreatmentNote(fault.id, treatmentNoteDraft);
    }
    setTreatmentModalOpen(false);
  }

  function openCloseModal() {
    setClosureNoteDraft("");
    setCloseModalOpen(true);
  }

  function confirmCloseModal() {
    onClose(fault.id, closureNoteDraft);
    setCloseModalOpen(false);
  }

  return (
    <>
      <article
        className={`fv2-card fv2-fault-card${highlighted ? " fv2-fault-card-highlighted" : ""}`}
        data-fault-id={fault.id}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="fv2-fault-card-title">{fault.fault_type}</p>
            <p className="text-xs text-forte-text-secondary">
              {fault.elevator_name}
              {fault.ticket_number ? ` · ${fault.ticket_number}` : ""}
            </p>
            <p className="text-[11px] text-forte-text-secondary mt-0.5">
              מקור: {formatFaultSource(fault.fault_source)}
            </p>
          </div>
          <StatusBadge
            status={faultStatusForBadge(fault.status)}
            size="sm"
            pulse={!isClosed && fault.status === "פתוחה"}
          />
        </div>

        <p className="text-sm text-forte-text/80 leading-relaxed">{fault.description}</p>

        {inTreatment && (
          <div className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 space-y-1">
            <p className="text-xs font-semibold text-amber-900">בטיפול</p>
            {fault.treatment_started_at && (
              <p className="text-[11px] text-amber-900/80">
                התחלת טיפול: {formatDate(fault.treatment_started_at)}
              </p>
            )}
            {fault.treatment_note?.trim() ? (
              <p className="text-xs text-forte-text/85 whitespace-pre-wrap">
                {fault.treatment_note}
              </p>
            ) : (
              <p className="text-[11px] text-forte-text-secondary">אין הערת טיפול</p>
            )}
          </div>
        )}

        {isClosed && fault.closure_note?.trim() && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700">סיכום סגירה</p>
            <p className="text-xs text-forte-text/85 whitespace-pre-wrap mt-1">
              {fault.closure_note}
            </p>
          </div>
        )}

        <FaultReportImageThumbnails
          images={reportImages}
          onOpen={imageViewer.openImage}
        />
        {imageViewer.lightbox}

        <p className="text-xs text-forte-text-secondary mt-2">
          נפתח: {formatDate(fault.created_at)}
          {fault.closed_at && (
            <span className="mr-2"> · נסגר: {formatDate(fault.closed_at)}</span>
          )}
        </p>

        {notifications.length > 0 && (
          <div className="mt-2 rounded-lg border border-forte-border bg-forte-blue-light/40 px-3 py-2 space-y-1">
            <p className="text-[11px] font-semibold text-forte-text">התראות</p>
            {notifications.slice(0, 5).map((row) => (
              <p key={row.id} className="text-[11px] text-forte-text-secondary">
                Telegram · {FAULT_NOTIFICATION_EVENT_LABELS[row.event_type]} ·{" "}
                {row.status === "sent" ? "נשלח" : "נכשל"}
                {row.sent_at
                  ? ` · ${formatFaultNotificationTimestamp(row.sent_at)}`
                  : row.created_at
                    ? ` · ${formatFaultNotificationTimestamp(row.created_at)}`
                    : ""}
                {row.status === "failed" && row.error
                  ? ` (${row.error})`
                  : ""}
              </p>
            ))}
          </div>
        )}

        <div className="fv2-list-card-actions">
          {imageViewer.hasImages && (
            <>
              <ForteV2SecondaryButton
                onClick={() => imageViewer.openImage(0)}
                size="sm"
              >
                פתח תמונה
              </ForteV2SecondaryButton>
              <ForteV2SecondaryButton
                onClick={() => void imageViewer.downloadImage(0)}
                disabled={imageViewer.downloading}
                size="sm"
              >
                {imageViewer.downloading ? "מוריד..." : "הורד תמונה"}
              </ForteV2SecondaryButton>
            </>
          )}

          {canStartTreatment && (
            <ForteV2SecondaryButton
              disabled={busy}
              onClick={openStartTreatmentModal}
              size="sm"
            >
              העבר לטיפול
            </ForteV2SecondaryButton>
          )}

          {inTreatment && (
            <ForteV2SecondaryButton
              disabled={busy}
              onClick={openUpdateTreatmentModal}
              size="sm"
            >
              עדכן הערת טיפול
            </ForteV2SecondaryButton>
          )}

          {!isClosed ? (
            <ForteV2PrimaryButton disabled={busy} onClick={openCloseModal} size="sm">
              סגור תקלה
            </ForteV2PrimaryButton>
          ) : (
            <ForteV2SecondaryButton
              disabled={busy}
              onClick={() => onReopen(fault.id)}
              size="sm"
            >
              פתח מחדש
            </ForteV2SecondaryButton>
          )}

          <ForteV2DangerButton outline disabled={busy} onClick={() => onDelete(fault.id)}>
            מחק
          </ForteV2DangerButton>
        </div>
      </article>

      {treatmentModalOpen && (
        <ForteV2DialogOverlay onClose={() => setTreatmentModalOpen(false)}>
          <ForteV2Dialog
            title={treatmentModalMode === "start" ? "העברה לטיפול" : "עדכון הערת טיפול"}
            onClose={() => setTreatmentModalOpen(false)}
          >
            <p className="text-xs text-forte-text-secondary mb-3">
              {treatmentModalMode === "start"
                ? "ניתן להוסיף הערת טיפול (אופציונלי)."
                : "עדכון הערה מקצועית לטיפול בתקלה."}
            </p>
            <textarea
              value={treatmentNoteDraft}
              onChange={(e) => setTreatmentNoteDraft(e.target.value)}
              className="fv2-input min-h-[5rem] w-full text-sm mb-4"
              placeholder="הערת טיפול / פירוט מקצועי"
            />
            <div className="flex gap-2 justify-end">
              <ForteV2SecondaryButton onClick={() => setTreatmentModalOpen(false)}>
                ביטול
              </ForteV2SecondaryButton>
              <ForteV2PrimaryButton disabled={busy} onClick={confirmTreatmentModal} size="sm">
                {treatmentModalMode === "start" ? "העבר לטיפול" : "שמור הערה"}
              </ForteV2PrimaryButton>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}

      {closeModalOpen && (
        <ForteV2DialogOverlay onClose={() => setCloseModalOpen(false)}>
          <ForteV2Dialog title="סגירת תקלה" onClose={() => setCloseModalOpen(false)}>
            <p className="text-xs text-forte-text-secondary mb-3">
              מומלץ למלא סיכום טיפול / הערת סגירה (אופציונלי).
            </p>
            <textarea
              value={closureNoteDraft}
              onChange={(e) => setClosureNoteDraft(e.target.value)}
              className="fv2-input min-h-[5rem] w-full text-sm mb-4"
              placeholder="סיכום טיפול / הערת סגירה"
            />
            <div className="flex gap-2 justify-end">
              <ForteV2SecondaryButton onClick={() => setCloseModalOpen(false)}>
                ביטול
              </ForteV2SecondaryButton>
              <ForteV2PrimaryButton disabled={busy} onClick={confirmCloseModal} size="sm">
                סגור תקלה
              </ForteV2PrimaryButton>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}
    </>
  );
}
