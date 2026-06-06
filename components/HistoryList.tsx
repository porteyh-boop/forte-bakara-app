"use client";

import { useState } from "react";
import FaultCard from "./FaultCard";
import type { Fault } from "@/lib/types";

type Filter = "הכל" | "פעילות" | "טופלו";

const filters: { key: Filter; label: string }[] = [
  { key: "הכל", label: "הכל" },
  { key: "פעילות", label: "פעילות" },
  { key: "טופלו", label: "טופלו" },
];

function matchesFilter(fault: Fault, filter: Filter) {
  if (filter === "הכל") return true;
  if (filter === "פעילות") return fault.status !== "טופלה";
  return fault.status === "טופלה";
}

interface HistoryListProps {
  faults: Fault[];
}

export default function HistoryList({ faults }: HistoryListProps) {
  const [filter, setFilter] = useState<Filter>("הכל");

  const sorted = [...faults]
    .filter((f) => matchesFilter(f, filter))
    .sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );

  const counts = {
    הכל: faults.length,
    פעילות: faults.filter((f) => f.status !== "טופלה").length,
    טופלו: faults.filter((f) => f.status === "טופלה").length,
  };

  return (
    <>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 animate-fade-up">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`filter-tab ${
              filter === f.key ? "filter-tab-active" : "filter-tab-inactive"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {sorted.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sorted.map((fault, i) => (
            <FaultCard key={fault.id} fault={fault} index={i} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-fade-up">
          <p className="text-sm font-medium text-navy">אין תקלות בקטגוריה זו</p>
        </div>
      )}
    </>
  );
}
