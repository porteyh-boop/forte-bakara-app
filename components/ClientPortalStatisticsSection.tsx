"use client";

import { useCallback } from "react";
import StatisticsContent from "@/components/statistics/StatisticsContent";
import type { ClientAccessRecord } from "@/lib/client-access";
import type { StatisticsFaultRow } from "@/lib/statistics";
import type { Elevator } from "@/lib/types";

interface ClientPortalStatisticsSectionProps {
  buildingId: string;
  buildingName: string;
  access: Pick<ClientAccessRecord, "access_level" | "elevator_id">;
  elevators: Elevator[];
}

export default function ClientPortalStatisticsSection({
  buildingId,
  buildingName,
  access,
  elevators,
}: ClientPortalStatisticsSectionProps) {
  const filterRows = useCallback(
    (rows: StatisticsFaultRow[]) => {
      if (access.access_level !== "elevator" || !access.elevator_id) {
        return rows;
      }

      const lockedElevator = elevators.find(
        (elevator) => elevator.id === access.elevator_id
      );
      if (!lockedElevator) {
        return rows;
      }

      return rows.filter(
        (row) => (row.elevator_name?.trim() || "לא צוין") === lockedElevator.name
      );
    },
    [access.access_level, access.elevator_id, elevators]
  );

  return (
    <StatisticsContent
      buildingId={buildingId}
      buildingName={buildingName}
      filterRows={filterRows}
    />
  );
}
