"use client";

import { useCallback } from "react";
import StatisticsContent from "@/components/statistics/StatisticsContent";
import { fetchClientPortalStatistics } from "@/lib/client-portal-api-client";
import type { ClientAccessRecord } from "@/lib/client-access";
import type { Elevator } from "@/lib/types";

interface ClientPortalStatisticsSectionProps {
  portalToken: string;
  buildingId: string;
  buildingName: string;
  access: Pick<ClientAccessRecord, "access_level" | "elevator_id">;
  elevators: Elevator[];
}

export default function ClientPortalStatisticsSection({
  portalToken,
  buildingId,
  buildingName,
  access,
  elevators,
}: ClientPortalStatisticsSectionProps) {
  const filterRows = useCallback(
    (rows: Parameters<NonNullable<Parameters<typeof StatisticsContent>[0]["filterRows"]>>[0]) => {
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

  const loadRows = useCallback(async () => {
    const result = await fetchClientPortalStatistics(portalToken);
    if (!result.ok) {
      return { ok: false as const, reason: "fetch_failed" as const };
    }
    return { ok: true as const, rows: result.data.rows };
  }, [portalToken]);

  return (
    <StatisticsContent
      buildingId={buildingId}
      buildingName={buildingName}
      filterRows={filterRows}
      loadRows={loadRows}
    />
  );
}
