"use client";

import type { StatisticsPeriod } from "@/lib/statistics";
import { STATISTICS_PERIOD_OPTIONS } from "@/lib/statistics";

interface PeriodFilterProps {
  value: StatisticsPeriod;
  onChange: (period: StatisticsPeriod) => void;
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <label htmlFor="statistics-period" className="text-xs font-semibold text-gray-text block mb-2">
        תקופה
      </label>
      <select
        id="statistics-period"
        value={value}
        onChange={(event) => onChange(event.target.value as StatisticsPeriod)}
        className="form-input text-sm w-full"
      >
        {STATISTICS_PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
