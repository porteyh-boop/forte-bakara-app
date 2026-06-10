"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { getAllBuildingIds } from "@/lib/buildings";
import { getLiveBuildingListItems } from "@/lib/data";
import { syncAllSubmittedReportsWithCloud } from "@/lib/report-cloud-sync";
import { getSubmittedReports } from "@/lib/report-storage";
import type { Fault } from "@/lib/types";

function loadAllSubmittedReportsLocal(): Record<string, Fault[]> {
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

  const refresh = useCallback(async () => {
    if (!buildingReady || !catalogReady) return;
    try {
      const ids = getAllBuildingIds();
      const synced = await syncAllSubmittedReportsWithCloud(ids);
      setReportsByBuilding(synced);
    } catch {
      setReportsByBuilding(loadAllSubmittedReportsLocal());
    } finally {
      setReady(true);
    }
  }, [buildingReady, catalogReady]);

  useEffect(() => {
    if (!buildingReady || !catalogReady) {
      setReportsByBuilding({});
      setReady(false);
      return;
    }

    setReady(false);
    void refresh();

    function onReportsUpdated() {
      void refresh();
    }

    function onBuildingChanged() {
      setReady(false);
      void refresh();
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
