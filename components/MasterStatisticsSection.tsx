"use client";

import { useBuilding } from "@/components/BuildingProvider";
import StatisticsContent from "@/components/statistics/StatisticsContent";

export default function MasterStatisticsSection() {
  const { buildingId, ctx } = useBuilding();

  return (
    <StatisticsContent buildingId={buildingId} buildingName={ctx.building.name} />
  );
}
