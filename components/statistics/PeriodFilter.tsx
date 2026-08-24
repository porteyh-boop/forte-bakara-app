"use client";

import type { StatisticsPeriod } from "@/lib/statistics";
import { STATISTICS_PERIOD_OPTIONS } from "@/lib/statistics";

interface PeriodFilterProps {
  value: StatisticsPeriod;
  onChange: (period: StatisticsPeriod) => void;
  /** Inline filter for compact dashboard layouts. */
  compact?: boolean;
}

export default function PeriodFilter({ value, onChange, compact = false }: PeriodFilterProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label
          htmlFor="statistics-period"
          className="text-xs font-semibold text-gray-text shrink-0"
        >
          תקופה
        </label>
        <select
          id="statistics-period"
          value={value}
          onChange={(event) => onChange(event.target.value as StatisticsPeriod)}
          className="form-input text-sm min-w-[9rem] max-w-xs flex-1 sm:flex-none sm:w-44"
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
