"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { filterFaultsForLiveStart } from "@/lib/building-live";
import { syncSubmittedReportsWithCloud } from "@/lib/report-cloud-sync";
import { getSubmittedReports } from "@/lib/report-storage";
import type { Fault } from "@/lib/types";

export function useSubmittedReports(liveStartedAt: string | null = null) {
  const { buildingId, isReady } = useBuilding();
  const [submitted, setSubmitted] = useState<Fault[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!isReady) return;
    try {
      const reports = await syncSubmittedReportsWithCloud(
        buildingId,
        liveStartedAt
      );
      setSubmitted(reports);
    } catch {
      const local = getSubmittedReports(buildingId);
      setSubmitted(filterFaultsForLiveStart(local, liveStartedAt));
    } finally {
      setReady(true);
    }
  }, [buildingId, isReady, liveStartedAt]);

  useEffect(() => {
    if (!isReady) {
      setSubmitted([]);
      setReady(false);
      return;
    }

    setReady(false);
    void refresh();

    function onReportsUpdated(e: Event) {
      const detail = (e as CustomEvent<{ buildingId?: string }>).detail;
      if (!detail?.buildingId || detail.buildingId === buildingId) {
        void refresh();
      }
    }

    window.addEventListener("forte-reports-updated", onReportsUpdated);
    return () => {
      window.removeEventListener("forte-reports-updated", onReportsUpdated);
    };
  }, [buildingId, isReady, liveStartedAt, refresh]);

  return { submitted, ready: isReady && ready, refresh };
}
