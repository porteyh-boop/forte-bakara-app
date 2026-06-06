import type { FaultLifecycleStats } from "@/lib/fault-stats";

interface ExpertLifecycleStatsProps {
  stats: FaultLifecycleStats;
}

export default function ExpertLifecycleStats({ stats }: ExpertLifecycleStatsProps) {
  const items = [
    { label: "תקלות פתוחות", value: String(stats.openFaults) },
    { label: "תקלות סגורות", value: String(stats.closedFaults) },
    { label: "זמן טיפול ממוצע", value: `${stats.avgTreatmentHours} שעות` },
    { label: "זמן השבתה ממוצע", value: `${stats.avgDowntimeHours} שעות` },
    { label: "אחוז זמינות", value: `${stats.availabilityPercent}%` },
    { label: "נסגרו החודש", value: String(stats.closedThisMonth) },
    {
      label: "נפתרו תוך 24 שעות",
      value: `${stats.resolvedWithin24hPercent}%`,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between px-4 py-3.5"
        >
          <span className="text-sm text-navy/70">{item.label}</span>
          <span className="text-sm font-bold text-navy">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
