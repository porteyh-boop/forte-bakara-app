"use client";

import type { ReactNode } from "react";
import type { ElevatorFaultStat } from "@/lib/statistics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

interface ElevatorChartProps {
  data: ElevatorFaultStat[];
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

export default function ElevatorChart({ data, compact = false }: ElevatorChartProps) {
  if (data.length === 0) {
    return chartShell(
      compact,
      "תקלות לפי מעלית",
      <p className={`text-sm text-gray-text text-center ${compact ? "py-8" : "py-10"}`}>
        אין תקלות להצגה בגרף
      </p>
    );
  }

  const chartHeight = compact ? undefined : Math.max(220, data.length * 44);
  const innerHeight = compact ? Math.max(176, data.length * 36) : chartHeight;

  return chartShell(
    compact,
    "תקלות לפי מעלית",
    <div
      className={`w-full min-h-0 ${compact ? "flex-1 overflow-y-auto overflow-x-hidden" : ""}`}
      dir="ltr"
      style={compact ? { maxHeight: "11rem" } : { height: chartHeight }}
    >
      <div style={{ height: innerHeight, minHeight: compact ? "100%" : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: compact ? 22 : 28, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e9" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#6b7280", fontSize: compact ? 10 : 11 }}
            />
            <YAxis
              type="category"
              dataKey="elevatorName"
              width={compact ? 88 : 108}
              tick={{ fill: "#0d1b3e", fontSize: compact ? 10 : 11 }}
            />
            <Bar
              dataKey="count"
              fill="#c9a962"
              radius={[0, compact ? 4 : 6, compact ? 4 : 6, 0]}
              maxBarSize={compact ? 18 : 24}
            >
              <LabelList
                dataKey="count"
                position="right"
                fill="#0d1b3e"
                fontSize={compact ? 10 : 11}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
