"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import {
  getAllCloudElevators,
  type CloudElevatorRow,
} from "@/lib/buildings-cloud";
import {
  getBuildingDataset,
  getStaticDemoBuildingMeta,
} from "@/lib/buildings";
import {
  buildElevatorDossier,
  formatDossierDate,
} from "@/lib/master-building-dossier";
import {
  clearElevatorFaultFilters,
  DEFAULT_ELEVATOR_FAULT_FILTERS,
  ELEVATOR_FAULT_PERIOD_OPTIONS,
  ELEVATOR_FAULT_STATUS_OPTIONS,
  filterElevatorDossierFaults,
  getUniqueFaultTypesFromFaults,
  isElevatorFaultFilterActive,
  type ElevatorFaultFilters,
} from "@/lib/master-elevator-fault-filters";
import { buildMasterElevatorDossierPath } from "@/lib/master-elevator-routes";
import {
  getAllPilotFaults,
  isMasterAuthenticated,
  isMasterCodeConfigured,
  isPilotCloudConfigured,
  setMasterAuthenticated,
  verifyMasterCode,
  type PilotCloudFault,
} from "@/lib/pilot-cloud";
import type { Fault } from "@/lib/types";

function mapDemoFaultToPilot(
  fault: Fault,
  buildingId: string,
  buildingName: string
): PilotCloudFault {
  return {
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
    fault_source: null,
  };
}

function MasterCodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isMasterCodeConfigured()) {
      setError("קוד גישה לא הוגדר במערכת (NEXT_PUBLIC_MASTER_CODE).");
      return;
    }
    if (!verifyMasterCode(code)) {
      setError("קוד גישה שגוי.");
      return;
    }
    setMasterAuthenticated(true);
    onSuccess();
  }

  return (
    <div className="min-h-screen bg-gray-light flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-navy mb-1">גישה למסך ניהול פיילוט</h1>
        <p className="text-sm text-gray-text mb-4">הזינו קוד גישה פנימי</p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="קוד גישה"
          className="form-input mb-3"
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button type="submit" className="btn-primary w-full">
          כניסה
        </button>
      </form>
    </div>
  );
}

function DossierKpi({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
      <p className="text-[11px] text-gray-text">{label}</p>
      <p
        className={`font-bold text-navy mt-0.5 ${small ? "text-xs" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}

interface MasterElevatorDossierPageContentProps {
  buildingId: string;
  elevatorId: string;
}

export default function MasterElevatorDossierPageContent({
  buildingId,
  elevatorId,
}: MasterElevatorDossierPageContentProps) {
  const [authed, setAuthed] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [faults, setFaults] = useState<PilotCloudFault[]>([]);
  const [cloudElevator, setCloudElevator] = useState<CloudElevatorRow | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [faultFilters, setFaultFilters] = useState<ElevatorFaultFilters>(
    DEFAULT_ELEVATOR_FAULT_FILTERS
  );

  const buildingName = useMemo(() => {
    const fromDemo = getStaticDemoBuildingMeta(buildingId).name;
    if (fromDemo !== buildingId) return fromDemo;
    return (
      faults.find((f) => f.building_id === buildingId)?.building_name ??
      buildingId
    );
  }, [buildingId, faults]);

  const refresh = useCallback(async () => {
    setLoading(true);
    let loaded: PilotCloudFault[] = [];

    if (isPilotCloudConfigured()) {
      loaded = await getAllPilotFaults();
      const elevators = await getAllCloudElevators();
      setCloudElevator(
        elevators.find(
          (e) => e.building_id === buildingId && e.elevator_id === elevatorId
        ) ?? null
      );
    }

    try {
      const demo = getBuildingDataset(buildingId);
      const demoFaults = demo.faults.map((f) =>
        mapDemoFaultToPilot(f, buildingId, demo.building.name)
      );
      const seen = new Set(loaded.map((f) => f.id));
      for (const f of demoFaults) {
        if (!seen.has(f.id)) loaded.push(f);
      }
    } catch {
      /* building not in demo catalog */
    }

    setFaults(loaded);
    setLoading(false);
  }, [buildingId, elevatorId]);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
    setCloudReady(isPilotCloudConfigured());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void refresh();
  }, [authed, refresh]);

  const demoElevator = useMemo(() => {
    try {
      return getBuildingDataset(buildingId).elevators.find(
        (e) => e.id === elevatorId
      );
    } catch {
      return undefined;
    }
  }, [buildingId, elevatorId]);

  const elevatorName =
    cloudElevator?.elevator_name ??
    demoElevator?.name ??
    faults.find(
      (f) => f.building_id === buildingId && f.elevator_id === elevatorId
    )?.elevator_name ??
    elevatorId;

  const elevatorStatus =
    cloudElevator?.status ?? demoElevator?.status ?? "—";

  const stations =
    cloudElevator?.floors_count ?? demoElevator?.stations ?? null;

  const dossier = useMemo(
    () =>
      buildElevatorDossier({
        buildingId,
        elevatorId,
        elevatorName,
        faults,
      }),
    [buildingId, elevatorId, elevatorName, faults]
  );

  const faultTypeOptions = useMemo(
    () => getUniqueFaultTypesFromFaults(dossier.faults),
    [dossier.faults]
  );

  const filteredFaults = useMemo(
    () => filterElevatorDossierFaults(dossier.faults, faultFilters),
    [dossier.faults, faultFilters]
  );

  const filterActive = isElevatorFaultFilterActive(faultFilters);

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-light pb-8">
      <PageHeader title="תיק מעלית" subtitle={buildingName} master />

      <main className="mx-auto w-full max-w-lg px-5 pb-8 md:max-w-7xl md:px-8 -mt-2 space-y-4 md:space-y-6">
        <Link
          href="/master"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline cursor-pointer"
        >
          ← חזרה ל-Master
        </Link>

        {loading ? (
          <p className="text-sm text-gray-text">טוען תיק מעלית...</p>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gold/30 p-4 space-y-3">
              <div>
                <h2 className="text-base font-bold text-navy">
                  {elevatorName}
                </h2>
                <p className="text-xs text-gray-text mt-0.5">
                  {buildingName} · {buildingId} · {elevatorId}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                <DossierKpi label="סטטוס מעלית" value={elevatorStatus} small />
                <DossierKpi
                  label="מספר תחנות"
                  value={stations ?? "—"}
                />
                <DossierKpi label='סה"כ תקלות' value={dossier.totalFaults} />
                <DossierKpi
                  label="תקלה אחרונה"
                  value={formatDossierDate(dossier.lastFaultDate)}
                  small
                />
                <DossierKpi label="פתוחות" value={dossier.openFaults} />
                <DossierKpi label="סגורות" value={dossier.closedFaults} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-bold text-navy">
                היסטוריית תקלות — {elevatorName}
              </h3>
              {dossier.faults.length === 0 ? (
                <p className="text-sm text-gray-text">אין תקלות רשומות.</p>
              ) : (
                <>
                  <div className="bg-gray-light rounded-xl border border-gray-200 p-3 space-y-3">
                    <p className="text-xs font-semibold text-gold">
                      סינון היסטוריית תקלות
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-gray-text">סטטוס תקלה</label>
                        <select
                          value={faultFilters.status}
                          onChange={(e) =>
                            setFaultFilters((prev) => ({
                              ...prev,
                              status: e.target
                                .value as ElevatorFaultFilters["status"],
                            }))
                          }
                          className="form-input mt-1"
                        >
                          {ELEVATOR_FAULT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-text">סוג תקלה</label>
                        <select
                          value={faultFilters.faultType}
                          onChange={(e) =>
                            setFaultFilters((prev) => ({
                              ...prev,
                              faultType: e.target.value,
                            }))
                          }
                          className="form-input mt-1"
                        >
                          <option value="all">הכל</option>
                          {faultTypeOptions.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-text">תקופה</label>
                        <select
                          value={faultFilters.period}
                          onChange={(e) =>
                            setFaultFilters((prev) => ({
                              ...prev,
                              period: e.target
                                .value as ElevatorFaultFilters["period"],
                            }))
                          }
                          className="form-input mt-1"
                        >
                          {ELEVATOR_FAULT_PERIOD_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-text">
                          חיפוש בתיאור
                        </label>
                        <input
                          type="search"
                          value={faultFilters.searchQuery}
                          onChange={(e) =>
                            setFaultFilters((prev) => ({
                              ...prev,
                              searchQuery: e.target.value,
                            }))
                          }
                          placeholder="חיפוש לפי תיאור התקלה"
                          className="form-input mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-gray-text">
                        מוצגות {filteredFaults.length} מתוך{" "}
                        {dossier.faults.length} תקלות
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setFaultFilters(clearElevatorFaultFilters())
                        }
                        disabled={!filterActive}
                        className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        נקה סינון
                      </button>
                    </div>
                  </div>

                  {filteredFaults.length === 0 ? (
                    <p className="text-sm text-gray-text">
                      לא נמצאו תקלות בהתאם לסינון שנבחר
                    </p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full min-w-[32rem] text-sm">
                        <thead>
                          <tr className="text-xs text-gray-text border-b border-gray-200">
                            <th className="text-right py-2 px-2 font-semibold">
                              תאריך
                            </th>
                            <th className="text-right py-2 px-2 font-semibold">
                              סוג תקלה
                            </th>
                            <th className="text-right py-2 px-2 font-semibold">
                              תיאור
                            </th>
                            <th className="text-right py-2 px-2 font-semibold">
                              סטטוס
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFaults.map((f) => (
                            <tr
                              key={f.id}
                              className="border-b border-gray-100 align-top"
                            >
                              <td className="py-2 px-2 whitespace-nowrap text-xs">
                                {formatDossierDate(f.created_at)}
                              </td>
                              <td className="py-2 px-2 text-xs">
                                {f.fault_type}
                              </td>
                              <td className="py-2 px-2 text-xs text-navy/80 max-w-[14rem]">
                                {f.description}
                              </td>
                              <td className="py-2 px-2 text-xs font-semibold">
                                {f.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="text-[11px] text-gray-text">
              נתיב: {buildMasterElevatorDossierPath(buildingId, elevatorId)}
              {!cloudReady ? " · מצב דמו" : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
