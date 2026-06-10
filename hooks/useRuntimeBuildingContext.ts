"use client";

import { useMemo } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { buildRuntimeBuildingContext } from "@/lib/data";
import { useBuildingLiveStarted } from "./useBuildingLiveStarted";
import { useSubmittedReports } from "./useSubmittedReports";

export function useRuntimeBuildingContext() {
  const { buildingId, ctx, ready: buildingReady } = useBuilding();
  const { liveStartedAt, ready: liveReady } = useBuildingLiveStarted();
  const { submitted, ready: reportsReady, refresh } = useSubmittedReports(
    liveStartedAt
  );
  const storageReady = buildingReady && liveReady && reportsReady;

  const runtimeCtx = useMemo(
    () =>
      buildRuntimeBuildingContext(
        ctx,
        submitted,
        buildingId,
        storageReady,
        liveStartedAt
      ),
    [ctx, submitted, buildingId, storageReady, liveStartedAt]
  );

  return {
    ...runtimeCtx,
    buildingId,
    submitted,
    liveStartedAt,
    ready: storageReady,
    refreshReports: refresh,
  };
}
