import type { ExpertMetric } from "@/lib/types";

interface ExpertMetricCardProps {
  metric: ExpertMetric;
  index?: number;
}

export default function ExpertMetricCard({
  metric,
  index = 0,
}: ExpertMetricCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <p className="text-xs text-gray-text mb-1">{metric.label}</p>
      <p className="text-xl font-bold text-navy">{metric.value}</p>
      {metric.trend && (
        <p
          className={`text-xs font-medium mt-1 ${
            metric.trendUp ? "text-red-600" : "text-emerald-600"
          }`}
        >
          {metric.trend}
        </p>
      )}
    </div>
  );
}
