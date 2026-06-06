"use client";

import { useMemo, useState } from "react";
import HistoryList from "@/components/HistoryList";
import PageHeader from "@/components/PageHeader";
import { useBuilding } from "@/components/BuildingProvider";
import { useRuntimeBuildingContext } from "@/hooks/useRuntimeBuildingContext";
import { isOpenFault } from "@/lib/fault-lifecycle";
import { closePilotFaultByTicket } from "@/lib/pilot-cloud";
import { closeFault } from "@/lib/report-storage";
import type { Fault } from "@/lib/types";

export default function HistoryPageContent() {
  const { buildingId, ctx } = useBuilding();
  const { faults: allFaults, ready, refreshReports } = useRuntimeBuildingContext();
  const [closingFaultId, setClosingFaultId] = useState<string | null>(null);

  const openCount = useMemo(
    () => allFaults.filter((f) => isOpenFault(f)).length,
    [allFaults]
  );

  function handleCloseFault(fault: Fault) {
    setClosingFaultId(fault.id);
    closeFault(fault, buildingId);
    void closePilotFaultByTicket(fault.ticketNumber, buildingId);
    refreshReports();
    setTimeout(() => setClosingFaultId(null), 400);
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-light">
        <PageHeader
          title="היסטוריית תקלות"
          subtitle="טוען נתונים..."
          badge={ctx.building.name}
        />
        <main className="page-content -mt-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-pulse">
            <p className="text-sm text-gray-text">טוען היסטוריית תקלות...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="היסטוריית תקלות"
        subtitle={`${allFaults.length} תקלות רשומות · ${openCount} פתוחות`}
        badge={ctx.building.name}
      />

      <main className="page-content -mt-2">
        <HistoryList
          faults={allFaults}
          onCloseFault={handleCloseFault}
          closingFaultId={closingFaultId}
        />
      </main>
    </div>
  );
}
