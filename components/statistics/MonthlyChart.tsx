"use client";

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
}

export default function MonthlyChart({ data }: MonthlyChartProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-navy mb-4">תקלות לפי חודש</h3>
      <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e9" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                width={32}
              />
              <Bar dataKey="count" fill="#0d1b3e" radius={[6, 6, 0, 0]} maxBarSize={36}>
                <LabelList
                  dataKey="count"
                  position="top"
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
