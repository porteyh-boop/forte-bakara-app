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
  getAllDemoBuildingIds,
  getStaticDemoBuildingMeta,
} from "@/lib/buildings";
import {
  buildMasterBuildingList,
  type FaultBuildingSummary,
} from "@/lib/master-buildings-list";
import type { BuildingDossier } from "@/lib/master-building-dossier";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  isMasterFaultAggregatesApiConfigured,
  listMasterFaultAggregates,
  type MasterFaultAggregateDto,
} from "@/lib/master-fault-aggregates-api";
import {
  isMasterAuthenticated,
  isPilotCloudConfigured,
  setMasterAuthenticated,
} from "@/lib/pilot-cloud";

function buildStubDossier(
  buildingId: string,
  buildingName: string,
  elevatorCount: number,
  lastFaultDate: string | null
): BuildingDossier {
  return {
    buildingId,
    buildingName,
    totalFaults: 0,
    openFaults: 0,
    closedFaults: 0,
    elevatorCount,
    faultsByElevator: [],
    lastFaultDate,
    healthScore: 100,
    healthLevel: "green",
    recurringCount: 0,
    faults: [],
  };
}

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
  const [faultAggregates, setFaultAggregates] = useState<
    MasterFaultAggregateDto[]
  >([]);

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

    const aggregates =
      cloudReady && isMasterFaultAggregatesApiConfigured()
        ? await listMasterFaultAggregates()
        : [];
    setFaultAggregates(aggregates);

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
    }

    setBuildings(rows);
    setElevatorsByBuilding(grouped);
    setLoading(false);
  }, [cloudReady]);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  const faultBuildings = useMemo<FaultBuildingSummary[]>(
    () =>
      faultAggregates.map((aggregate) => ({
        buildingId: aggregate.buildingId,
        buildingName: aggregate.buildingName,
      })),
    [faultAggregates]
  );

  const aggregateByBuildingId = useMemo(() => {
    const map = new Map<string, MasterFaultAggregateDto>();
    for (const aggregate of faultAggregates) {
      map.set(aggregate.buildingId, aggregate);
    }
    return map;
  }, [faultAggregates]);

  const masterBuildingList = useMemo(
    () =>
      buildMasterBuildingList({
        cloudBuildings: buildings,
        demoBuildingIds: getAllDemoBuildingIds(),
        resolveDemoName: (id) => getStaticDemoBuildingMeta(id).name,
        resolveDemoCity: (id) => getStaticDemoBuildingMeta(id).city,
        faultBuildings,
      }),
    [buildings, faultBuildings]
  );

  const dossierByBuildingId = useMemo(() => {
    const map = new Map<string, BuildingDossier>();
    for (const entry of masterBuildingList) {
      const elevators = elevatorsByBuilding[entry.buildingId] ?? [];
      const aggregate = aggregateByBuildingId.get(entry.buildingId);
      map.set(
        entry.buildingId,
        buildStubDossier(
          entry.buildingId,
          entry.name,
          elevators.length,
          aggregate?.lastFaultDate ?? null
        )
      );
    }
    return map;
  }, [masterBuildingList, elevatorsByBuilding, aggregateByBuildingId]);

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
