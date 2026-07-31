"use client";

import type { FaultTypeStat } from "@/lib/statistics";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface FaultTypeChartProps {
  data: FaultTypeStat[];
}

function renderLegendText(
  value: string,
  entry: { payload?: { type?: string; count?: number; percentage?: number } }
) {
  const item = entry.payload as FaultTypeStat | undefined;
  if (!item) return value;
  return `${item.type} · ${item.count} · ${item.percentage}%`;
}

export default function FaultTypeChart({ data }: FaultTypeChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-bold text-navy mb-4">חלוקת תקלות לפי סוג</h3>
        <p className="text-sm text-gray-text text-center py-10">אין תקלות להצגה בגרף</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-navy mb-4">חלוקת תקלות לפי סוג</h3>
      <div className="h-80 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              cx="50%"
              cy="46%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.type} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const payload = item.payload as FaultTypeStat;
                const count = typeof value === "number" ? value : Number(value ?? 0);
                return [`${count} (${payload.percentage}%)`, payload.type];
              }}
            />
            <Legend
              verticalAlign="bottom"
              formatter={(value, entry) => renderLegendText(String(value), entry)}
              wrapperStyle={{ fontSize: "12px", color: "#0d1b3e", lineHeight: "1.6" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
