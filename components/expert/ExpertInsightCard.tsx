import type { ExpertInsight } from "@/lib/types";

const severityStyles = {
  גבוה: "border-red-200 bg-red-50/50",
  בינוני: "border-amber-200 bg-amber-50/50",
  נמוך: "border-slate-200 bg-slate-50/50",
};

const severityBadge = {
  גבוה: "bg-red-100 text-red-700",
  בינוני: "bg-amber-100 text-amber-700",
  נמוך: "bg-slate-100 text-slate-600",
};

interface ExpertInsightCardProps {
  insight: ExpertInsight;
  index?: number;
}

export default function ExpertInsightCard({
  insight,
  index = 0,
}: ExpertInsightCardProps) {
  return (
    <article
      className={`rounded-2xl border p-4 animate-fade-up ${severityStyles[insight.severity]}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-semibold text-navy/50 uppercase tracking-wide">
          {insight.category}
        </span>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${severityBadge[insight.severity]}`}
        >
          {insight.severity}
        </span>
      </div>
      <p className="text-sm text-navy leading-relaxed font-medium">
        {insight.text}
      </p>
    </article>
  );
}
