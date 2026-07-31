"use client";

import { useBuilding } from "@/components/BuildingProvider";
import StatisticsContent from "@/components/statistics/StatisticsContent";

interface MasterStatisticsSectionProps {
  /** Master filter — "all" means no single building selected for statistics */
  masterBuildingFilter: string;
}

export default function MasterStatisticsSection({
  masterBuildingFilter,
}: MasterStatisticsSectionProps) {
  const { buildingId, ctx, isReady } = useBuilding();

  if (masterBuildingFilter === "all") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-text">
          בחרו בניין בסינון למעלה כדי להציג סטטיסטיקות לבניין הספציפי.
        </p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-text">טוען בניין פעיל...</p>
      </div>
    );
  }

  const activeBuildingId = buildingId.trim();
  if (!activeBuildingId || activeBuildingId !== masterBuildingFilter) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-text">טוען בניין פעיל...</p>
      </div>
    );
  }

  return (
    <StatisticsContent buildingId={activeBuildingId} buildingName={ctx.building.name} />
  );
}
