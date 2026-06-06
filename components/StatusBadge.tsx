import type { FaultStatus, Status } from "@/lib/types";

type BadgeStatus = Status | FaultStatus;

const statusConfig: Record<
  BadgeStatus,
  { bg: string; text: string; dot: string; border: string }
> = {
  פתוחה: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
  },
  פעילה: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
  },
  בטיפול: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    border: "border-amber-200",
  },
  מושבתת: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
    border: "border-red-200",
  },
  סגורה: {
    bg: "bg-slate-50",
    text: "text-slate-600",
    dot: "bg-slate-400",
    border: "border-slate-200",
  },
  טופלה: {
    bg: "bg-slate-50",
    text: "text-slate-600",
    dot: "bg-slate-400",
    border: "border-slate-200",
  },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  size?: "sm" | "md";
  pulse?: boolean;
}

export default function StatusBadge({
  status,
  size = "sm",
  pulse = false,
}: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.פתוחה;
  const sizeClass = size === "sm" ? "text-xs px-2.5 py-0.5" : "text-sm px-3 py-1";
  const isClosed = status === "סגורה" || status === "טופלה";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bg} ${config.text} ${config.border} ${sizeClass}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && !isClosed && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${config.dot}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
      </span>
      {status}
    </span>
  );
}
