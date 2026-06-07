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
  BUILDINGS_CATALOG_UPDATED_EVENT,
} from "@/lib/buildings-catalog";
import {
  DEFAULT_BUILDING_ID,
  ensureBuildingCatalogLoaded,
  getBuildingDataset,
  getDemoDatasets,
} from "@/lib/buildings";
import {
  getStoredBuildingId,
  setStoredBuildingId,
} from "@/lib/building-storage";
import type { BuildingDataContext } from "@/lib/types";

interface BuildingContextValue {
  buildingId: string;
  ctx: BuildingDataContext;
  selectBuilding: (id: string) => void;
  ready: boolean;
  catalogReady: boolean;
}

const BuildingContext = createContext<BuildingContextValue | null>(null);

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const [buildingId, setBuildingId] = useState(DEFAULT_BUILDING_ID);
  const [ready, setReady] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);

  const loadCatalog = useCallback(async () => {
    await ensureBuildingCatalogLoaded(getDemoDatasets());
    setCatalogReady(true);
    setCatalogVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setBuildingId(getStoredBuildingId());
    setReady(true);
    void loadCatalog();

    function onBuildingChanged(e: Event) {
      const detail = (e as CustomEvent<{ buildingId: string }>).detail;
      if (detail?.buildingId) setBuildingId(detail.buildingId);
    }

    function onCatalogUpdated() {
      void loadCatalog();
    }

    window.addEventListener("forte-building-changed", onBuildingChanged);
    window.addEventListener(BUILDINGS_CATALOG_UPDATED_EVENT, onCatalogUpdated);
    return () => {
      window.removeEventListener("forte-building-changed", onBuildingChanged);
      window.removeEventListener(
        BUILDINGS_CATALOG_UPDATED_EVENT,
        onCatalogUpdated
      );
    };
  }, [loadCatalog]);

  const selectBuilding = useCallback((id: string) => {
    setStoredBuildingId(id);
    setBuildingId(id);
  }, []);

  const ctx = useMemo(
    () => getBuildingDataset(buildingId),
    [buildingId, catalogVersion]
  );

  const value = useMemo(
    () => ({ buildingId, ctx, selectBuilding, ready, catalogReady }),
    [buildingId, ctx, selectBuilding, ready, catalogReady]
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
