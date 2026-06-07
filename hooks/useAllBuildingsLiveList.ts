"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { getAllBuildingIds } from "@/lib/buildings";
import { getLiveBuildingListItems } from "@/lib/data";
import { getSubmittedReports } from "@/lib/report-storage";
import type { Fault } from "@/lib/types";

function loadAllSubmittedReports(): Record<string, Fault[]> {
  const map: Record<string, Fault[]> = {};
  for (const id of getAllBuildingIds()) {
    map[id] = getSubmittedReports(id);
  }
  return map;
}

export function useAllBuildingsLiveList() {
  const { ready: buildingReady, catalogReady } = useBuilding();
  const [reportsByBuilding, setReportsByBuilding] = useState<
    Record<string, Fault[]>
  >({});
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!buildingReady || !catalogReady) return;
    setReportsByBuilding(loadAllSubmittedReports());
    setReady(true);
  }, [buildingReady, catalogReady]);

  useEffect(() => {
    if (!buildingReady || !catalogReady) {
      setReportsByBuilding({});
      setReady(false);
      return;
    }

    refresh();

    function onReportsUpdated() {
      refresh();
    }

    function onBuildingChanged() {
      setReady(false);
      refresh();
    }

    window.addEventListener("forte-reports-updated", onReportsUpdated);
    window.addEventListener("forte-building-changed", onBuildingChanged);
    return () => {
      window.removeEventListener("forte-reports-updated", onReportsUpdated);
      window.removeEventListener("forte-building-changed", onBuildingChanged);
    };
  }, [buildingReady, catalogReady, refresh]);

  const buildings = useMemo(
    () =>
      getLiveBuildingListItems(
        reportsByBuilding,
        buildingReady && catalogReady && ready
      ),
    [reportsByBuilding, buildingReady, catalogReady, ready]
  );

  return {
    buildings,
    ready: buildingReady && catalogReady && ready,
    refresh,
  };
}
