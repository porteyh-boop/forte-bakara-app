import type { Fault } from "@/lib/types";
import { getLifecycleStatus } from "@/lib/fault-lifecycle";
import { resolveFaultReportImagesFromFault } from "@/lib/fault-images";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import {
  FaultReportImageThumbnails,
  useFaultReportImageViewer,
} from "./FaultReportImageSection";
import StatusBadge from "./StatusBadge";

interface FaultCardProps {
  fault: Fault;
  compact?: boolean;
  index?: number;
  onClose?: (fault: Fault) => void;
  closing?: boolean;
}

const priorityStyles = {
  דחופה: "text-red-600 bg-red-50 border-red-100",
  רגילה: "text-navy/70 bg-gray-light border-gray-200",
  נמוכה: "text-gray-text bg-white border-gray-200",
};

export default function FaultCard({
  fault,
  compact = false,
  index = 0,
  onClose,
  closing = false,
}: FaultCardProps) {
  const lifecycleStatus = getLifecycleStatus(fault);
  const isActive = lifecycleStatus !== "סגורה";
  const reportImages = resolveFaultReportImagesFromFault(fault);
  const imageViewer = useFaultReportImageViewer(reportImages);

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm animate-fade-up transition-all duration-300 hover:shadow-md ${
        fault.status === "מושבתת" || fault.isDisabled
          ? "border-red-200 ring-1 ring-red-100"
          : "border-gray-200"
      } ${compact ? "p-3.5" : "p-4"}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-navy text-[15px]">{fault.type}</h3>
            {fault.ticketNumber && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gold/15 text-navy border border-gold/25">
                {fault.ticketNumber}
              </span>
            )}
            {fault.isUserSubmitted && isActive && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                דיווח חדש
              </span>
            )}
            {isActive && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${priorityStyles[fault.priority]}`}
              >
                {fault.priority}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-text mt-0.5">{fault.elevatorName}</p>
        </div>
        <StatusBadge
          status={lifecycleStatus}
          pulse={isActive && lifecycleStatus === "פתוחה"}
        />
      </div>

      {!compact && (
        <p className="text-sm text-navy/75 leading-relaxed">{fault.description}</p>
      )}

      <FaultReportImageThumbnails
        images={reportImages}
        compact={compact}
        onOpen={imageViewer.openImage}
      />
      {imageViewer.lightbox}

      {fault.resolvedAt && (
        <p className="text-xs text-gray-text mt-2">
          נסגרה: {formatDate(fault.resolvedAt)}
          {fault.durationHours != null && (
            <span className="mr-2"> · משך טיפול: {fault.durationHours} שעות</span>
          )}
        </p>
      )}

      <div
        className={`flex items-center justify-between gap-2 ${compact ? "mt-2" : "mt-3 pt-3 border-t border-gray-100"}`}
      >
        <time className="text-xs text-gray-text" title={formatDate(fault.reportedAt)}>
          {isActive ? formatRelativeDate(fault.reportedAt) : formatDate(fault.reportedAt)}
        </time>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {fault.reportedBy && !compact && (
            <span className="text-xs text-gray-text">{fault.reportedBy}</span>
          )}
          {imageViewer.hasImages && onClose && (
            <>
              <button
                type="button"
                onClick={() => imageViewer.openImage(0)}
                className="text-xs font-semibold border border-gray-200 text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                פתח תמונה
              </button>
              <button
                type="button"
                onClick={() => void imageViewer.downloadImage(0)}
                disabled={imageViewer.downloading}
                className="text-xs font-semibold border border-gray-200 text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {imageViewer.downloading ? "מוריד..." : "הורד תמונה"}
              </button>
            </>
          )}
          {isActive && onClose && (
            <button
              type="button"
              onClick={() => onClose(fault)}
              disabled={closing}
              className="text-xs font-semibold text-white bg-navy hover:bg-navy-light px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {closing ? "סוגר..." : "סגור תקלה"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
