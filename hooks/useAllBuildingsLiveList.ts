"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { getAllBuildingIds } from "@/lib/buildings";
import { resolveAllLiveStartedAt } from "@/lib/building-live";
import { getLiveBuildingListItems } from "@/lib/data";
import { syncAllSubmittedReportsWithCloud } from "@/lib/report-cloud-sync";
import { getSubmittedReports } from "@/lib/report-storage";
import type { Fault } from "@/lib/types";
import { BUILDING_LIVE_STARTED_EVENT } from "./useBuildingLiveStarted";

function loadAllSubmittedReportsLocal(
  liveStartedAtByBuilding: Record<string, string | null>
): Record<string, Fault[]> {
  const map: Record<string, Fault[]> = {};
  for (const id of getAllBuildingIds()) {
    map[id] = getSubmittedReports(id);
    if (liveStartedAtByBuilding[id]) {
      map[id] = map[id].filter(
        (fault) =>
          new Date(fault.reportedAt).getTime() >=
          new Date(liveStartedAtByBuilding[id]!).getTime()
      );
    }
  }
  return map;
}

export function useAllBuildingsLiveList() {
  const { isReady } = useBuilding();
  const [reportsByBuilding, setReportsByBuilding] = useState<
    Record<string, Fault[]>
  >({});
  const [liveStartedAtByBuilding, setLiveStartedAtByBuilding] = useState<
    Record<string, string | null>
  >({});
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!isReady) return;
    try {
      const ids = getAllBuildingIds();
      const liveMap = resolveAllLiveStartedAt(ids);
      setLiveStartedAtByBuilding(liveMap);
      const synced = await syncAllSubmittedReportsWithCloud(ids, liveMap);
      setReportsByBuilding(synced);
    } catch {
      const ids = getAllBuildingIds();
      const liveMap = resolveAllLiveStartedAt(ids);
      setLiveStartedAtByBuilding(liveMap);
      setReportsByBuilding(loadAllSubmittedReportsLocal(liveMap));
    } finally {
      setReady(true);
    }
  }, [isReady]);

  useEffect(() => {
    if (!isReady) {
      setReportsByBuilding({});
      setLiveStartedAtByBuilding({});
      setReady(false);
      return;
    }

    setReady(false);
    void refresh();

    function onReportsUpdated() {
      void refresh();
    }

    function onLiveStarted() {
      void refresh();
    }

    window.addEventListener("forte-reports-updated", onReportsUpdated);
    window.addEventListener(BUILDING_LIVE_STARTED_EVENT, onLiveStarted);
    return () => {
      window.removeEventListener("forte-reports-updated", onReportsUpdated);
      window.removeEventListener(BUILDING_LIVE_STARTED_EVENT, onLiveStarted);
    };
  }, [isReady, refresh]);

  const buildings = useMemo(
    () =>
      getLiveBuildingListItems(
        reportsByBuilding,
        isReady && ready,
        undefined,
        liveStartedAtByBuilding
      ),
    [reportsByBuilding, liveStartedAtByBuilding, isReady, ready]
  );

  return {
    buildings,
    ready: isReady && ready,
    refresh,
  };
}
