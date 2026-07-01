"use client";

import { useCallback, useEffect, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import { BUILDINGS_CATALOG_UPDATED_EVENT } from "@/lib/buildings-catalog";
import {
  getCachedLiveStartedAt,
  resolveLiveStartedAt,
  setCachedLiveStartedAt,
} from "@/lib/building-live";
import { resolveLiveStartedAtForBuilding } from "@/lib/report-cloud-sync";

export const BUILDING_LIVE_STARTED_EVENT = "forte-building-live-started";

export function useBuildingLiveStarted() {
  const { buildingId, isReady } = useBuilding();
  const [liveStartedAt, setLiveStartedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!isReady) return;

    const fromCatalog = resolveLiveStartedAt(buildingId);
    if (fromCatalog) {
      setLiveStartedAt(fromCatalog);
      setReady(true);
      return;
    }

    const fromCache = getCachedLiveStartedAt(buildingId);
    if (fromCache) {
      setLiveStartedAt(fromCache);
    }

    const fromCloud = await resolveLiveStartedAtForBuilding(buildingId);
    setLiveStartedAt(fromCloud);
    setReady(true);
  }, [buildingId, isReady]);

  useEffect(() => {
    if (!isReady) {
      setLiveStartedAt(null);
      setReady(false);
      return;
    }

    setReady(false);
    void refresh();

    function onLiveStarted(e: Event) {
      const detail = (e as CustomEvent<{ buildingId?: string; liveStartedAt?: string }>)
        .detail;
      if (detail?.buildingId && detail.buildingId !== buildingId) return;
      if (detail?.liveStartedAt) {
        setCachedLiveStartedAt(buildingId, detail.liveStartedAt);
        setLiveStartedAt(detail.liveStartedAt);
        setReady(true);
        return;
      }
      void refresh();
    }

    function onCatalogUpdated() {
      void refresh();
    }

    window.addEventListener(BUILDING_LIVE_STARTED_EVENT, onLiveStarted);
    window.addEventListener(BUILDINGS_CATALOG_UPDATED_EVENT, onCatalogUpdated);
    return () => {
      window.removeEventListener(BUILDING_LIVE_STARTED_EVENT, onLiveStarted);
      window.removeEventListener(
        BUILDINGS_CATALOG_UPDATED_EVENT,
        onCatalogUpdated
      );
    };
  }, [buildingId, isReady, refresh]);

  return { liveStartedAt, ready: isReady && ready, refresh };
}
