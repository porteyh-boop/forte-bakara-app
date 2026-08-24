"use client";

import type { ReactNode } from "react";
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
  compact?: boolean;
}

function renderLegendText(
  value: string,
  entry: { payload?: { type?: string; count?: number; percentage?: number } }
) {
  const item = entry.payload as FaultTypeStat | undefined;
  if (!item) return value;
  return `${item.type} · ${item.count} · ${item.percentage}%`;
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

function CompactLegend({ data }: { data: FaultTypeStat[] }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden text-[11px] leading-snug text-navy">
      {data.map((item) => (
        <li key={item.type} className="flex items-start gap-1.5">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="min-w-0 break-words">
            {item.type} · {item.count} · {item.percentage}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function FaultTypeChart({ data, compact = false }: FaultTypeChartProps) {
  if (data.length === 0) {
    return chartShell(
      compact,
      "חלוקת תקלות לפי סוג",
      <p className={`text-sm text-gray-text text-center ${compact ? "py-8" : "py-10"}`}>
        אין תקלות להצגה בגרף
      </p>
    );
  }

  if (compact) {
    return chartShell(
      compact,
      "חלוקת תקלות לפי סוג",
      <div className="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="mx-auto h-36 w-full min-w-0 shrink-0 sm:mx-0 sm:h-full sm:max-h-40 sm:w-[48%]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={34}
                outerRadius={58}
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
            </PieChart>
          </ResponsiveContainer>
        </div>
        <CompactLegend data={data} />
      </div>
    );
  }

  return chartShell(
    compact,
    "חלוקת תקלות לפי סוג",
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
  );
}
