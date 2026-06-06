"use client";

import { useMemo } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { buildRuntimeBuildingContext } from "@/lib/data";
import { useSubmittedReports } from "./useSubmittedReports";

export function useRuntimeBuildingContext() {
  const { buildingId, ctx, ready: buildingReady } = useBuilding();
  const { submitted, ready: reportsReady, refresh } = useSubmittedReports();
  const storageReady = buildingReady && reportsReady;

  const runtimeCtx = useMemo(
    () =>
      buildRuntimeBuildingContext(
        ctx,
        submitted,
        buildingId,
        storageReady
      ),
    [ctx, submitted, buildingId, storageReady]
  );

  return {
    ...runtimeCtx,
    buildingId,
    submitted,
    ready: storageReady,
    refreshReports: refresh,
  };
}
