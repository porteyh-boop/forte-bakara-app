import type { Fault } from "@/lib/types";
import { formatDate, formatRelativeDate } from "@/lib/utils";
import StatusBadge from "./StatusBadge";

interface FaultCardProps {
  fault: Fault;
  compact?: boolean;
  index?: number;
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
}: FaultCardProps) {
  const isActive = fault.status !== "טופלה";

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm animate-fade-up transition-all duration-300 hover:shadow-md ${
        fault.status === "מושבתת"
          ? "border-red-200 ring-1 ring-red-100"
          : "border-gray-200"
      } ${compact ? "p-3.5" : "p-4"}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-navy text-[15px]">{fault.type}</h3>
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
          status={fault.status}
          pulse={fault.status === "מושבתת" || fault.status === "פעילה"}
        />
      </div>

      {!compact && (
        <p className="text-sm text-navy/75 leading-relaxed">{fault.description}</p>
      )}

      <div
        className={`flex items-center justify-between ${compact ? "mt-2" : "mt-3 pt-3 border-t border-gray-100"}`}
      >
        <time className="text-xs text-gray-text" title={formatDate(fault.reportedAt)}>
          {isActive ? formatRelativeDate(fault.reportedAt) : formatDate(fault.reportedAt)}
        </time>
        {fault.reportedBy && !compact && (
          <span className="text-xs text-gray-text">{fault.reportedBy}</span>
        )}
      </div>
    </article>
  );
}
