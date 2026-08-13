"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBuilding } from "@/components/BuildingProvider";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterProjectsView from "@/components/master-v2/MasterProjectsView";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import {
  getAllCloudBuildingsWithMeta,
  getAllCloudElevators,
  type CloudBuildingRow,
  type CloudElevatorRow,
} from "@/lib/buildings-cloud";
import {
  buildLiveStartedAtByBuilding,
  filterPilotFaultsByBuildingLiveStart,
} from "@/lib/building-live";
import {
  getAllBuildingIds,
  getStaticDemoBuildingMeta,
  getAllDemoBuildingIds,
} from "@/lib/buildings";
import {
  buildMasterBuildingList,
  summarizeFaultBuildings,
} from "@/lib/master-buildings-list";
import { buildBuildingDossier } from "@/lib/master-building-dossier";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  getAllPilotFaults,
  isMasterAuthenticated,
  isPilotCloudConfigured,
  setMasterAuthenticated,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";

export default function MasterPageContentV2() {
  const { selectBuilding } = useBuilding();
  const [authed, setAuthed] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<CloudBuildingRow[]>([]);
  const [elevatorsByBuilding, setElevatorsByBuilding] = useState<
    Record<string, CloudElevatorRow[]>
  >({});
  const [faults, setFaults] = useState<PilotCloudFault[]>([]);
  const [liveStartedAtByBuilding, setLiveStartedAtByBuilding] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
    setCloudReady(isPilotCloudConfigured());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setCloudLoadError(null);

    const faultRows = cloudReady ? await getAllPilotFaults() : [];
    setFaults(faultRows);

    let rows: CloudBuildingRow[] = [];
    let grouped: Record<string, CloudElevatorRow[]> = {};

    if (cloudReady) {
      const [cloudResult, allElevators] = await Promise.all([
        getAllCloudBuildingsWithMeta(),
        getAllCloudElevators(),
      ]);
      rows = cloudResult.rows;
      if (cloudResult.error) setCloudLoadError(cloudResult.error);
      for (const elevator of allElevators) {
        if (!grouped[elevator.building_id]) grouped[elevator.building_id] = [];
        grouped[elevator.building_id].push(elevator);
      }

      const cloudLiveMap: Record<string, string | null> = {};
      for (const row of rows) {
        cloudLiveMap[row.building_id] = row.live_started_at ?? null;
      }
      setLiveStartedAtByBuilding(
        buildLiveStartedAtByBuilding(getAllBuildingIds(), cloudLiveMap)
      );
    }

    setBuildings(rows);
    setElevatorsByBuilding(grouped);
    setLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  const dossierFaults = useMemo(
    () =>
      filterPilotFaultsByBuildingLiveStart(faults, liveStartedAtByBuilding),
    [faults, liveStartedAtByBuilding]
  );

  const masterBuildingList = useMemo(
    () =>
      buildMasterBuildingList({
        cloudBuildings: buildings,
        demoBuildingIds: getAllDemoBuildingIds(),
        resolveDemoName: (id) => getStaticDemoBuildingMeta(id).name,
        resolveDemoCity: (id) => getStaticDemoBuildingMeta(id).city,
        faultBuildings: summarizeFaultBuildings(dossierFaults),
      }),
    [buildings, dossierFaults]
  );

  const dossierByBuildingId = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof buildBuildingDossier>
    >();
    for (const entry of masterBuildingList) {
      const elevators = elevatorsByBuilding[entry.buildingId] ?? [];
      map.set(
        entry.buildingId,
        buildBuildingDossier({
          buildingId: entry.buildingId,
          buildingName: entry.name,
          faults: dossierFaults,
          registeredElevatorIds: elevators.map((e) => e.elevator_id),
        })
      );
    }
    return map;
  }, [masterBuildingList, elevatorsByBuilding, dossierFaults]);

  function handleRowClick(buildingId: string) {
    selectBuilding(buildingId);
    window.location.assign(buildMasterProjectV2Path(buildingId));
  }

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <MasterShellLayout onLogout={handleLogout}>
      <div className="flex-1 min-w-0 flex flex-col">
        {!cloudReady && (
          <div className="px-8 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            Supabase לא מוגדר — מוצגים נתונים מקומיים בלבד.
          </div>
        )}
        {cloudLoadError && (
          <div className="px-8 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            לא ניתן לטעון בניינים מ-Supabase ({cloudLoadError}).
          </div>
        )}
        <MasterProjectsView
          entries={masterBuildingList}
          dossierByBuildingId={dossierByBuildingId}
          loading={loading}
          onRefresh={() => void refresh()}
          onRowClick={handleRowClick}
        />
      </div>
    </MasterShellLayout>
  );
}
