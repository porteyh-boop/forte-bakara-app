import Link from "next/link";
import StatusBadge from "./StatusBadge";
import { getBuildingAggregateStatus } from "@/lib/elevator-status";
import type { Building, Elevator } from "@/lib/types";

interface BuildingCardProps {
  building: Building;
  elevators: Elevator[];
  openFaultCount?: number;
  closedFaultCount?: number;
}

export default function BuildingCard({
  building,
  elevators,
  openFaultCount,
  closedFaultCount,
}: BuildingCardProps) {
  const activeCount = elevators.filter((e) => e.status === "פעילה").length;
  const disabledCount = elevators.filter((e) => e.status === "מושבתת").length;
  const buildingStatus = getBuildingAggregateStatus(elevators);

  return (
    <Link
      href="/building"
      className="block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-up hover:shadow-md transition-shadow duration-300"
    >
      <div className="h-1.5 bg-gradient-to-l from-gold via-gold/60 to-navy" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gold tracking-wide mb-1">
              {building.managementCompany}
            </p>
            <h3 className="text-lg font-bold text-navy truncate">
              {building.name}
            </h3>
            <p className="text-sm text-gray-text mt-0.5 truncate">
              {building.address}, {building.city}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-6 h-6 text-navy"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-sm text-navy/70">
            <span className="font-semibold text-navy">{building.elevatorCount}</span>
            <span>מעליות</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-sm text-navy/70">
            <span className="font-semibold text-emerald-600">{activeCount}</span>
            <span>פעילות</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-sm text-navy/70">
            <span className="font-semibold text-red-600">{disabledCount}</span>
            <span>מושבתות</span>
          </div>
          <div className="mr-auto">
            <StatusBadge
              status={buildingStatus}
              size="sm"
              pulse={buildingStatus === "מושבתת"}
            />
          </div>
        </div>
        {(openFaultCount != null || closedFaultCount != null) && (
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-text">
            {openFaultCount != null && (
              <span>
                <strong className="text-navy">{openFaultCount}</strong> פתוחות
              </span>
            )}
            {closedFaultCount != null && (
              <span>
                <strong className="text-navy">{closedFaultCount}</strong> סגורות
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
