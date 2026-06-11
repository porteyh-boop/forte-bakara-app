"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ElevatorStatusRow from "@/components/ElevatorStatusRow";
import HistoryList from "@/components/HistoryList";
import PageHeader from "@/components/PageHeader";
import SectionTitle from "@/components/SectionTitle";
import ClientAccessReportForm from "@/components/ClientAccessReportForm";
import { isAfterLiveStart, resolveLiveStartedAt } from "@/lib/building-live";
import { getBuildingDataset } from "@/lib/buildings";
import { getAllCloudElevators } from "@/lib/buildings-cloud";
import {
  getClientAccessByToken,
  getClientAccessGateMessage,
  resolveClientAccessGate,
  scopeElevatorsForClientAccess,
  scopeFaultsForClientAccess,
  type ClientAccessSession,
} from "@/lib/client-access";
import { isClosedFault, isOpenFault } from "@/lib/fault-lifecycle";
import { getAllElevatorFaultCounts } from "@/lib/elevator-stats";
import {
  getAllPilotFaults,
  getPilotFaultsForBuilding,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";
import type { Elevator, Fault, FaultStatus, FaultType } from "@/lib/types";

type ClientTab = "overview" | "history" | "report";

function mapPilotFaultToClientFault(fault: PilotCloudFault): Fault {
  return {
    id: fault.id,
    elevatorId: fault.elevator_id,
    elevatorName: fault.elevator_name,
    type: fault.fault_type as FaultType,
    description: fault.description,
    status: fault.status as FaultStatus,
    priority: "רגילה",
    reportedAt: fault.created_at,
    resolvedAt: fault.closed_at ?? undefined,
    ticketNumber: fault.ticket_number ?? undefined,
    isDisabled: fault.is_disabled,
  };
}

function mergeBuildingFaults(
  buildingId: string,
  buildingName: string,
  cloudFaults: PilotCloudFault[]
): PilotCloudFault[] {
  const merged = [...cloudFaults];
  const seen = new Set(merged.map((fault) => fault.id));

  try {
    const demoFaults = getBuildingDataset(buildingId).faults.map((fault) => ({
      id: fault.id,
      building_id: buildingId,
      building_name: buildingName,
      elevator_id: fault.elevatorId,
      elevator_name: fault.elevatorName,
      fault_type: fault.type,
      description: fault.description,
      is_disabled: fault.isDisabled ?? false,
      status: fault.status,
      ticket_number: fault.ticketNumber ?? null,
      image_data: null,
      image_url: null,
      created_at: fault.reportedAt,
      closed_at: fault.resolvedAt ?? null,
      source_device_id: null,
    }));
    for (const fault of demoFaults) {
      if (!seen.has(fault.id)) merged.push(fault);
    }
  } catch {
    /* building not in demo catalog */
  }

  return merged;
}

interface ClientAccessPageContentProps {
  token: string;
}

export default function ClientAccessPageContent({
  token,
}: ClientAccessPageContentProps) {
  const [tab, setTab] = useState<ClientTab>("overview");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ClientAccessSession | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [buildingName, setBuildingName] = useState("");
  const [scopeLabel, setScopeLabel] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadScopedData = useCallback(async () => {
    setLoading(true);
    const loadedSession = await getClientAccessByToken(token);
    const gate = resolveClientAccessGate(loadedSession);

    if (gate !== "ok" || !loadedSession) {
      setSession(null);
      setGateMessage(getClientAccessGateMessage(gate));
      setElevators([]);
      setFaults([]);
      setLoading(false);
      return;
    }

    setSession(loadedSession);
    setGateMessage(null);

    const { building_id: buildingId, access_level, elevator_id } =
      loadedSession.access;

    let ctx;
    try {
      ctx = getBuildingDataset(buildingId);
    } catch {
      setGateMessage("קישור לא תקין");
      setLoading(false);
      return;
    }

    setBuildingName(ctx.building.name);

    const cloudElevators = await getAllCloudElevators();
    const cloudForBuilding = cloudElevators.filter(
      (elevator) => elevator.building_id === buildingId
    );

    const baseElevators =
      cloudForBuilding.length > 0
        ? cloudForBuilding.map((elevator) => ({
            id: elevator.elevator_id,
            name: elevator.elevator_name,
            status: elevator.status as Elevator["status"],
            stations: elevator.floors_count ?? 0,
          }))
        : ctx.elevators;

    const scopedElevators = scopeElevatorsForClientAccess(
      baseElevators,
      loadedSession.access
    );

    const cloudFaults =
      (await getPilotFaultsForBuilding(buildingId)) ??
      (await getAllPilotFaults()).filter(
        (fault) => fault.building_id === buildingId
      );

    const mergedFaults = mergeBuildingFaults(
      buildingId,
      ctx.building.name,
      cloudFaults
    );
    const liveStartedAt = resolveLiveStartedAt(buildingId);
    const liveFiltered = liveStartedAt
      ? mergedFaults.filter((fault) =>
          isAfterLiveStart(fault.created_at, liveStartedAt)
        )
      : mergedFaults;
    const scopedFaults = scopeFaultsForClientAccess(
      liveFiltered,
      loadedSession.access
    ).map(mapPilotFaultToClientFault);

    setElevators(scopedElevators);
    setFaults(scopedFaults);
    setScopeLabel(
      access_level === "elevator" && elevator_id
        ? scopedElevators[0]?.name ?? elevator_id
        : "כל הבניין"
    );
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadScopedData();
  }, [loadScopedData, refreshKey]);

  const openFaults = useMemo(
    () => faults.filter((fault) => isOpenFault(fault)),
    [faults]
  );
  const closedFaults = useMemo(
    () => faults.filter((fault) => isClosedFault(fault)),
    [faults]
  );
  const faultCounts = useMemo(
    () => getAllElevatorFaultCounts(elevators, faults),
    [elevators, faults]
  );

  const buildingStatus = useMemo(() => {
    if (elevators.some((elevator) => elevator.status === "מושבתת")) {
      return "מושבתת";
    }
    if (elevators.some((elevator) => elevator.status === "בטיפול")) {
      return "בטיפול";
    }
    return "פעילה";
  }, [elevators]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
        <p className="text-sm text-gray-text">טוען גישת לקוח...</p>
      </div>
    );
  }

  if (gateMessage) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-bold text-navy">גישת לקוח</h1>
          <p className="text-sm text-gray-text">{gateMessage}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-light pb-8">
      <PageHeader
        title={buildingName}
        subtitle={`גישה אישית · ${scopeLabel}`}
        badge={buildingStatus}
      />

      <main className="max-w-lg mx-auto px-4 space-y-4 page-content -mt-2">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <p className="text-sm text-gray-text">
            שלום {session.user.name}, להלן המידע שהוקצה לכם בלבד.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
              <p className="text-[11px] text-gray-text">תקלות פתוחות</p>
              <p className="text-lg font-bold text-navy">{openFaults.length}</p>
            </div>
            <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
              <p className="text-[11px] text-gray-text">תקלות סגורות</p>
              <p className="text-lg font-bold text-navy">
                {closedFaults.length}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "סקירה"],
              ["history", "היסטוריית דיווחים"],
              ["report", "דיווח תקלה"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 min-w-[6rem] rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                tab === key
                  ? "bg-navy text-white"
                  : "bg-white border border-gray-200 text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <section className="space-y-4">
            <SectionTitle title="סטטוס מעליות" />
            <ElevatorStatusRow
              elevators={elevators}
              faultCounts={faultCounts}
            />
          </section>
        )}

        {tab === "history" && (
          <section className="space-y-3">
            <SectionTitle title="היסטוריית דיווחים" />
            <HistoryList faults={faults} />
          </section>
        )}

        {tab === "report" && (
          <section className="space-y-3">
            <SectionTitle title="דיווח תקלה" />
            <ClientAccessReportForm
              buildingId={session.access.building_id}
              buildingName={buildingName}
              elevators={elevators}
              lockedElevatorId={
                session.access.access_level === "elevator"
                  ? session.access.elevator_id
                  : null
              }
              onSubmitted={() => setRefreshKey((value) => value + 1)}
            />
          </section>
        )}
      </main>
    </div>
  );
}
