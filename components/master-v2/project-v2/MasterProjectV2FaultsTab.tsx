"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import MasterProjectV2FaultCard from "@/components/master-v2/project-v2/MasterProjectV2FaultCard";
import ProjectDocumentsPanel from "@/components/master-v2/project-v2/ProjectDocumentsPanel";
import {
  ForteV2TabShell,
  MasterProjectV2EmptyState,
  MasterProjectV2SearchInput,
  MasterProjectV2StatusBanner,
  MasterProjectV2Toolbar,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { filterPilotFaultsByBuildingLiveStart, buildLiveStartedAtByBuilding } from "@/lib/building-live";
import { getAllCloudBuildingsWithMeta } from "@/lib/buildings-cloud";
import { getAllBuildingIds } from "@/lib/buildings";
import {
  groupFaultNotificationsByFaultId,
  listFaultNotificationsByBuilding,
  type FaultNotificationRecord,
} from "@/lib/fault-notifications";
import {
  closePilotFault,
  deletePilotFault,
  getAllPilotFaults,
  isPilotCloudConfigured,
  reopenPilotFault,
  startPilotFaultTreatment,
  updatePilotFaultTreatmentNote,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";

function formatCloudDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

interface MasterProjectV2FaultsTabProps {
  buildingId: string;
  highlightFaultId?: string | null;
  onHighlightConsumed?: () => void;
}

export default function MasterProjectV2FaultsTab({
  buildingId,
  highlightFaultId = null,
  onHighlightConsumed,
}: MasterProjectV2FaultsTabProps) {
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();

  const [faults, setFaults] = useState<PilotCloudFault[]>([]);
  const [notificationsByFault, setNotificationsByFault] = useState<
    Record<string, FaultNotificationRecord[]>
  >({});
  const [liveStartedAtByBuilding, setLiveStartedAtByBuilding] = useState<
    Record<string, string | null>
  >({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cloudReady) return;
    setLoading(true);
    const [faultRows, cloudResult, notificationRows] = await Promise.all([
      getAllPilotFaults(),
      getAllCloudBuildingsWithMeta(),
      listFaultNotificationsByBuilding(buildingId),
    ]);
    const cloudLiveMap: Record<string, string | null> = {};
    for (const row of cloudResult.rows) {
      cloudLiveMap[row.building_id] = row.live_started_at ?? null;
    }
    setFaults(faultRows);
    setNotificationsByFault(groupFaultNotificationsByFaultId(notificationRows));
    setLiveStartedAtByBuilding(
      buildLiveStartedAtByBuilding(getAllBuildingIds(), cloudLiveMap)
    );
    setLoading(false);
  }, [cloudReady, buildingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const buildingFaults = useMemo(() => {
    const filtered = filterPilotFaultsByBuildingLiveStart(
      faults,
      liveStartedAtByBuilding
    ).filter((fault) => fault.building_id === buildingId);

    const q = search.trim().toLowerCase();
    if (!q) return filtered;

    return filtered.filter((fault) =>
      [
        fault.fault_type,
        fault.description,
        fault.status,
        fault.elevator_name,
        fault.building_name,
        fault.ticket_number ?? "",
        fault.fault_source ?? "",
        fault.treatment_note ?? "",
        fault.closure_note ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [faults, liveStartedAtByBuilding, buildingId, search]);

  useEffect(() => {
    if (!highlightFaultId || loading) return;

    const faultExists = buildingFaults.some((fault) => fault.id === highlightFaultId);
    if (!faultExists) return;

    setActiveHighlightId(highlightFaultId);

    const scrollFrameId = requestAnimationFrame(() => {
      const element = document.querySelector(
        `[data-fault-id="${highlightFaultId}"]`
      );
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const clearTimeoutId = window.setTimeout(() => {
      setActiveHighlightId(null);
      onHighlightConsumed?.();
    }, 4000);

    return () => {
      cancelAnimationFrame(scrollFrameId);
      window.clearTimeout(clearTimeoutId);
    };
  }, [highlightFaultId, loading, buildingFaults, onHighlightConsumed]);

  async function handleStartTreatment(
    id: string,
    treatmentNote?: string | null
  ) {
    if (!guardSensitiveAction()) return;
    setActionId(id);
    await startPilotFaultTreatment(id, { treatmentNote });
    await refresh();
    setActionId(null);
  }

  async function handleUpdateTreatmentNote(id: string, treatmentNote: string) {
    if (!guardSensitiveAction()) return;
    setActionId(id);
    await updatePilotFaultTreatmentNote(id, treatmentNote);
    await refresh();
    setActionId(null);
  }

  async function handleClose(id: string, closureNote?: string | null) {
    if (!guardSensitiveAction()) return;
    setActionId(id);
    await closePilotFault(id, { closureNote });
    await refresh();
    setActionId(null);
  }

  async function handleReopen(id: string) {
    if (!guardSensitiveAction()) return;
    setActionId(id);
    await reopenPilotFault(id);
    await refresh();
    setActionId(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("למחוק דיווח זה מהענן?")) return;
    if (!guardSensitiveAction()) return;
    setActionId(id);
    await deletePilotFault(id);
    await refresh();
    setActionId(null);
  }

  return (
    <ForteV2TabShell
      workspace="project-v2-faults"
      title="תקלות"
      description="דיווחי תקלה, טיפול וסגירה"
    >
      <MasterProjectV2Toolbar
        inner
        search={<MasterProjectV2SearchInput value={search} onChange={setSearch} />}
        actions={null}
      />

      {!cloudReady && (
        <MasterProjectV2StatusBanner tone="warning">
          Supabase לא מחובר — לא ניתן לטעון תקלות.
        </MasterProjectV2StatusBanner>
      )}

      {loading ? (
        <p className="text-xs text-forte-text-secondary py-6 text-center">טוען תקלות...</p>
      ) : buildingFaults.length === 0 ? (
        <MasterProjectV2EmptyState
          title="אין תקלות בפרויקט."
          description="לא נרשמו דיווחי תקלה עבור פרויקט זה."
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-auto pt-2 space-y-2">
          {buildingFaults.map((fault) => (
            <MasterProjectV2FaultCard
              key={fault.id}
              fault={fault}
              highlighted={activeHighlightId === fault.id}
              notifications={notificationsByFault[fault.id] ?? []}
              actionId={actionId}
              formatDate={formatCloudDate}
              onStartTreatment={(faultId, note) =>
                void handleStartTreatment(faultId, note)
              }
              onUpdateTreatmentNote={(faultId, note) =>
                void handleUpdateTreatmentNote(faultId, note)
              }
              onClose={(faultId, note) => void handleClose(faultId, note)}
              onReopen={(faultId) => void handleReopen(faultId)}
              onDelete={(faultId) => void handleDelete(faultId)}
            />
          ))}
        </div>
      )}

      <ProjectDocumentsPanel buildingId={buildingId} section="faults" />
    </ForteV2TabShell>
  );
}
