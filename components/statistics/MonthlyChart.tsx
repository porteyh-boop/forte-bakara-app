"use client";

import type { ReactNode } from "react";
import type { MonthlyFaultStat } from "@/lib/statistics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

interface MonthlyChartProps {
  data: MonthlyFaultStat[];
  compact?: boolean;
}

function chartShell(compact: boolean, title: string, children: ReactNode) {
  return (
    <div
      className={
        compact
          ? "bg-white rounded-xl border border-gray-200 p-3 shadow-sm h-full flex flex-col min-h-[17.5rem]"
          : "bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
      }
    >
      <h3 className={`text-sm font-bold text-navy ${compact ? "mb-2 shrink-0" : "mb-4"}`}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function MonthlyChart({ data, compact = false }: MonthlyChartProps) {
  return chartShell(
    compact,
    "תקלות לפי חודש",
    <div className={`w-full min-h-0 ${compact ? "flex-1 h-44" : "h-64"}`} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: compact ? 16 : 24, right: 4, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e9" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{ fill: "#6b7280", fontSize: compact ? 10 : 11 }}
            interval={0}
            angle={compact ? -40 : -35}
            textAnchor="end"
            height={compact ? 48 : 56}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#6b7280", fontSize: compact ? 10 : 11 }}
            width={compact ? 28 : 32}
          />
          <Bar
            dataKey="count"
            fill="#0d1b3e"
            radius={[compact ? 4 : 6, compact ? 4 : 6, 0, 0]}
            maxBarSize={compact ? 28 : 36}
          >
            <LabelList
              dataKey="count"
              position="top"
              fill="#0d1b3e"
              fontSize={compact ? 10 : 11}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
