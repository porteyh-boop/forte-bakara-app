"use client";

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
}

export default function ElevatorChart({ data }: ElevatorChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4">תקלות לפי מעלית</h3>
        <p className="text-sm text-gray-text text-center py-10">אין תקלות להצגה בגרף</p>
      </div>
    );
  }

  const chartHeight = Math.max(220, data.length * 44);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-navy mb-4">תקלות לפי מעלית</h3>
      <div className="w-full" dir="ltr" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e9" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="elevatorName"
              width={108}
              tick={{ fill: "#0d1b3e", fontSize: 11 }}
            />
            <Bar dataKey="count" fill="#c9a962" radius={[0, 6, 6, 0]} maxBarSize={24}>
              <LabelList
                dataKey="count"
                position="right"
                fill="#0d1b3e"
                fontSize={11}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
