"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ProjectV2NavTab } from "@/lib/master-project-v2-nav-stack";

interface MasterProjectV2NavContextValue {
  buildingId: string;
  showTabBack: boolean;
  goBack: () => void;
}

const MasterProjectV2NavContext =
  createContext<MasterProjectV2NavContextValue | null>(null);

export function MasterProjectV2NavProvider({
  buildingId,
  activeTab,
  goBack,
  children,
}: {
  buildingId: string;
  activeTab: ProjectV2NavTab;
  goBack: () => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      buildingId,
      showTabBack: Boolean(buildingId) && activeTab !== "details",
      goBack,
    }),
    [activeTab, buildingId, goBack]
  );

  return (
    <MasterProjectV2NavContext.Provider value={value}>
      {children}
    </MasterProjectV2NavContext.Provider>
  );
}

export function useMasterProjectV2Nav(): MasterProjectV2NavContextValue | null {
  return useContext(MasterProjectV2NavContext);
}
