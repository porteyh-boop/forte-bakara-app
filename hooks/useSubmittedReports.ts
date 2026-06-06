"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { getSubmittedReports } from "@/lib/report-storage";
import type { Fault } from "@/lib/types";

export function useSubmittedReports() {
  const { buildingId, ready: buildingReady } = useBuilding();
  const [submitted, setSubmitted] = useState<Fault[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!buildingReady) return;
    setSubmitted(getSubmittedReports(buildingId));
    setReady(true);
  }, [buildingId, buildingReady]);

  useEffect(() => {
    if (!buildingReady) {
      setSubmitted([]);
      setReady(false);
      return;
    }

    refresh();

    function onReportsUpdated(e: Event) {
      const detail = (e as CustomEvent<{ buildingId?: string }>).detail;
      if (!detail?.buildingId || detail.buildingId === buildingId) {
        refresh();
      }
    }

    function onBuildingChanged() {
      setReady(false);
      setSubmitted([]);
      refresh();
    }

    window.addEventListener("forte-reports-updated", onReportsUpdated);
    window.addEventListener("forte-building-changed", onBuildingChanged);
    return () => {
      window.removeEventListener("forte-reports-updated", onReportsUpdated);
      window.removeEventListener("forte-building-changed", onBuildingChanged);
    };
  }, [buildingId, buildingReady, refresh]);

  return { submitted, ready: buildingReady && ready, refresh };
}
