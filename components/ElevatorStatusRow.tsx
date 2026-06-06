import StatusBadge from "./StatusBadge";
import type { ElevatorFaultCounts } from "@/lib/elevator-stats";
import type { Elevator } from "@/lib/types";

interface ElevatorStatusRowProps {
  elevators: Elevator[];
  faultCounts?: Record<string, ElevatorFaultCounts>;
}

export default function ElevatorStatusRow({
  elevators,
  faultCounts,
}: ElevatorStatusRowProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 animate-fade-up animation-delay-100">
      {elevators.map((elevator, i) => {
        const counts = faultCounts?.[elevator.id];
        return (
          <div
            key={elevator.id}
            className="px-4 py-3.5 animate-fade-up"
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="w-4.5 h-4.5 text-navy"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7v10m8-10v10M6 7h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{elevator.name}</p>
                  <p className="text-xs text-gray-text">
                    {elevator.stations} תחנות
                  </p>
                </div>
              </div>
              <StatusBadge
                status={elevator.status}
                pulse={elevator.status === "מושבתת"}
              />
            </div>
            {counts && (
              <div className="flex items-center gap-4 mt-2 mr-12 text-xs">
                <span className="text-amber-700">
                  <strong>{counts.open}</strong> תקלות פתוחות
                </span>
                <span className="text-gray-text">
                  <strong className="text-navy">{counts.closed}</strong> סגורות
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
