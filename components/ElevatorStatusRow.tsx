import StatusBadge from "./StatusBadge";
import type { Elevator } from "@/lib/types";

interface ElevatorStatusRowProps {
  elevators: Elevator[];
}

export default function ElevatorStatusRow({ elevators }: ElevatorStatusRowProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 animate-fade-up animation-delay-100">
      {elevators.map((elevator, i) => (
        <div
          key={elevator.id}
          className="flex items-center justify-between px-4 py-3.5 animate-fade-up"
          style={{ animationDelay: `${(i + 1) * 60}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center">
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
            <div>
              <p className="text-sm font-semibold text-navy">{elevator.name}</p>
              {elevator.floor && (
                <p className="text-xs text-gray-text">{elevator.floor}</p>
              )}
            </div>
          </div>
          <StatusBadge
            status={elevator.status}
            pulse={elevator.status === "מושבתת"}
          />
        </div>
      ))}
    </div>
  );
}
