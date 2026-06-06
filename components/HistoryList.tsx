"use client";

import { useState } from "react";
import FaultCard from "./FaultCard";
import { isClosedFault, isOpenFault } from "@/lib/fault-lifecycle";
import type { Fault } from "@/lib/types";

type Filter = "הכל" | "פתוחות" | "סגורות";

const filters: { key: Filter; label: string }[] = [
  { key: "הכל", label: "הכל" },
  { key: "פתוחות", label: "פתוחות" },
  { key: "סגורות", label: "סגורות" },
];

function matchesFilter(fault: Fault, filter: Filter) {
  if (filter === "הכל") return true;
  if (filter === "פתוחות") return isOpenFault(fault);
  return isClosedFault(fault);
}

interface HistoryListProps {
  faults: Fault[];
  onCloseFault?: (fault: Fault) => void;
  closingFaultId?: string | null;
}

export default function HistoryList({
  faults,
  onCloseFault,
  closingFaultId,
}: HistoryListProps) {
  const [filter, setFilter] = useState<Filter>("הכל");

  const sorted = [...faults]
    .filter((f) => matchesFilter(f, filter))
    .sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );

  const counts = {
    הכל: faults.length,
    פתוחות: faults.filter((f) => isOpenFault(f)).length,
    סגורות: faults.filter((f) => isClosedFault(f)).length,
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
            <FaultCard
              key={fault.id}
              fault={fault}
              index={i}
              onClose={onCloseFault}
              closing={closingFaultId === fault.id}
            />
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
