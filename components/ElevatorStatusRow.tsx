import StatusBadge from "./StatusBadge";
import type { ElevatorFaultCounts } from "@/lib/elevator-stats";
import type { Elevator } from "@/lib/types";

interface ElevatorStatusRowProps {
  elevators: Elevator[];
  faultCounts?: Record<string, ElevatorFaultCounts>;
  /** On lg+ (desktop) show a multi-column card grid instead of a single stacked list */
  responsiveGrid?: boolean;
}

export default function ElevatorStatusRow({
  elevators,
  faultCounts,
  responsiveGrid = false,
}: ElevatorStatusRowProps) {
  const count = elevators.length;
  const desktopGridClass = !responsiveGrid
    ? ""
    : count <= 1
      ? "lg:grid-cols-1 lg:gap-4"
      : count === 2
        ? "lg:grid-cols-2 lg:gap-5"
        : "lg:grid-cols-2 lg:gap-4 xl:grid-cols-3 xl:gap-4";

  const containerClass = responsiveGrid
    ? `animate-fade-up animation-delay-100 bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 lg:divide-y-0 lg:border-0 lg:bg-transparent lg:shadow-none lg:grid lg:w-full lg:min-w-0 ${desktopGridClass}`
    : "bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 animate-fade-up animation-delay-100";

  const itemClass = responsiveGrid
    ? "px-4 py-3.5 animate-fade-up lg:bg-white lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-sm lg:px-5 lg:py-4 lg:min-h-[5.25rem] lg:h-full"
    : "px-4 py-3.5 animate-fade-up";

  return (
    <div className={containerClass}>
      {elevators.map((elevator, i) => {
        const counts = faultCounts?.[elevator.id];
        return (
          <div
            key={elevator.id}
            className={itemClass}
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center shrink-0 lg:w-10 lg:h-10">
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
