import type { Fault } from "@/lib/types";
import { getLifecycleStatus } from "@/lib/fault-lifecycle";
import { formatFileSize } from "@/lib/report-image";
import { formatDate, formatRelativeDate } from "@/lib/utils";
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

      {fault.image && (
        <div className={`${compact ? "mt-2" : "mt-3"} rounded-xl overflow-hidden border border-gray-200 bg-gray-light`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fault.image.dataUrl}
            alt={`תמונה מצורפת: ${fault.image.name}`}
            className={`w-full object-cover ${compact ? "h-28" : "h-36"}`}
          />
          <p className="text-[10px] text-gray-text px-2 py-1.5 truncate">
            {fault.image.name} · {formatFileSize(fault.image.sizeBytes)}
          </p>
        </div>
      )}

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
        <div className="flex items-center gap-2">
          {fault.reportedBy && !compact && (
            <span className="text-xs text-gray-text">{fault.reportedBy}</span>
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
