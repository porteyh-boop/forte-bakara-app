"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  isKnownBuildingId,
  resolveActiveBuildingId,
} from "@/lib/active-building";
import {
  readPersistedBuildingId,
  writePersistedBuildingId,
} from "@/lib/building-persistence";
import {
  BUILDINGS_CATALOG_UPDATED_EVENT,
  getCatalogSnapshot,
} from "@/lib/buildings-catalog";
import { normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  DEFAULT_BUILDING_ID,
  ensureBuildingCatalogLoaded,
  getAllDemoBuildingIds,
  getBuildingDataset,
  getDemoDatasets,
} from "@/lib/buildings";
import type { BuildingDataContext } from "@/lib/types";

interface BuildingContextValue {
  buildingId: string;
  ctx: BuildingDataContext;
  selectBuilding: (id: string) => void;
  /** True after catalog load + single active-building sync */
  isReady: boolean;
  /** @deprecated Use isReady */
  catalogReady: boolean;
  /** @deprecated Use isReady */
  ready: boolean;
}

const BuildingContext = createContext<BuildingContextValue | null>(null);

function syncActiveBuildingFromPersistence(): string {
  const catalog = getCatalogSnapshot();
  const demoIds = getAllDemoBuildingIds();
  const resolved = resolveActiveBuildingId(
    readPersistedBuildingId(),
    catalog,
    demoIds
  );
  writePersistedBuildingId(resolved);
  return resolved;
}

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const [buildingId, setBuildingId] = useState(DEFAULT_BUILDING_ID);
  const [isReady, setIsReady] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);

  const applySyncedBuilding = useCallback((resolvedId: string) => {
    setBuildingId(resolvedId);
    setCatalogVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await ensureBuildingCatalogLoaded(getDemoDatasets());
      if (cancelled) return;
      const resolved = syncActiveBuildingFromPersistence();
      applySyncedBuilding(resolved);
      setIsReady(true);
    })();

    function onCatalogUpdated() {
      void (async () => {
        await ensureBuildingCatalogLoaded(getDemoDatasets());
        if (cancelled) return;
        const resolved = syncActiveBuildingFromPersistence();
        applySyncedBuilding(resolved);
        setIsReady(true);
      })();
    }

    function onBuildingChanged() {
      if (cancelled) return;
      const resolved = syncActiveBuildingFromPersistence();
      applySyncedBuilding(resolved);
    }

    window.addEventListener(BUILDINGS_CATALOG_UPDATED_EVENT, onCatalogUpdated);
    window.addEventListener("forte-building-changed", onBuildingChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        BUILDINGS_CATALOG_UPDATED_EVENT,
        onCatalogUpdated
      );
      window.removeEventListener("forte-building-changed", onBuildingChanged);
    };
  }, [applySyncedBuilding]);

  const selectBuilding = useCallback(
    (id: string) => {
      const normalized = normalizeBuildingId(id);
      const catalog = getCatalogSnapshot();
      if (!isKnownBuildingId(normalized, catalog, getAllDemoBuildingIds())) {
        return;
      }
      writePersistedBuildingId(normalized);
      setBuildingId(normalized);
      setCatalogVersion((v) => v + 1);
    },
    []
  );

  const ctx = useMemo(
    () => getBuildingDataset(buildingId),
    [buildingId, catalogVersion]
  );

  const value = useMemo(
    () => ({
      buildingId,
      ctx,
      selectBuilding,
      isReady,
      catalogReady: isReady,
      ready: isReady,
    }),
    [buildingId, ctx, selectBuilding, isReady]
  );

  return (
    <BuildingContext.Provider value={value}>{children}</BuildingContext.Provider>
  );
}

export function useBuilding(): BuildingContextValue {
  const context = useContext(BuildingContext);
  if (!context) {
    throw new Error("useBuilding must be used within BuildingProvider");
  }
  return context;
}
