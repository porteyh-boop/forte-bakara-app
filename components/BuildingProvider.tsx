"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_BUILDING_ID, getBuildingDataset } from "@/lib/buildings";
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
}

const BuildingContext = createContext<BuildingContextValue | null>(null);

export function BuildingProvider({ children }: { children: React.ReactNode }) {
  const [buildingId, setBuildingId] = useState(DEFAULT_BUILDING_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBuildingId(getStoredBuildingId());
    setReady(true);

    function onBuildingChanged(e: Event) {
      const detail = (e as CustomEvent<{ buildingId: string }>).detail;
      if (detail?.buildingId) setBuildingId(detail.buildingId);
    }

    window.addEventListener("forte-building-changed", onBuildingChanged);
    return () =>
      window.removeEventListener("forte-building-changed", onBuildingChanged);
  }, []);

  const selectBuilding = useCallback((id: string) => {
    setStoredBuildingId(id);
    setBuildingId(id);
  }, []);

  const ctx = useMemo(() => getBuildingDataset(buildingId), [buildingId]);

  const value = useMemo(
    () => ({ buildingId, ctx, selectBuilding, ready }),
    [buildingId, ctx, selectBuilding, ready]
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
